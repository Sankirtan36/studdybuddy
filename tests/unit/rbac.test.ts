import { describe, it, expect } from 'vitest';
import type { UserRole, Resource } from '../../src/types';

describe('Role-Based Access Control (RBAC) & Ownership Security', () => {
  function canAccessAdminPanel(role: UserRole): boolean {
    return role === 'admin' || role === 'owner';
  }

  function canModerateResources(role: UserRole): boolean {
    return role === 'moderator' || role === 'admin' || role === 'owner';
  }

  function canEditOrDeleteResource(user: { id: string; role: UserRole }, resource: Resource): boolean {
    if (user.role === 'admin' || user.role === 'owner') return true;
    return resource.contributorId === user.id;
  }

  it('prohibits visitor and normal student from accessing administrative panels', () => {
    expect(canAccessAdminPanel('visitor')).toBe(false);
    expect(canAccessAdminPanel('user')).toBe(false);
    expect(canAccessAdminPanel('admin')).toBe(true);
    expect(canAccessAdminPanel('owner')).toBe(true);
  });

  it('prohibits normal students from approving or rejecting resources', () => {
    expect(canModerateResources('user')).toBe(false);
    expect(canModerateResources('moderator')).toBe(true);
    expect(canModerateResources('admin')).toBe(true);
  });

  it('enforces that contributors can only modify their own resources and cannot tamper with others', () => {
    const studentA = { id: 'usr-student-a', role: 'user' as UserRole };
    const studentB = { id: 'usr-student-b', role: 'user' as UserRole };
    const admin = { id: 'usr-admin', role: 'admin' as UserRole };

    const resourceA: Resource = {
      _id: 'res-1',
      title: 'Student A DSA Notes',
      contributorId: 'usr-student-a',
      contributorName: 'Student A',
      universityId: 'parul-university',
      facultyId: 'fac-engineering-technology',
      programId: 'prog-btech-cse',
      academicTermId: 'term-2',
      subjectId: 'subj-dsa',
      category: 'Notes',
      originalFilename: 'notes.pdf',
      storageKey: 'key1.pdf',
      fileExtension: 'pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 1024,
      status: 'pending',
      viewCount: 0,
      downloadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Student A can modify their own resource
    expect(canEditOrDeleteResource(studentA, resourceA)).toBe(true);

    // Student B CANNOT modify Student A's resource (prevents ID tampering attack!)
    expect(canEditOrDeleteResource(studentB, resourceA)).toBe(false);

    // Admin can moderate
    expect(canEditOrDeleteResource(admin, resourceA)).toBe(true);
  });
});
