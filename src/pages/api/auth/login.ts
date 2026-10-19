import type { APIRoute } from 'astro';
import { z } from 'zod';
import { verifyPassword, createSession, SESSION_COOKIE_NAME } from '../../../server/auth/session';
import { findUserByEmail, updateUser } from '../../../server/auth/userStore';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const contentType = request.headers.get('content-type') || '';
    let body: any = {};
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      const formData = await request.formData();
      body = {
        email: formData.get('email'),
        password: formData.get('password'),
      };
    }

    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error.issues[0]?.message || 'Invalid input' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { email, password } = validation.data;
    const user = await findUserByEmail(email);

    // Generic error message to prevent email enumeration
    if (!user || !user.passwordHash) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address or password.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check suspension status
    if (user.status === 'suspended') {
      return new Response(
        JSON.stringify({ error: 'Your account has been suspended by an administrator. Please contact support.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify password hash
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address or password.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update lastLoginAt
    await updateUser(user._id!.toString(), { lastLoginAt: new Date() });

    // Create session
    const token = await createSession(user._id!.toString(), request);

    cookies.set(SESSION_COOKIE_NAME, token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return new Response(
      JSON.stringify({
        ok: true,
        user: {
          id: user._id!.toString(),
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Login error:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error during login' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
