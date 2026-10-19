import type { APIRoute } from 'astro';
import { getDb } from '../../../server/db/mongo';
import { validateUploadFile, reserveUploadCapacity, generateStorageKey, uploadObjectToStorage } from '../../../server/storage/storage';
import { createResource } from '../../../server/repositories/resourceRepository';
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

  try {
    const formData = await request.formData();

    const file = formData.get('file') as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: 'Please select a document or file to upload.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

    // 3. Validate file
    const fileValidation = validateUploadFile(file.name, file.type, file.size);
    if (!fileValidation.valid || !fileValidation.extension) {
      return new Response(JSON.stringify({ error: fileValidation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Check & reserve storage capacity (20 GB budget check)
    const reservation = await reserveUploadCapacity(user.id, file.size);
    if (!reservation.ok) {
      return new Response(JSON.stringify({ error: reservation.error }), {
        status: 507,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 5. Generate safe storage key grouped by Subject folder & upload file binary
    const storageKey = generateStorageKey(universityId, subjectSlug, fileValidation.extension);
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    await uploadObjectToStorage(storageKey, fileBuffer, fileValidation.mimeType || file.type);

    // 6. Insert into store with status: 'approved' (instantly available)
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
      examYear,
      examSession,
      status: 'approved', // Auto-approved: instantly live and accessible to all students
      viewCount: 0,
      downloadCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const created = await createResource(newResource);
    const resourceId = created._id?.toString() || '';

    // Mark storage reservation completed & record analytics if DB is available
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
    } catch (dbErr) {
      // Non-blocking: resource and files are already persisted safely
    }

    return new Response(
      JSON.stringify({
        ok: true,
        resourceId,
        status: 'approved',
        message: 'Resource published successfully! It is now live and accessible to all students.',
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
