import type { APIRoute } from 'astro';
import { createSession, SESSION_COOKIE_NAME } from '../../../server/auth/session';
import { findUserByEmail, createUser, updateUser } from '../../../server/auth/userStore';
import type { User } from '../../../types';
import { z } from 'zod';

const firebaseLoginSchema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
  photoUrl: z.string().optional(),
  uid: z.string().optional(),
  idToken: z.string().optional(),
});

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const parsed = firebaseLoginSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid user details received from Firebase.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { email: rawEmail, displayName: rawDisplayName, photoUrl } = parsed.data;
    const email = rawEmail.toLowerCase().trim();
    const displayName = rawDisplayName?.trim() || email.split('@')[0];

    let user = await findUserByEmail(email);

    if (!user) {
      // First time logging in with Firebase — create new student account
      const now = new Date();
      const newUser: User = {
        email,
        displayName,
        passwordHash: '', // Managed by Firebase Auth
        role: 'user',
        status: 'active',
        avatarUrl: photoUrl || undefined,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      };

      user = await createUser(newUser);
    } else {
      // Check account status
      if (user.status === 'suspended') {
        return new Response(
          JSON.stringify({ error: 'Your account has been suspended. Please contact platform administrators.' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Update lastLoginAt and avatarUrl if updated
      const updateFields: Partial<User> = { lastLoginAt: new Date(), updatedAt: new Date() };
      if (!user.avatarUrl && photoUrl) {
        updateFields.avatarUrl = photoUrl;
      }
      if (!user.displayName && displayName) {
        updateFields.displayName = displayName;
      }

      await updateUser(user._id!.toString(), updateFields);
    }

    // Create session token
    const token = await createSession(user._id!.toString(), request);

    // Set HTTP-only session cookie
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
    console.error('Firebase login error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error processing Firebase sign in.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
