import type { APIRoute } from 'astro';
import { getDb } from '../../../server/db/mongo';
import {
  validateUploadFile,
  reserveUploadCapacity,
  generateStorageKey,
  uploadObjectToStorage,
  validateMagicBytes,
  scanBufferForThreats,
  computeFileChecksum,
} from '../../../server/storage/storage';
import { createResource } from '../../../server/repositories/resourceRepository';
import { fulfillResourceRequest } from '../../../server/repositories/requestRepository';
import { awardReputation, REPUTATION_REWARDS } from '../../../server/reputation/reputationService';
import { createNotification } from '../../../server/notifications/notificationService';
import { isUploadRateLimited } from '../../../server/security/rateLimiter';
import type { Resource, ResourceCategory } from '../../../types';

export const POST: APIRoute = async ({ request, locals }) => {
  // 1. Enforce server-side authentication
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'You must be logged in to upload resources.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Enforce user restrictions
  if (user.restrictions?.uploadsBlocked) {
    return new Response(JSON.stringify({ error: 'Your account has been restricted from uploading resources.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. Sliding-window rate limit check
  const rateLimit = isUploadRateLimited(user.id);
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        error: `Upload rate limit reached. Please wait ${rateLimit.resetSeconds} seconds before uploading more materials.`,
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const formData = await request.formData();

    const file = formData.get('file') as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: 'Please select a document or file to upload.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Optional requestId if student is fulfilling a peer request
    const requestId = formData.get('requestId')?.toString().trim();

    // Auto title if not provided
    const rawTitle = formData.get('title')?.toString().trim();
    const title = rawTitle || file.name.replace(/\.[^/.]+$/, '');

    // Subject extraction & normalization for automatic subject folder grouping
    const rawSubject = (formData.get('subjectName')?.toString() || formData.get('subjectId')?.toString() || 'General Studies').trim();
    let subjectSlug = rawSubject.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'general';
    if (subjectSlug === 'artificial-intelligence' || subjectSlug === 'ai-ml') {
      subjectSlug = 'ai';
    }

    const description = formData.get('description')?.toString().trim() || `Academic material for ${rawSubject}`;
    const universityId = formData.get('universityId')?.toString().trim() || 'parul-university';
    const facultyId = formData.get('facultyId')?.toString().trim() || 'engineering-technology';
    const programId = formData.get('programId')?.toString().trim() || 'prog-btech-cse';
    const academicTermId = formData.get('academicTermId')?.toString().trim() || 'term-1';
    const category = (formData.get('category')?.toString().trim() as ResourceCategory) || 'Notes';
    const examYearStr = formData.get('examYear')?.toString().trim();
    const examSession = formData.get('examSession')?.toString().trim() || undefined;

    // 4. Validate file size and extension
    const fileValidation = validateUploadFile(file.name, file.type, file.size);
    if (!fileValidation.valid || !fileValidation.extension) {
      return new Response(JSON.stringify({ error: fileValidation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 5. Read buffer and perform Magic Bytes verification
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const magicCheck = validateMagicBytes(fileBuffer, fileValidation.extension);
    if (!magicCheck.valid) {
      return new Response(JSON.stringify({ error: magicCheck.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 6. Automated malware and security threat scanning
    const threatCheck = scanBufferForThreats(fileBuffer);
    if (!threatCheck.safe) {
      return new Response(
        JSON.stringify({
          error: `Security scan alert: ${threatCheck.reason}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 7. Duplicate detection using SHA-256 Checksum
    const checksum = computeFileChecksum(fileBuffer);
    try {
      const db = await getDb();
      const existingDuplicate = await db.collection<Resource>('resources').findOne({
        checksum,
        status: { $ne: 'removed' },
      });
      if (existingDuplicate) {
        return new Response(
          JSON.stringify({
            error: `Duplicate file detected: This exact document has already been uploaded as "${existingDuplicate.title}". Please browse existing resources.`,
            duplicateResourceId: existingDuplicate._id?.toString(),
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } catch {}

    // 8. Check & reserve storage capacity (20 GB budget check)
    const reservation = await reserveUploadCapacity(user.id, file.size);
    if (!reservation.ok) {
      return new Response(JSON.stringify({ error: reservation.error }), {
        status: 507,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 9. Generate safe storage key & upload file binary
    const storageKey = generateStorageKey(universityId, subjectSlug, fileValidation.extension);
    await uploadObjectToStorage(storageKey, fileBuffer, fileValidation.mimeType || file.type);

    // 10. Automated Approval: Files that pass extension, magic bytes, threat scan & duplicate check are auto-approved
    const now = new Date();
    const examYear = examYearStr ? parseInt(examYearStr, 10) : new Date().getFullYear();

    const newResource: Resource = {
      title,
      description,
      universityId,
      facultyId,
      programId,
      academicTermId,
      subjectId: subjectSlug,
      category,
      contributorId: user.id,
      contributorName: user.displayName,
      originalFilename: file.name,
      storageKey,
      fileExtension: fileValidation.extension,
      mimeType: fileValidation.mimeType || file.type,
      fileSizeBytes: file.size,
      checksum,
      examYear,
      examSession,
      status: 'approved',
      viewCount: 0,
      downloadCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const created = await createResource(newResource);
    const resourceId = created._id?.toString() || '';

    // 11. Award reputation points for verified upload (+10 points)
    await awardReputation(user.id, REPUTATION_REWARDS.UPLOAD_APPROVED, 'upload_approved', resourceId);

    // 12. If fulfilling an existing request, auto-link & award +25 points
    let fulfillmentMessage = '';
    if (requestId) {
      const fulfillRes = await fulfillResourceRequest(requestId, resourceId, user.id, user.displayName);
      if (fulfillRes.success) {
        fulfillmentMessage = ' Resource request automatically fulfilled (+25 reputation bonus awarded)!';
      }
    }

    // 13. Create in-app notification for contributor
    await createNotification(
      user.id,
      'upload_status',
      'Resource Published Live!',
      `"${title}" was verified and published to ${rawSubject} curriculum.`,
      `/resources/${resourceId}`
    );

    // 14. Mark storage reservation completed & record analytics
    try {
      const db = await getDb();
      if (reservation.reservationId) {
        await db.collection('storageReservations').updateOne(
          { reservationId: reservation.reservationId },
          { $set: { status: 'completed', storageKey } }
        );
      }

      await db.collection('analyticsEvents').insertMany([
        {
          eventType: 'upload_completed',
          userId: user.id,
          resourceId,
          category,
          fileSizeBytes: file.size,
          timestamp: now,
        },
        {
          eventType: 'contribution_submitted',
          userId: user.id,
          resourceId,
          category,
          timestamp: now,
        },
      ]);
    } catch {}

    return new Response(
      JSON.stringify({
        ok: true,
        resourceId,
        status: 'approved',
        message: `Resource verified & published successfully! It is now live.${fulfillmentMessage}`,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Server error during upload' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
