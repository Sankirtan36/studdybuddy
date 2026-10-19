import type { APIRoute } from 'astro';
import { z } from 'zod';
import { hashPassword, createSession, SESSION_COOKIE_NAME } from '../../../server/auth/session';
import { findUserByEmail, createUser } from '../../../server/auth/userStore';
import type { User } from '../../../types';

const registerSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(50),
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
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
        displayName: formData.get('displayName'),
        email: formData.get('email'),
        password: formData.get('password'),
      };
    }

    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error.issues[0]?.message || 'Invalid input' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { displayName, email, password } = validation.data;

    // Check existing email
    const existing = await findUserByEmail(email);
    if (existing) {
      return new Response(
        JSON.stringify({ error: 'An account with this email already exists.' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Hash password and store user. Role is ALWAYS 'user' on public signup.
    const passwordHash = await hashPassword(password);
    const now = new Date();

    const newUser: User = {
      email,
      displayName,
      passwordHash,
      role: 'user',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    const created = await createUser(newUser);
    const userId = created._id!.toString();

    // Create session and set HTTP-only cookie
    const token = await createSession(userId, request);

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
        user: { id: userId, email, displayName, role: 'user' },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Registration error:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error during registration' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
