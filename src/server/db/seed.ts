import { getDb, ensureIndexes } from './mongo';
import type { University, Faculty, Program, AcademicTerm, Subject } from '../../types';

export const INITIAL_ACADEMIC_GROUPS = [
  {
    name: 'Engineering & Technology',
    slug: 'engineering-technology',
    programs: [
      {
        name: 'B.Tech Computer Science & Engineering',
        slug: 'btech-cse',
        code: 'BTECH-CSE',
        structureType: 'semester' as const,
        durationYears: 4,
        totalTerms: 8,
        subjects: {
          'Semester 1': [
            { name: 'Engineering Mathematics I', slug: 'eng-math-1', code: 'MATH101' },
            { name: 'Engineering Physics', slug: 'eng-physics', code: 'PHY101' },
            { name: 'Basics of Computer Programming (C)', slug: 'prog-c', code: 'CSE101' },
          ],
          'Semester 2': [
            { name: 'Engineering Mathematics II', slug: 'eng-math-2', code: 'MATH102' },
            { name: 'Data Structures & Algorithms', slug: 'dsa', code: 'CSE102' },
            { name: 'Digital Logic & Computer Organization', slug: 'dlco', code: 'CSE103' },
          ],
        },
      },
      {
        name: 'B.Tech AI & Data Science',
        slug: 'btech-aids',
        code: 'BTECH-AIDS',
        structureType: 'semester' as const,
        durationYears: 4,
        totalTerms: 8,
        subjects: {
          'Semester 1': [
            { name: 'Engineering Mathematics I', slug: 'eng-math-1', code: 'MATH101' },
            { name: 'Introduction to AI', slug: 'intro-ai', code: 'AIDS101' },
          ],
        },
      },
      {
        name: 'B.Tech Mechanical Engineering',
        slug: 'btech-mech',
        code: 'BTECH-MECH',
        structureType: 'semester' as const,
        durationYears: 4,
        totalTerms: 8,
        subjects: {
          'Semester 1': [
            { name: 'Engineering Mechanics', slug: 'eng-mechanics', code: 'MECH101' },
            { name: 'Engineering Graphics', slug: 'eng-graphics', code: 'MECH102' },
          ],
        },
      },
    ],
  },
  {
    name: 'IT & Computer Science',
    slug: 'it-computer-science',
    programs: [
      {
        name: 'Bachelor of Computer Applications (BCA)',
        slug: 'bca',
        code: 'BCA',
        structureType: 'semester' as const,
        durationYears: 3,
        totalTerms: 6,
        subjects: {
          'Semester 1': [
            { name: 'Introduction to Programming using C', slug: 'c-programming', code: 'BCA101' },
            { name: 'Computer Fundamentals & Office Automation', slug: 'comp-fund', code: 'BCA102' },
            { name: 'Mathematical Foundations of Computer Science', slug: 'discrete-math', code: 'BCA103' },
          ],
          'Semester 2': [
            { name: 'Object Oriented Programming with C++', slug: 'cpp-programming', code: 'BCA201' },
            { name: 'Data Structures using C/C++', slug: 'bca-dsa', code: 'BCA202' },
            { name: 'Database Management Systems', slug: 'bca-dbms', code: 'BCA203' },
          ],
        },
      },
      {
        name: 'Master of Computer Applications (MCA)',
        slug: 'mca',
        code: 'MCA',
        structureType: 'semester' as const,
        durationYears: 2,
        totalTerms: 4,
        subjects: {
          'Semester 1': [
            { name: 'Advanced Java Programming', slug: 'adv-java', code: 'MCA101' },
            { name: 'Relational Database Management Systems', slug: 'rdbms', code: 'MCA102' },
          ],
        },
      },
    ],
  },
  {
    name: 'Management Studies',
    slug: 'management-studies',
    programs: [
      {
        name: 'Bachelor of Business Administration (BBA)',
        slug: 'bba',
        code: 'BBA',
        structureType: 'semester' as const,
        durationYears: 3,
        totalTerms: 6,
        subjects: {
          'Semester 1': [
            { name: 'Principles of Management', slug: 'principles-mgmt', code: 'BBA101' },
            { name: 'Financial Accounting', slug: 'fin-acc', code: 'BBA102' },
            { name: 'Business Economics', slug: 'biz-econ', code: 'BBA103' },
          ],
        },
      },
      {
        name: 'Master of Business Administration (MBA)',
        slug: 'mba',
        code: 'MBA',
        structureType: 'semester' as const,
        durationYears: 2,
        totalTerms: 4,
        subjects: {
          'Semester 1': [
            { name: 'Marketing Management', slug: 'mkt-mgmt', code: 'MBA101' },
            { name: 'Organizational Behavior', slug: 'org-behavior', code: 'MBA102' },
          ],
        },
      },
    ],
  },
  {
    name: 'Medicine',
    slug: 'medicine',
    programs: [
      {
        name: 'MBBS (Bachelor of Medicine & Surgery)',
        slug: 'mbbs',
        code: 'MBBS',
        structureType: 'year' as const,
        durationYears: 5,
        totalTerms: 5,
        subjects: {
          'Year 1': [
            { name: 'Human Anatomy', slug: 'human-anatomy', code: 'MBBS101' },
            { name: 'Physiology', slug: 'physiology', code: 'MBBS102' },
            { name: 'Biochemistry', slug: 'biochemistry', code: 'MBBS103' },
          ],
        },
      },
    ],
  },
  {
    name: 'Ayurved',
    slug: 'ayurved',
    programs: [
      {
        name: 'BAMS (Ayurvedic Medicine & Surgery)',
        slug: 'bams',
        code: 'BAMS',
        structureType: 'year' as const,
        durationYears: 5,
        totalTerms: 5,
        subjects: {
          'Year 1': [
            { name: 'Kriya Sharir (Physiology)', slug: 'kriya-sharir', code: 'BAMS101' },
            { name: 'Rachana Sharir (Anatomy)', slug: 'rachana-sharir', code: 'BAMS102' },
          ],
        },
      },
    ],
  },
  {
    name: 'Homeopathy',
    slug: 'homeopathy',
    programs: [
      {
        name: 'BHMS (Homeopathic Medicine & Surgery)',
        slug: 'bhms',
        code: 'BHMS',
        structureType: 'year' as const,
        durationYears: 5,
        totalTerms: 5,
        subjects: {
          'Year 1': [
            { name: 'Organon of Medicine', slug: 'organon-medicine', code: 'BHMS101' },
            { name: 'Homeopathic Pharmacy', slug: 'homeo-pharmacy', code: 'BHMS102' },
          ],
        },
      },
    ],
  },
  {
    name: 'Pharmacy',
    slug: 'pharmacy',
    programs: [
      {
        name: 'Bachelor of Pharmacy (B.Pharm)',
        slug: 'bpharm',
        code: 'BPHARM',
        structureType: 'semester' as const,
        durationYears: 4,
        totalTerms: 8,
        subjects: {
          'Semester 1': [
            { name: 'Human Anatomy & Physiology I', slug: 'hap-1', code: 'BP101T' },
            { name: 'Pharmaceutical Analysis I', slug: 'pharm-analysis-1', code: 'BP102T' },
            { name: 'Pharmaceutics I', slug: 'pharmaceutics-1', code: 'BP103T' },
          ],
        },
      },
    ],
  },
  {
    name: 'Physiotherapy',
    slug: 'physiotherapy',
    programs: [
      {
        name: 'Bachelor of Physiotherapy (BPT)',
        slug: 'bpt',
        code: 'BPT',
        structureType: 'year' as const,
        durationYears: 4,
        totalTerms: 4,
        subjects: {
          'Year 1': [
            { name: 'Anatomy for Physiotherapy', slug: 'pt-anatomy', code: 'BPT101' },
            { name: 'Exercise Therapy I', slug: 'exercise-therapy-1', code: 'BPT102' },
          ],
        },
      },
    ],
  },
  {
    name: 'Nursing',
    slug: 'nursing',
    programs: [
      {
        name: 'B.Sc. Nursing',
        slug: 'bsc-nursing',
        code: 'BSCN',
        structureType: 'semester' as const,
        durationYears: 4,
        totalTerms: 8,
        subjects: {
          'Semester 1': [
            { name: 'Applied Anatomy & Applied Physiology', slug: 'nursing-anatomy-physio', code: 'NURS101' },
            { name: 'Applied Sociology & Applied Psychology', slug: 'nursing-socio-psycho', code: 'NURS102' },
          ],
        },
      },
    ],
  },
  {
    name: 'Applied Sciences',
    slug: 'applied-sciences',
    programs: [
      {
        name: 'B.Sc. Biotechnology',
        slug: 'bsc-biotech',
        code: 'BSC-BT',
        structureType: 'semester' as const,
        durationYears: 3,
        totalTerms: 6,
        subjects: {
          'Semester 1': [
            { name: 'Cell Biology & Genetics', slug: 'cell-bio-genetics', code: 'BT101' },
            { name: 'Microbiology Fundamentals', slug: 'microbio-fund', code: 'BT102' },
          ],
        },
      },
    ],
  },
  {
    name: 'Design / PID',
    slug: 'design-pid',
    programs: [
      {
        name: 'Bachelor of Design (B.Des)',
        slug: 'bdes',
        code: 'BDES',
        structureType: 'semester' as const,
        durationYears: 4,
        totalTerms: 8,
        subjects: {
          'Semester 1': [
            { name: 'Design Fundamentals & 2D Geometry', slug: 'design-fund', code: 'DES101' },
            { name: 'Color Theory & Visual Composition', slug: 'color-theory', code: 'DES102' },
          ],
        },
      },
    ],
  },
  {
    name: 'Fine Arts & Performing Arts',
    slug: 'fine-arts-performing-arts',
    programs: [
      {
        name: 'Bachelor of Visual Arts (BVA)',
        slug: 'bva',
        code: 'BVA',
        structureType: 'semester' as const,
        durationYears: 4,
        totalTerms: 8,
        subjects: {
          'Semester 1': [
            { name: 'Drawing & Perspective', slug: 'drawing-perspective', code: 'BVA101' },
          ],
        },
      },
    ],
  },
  {
    name: 'Commerce',
    slug: 'commerce',
    programs: [
      {
        name: 'Bachelor of Commerce (B.Com Honours)',
        slug: 'bcom-hons',
        code: 'BCOM',
        structureType: 'semester' as const,
        durationYears: 3,
        totalTerms: 6,
        subjects: {
          'Semester 1': [
            { name: 'Corporate Accounting', slug: 'corp-accounting', code: 'BCOM101' },
            { name: 'Business Law', slug: 'business-law', code: 'BCOM102' },
          ],
        },
      },
    ],
  },
  {
    name: 'Hotel Management & Catering Technology',
    slug: 'hotel-management-catering-technology',
    programs: [
      {
        name: 'Bachelor of Hotel Management & Catering Tech (BHMCT)',
        slug: 'bhmct',
        code: 'BHMCT',
        structureType: 'semester' as const,
        durationYears: 4,
        totalTerms: 8,
        subjects: {
          'Semester 1': [
            { name: 'Food Production Foundation I', slug: 'food-prod-1', code: 'HM101' },
            { name: 'Food & Beverage Service Foundation I', slug: 'fnb-service-1', code: 'HM102' },
          ],
        },
      },
    ],
  },
  {
    name: 'Law',
    slug: 'law',
    programs: [
      {
        name: 'BA LLB (Integrated)',
        slug: 'ba-llb',
        code: 'BALLB',
        structureType: 'semester' as const,
        durationYears: 5,
        totalTerms: 10,
        subjects: {
          'Semester 1': [
            { name: 'Constitutional Law I', slug: 'constitutional-law-1', code: 'LAW101' },
            { name: 'Law of Torts', slug: 'law-of-torts', code: 'LAW102' },
          ],
        },
      },
    ],
  },
  {
    name: 'Social Work',
    slug: 'social-work',
    programs: [
      {
        name: 'Master of Social Work (MSW)',
        slug: 'msw',
        code: 'MSW',
        structureType: 'semester' as const,
        durationYears: 2,
        totalTerms: 4,
        subjects: {
          'Semester 1': [
            { name: 'History & Philosophy of Social Work', slug: 'history-social-work', code: 'MSW101' },
          ],
        },
      },
    ],
  },
  {
    name: 'Arts & Liberal Arts',
    slug: 'arts-liberal-arts',
    programs: [
      {
        name: 'Bachelor of Arts (BA Psychology)',
        slug: 'ba-psychology',
        code: 'BA-PSY',
        structureType: 'semester' as const,
        durationYears: 3,
        totalTerms: 6,
        subjects: {
          'Semester 1': [
            { name: 'Introduction to Psychology', slug: 'intro-psychology', code: 'PSY101' },
          ],
        },
      },
    ],
  },
  {
    name: 'Agriculture',
    slug: 'agriculture',
    programs: [
      {
        name: 'B.Sc. (Hons.) Agriculture',
        slug: 'bsc-agriculture',
        code: 'BSC-AGRI',
        structureType: 'semester' as const,
        durationYears: 4,
        totalTerms: 8,
        subjects: {
          'Semester 1': [
            { name: 'Fundamentals of Agronomy', slug: 'fund-agronomy', code: 'AGRI101' },
            { name: 'Fundamentals of Soil Science', slug: 'soil-science', code: 'AGRI102' },
          ],
        },
      },
    ],
  },
  {
    name: 'Library & Information Science',
    slug: 'library-information-science',
    programs: [
      {
        name: 'Bachelor of Library & Information Science (B.Lib.I.Sc)',
        slug: 'blibisc',
        code: 'BLIB',
        structureType: 'semester' as const,
        durationYears: 1,
        totalTerms: 2,
        subjects: {
          'Semester 1': [
            { name: 'Library & Information Society', slug: 'library-society', code: 'BLIB101' },
          ],
        },
      },
    ],
  },
  {
    name: 'Architecture & Planning',
    slug: 'architecture-planning',
    programs: [
      {
        name: 'Bachelor of Architecture (B.Arch)',
        slug: 'barch',
        code: 'BARCH',
        structureType: 'semester' as const,
        durationYears: 5,
        totalTerms: 10,
        subjects: {
          'Semester 1': [
            { name: 'Architectural Design I', slug: 'arch-design-1', code: 'ARCH101' },
            { name: 'Building Construction & Materials I', slug: 'bcm-1', code: 'ARCH102' },
          ],
        },
      },
    ],
  },
];

