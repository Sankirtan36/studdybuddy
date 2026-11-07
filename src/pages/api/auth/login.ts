import type { APIRoute } from 'astro';
import { z } from 'zod';
import { verifyPassword, createSession, SESSION_COOKIE_NAME } from '../../../server/auth/session';
import { findUserByEmail, updateUser } from '../../../server/auth/userStore';

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }).toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const contentType = request.headers.get('content-type') || '';
  const accept = request.headers.get('accept') || '';
  const isJson = contentType.includes('application/json') || accept.includes('application/json');

  let body: any = {};
  let redirectTarget = '/dashboard';

  try {
    if (contentType.includes('application/json')) {
      body = await request.json();
      redirectTarget = body.redirect || '/dashboard';
    } else {
      const formData = await request.formData();
      redirectTarget = (formData.get('redirect') as string) || '/dashboard';
      body = {
        email: formData.get('email'),
        password: formData.get('password'),
      };
    }

    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      const errMsg = validation.error.issues[0]?.message || 'Invalid input';
      if (isJson) {
        return new Response(
          JSON.stringify({ error: errMsg }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return redirect(`/login?error=${encodeURIComponent(errMsg)}&email=${encodeURIComponent(body?.email || '')}`);
    }

    const { email, password } = validation.data;
    const user = await findUserByEmail(email);

    // Generic error message to prevent email enumeration
    if (!user || !user.passwordHash) {
      const errMsg = 'Invalid email address or password.';
      if (isJson) {
        return new Response(
          JSON.stringify({ error: errMsg }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return redirect(`/login?error=${encodeURIComponent(errMsg)}&email=${encodeURIComponent(email)}`);
    }

    // Check suspension status
    if (user.status === 'suspended') {
      const errMsg = 'Your account has been suspended by an administrator. Please contact support.';
      if (isJson) {
        return new Response(
          JSON.stringify({ error: errMsg }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return redirect(`/login?error=${encodeURIComponent(errMsg)}&email=${encodeURIComponent(email)}`);
    }

    // Verify password hash
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      const errMsg = 'Invalid email address or password.';
      if (isJson) {
        return new Response(
          JSON.stringify({ error: errMsg }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return redirect(`/login?error=${encodeURIComponent(errMsg)}&email=${encodeURIComponent(email)}`);
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

    if (isJson) {
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
    }

    return redirect(redirectTarget);
  } catch (err: any) {
    console.error('Login error:', err);
    const errMsg = err?.message || 'Internal server error during login';
    if (isJson) {
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return redirect(`/login?error=${encodeURIComponent(errMsg)}&email=${encodeURIComponent(body?.email || '')}`);
  }
};
