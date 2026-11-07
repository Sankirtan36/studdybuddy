import type { APIRoute } from 'astro';
import { addFacultyToUniversity } from '../../../server/repositories/universityRequestRepository';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const universitySlug = (body.universitySlug || '').trim();
    const facultyName = (body.facultyName || '').trim();
    const description = (body.description || '').trim();

    if (!universitySlug) {
      return new Response(
        JSON.stringify({ ok: false, error: 'University slug is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!facultyName || facultyName.length < 2) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Department / Faculty name must be at least 2 characters.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const newFaculty = await addFacultyToUniversity(universitySlug, facultyName, description || undefined);

    return new Response(
      JSON.stringify({
        ok: true,
        message: `Department "${newFaculty.name}" successfully added to university!`,
        faculty: newFaculty,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Failed to add department.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

