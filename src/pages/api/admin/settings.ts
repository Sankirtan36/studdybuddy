import type { APIRoute } from 'astro';
import { updateUser, findUserById } from '../../../server/auth/userStore';
import { verifyPassword, hashPassword } from '../../../server/auth/session';
import { updateSystemSettings, getSystemSettings } from '../../../server/repositories/settingsRepository';
import { getDb } from '../../../server/db/mongo';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
    return new Response(JSON.stringify({ error: 'Unauthorized administrative access.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const action = body.action;

    // 1. Update Display Name / Username
    if (action === 'update_profile') {
      const displayName = String(body.displayName || '').trim();
      if (!displayName || displayName.length < 2) {
        return new Response(
          JSON.stringify({ error: 'Display name / username must be at least 2 characters long.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      await updateUser(user.id, {
        displayName,
        updatedAt: new Date(),
      });

      // Update in-memory session user object
      user.displayName = displayName;

      // Log in audit logs
      try {
        const db = await getDb();
        await db.collection('auditLogs').insertOne({
          action: 'admin_profile_updated',
          performedBy: user.email,
          performedById: user.id,
          details: `Updated administrative display name to "${displayName}"`,
          timestamp: new Date(),
        } as any);
      } catch {}

      return new Response(
        JSON.stringify({ ok: true, message: 'Administrative profile updated successfully!', displayName }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Change Admin Password
    if (action === 'change_password') {
      const currentPassword = String(body.currentPassword || '').trim();
      const newPassword = String(body.newPassword || '').trim();
      const confirmPassword = String(body.confirmPassword || '').trim();

      if (!currentPassword) {
        return new Response(
          JSON.stringify({ error: 'Current password is required to authorize this change.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!newPassword || newPassword.length < 8) {
        return new Response(
          JSON.stringify({ error: 'New password must be at least 8 characters long.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (newPassword !== confirmPassword) {
        return new Response(
          JSON.stringify({ error: 'New password and confirmation password do not match.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Fetch latest user record with passwordHash
      const fullUser = await findUserById(user.id);
      if (!fullUser) {
        return new Response(
          JSON.stringify({ error: 'Administrative record not found.' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      let isCurrentMatch = false;
      if (fullUser.passwordHash) {
        isCurrentMatch = await verifyPassword(currentPassword, fullUser.passwordHash);
      }

      // Fallback check for default admin passwords
      if (!isCurrentMatch && ['admin2820@gmail.com', 'aryan@gmail.com'].includes(fullUser.email.toLowerCase())) {
        const allowedAdminPasswords = ['admin@2820', 'admin2820', 'Admin@123', 'admin123', 'Admin2820@'];
        if (allowedAdminPasswords.includes(currentPassword)) {
          isCurrentMatch = true;
        }
      }

      if (!isCurrentMatch) {
        return new Response(
          JSON.stringify({ error: 'Current password verification failed. Please check your current password.' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Hash and persist new password
      const newHash = await hashPassword(newPassword);
      await updateUser(user.id, {
        passwordHash: newHash,
        updatedAt: new Date(),
      });

      // Log in audit logs
      try {
        const db = await getDb();
        await db.collection('auditLogs').insertOne({
          action: 'admin_password_changed',
          performedBy: user.email,
          performedById: user.id,
          details: 'Administrative security credentials changed successfully',
          timestamp: new Date(),
        } as any);
      } catch {}

      return new Response(
        JSON.stringify({ ok: true, message: 'Password updated successfully! Your new password is now active.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Update Platform Governance Settings
    if (action === 'update_platform_settings') {
      const {
        allowUniversitySubmissions,
        strictDuplicateCheck,
        moderationMode,
        guestPdfRetentionHours,
        userPdfRetentionHours,
        maintenanceMode,
        maintenanceNotice,
      } = body;

      const updated = await updateSystemSettings(
        {
          allowUniversitySubmissions: Boolean(allowUniversitySubmissions),
          strictDuplicateCheck: Boolean(strictDuplicateCheck),
          moderationMode: moderationMode === 'instant_publish' ? 'instant_publish' : 'manual_first',
          guestPdfRetentionHours: Math.max(1, Number(guestPdfRetentionHours) || 6),
          userPdfRetentionHours: Math.max(1, Number(userPdfRetentionHours) || 48),
          maintenanceMode: Boolean(maintenanceMode),
          maintenanceNotice: String(maintenanceNotice || '').trim() || undefined,
        },
        user.email
      );

      // Log in audit logs
      try {
        const db = await getDb();
        await db.collection('auditLogs').insertOne({
          action: 'platform_settings_updated',
          performedBy: user.email,
          performedById: user.id,
          details: `Updated platform governance settings (Moderation: ${updated.moderationMode}, Maintenance: ${updated.maintenanceMode})`,
          timestamp: new Date(),
        } as any);
      } catch {}

      return new Response(
        JSON.stringify({ ok: true, message: 'Platform settings saved successfully!', settings: updated }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ error: 'Unknown settings action requested.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Server error while processing settings.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
    return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const settings = await getSystemSettings();
  return new Response(JSON.stringify({ ok: true, settings }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

