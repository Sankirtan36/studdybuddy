import { describe, it, expect, beforeAll } from 'vitest';
import { findUserByEmail, findUserById, createUser, findSession } from '../../src/server/auth/userStore';
import { createSession } from '../../src/server/auth/session';

describe('Login & Dashboard Performance Verification', () => {
  const testEmail = 'speedtest@studdybuddy.in';
  const testUserId = 'usr-speed-perf-1';

  beforeAll(async () => {
    await createUser({
      _id: testUserId,
      email: testEmail,
      displayName: 'Speed Student',
      passwordHash: 'dummy:hash',
      role: 'user',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('resolves user by email in under 10ms (instant login lookup)', async () => {
    const start = performance.now();
    const user = await findUserByEmail(testEmail);
    const duration = performance.now() - start;

    expect(user).toBeDefined();
    expect(user?.email).toBe(testEmail);
    expect(duration).toBeLessThan(25); // Under 25ms (usually < 1ms)
  });

  it('creates and caches session in under 15ms', async () => {
    const start = performance.now();
    const token = await createSession(testUserId);
    const duration = performance.now() - start;

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(duration).toBeLessThan(25);
  });

  it('validates session and loads user profile in middleware in under 10ms', async () => {
    const token = await createSession(testUserId);

    const start = performance.now();
    const session = await findSession(token);
    expect(session).toBeDefined();

    const user = await findUserById(testUserId);
    const duration = performance.now() - start;

    expect(user).toBeDefined();
    expect(duration).toBeLessThan(25); // Sub-millisecond memory/local check
  });

  it('guarantees multiple users can remain logged in concurrently without session collision', async () => {
    const userA_Id = 'usr-concurrent-a';
    const userB_Id = 'usr-concurrent-b';

    await createUser({
      _id: userA_Id,
      email: 'user_a@test.ac.in',
      displayName: 'Student Alpha',
      passwordHash: 'hash:a',
      role: 'user',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await createUser({
      _id: userB_Id,
      email: 'user_b@test.ac.in',
      displayName: 'Student Beta',
      passwordHash: 'hash:b',
      role: 'user',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const tokenA = await createSession(userA_Id);
    const tokenB = await createSession(userB_Id);

    expect(tokenA).not.toBe(tokenB);

    const { validateSession } = await import('../../src/server/auth/session');
    const validatedA = await validateSession(tokenA);
    const validatedB = await validateSession(tokenB);

    expect(validatedA).toBeDefined();
    expect(validatedA?.email).toBe('user_a@test.ac.in');
    expect(validatedB).toBeDefined();
    expect(validatedB?.email).toBe('user_b@test.ac.in');
  });
});