/**
 * Idempotently seed Parul University and its 20 academic groups.
 */
export async function seedAcademicCatalog(): Promise<{
  universitiesCreated: number;
  facultiesCreated: number;
  programsCreated: number;
  termsCreated: number;
  subjectsCreated: number;
}> {
  const db = await getDb();
  await ensureIndexes(db);

  let counts = {
    universitiesCreated: 0,
    facultiesCreated: 0,
    programsCreated: 0,
    termsCreated: 0,
    subjectsCreated: 0,
  };

  const now = new Date();

  // 1. Upsert Parul University
  const uniDoc: Partial<University> = {
    name: 'Parul University',
    slug: 'parul-university',
    location: 'Vadodara, Gujarat, India',
    description: 'A leading multi-disciplinary university in Gujarat offering undergraduate, postgraduate and doctoral programs.',
    websiteUrl: 'https://paruluniversity.ac.in',
    isActive: true,
    updatedAt: now,
  };

  const uniRes = await db.collection('universities').findOneAndUpdate(
    { slug: 'parul-university' },
    { $set: uniDoc, $setOnInsert: { createdAt: now } },
    { upsert: true, returnDocument: 'after' }
  );

  const universityId = (uniRes?._id || (await db.collection('universities').findOne({ slug: 'parul-university' }))?._id)!.toString();
  counts.universitiesCreated = 1;

  // 2. Iterate each Academic Group (Faculty)
  for (const group of INITIAL_ACADEMIC_GROUPS) {
    const facDoc: Partial<Faculty> = {
      universityId,
      name: group.name,
      slug: group.slug,
      isActive: true,
      updatedAt: now,
    };

    const facRes = await db.collection('faculties').findOneAndUpdate(
      { universityId, slug: group.slug },
      { $set: facDoc, $setOnInsert: { createdAt: now } },
      { upsert: true, returnDocument: 'after' }
    );

    const facultyId = (facRes?._id || (await db.collection('faculties').findOne({ universityId, slug: group.slug }))?._id)!.toString();
    counts.facultiesCreated++;

    // 3. Upsert Programs
    for (const prog of group.programs) {
      const progDoc: Partial<Program> = {
        universityId,
        facultyId,
        name: prog.name,
        slug: prog.slug,
        code: prog.code,
        structureType: prog.structureType,
        durationYears: prog.durationYears,
        totalTerms: prog.totalTerms,
        isActive: true,
        updatedAt: now,
      };

      const progRes = await db.collection('programs').findOneAndUpdate(
        { universityId, facultyId, slug: prog.slug },
        { $set: progDoc, $setOnInsert: { createdAt: now } },
        { upsert: true, returnDocument: 'after' }
      );

      const programId = (progRes?._id || (await db.collection('programs').findOne({ universityId, facultyId, slug: prog.slug }))?._id)!.toString();
      counts.programsCreated++;

      // 4. Upsert Terms and Subjects
      let orderIndex = 1;
      for (const [termName, subjectList] of Object.entries(prog.subjects)) {
        const termDoc: Partial<AcademicTerm> = {
          programId,
          name: termName,
          orderIndex,
          isActive: true,
          updatedAt: now,
        };

        const termRes = await db.collection('academicTerms').findOneAndUpdate(
          { programId, orderIndex },
          { $set: termDoc, $setOnInsert: { createdAt: now } },
          { upsert: true, returnDocument: 'after' }
        );

        const academicTermId = (termRes?._id || (await db.collection('academicTerms').findOne({ programId, orderIndex }))?._id)!.toString();
        counts.termsCreated++;
        orderIndex++;

        // 5. Upsert Subjects
        for (const subj of subjectList) {
          const subjDoc: Partial<Subject> = {
            programId,
            academicTermId,
            name: subj.name,
            slug: subj.slug,
            code: subj.code,
            isActive: true,
            updatedAt: now,
          };

          await db.collection('subjects').findOneAndUpdate(
            { programId, academicTermId, slug: subj.slug },
            { $set: subjDoc, $setOnInsert: { createdAt: now } },
            { upsert: true }
          );
          counts.subjectsCreated++;
        }
      }
    }
  }

  return counts;
}
