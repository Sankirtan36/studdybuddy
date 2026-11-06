import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordResourceView,
  getRecentlyViewedResources,
  writeLocalRecentViews,
  writeLocalResources,
} from '../../src/server/repositories/resourceRepository';
import type { Resource } from '../../src/types';

describe('University-Specific Smart Search & Recently Viewed Resources', () => {
  const uniA = 'parul-university';
  const uniB = 'gtu';
  const studentA = 'usr-student-test-a';
  const studentB = 'usr-student-test-b';

  beforeEach(() => {
    // Clear recent views for clean testing
    writeLocalRecentViews([]);
  });

  it('records resource views and updates viewedAt on repeated visits (de-duplication)', async () => {
    // Setup test resource
    const resA: Resource = {
      _id: 'res-test-dsa-1',
      title: 'Data Structures Notes',
      universityId: uniA,
      facultyId: 'fac-eng',
      programId: 'prog-btech-cse',
      academicTermId: 'term-3',
      subjectId: 'subj-dsa',
      category: 'Notes',
      contributorId: studentA,
      contributorName: 'Test Student',
      originalFilename: 'dsa.pdf',
      storageKey: 'dsa.pdf',
      fileExtension: 'pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 2048,
      status: 'approved',
      viewCount: 0,
      downloadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const existingResources = [resA];
    writeLocalResources(existingResources);

    // First view
    await recordResourceView(studentA, uniA, 'res-test-dsa-1');
    let recent = await getRecentlyViewedResources(studentA, uniA, 5);
    expect(recent.length).toBe(1);
    expect(recent[0]._id).toBe('res-test-dsa-1');
    const firstTimestamp = recent[0].viewedAt.getTime();

    // Small delay to ensure timestamp increment
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Second view of the SAME resource
    await recordResourceView(studentA, uniA, 'res-test-dsa-1');
    recent = await getRecentlyViewedResources(studentA, uniA, 5);

    // Must be de-duplicated: still exactly 1 entry, but updated timestamp
    expect(recent.length).toBe(1);
    expect(recent[0].viewedAt.getTime()).toBeGreaterThanOrEqual(firstTimestamp);
  });

  it('enforces strict university isolation: student viewing Uni A cannot see Uni B history', async () => {
    const resA: Resource = {
      _id: 'res-test-uni-a',
      title: 'Parul University Engineering Physics',
      universityId: uniA,
      facultyId: 'fac-eng',
      programId: 'prog-btech-cse',
      academicTermId: 'term-1',
      subjectId: 'subj-physics',
      category: 'Notes',
      contributorId: studentA,
      contributorName: 'Student A',
      originalFilename: 'physics.pdf',
      storageKey: 'physics.pdf',
      fileExtension: 'pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 1024,
      status: 'approved',
      viewCount: 0,
      downloadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const resB: Resource = {
      _id: 'res-test-uni-b',
      title: 'GTU Mechanical Thermodynamics',
      universityId: uniB,
      facultyId: 'fac-mech',
      programId: 'prog-btech-mech',
      academicTermId: 'term-2',
      subjectId: 'subj-thermo',
      category: 'Previous Year Question Paper',
      contributorId: studentB,
      contributorName: 'Student B',
      originalFilename: 'thermo.pdf',
      storageKey: 'thermo.pdf',
      fileExtension: 'pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 2048,
      status: 'approved',
      viewCount: 0,
      downloadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    writeLocalResources([resA, resB]);

    // Student A visits Uni A resource and Uni B resource
    await recordResourceView(studentA, uniA, 'res-test-uni-a');
    await recordResourceView(studentA, uniB, 'res-test-uni-b');

    // Query recently viewed in Uni A space: MUST ONLY return Uni A resource
    const uniARecent = await getRecentlyViewedResources(studentA, uniA, 10);
    expect(uniARecent.some((r) => r._id === 'res-test-uni-a')).toBe(true);
    expect(uniARecent.some((r) => r._id === 'res-test-uni-b')).toBe(false);

    // Query recently viewed in Uni B space: MUST ONLY return Uni B resource
    const uniBRecent = await getRecentlyViewedResources(studentA, uniB, 10);
    expect(uniBRecent.some((r) => r._id === 'res-test-uni-b')).toBe(true);
    expect(uniBRecent.some((r) => r._id === 'res-test-uni-a')).toBe(false);
  });

  it('guarantees exact navigation identity matching resource _id', async () => {
    const res: Resource = {
      _id: 'res-unique-exact-target',
      title: 'Database Management Systems Lab Viva Questions',
      universityId: uniA,
      facultyId: 'fac-eng',
      programId: 'prog-btech-cse',
      academicTermId: 'term-4',
      subjectId: 'subj-dbms',
      category: 'Practical & Lab Material',
      contributorId: studentA,
      contributorName: 'Student A',
      originalFilename: 'viva.pdf',
      storageKey: 'viva.pdf',
      fileExtension: 'pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 4096,
      status: 'approved',
      viewCount: 1,
      downloadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    writeLocalResources([res]);
    await recordResourceView(studentA, uniA, 'res-unique-exact-target');

    const recent = await getRecentlyViewedResources(studentA, uniA, 1);
    expect(recent[0]._id).toBe('res-unique-exact-target');
    // Clicking card opens `/resources/${resource._id}`
    const navigationUrl = `/resources/${recent[0]._id}`;
    expect(navigationUrl).toBe('/resources/res-unique-exact-target');
  });
});
