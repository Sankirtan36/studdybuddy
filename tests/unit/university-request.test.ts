import { describe, it, expect, beforeEach } from 'vitest';
import {
  submitUniversityRequest,
  findExistingUniversity,
  findPendingUniversityRequest,
  approveUniversityRequest,
  rejectUniversityRequest,
  addFacultyToUniversity,
  normalizeNameForComparison,
  slugify,
} from '../../src/server/repositories/universityRequestRepository';
import { getUniversities, getUniversityBySlug, getFacultiesByUniversity } from '../../src/server/repositories/catalogRepository';

describe('University Request & Moderation System', () => {
  it('slugify converts raw text into URL-safe slugs', () => {
    expect(slugify('IIT Bombay')).toBe('iit-bombay');
    expect(slugify('National Institute of Technology, Surat')).toBe('national-institute-of-technology-surat');
    expect(slugify('  Parul   University  ')).toBe('parul-university');
  });

  it('normalizeNameForComparison strips common stop-words for duplicate detection', () => {
    const norm1 = normalizeNameForComparison('Parul University');
    const norm2 = normalizeNameForComparison('parul college');
    expect(norm1).toBe('parul');
    expect(norm2).toBe('parul');
    expect(norm1).toBe(norm2);
  });

  it('detects existing university in catalog (e.g. Parul University or GTU)', async () => {
    const existing = await findExistingUniversity('Parul University');
    expect(existing).not.toBeNull();
    expect(existing?.slug).toBe('parul-university');

    const gtu = await findExistingUniversity('gtu');
    expect(gtu).not.toBeNull();
    expect(gtu?.slug).toBe('gtu');
  });

  it('strictly blocks duplicate request if university already exists', async () => {
    let errorCaught: any = null;
    try {
      await submitUniversityRequest({
        name: 'Parul University',
        location: 'Vadodara, Gujarat',
        requestedBy: 'student-123',
      });
    } catch (err: any) {
      errorCaught = err;
    }

    expect(errorCaught).not.toBeNull();
    expect(errorCaught.isDuplicate).toBe(true);
    expect(errorCaught.message).toContain('is already registered on StuddyBuddy');
  });

  it('allows submitting a new university request and sets status to pending', async () => {
    const uniqueName = `Test Tech University ${Date.now()}`;
    const req = await submitUniversityRequest({
      name: uniqueName,
      location: 'Pune, Maharashtra',
      websiteUrl: 'https://testtech.edu',
      departments: ['Computer Engineering', 'Mechanical Engineering'],
      requestedByName: 'Test Student',
      requestedByEmail: 'student@testtech.edu',
    });

    expect(req.status).toBe('pending');
    expect(req.name).toBe(uniqueName);
    expect(req.departments).toHaveLength(2);

    // Verify pending check finds it
    const pending = findPendingUniversityRequest(uniqueName);
    expect(pending).not.toBeNull();
    expect(pending?._id).toBe(req._id);

    // Trying to submit the same university again while pending must fail
    let pendingErr: any = null;
    try {
      await submitUniversityRequest({
        name: uniqueName,
        location: 'Pune, Maharashtra',
      });
    } catch (err: any) {
      pendingErr = err;
    }
    expect(pendingErr).not.toBeNull();
    expect(pendingErr.isPending).toBe(true);
    expect(pendingErr.message).toContain('is already under administrative review');
  });

  it('Admin approval activates university into catalog and adds departments', async () => {
    const uniName = `Apex Institute ${Date.now()}`;
    const req = await submitUniversityRequest({
      name: uniName,
      location: 'Bengaluru, Karnataka',
      departments: ['AI & Robotics', 'Bioinformatics'],
      requestedByName: 'Aarav Patel',
      requestedByEmail: 'aarav@apex.edu',
    });

    const admin = {
      id: 'admin-1',
      email: 'admin@studdybuddy.com',
      displayName: 'System Admin',
    };

    const approvalResult = await approveUniversityRequest(req._id!.toString(), admin);
    expect(approvalResult.university.name).toBe(uniName);
    expect(approvalResult.university.isActive).toBe(true);
    expect(approvalResult.faculties.length).toBeGreaterThanOrEqual(2);

    // Verify it is now live in catalogRepository
    const liveUni = await getUniversityBySlug(approvalResult.university.slug);
    expect(liveUni).not.toBeNull();
    expect(liveUni?.name).toBe(uniName);

    // Verify faculties can be retrieved
    const faculties = await getFacultiesByUniversity(approvalResult.university.slug);
    expect(faculties.length).toBeGreaterThanOrEqual(2);

    // Add a new department to this approved university
    const newDept = await addFacultyToUniversity(approvalResult.university.slug, 'Department of Aerospace Engineering');
    expect(newDept.name).toBe('Department of Aerospace Engineering');
    expect(newDept.universityId).toBe(approvalResult.university.slug);

    const updatedFaculties = await getFacultiesByUniversity(approvalResult.university.slug);
    const hasAerospace = updatedFaculties.some((f) => f.name === 'Department of Aerospace Engineering');
    expect(hasAerospace).toBe(true);
  });
});

