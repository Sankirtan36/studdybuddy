import { getDb } from '../db/mongo';
import { INITIAL_ACADEMIC_GROUPS } from '../db/seed';
import type { University, Faculty, Program, Subject } from '../../types';

// Fallback static in-memory data for Parul University
const FALLBACK_UNIVERSITY: University = {
  _id: 'parul-university',
  name: 'Parul University',
  slug: 'parul-university',
  location: 'Vadodara, Gujarat, India',
  description: 'A leading multi-disciplinary university in Gujarat offering undergraduate, postgraduate and doctoral programs.',
  websiteUrl: 'https://paruluniversity.ac.in',
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export async function getUniversities(): Promise<University[]> {
  try {
    const db = await getDb();
    const items = await db.collection<University>('universities').find({ isActive: true }).toArray();
    if (items.length > 0) return items;
  } catch (err) {
    // Graceful fallback to static seed data
  }
  return [FALLBACK_UNIVERSITY];
}

export async function getUniversityBySlug(slug: string): Promise<University | null> {
  try {
    const db = await getDb();
    const item = await db.collection<University>('universities').findOne({ slug, isActive: true });
    if (item) return item;
  } catch (err) {
    // fallback
  }
  if (slug === 'parul-university') return FALLBACK_UNIVERSITY;
  return null;
}

export async function getFacultiesByUniversity(universityIdOrSlug: string): Promise<Faculty[]> {
  try {
    const db = await getDb();
    const uni = await getUniversityBySlug(universityIdOrSlug);
    const uniId = uni?._id?.toString() || universityIdOrSlug;
    const items = await db.collection<Faculty>('faculties').find({ universityId: uniId, isActive: true }).toArray();
    if (items.length > 0) return items;
  } catch (err) {
    // fallback
  }
  return INITIAL_ACADEMIC_GROUPS.map((g) => ({
    _id: `fac-${g.slug}`,
    universityId: 'parul-university',
    name: g.name,
    slug: g.slug,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  }));
}

export async function getFacultyBySlug(universityIdOrSlug: string, facultySlug: string): Promise<Faculty | null> {
  const faculties = await getFacultiesByUniversity(universityIdOrSlug);
  return faculties.find((f) => f.slug === facultySlug) || null;
}

export async function getProgramsByFaculty(facultyIdOrSlug: string): Promise<Program[]> {
  try {
    const db = await getDb();
    const items = await db.collection<Program>('programs').find({
      $or: [{ facultyId: facultyIdOrSlug }, { slug: facultyIdOrSlug }],
      isActive: true,
    }).toArray();
    if (items.length > 0) return items;
  } catch (err) {
    // fallback
  }

  const group = INITIAL_ACADEMIC_GROUPS.find((g) => g.slug === facultyIdOrSlug || `fac-${g.slug}` === facultyIdOrSlug);
  if (group) {
    return group.programs.map((p) => ({
      _id: `prog-${p.slug}`,
      universityId: 'parul-university',
      facultyId: `fac-${group.slug}`,
      name: p.name,
      slug: p.slug,
      code: p.code,
      structureType: p.structureType,
      durationYears: p.durationYears,
      totalTerms: p.totalTerms,
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    }));
  }
  return [];
}

export async function getProgramBySlug(programSlug: string): Promise<Program | null> {
  try {
    const db = await getDb();
    const item = await db.collection<Program>('programs').findOne({ slug: programSlug, isActive: true });
    if (item) return item;
  } catch (err) {
    // fallback
  }

  for (const group of INITIAL_ACADEMIC_GROUPS) {
    const prog = group.programs.find((p) => p.slug === programSlug);
    if (prog) {
      return {
        _id: `prog-${prog.slug}`,
        universityId: 'parul-university',
        facultyId: `fac-${group.slug}`,
        name: prog.name,
        slug: prog.slug,
        code: prog.code,
        structureType: prog.structureType,
        durationYears: prog.durationYears,
        totalTerms: prog.totalTerms,
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };
    }
  }
  return null;
}

export async function getSubjectsByProgram(programSlug: string): Promise<Subject[]> {
  try {
    const db = await getDb();
    const prog = await getProgramBySlug(programSlug);
    if (prog?._id) {
      const items = await db.collection<Subject>('subjects').find({ programId: prog._id.toString(), isActive: true }).toArray();
      if (items.length > 0) return items;
    }
  } catch (err) {
    // fallback
  }

  const result: Subject[] = [];
  for (const group of INITIAL_ACADEMIC_GROUPS) {
    const prog = group.programs.find((p) => p.slug === programSlug);
    if (prog) {
      let orderIndex = 1;
      for (const [, subjectList] of Object.entries(prog.subjects)) {
        for (const subj of subjectList) {
          result.push({
            _id: `subj-${subj.slug}`,
            programId: `prog-${prog.slug}`,
            academicTermId: `term-${orderIndex}`,
            name: subj.name,
            slug: subj.slug,
            code: subj.code,
            isActive: true,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
          });
        }
        orderIndex++;
      }
    }
  }
  return result;
}

export async function getSubjectBySlug(subjectSlug: string): Promise<Subject | null> {
  try {
    const db = await getDb();
    const item = await db.collection<Subject>('subjects').findOne({ slug: subjectSlug, isActive: true });
    if (item) return item;
  } catch (err) {
    // fallback
  }

  for (const group of INITIAL_ACADEMIC_GROUPS) {
    for (const prog of group.programs) {
      let orderIndex = 1;
      for (const [, subjectList] of Object.entries(prog.subjects)) {
        const found = subjectList.find((s: { slug: string; name: string; code?: string }) => s.slug === subjectSlug);
        if (found) {
          return {
            _id: `subj-${found.slug}`,
            programId: `prog-${prog.slug}`,
            academicTermId: `term-${orderIndex}`,
            name: found.name,
            slug: found.slug,
            code: found.code,
            isActive: true,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
          };
        }
        orderIndex++;
      }
    }
  }
  return null;
}
