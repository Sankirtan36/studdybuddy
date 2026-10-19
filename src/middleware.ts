import { defineMiddleware } from 'astro:middleware';
import { validateSession, SESSION_COOKIE_NAME } from './server/auth/session';
import type { User } from './types';

// Extend App.Locals interface
declare global {
  namespace App {
    interface Locals {
      user: {
        id: string;
        email: string;
        displayName: string;
        role: string;
        status: string;
        restrictions?: any;
      } | null;
    }
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const cookies = context.cookies;
  const sessionToken = cookies.get(SESSION_COOKIE_NAME)?.value;

  let authenticatedUser: User | null = null;
  if (sessionToken) {
    authenticatedUser = await validateSession(sessionToken);
  }

  if (authenticatedUser) {
    context.locals.user = {
      id: authenticatedUser._id?.toString() || '',
      email: authenticatedUser.email,
      displayName: authenticatedUser.displayName,
      role: authenticatedUser.role,
      status: authenticatedUser.status,
      restrictions: authenticatedUser.restrictions,
    };
  } else {
    context.locals.user = null;
  }

  const pathname = context.url.pathname;

  // Protect Admin Area on the server (Requires login and admin/owner role)
  if (pathname.startsWith('/admin')) {
    if (!context.locals.user) {
      return context.redirect(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
    if (context.locals.user.role !== 'admin' && context.locals.user.role !== 'owner') {
      return context.redirect('/dashboard?error=unauthorized_admin');
    }
  }

  // Protect Database Explorer (Only Admin/Owner can access)
  if (pathname.startsWith('/database')) {
    if (!context.locals.user) {
      return context.redirect(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
    if (context.locals.user.role !== 'admin' && context.locals.user.role !== 'owner') {
      return context.redirect('/dashboard?error=unauthorized_database');
    }
  }

  // Protect Contributor & Dashboard Pages (Requires login)
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/upload')) {
    if (!context.locals.user) {
      return context.redirect(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }

  return next();
});
