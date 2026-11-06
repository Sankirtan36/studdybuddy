import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/server/auth/session';

describe('Authentication & Password Security', () => {
  it('hashes password with random salt and verifies correctly', async () => {
    const rawPassword = 'StudentSecret123!';
    const hash = await hashPassword(rawPassword);

    expect(hash).toContain(':');
    const [salt, key] = hash.split(':');
    expect(salt.length).toBeGreaterThan(10);
    expect(key.length).toBeGreaterThan(10);

    const isMatch = await verifyPassword(rawPassword, hash);
    expect(isMatch).toBe(true);
  });

  it('rejects incorrect passwords safely', async () => {
    const hash = await hashPassword('CorrectPassword123');
    const isMatch = await verifyPassword('WrongPassword999', hash);
    expect(isMatch).toBe(false);
  });

  it('generates different hashes for identical passwords due to salt randomization', async () => {
    const p1 = await hashPassword('SamePassword');
    const p2 = await hashPassword('SamePassword');
    expect(p1).not.toBe(p2);
  });

  it('updates password and invalidates previous password', async () => {
    const originalPass = 'OldSecretPass123';
    const newPass = 'NewSecurePass456';

    const originalHash = await hashPassword(originalPass);
    expect(await verifyPassword(originalPass, originalHash)).toBe(true);

    const updatedHash = await hashPassword(newPass);
    // Old password fails against updated hash
    expect(await verifyPassword(originalPass, updatedHash)).toBe(false);
    // New password succeeds against updated hash
    expect(await verifyPassword(newPass, updatedHash)).toBe(true);
  });
});
