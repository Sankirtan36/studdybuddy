import type { APIRoute } from 'astro';
import {
  submitUniversityRequest,
  findExistingUniversity,
  findPendingUniversityRequest,
} from '../../../server/repositories/universityRequestRepository';

/**
 * GET /api/universities/request?checkName=...
 * Live check for duplicates or pending requests as the user types
 */
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const checkName = (url.searchParams.get('checkName') || '').trim();

  if (!checkName || checkName.length < 2) {
    return new Response(JSON.stringify({ ok: true, available: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const existing = await findExistingUniversity(checkName);
    if (existing) {
      return new Response(
        JSON.stringify({
          ok: true,
          available: false,
          reason: 'exists',
          message: `"${existing.name}" is already registered on StuddyBuddy.`,
          existingUrl: `/university/${existing.slug}`,
          university: existing,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const pending = findPendingUniversityRequest(checkName);
    if (pending) {
      return new Response(
        JSON.stringify({
          ok: true,
          available: false,
          reason: 'pending',
          message: `A registration request for "${pending.name}" is currently under administrative review.`,
          pendingRequest: pending,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        available: true,
        message: 'Name is available!',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || 'Check failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/**
 * POST /api/universities/request
 * Submit a request to add a new University / College
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    let body: any = {};
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries());
      if (typeof body.departments === 'string') {
        body.departments = body.departments
          .split('\n')
          .map((s: string) => s.trim())
          .filter(Boolean);
      }
    }

    const name = (body.name || '').trim();
    const location = (body.location || '').trim();
    const websiteUrl = (body.websiteUrl || '').trim();
    const description = (body.description || '').trim();
    
    let departments: string[] = [];
    if (Array.isArray(body.departments)) {
      departments = body.departments.map((d: any) => String(d).trim()).filter(Boolean);
    } else if (typeof body.departments === 'string') {
      departments = body.departments.split(',').map((d: string) => d.trim()).filter(Boolean);
    }

    if (!name || name.length < 3) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Please enter a valid institution name (minimum 3 characters).',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!location || location.length < 2) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Please provide the campus location (City, State / Region).',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const currentUser = locals.user;
    const requestedBy = currentUser?.id || 'guest';
    const requestedByName = currentUser?.displayName || body.requestedByName || 'Student Contributor';
    const requestedByEmail = currentUser?.email || body.requestedByEmail || undefined;

    const newRequest = await submitUniversityRequest({
      name,
      location,
      websiteUrl: websiteUrl || undefined,
      description: description || undefined,
      departments: departments.length > 0 ? departments : undefined,
      requestedBy,
      requestedByName,
      requestedByEmail,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Your campus registration request has been submitted to the moderation team. Once approved by the administrator, the campus will be published and you will be able to configure academic departments and upload course materials.',
        request: newRequest,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    if (err.isDuplicate) {
      return new Response(
        JSON.stringify({
          ok: false,
          isDuplicate: true,
          error: err.message,
          existingUniversity: err.existingUniversity,
          existingUrl: err.existingUniversity ? `/university/${err.existingUniversity.slug}` : undefined,
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (err.isPending) {
      return new Response(
        JSON.stringify({
          ok: false,
          isPending: true,
          error: err.message,
          pendingRequest: err.pendingRequest,
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: false,
        error: err?.message || 'University add request submit nahi ho payi.',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

