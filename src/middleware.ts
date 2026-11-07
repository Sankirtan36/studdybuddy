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
        universityId?: string | null;
        isUniversityVerified?: boolean;
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
      universityId: authenticatedUser.universityId,
      isUniversityVerified: authenticatedUser.isUniversityVerified,
    };
  } else {
    context.locals.user = null;
  }

  const pathname = context.url.pathname;

  // Automatic staff isolation: administrators & owners are strictly kept within Admin/PDF workbench
  if (context.locals.user && (context.locals.user.role === 'admin' || context.locals.user.role === 'owner')) {
    if (
      pathname === '/' ||
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/community') ||
      pathname.startsWith('/requests') ||
      pathname.startsWith('/upload')
    ) {
      return context.redirect('/admin');
    }
  }

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
