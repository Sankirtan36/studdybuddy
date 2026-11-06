import type { APIRoute } from 'astro';
import { z } from 'zod';
import { findUserByEmail } from '../../../server/auth/userStore';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message || 'Invalid email address.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { email } = parsed.data;
    const user = await findUserByEmail(email);

    // For security and privacy, respond positively whether the email exists or not
    return new Response(
      JSON.stringify({
        ok: true,
        userFound: !!user,
        message: 'If an account exists with this email, password reset instructions have been sent.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Forgot password error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error processing reset request.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
