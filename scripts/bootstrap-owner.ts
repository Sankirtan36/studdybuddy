import { hashPassword } from '../src/server/auth/session.ts';
import { findUserByEmail, createUser, updateUser } from '../src/server/auth/userStore.ts';
import type { User } from '../src/types/index.ts';

async function bootstrapOwner() {
  const args = process.argv.slice(2);
  const email = (args[0] || '').toLowerCase().trim();
  const password = args[1] || '';
  const displayName = args[2] || 'Platform Owner';

  if (!email || !password) {
    console.error('❌ Error: Both email and password are required.');
    console.error('Usage: node --experimental-strip-types scripts/bootstrap-owner.ts <email> <password> [displayName]');
    process.exit(1);
  }

  console.log(`🔐 Initiating StuddyBuddy Owner Bootstrap for: ${email}`);

  try {
    const existingUser = await findUserByEmail(email);
    const now = new Date();

    if (existingUser) {
      const passwordHash = await hashPassword(password);
      await updateUser(existingUser._id!.toString(), {
        role: 'owner',
        status: 'active',
        passwordHash,
        displayName: displayName || existingUser.displayName,
        updatedAt: now,
      });
      console.log(`✅ Existing user "${email}" updated with new password and elevated to OWNER role.`);
    } else {
      const passwordHash = await hashPassword(password);
      const newOwner: User = {
        email,
        displayName,
        passwordHash,
        role: 'owner',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      await createUser(newOwner);
      console.log(`✅ New OWNER account provisioned successfully for "${email}".`);
    }

    console.log(`🎉 Admin Owner credentials successfully configured!`);
    console.log(`   Email: ${email}`);
    console.log(`   Role: owner (Full Admin Privileges)`);
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Failed to bootstrap owner:', err?.message || err);
    process.exit(1);
  }
}

bootstrapOwner();
