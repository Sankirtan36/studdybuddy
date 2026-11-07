import { describe, it, expect } from 'vitest';
import {
  createResourceRequest,
  getRequestById,
  fulfillResourceRequest,
  closeResourceRequest,
} from '../../src/server/repositories/requestRepository';
import { findUserById, createUser } from '../../src/server/auth/userStore';

describe('Module 3: Student-to-Student Resource Requests & Fulfillment', () => {
  it('creates an open study material request', async () => {
    const req = await createResourceRequest({
      requesterId: 'usr-student-asker',
      requesterName: 'Aarav Shah',
      universityId: 'parul-university',
      programId: 'btech-cse',
      subjectId: 'dsa',
      subjectName: 'Data Structures & Algorithms',
      category: 'Previous Year Question Paper',
      examYear: 2024,
      urgency: 'urgent',
      description: 'Need Mid-Sem 2024 exam paper with solutions',
    });

    expect(req.status).toBe('open');
    expect(req.subjectName).toBe('Data Structures & Algorithms');
    expect(req.urgency).toBe('urgent');
    expect(req._id).toBeDefined();

    const fetched = await getRequestById(req._id!.toString());
    expect(fetched).not.toBeNull();
    expect(fetched?.requesterName).toBe('Aarav Shah');
  });

  it('allows peer student to fulfill request, auto-updates status and awards reputation points', async () => {
    // 1. Create helper user
    const helper = await createUser({
      email: `helper-${Date.now()}@parul.ac.in`,
      displayName: 'Neha Sharma',
      passwordHash: 'dummy',
      role: 'user',
      status: 'active',
      reputationPoints: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const helperId = helper._id!.toString();

    // 2. Create request
    const req = await createResourceRequest({
      requesterId: 'usr-student-different',
      requesterName: 'Kunal Verma',
      universityId: 'parul-university',
      programId: 'btech-cse',
      subjectId: 'eng-math-1',
      subjectName: 'Engineering Mathematics I',
      category: 'Notes',
      urgency: 'normal',
    });

    // 3. Fulfill request with resource
    const result = await fulfillResourceRequest(req._id!.toString(), 'res-math-notes-101', helperId, 'Neha Sharma');
    expect(result.success).toBe(true);
    expect(result.request?.status).toBe('fulfilled');
    expect(result.request?.fulfilledResourceId).toBe('res-math-notes-101');
    expect(result.request?.fulfilledByUserName).toBe('Neha Sharma');

    // 4. Verify helper received +25 reputation points
    const updatedHelper = await findUserById(helperId);
    expect(updatedHelper?.reputationPoints).toBe(25);
  });

  it('prevents student from fulfilling their own request', async () => {
    const req = await createResourceRequest({
      requesterId: 'usr-same-student',
      requesterName: 'Rohan Gupta',
      universityId: 'parul-university',
      programId: 'btech-cse',
      subjectId: 'c-prog',
      subjectName: 'C Programming',
      category: 'Assignment',
      urgency: 'low',
    });

    const result = await fulfillResourceRequest(req._id!.toString(), 'res-any', 'usr-same-student', 'Rohan Gupta');
    expect(result.success).toBe(false);
    expect(result.error).toContain('cannot fulfill your own');
  });

  it('allows requester to close their open request', async () => {
    const req = await createResourceRequest({
      requesterId: 'usr-close-tester',
      requesterName: 'Priya Mehta',
      universityId: 'parul-university',
      programId: 'bca',
      subjectId: 'dbms',
      subjectName: 'DBMS',
      category: 'Notes',
      urgency: 'normal',
    });

    const closeRes = await closeResourceRequest(req._id!.toString(), 'usr-close-tester');
    expect(closeRes.success).toBe(true);

    const fetched = await getRequestById(req._id!.toString());
    expect(fetched?.status).toBe('closed');
  });
});

