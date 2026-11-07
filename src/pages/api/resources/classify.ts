import type { APIRoute } from 'astro';
import { classifyAcademicFile } from '../../../server/classifier/academicClassifier';
import { findUserById } from '../../../server/auth/userStore';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const filename = body.filename?.toString().trim();

    if (!filename) {
      return new Response(JSON.stringify({ error: 'Filename is required for academic classification.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Retrieve saved student academic profile context
    let studentProfile = undefined;
    if (locals.user) {
      const fullUser = await findUserById(locals.user.id);
      if (fullUser) {
        studentProfile = {
          universityId: fullUser.universityId || 'parul-university',
          programId: fullUser.programId || 'prog-btech-cse',
          currentSemester: fullUser.currentSemester || 'Semester 1',
        };
      }
    }

    const classification = classifyAcademicFile(filename, studentProfile);

    return new Response(JSON.stringify({ ok: true, classification }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Classification error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

