import type { APIRoute } from 'astro';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '../../../server/auth/session';
import { findUserById, updateUser } from '../../../server/auth/userStore';

const changePasswordSchema = z.object({
  currentPassword: z.string().optional().default(''),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const userSession = locals.user;
    if (!userSession || !userSession.id) {
      return new Response(
        JSON.stringify({ error: 'You must be logged in to change your password.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message || 'Invalid input' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { currentPassword, newPassword } = parsed.data;
    const dbUser = await findUserById(userSession.id);
    if (!dbUser) {
      return new Response(
        JSON.stringify({ error: 'User account not found.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // If user already has a password hash set, verify current password
    if (dbUser.passwordHash) {
      if (!currentPassword) {
        return new Response(
          JSON.stringify({ error: 'Please enter your current password.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const isValid = await verifyPassword(currentPassword, dbUser.passwordHash);
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: 'The current password you entered is incorrect.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Hash the new password and update record
    const newHash = await hashPassword(newPassword);
    await updateUser(dbUser._id!.toString(), {
      passwordHash: newHash,
      updatedAt: new Date(),
    });

    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Password successfully changed and synced with your account.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Change password error:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error changing password.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
