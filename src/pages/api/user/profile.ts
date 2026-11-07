import type { APIRoute } from 'astro';
import { updateUser, findUserById } from '../../../server/auth/userStore';
import { z } from 'zod';

const profileUpdateSchema = z.object({
  displayName: z.string().min(2).max(60).optional(),
  currentSemester: z.string().max(30).optional(),
  programId: z.string().max(50).optional(),
  enrollmentYear: z.number().min(2015).max(2030).optional(),
  bio: z.string().max(300).optional(),
});

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const profile = await findUserById(user.id);
  if (!profile) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      user: {
        id: profile._id?.toString(),
        email: profile.email,
        displayName: profile.displayName,
        role: profile.role,
        currentSemester: profile.currentSemester || 'Semester 1',
        programId: profile.programId || 'btech-cse',
        reputationPoints: profile.reputationPoints || 0,
        isVerifiedSenior: profile.isVerifiedSenior || false,
        bio: profile.bio || '',
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const parsed = profileUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message || 'Validation error' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { currentSemester, enrollmentYear } = parsed.data;

    // Check if verified senior (Semester 5+ or enrolled 3+ years ago)
    let isVerifiedSenior = false;
    if (currentSemester) {
      const semNum = parseInt(currentSemester.replace(/[^0-9]/g, ''), 10);
      if (semNum >= 5) {
        isVerifiedSenior = true;
      }
    }
    if (enrollmentYear && enrollmentYear <= new Date().getFullYear() - 2) {
      isVerifiedSenior = true;
    }

    await updateUser(user.id, {
      ...parsed.data,
      isVerifiedSenior,
      updatedAt: new Date(),
    });

    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Profile updated successfully!',
        isVerifiedSenior,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

