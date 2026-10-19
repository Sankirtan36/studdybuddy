import type { APIRoute } from 'astro';
import { revokeSession, SESSION_COOKIE_NAME } from '../../../server/auth/session';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  const token = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await revokeSession(token);
  }

  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });

  return redirect('/');
};

export const GET: APIRoute = async ({ cookies, redirect }) => {
  const token = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await revokeSession(token);
  }

  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });

  return redirect('/');
};
