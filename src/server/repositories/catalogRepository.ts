import { getDb } from '../db/mongo';
import { INITIAL_ACADEMIC_GROUPS } from '../db/seed';
import type { University, Faculty, Program, AcademicTerm, Subject } from '../../types';

// Fallback static in-memory universities data
const FALLBACK_UNIVERSITIES: University[] = [
  {
    _id: 'parul-university',
    name: 'Parul University',
    slug: 'parul-university',
    location: 'Vadodara, Gujarat, India',
    description: 'A leading multi-disciplinary university in Gujarat offering undergraduate, postgraduate and doctoral programs.',
    websiteUrl: 'https://paruluniversity.ac.in',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    _id: 'gtu',
    name: 'Gujarat Technological University (GTU)',
    slug: 'gtu',
    location: 'Ahmedabad, Gujarat, India',
    description: 'Premier state engineering and technology university affiliated with top polytechnics and engineering institutes across Gujarat.',
    websiteUrl: 'https://gtu.ac.in',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    _id: 'msu-baroda',
    name: 'Maharaja Sayajirao University of Baroda (MSU)',
    slug: 'msu-baroda',
    location: 'Vadodara, Gujarat, India',
    description: 'One of premier multidisciplinary universities in Western India known for engineering, commerce, and applied sciences.',
    websiteUrl: 'https://msubaroda.ac.in',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    _id: 'dtu',
    name: 'Delhi Technological University (DTU)',
    slug: 'dtu',
    location: 'New Delhi, India',
    description: 'Renowned public technical university in Delhi pioneering research, technology, and applied computer science education.',
    websiteUrl: 'https://dtu.ac.in',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    _id: 'mumbai-university',
    name: 'University of Mumbai',
    slug: 'mumbai-university',
    location: 'Mumbai, Maharashtra, India',
    description: 'One of the oldest and largest collegiate universities in India offering diverse engineering, arts, and science curricula.',
    websiteUrl: 'https://mu.ac.in',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

export async function getUniversities(): Promise<University[]> {
  try {
    const db = await getDb();
    const items = await db.collection<University>('universities').find({ isActive: true }).toArray();
    if (items.length > 0) {
      // Merge with fallback to ensure rich catalog discovery
      const existingSlugs = new Set(items.map((u) => u.slug));
      const merged: University[] = [...items];
      for (const fb of FALLBACK_UNIVERSITIES) {
        if (!existingSlugs.has(fb.slug)) {
          merged.push(fb);
        }
      }
      return merged;
    }
  } catch (err) {
    // Graceful fallback to static seed data
  }
  return FALLBACK_UNIVERSITIES;
}

export async function getUniversityBySlug(slug: string): Promise<University | null> {
  try {
    const db = await getDb();
    const item = await db.collection<University>('universities').findOne({ slug, isActive: true });
    if (item) return item;
  } catch (err) {
    // fallback
  }
  return FALLBACK_UNIVERSITIES.find((u) => u.slug === slug) || null;
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

/**
 * Get all academic terms/semesters for a program dynamically based on program.totalTerms
 */
export async function getAcademicTermsByProgram(programSlug: string): Promise<AcademicTerm[]> {
  const prog = await getProgramBySlug(programSlug);
  if (!prog) return [];

  try {
    const db = await getDb();
    if (prog._id) {
      const dbTerms = await db
        .collection<AcademicTerm>('academicTerms')
        .find({ programId: prog._id.toString(), isActive: true })
        .sort({ orderIndex: 1 })
        .toArray();
      if (dbTerms.length > 0) return dbTerms;
    }
  } catch (err) {}

  // Generate terms according to structureType and totalTerms
  const terms: AcademicTerm[] = [];
  const total = prog.totalTerms || 8;
  const label = prog.structureType === 'year' ? 'Year' : prog.structureType === 'trimester' ? 'Trimester' : 'Semester';

  for (let i = 1; i <= total; i++) {
    terms.push({
      _id: `term-${prog.slug}-${i}`,
      programId: prog._id?.toString() || `prog-${prog.slug}`,
      name: `${label} ${i}`,
      slug: `semester-${i}`,
      orderIndex: i,
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    });
  }
  return terms;
}

export async function getAcademicTermBySlug(programSlug: string, termSlug: string): Promise<AcademicTerm | null> {
  const terms = await getAcademicTermsByProgram(programSlug);
  const match = terms.find((t) => t.slug === termSlug || `semester-${t.orderIndex}` === termSlug || t.orderIndex.toString() === termSlug);
  return match || null;
}

/**
 * Get subjects filtered by academic term/semester
 */
export async function getSubjectsByProgramAndTerm(
  programSlug: string,
  termSlugOrIndex: string | number
): Promise<Subject[]> {
  const allSubjects = await getSubjectsByProgram(programSlug);
  const termSlug = termSlugOrIndex.toString().toLowerCase();

  let orderIndex = 1;
  const parsedInt = parseInt(termSlug.replace(/\D/g, ''), 10);
  if (!isNaN(parsedInt)) {
    orderIndex = parsedInt;
  }

  // Check matching subjects
  const filtered = allSubjects.filter(
    (s) =>
      s.academicTermId === `term-${orderIndex}` ||
      s.academicTermId === `term-${programSlug}-${orderIndex}` ||
      s.academicTermId === orderIndex.toString()
  );

  return filtered.length > 0 ? filtered : allSubjects;
}

export interface SmartSearchCatalogItem {
  type: 'subject' | 'resource';
  name: string;
  code?: string;
  semester: string;
  branch: string;
  url: string;
}

/**
 * Get all searchable subject items for Google-like smart search autocomplete
 */
export async function getUniversitySearchItems(uniSlug: string): Promise<SmartSearchCatalogItem[]> {
  const items: SmartSearchCatalogItem[] = [];

  for (const group of INITIAL_ACADEMIC_GROUPS) {
    for (const prog of group.programs) {
      let orderIndex = 1;
      for (const [termName, subjectList] of Object.entries(prog.subjects)) {
        for (const subj of subjectList) {
          items.push({
            type: 'subject',
            name: subj.name,
            code: subj.code || '',
            semester: termName,
            branch: prog.name,
            url: `/university/${uniSlug}/${group.slug}/${prog.slug}/semester-${orderIndex}/${subj.slug}`,
          });
        }
        orderIndex++;
      }
    }
  }

  return items;
}

