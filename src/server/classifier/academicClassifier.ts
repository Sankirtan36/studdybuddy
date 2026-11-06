import { INITIAL_ACADEMIC_GROUPS } from '../db/seed';
import type { ResourceCategory } from '../../types';

export interface StudentProfileContext {
  universityId?: string;
  facultyId?: string;
  programId?: string;
  currentSemester?: string;
}

export interface ClassificationResult {
  confident: boolean;
  confidenceScore: number; // 0.0 to 1.0
  suggestedUniversityId: string;
  suggestedFacultyId: string;
  suggestedProgramId: string;
  suggestedAcademicTermId: string;
  suggestedSubjectId: string;
  suggestedSubjectName: string;
  suggestedCategory: ResourceCategory;
  suggestedExamYear?: number;
  suggestedExamSession?: string;
  suggestedTitle: string;
  matchedKeywords: string[];
  explanation: string;
}

interface SubjectEntry {
  subjectId: string;
  subjectName: string;
  code?: string;
  programId: string;
  facultyId: string;
  termId: string;
  termName: string;
}

// Build subject lookup index from seed catalog
const CATALOG_SUBJECTS: SubjectEntry[] = [];
for (const group of INITIAL_ACADEMIC_GROUPS) {
  for (const prog of group.programs) {
    let termIdx = 1;
    for (const [termName, subjectList] of Object.entries(prog.subjects)) {
      for (const s of subjectList) {
        CATALOG_SUBJECTS.push({
          subjectId: s.slug,
          subjectName: s.name,
          code: s.code,
          programId: `prog-${prog.slug}`,
          facultyId: `fac-${group.slug}`,
          termId: `term-${termIdx}`,
          termName,
        });
      }
      termIdx++;
    }
  }
}

/**
 * Classify file metadata and filename to suggest academic destination.
 */
export function classifyAcademicFile(
  filename: string,
  profile?: StudentProfileContext
): ClassificationResult {
  // Normalize string for matching: replace underscores, dashes, dots with spaces
  const cleanName = filename.replace(/\.[^/.]+$/, ''); // remove extension
  const normalized = cleanName.toLowerCase().replace(/[_\-.]+/g, ' ');
  const tokens = normalized.split(/\s+/).filter(Boolean);

  const matchedKeywords: string[] = [];

  // 1. Detect Category
  let category: ResourceCategory = 'Notes';
  if (/\b(pyq|previous year|old paper|past paper|question paper)\b/i.test(normalized)) {
    category = 'Previous Year Question Paper';
    matchedKeywords.push('category:pyq');
  } else if (/\b(mid sem|midsem|internal exam|mid term)\b/i.test(normalized)) {
    category = 'Mid-Semester Paper';
    matchedKeywords.push('category:midsem');
  } else if (/\b(end sem|endsem|final exam|university exam)\b/i.test(normalized)) {
    category = 'End-Semester Paper';
    matchedKeywords.push('category:endsem');
  } else if (/\b(assignment solutions?|solutions?|solved)\b/i.test(normalized)) {
    category = 'Assignment Solution';
    matchedKeywords.push('category:solution');
  } else if (/\b(assignments?|hw|homework)\b/i.test(normalized)) {
    category = 'Assignment';
    matchedKeywords.push('category:assignment');
  } else if (/\b(question bank|qb|imp questions|important)\b/i.test(normalized)) {
    category = 'Question Bank';
    matchedKeywords.push('category:qbank');
  } else if (/\b(lab|practical|viva|manual)\b/i.test(normalized)) {
    category = 'Practical & Lab Material';
    matchedKeywords.push('category:lab');
  } else if (/\b(ppt|presentation|slides)\b/i.test(normalized)) {
    category = 'Presentation/PPT';
    matchedKeywords.push('category:ppt');
  } else {
    matchedKeywords.push('category:notes (default)');
  }

  // 2. Detect Exam Year (2015 - 2030)
  let examYear: number | undefined;
  const yearMatch = normalized.match(/\b(201[5-9]|202[0-9]|2030)\b/);
  if (yearMatch) {
    examYear = parseInt(yearMatch[1], 10);
    matchedKeywords.push(`year:${examYear}`);
  }

  // 3. Detect Exam Session (Summer / Winter)
  let examSession: string | undefined;
  if (/\b(summer|w23|w24|s24|s23|winter|regular|remedial)\b/i.test(normalized)) {
    if (/\bsummer\b/i.test(normalized)) examSession = 'Summer';
    else if (/\bwinter\b/i.test(normalized)) examSession = 'Winter';
    else if (/\bremedial\b/i.test(normalized)) examSession = 'Remedial';
    matchedKeywords.push(`session:${examSession || 'regular'}`);
  }

  // 4. Detect Semester / Academic Term
  let termId = 'term-1';
  let termName = 'Semester 1';
  const semMatch = normalized.match(/\b(sem(?:ester)?|term)?\s*([1-8])\b/);
  if (semMatch && semMatch[2]) {
    const semNum = parseInt(semMatch[2], 10);
    termId = `term-${semNum}`;
    termName = `Semester ${semNum}`;
    matchedKeywords.push(`term:${termName}`);
  } else if (profile?.currentSemester) {
    const semNum = parseInt(profile.currentSemester.replace(/[^0-9]/g, ''), 10) || 1;
    termId = `term-${semNum}`;
    termName = `Semester ${semNum}`;
    matchedKeywords.push(`term:${termName} (from student profile)`);
  }

  // 5. Detect Program
  let programId = profile?.programId || 'prog-btech-cse';
  let facultyId = profile?.facultyId || 'fac-engineering-technology';

  if (/\b(bca)\b/i.test(normalized)) {
    programId = 'prog-bca';
    facultyId = 'fac-it-computer-science';
    matchedKeywords.push('program:BCA');
  } else if (/\b(mca)\b/i.test(normalized)) {
    programId = 'prog-mca';
    facultyId = 'fac-it-computer-science';
    matchedKeywords.push('program:MCA');
  } else if (/\b(btech|b\.tech|cse|computer science)\b/i.test(normalized)) {
    programId = 'prog-btech-cse';
    facultyId = 'fac-engineering-technology';
    matchedKeywords.push('program:B.Tech CSE');
  } else if (/\b(aids|ai\s*ds|artificial intelligence)\b/i.test(normalized)) {
    programId = 'prog-btech-aids';
    facultyId = 'fac-engineering-technology';
    matchedKeywords.push('program:B.Tech AI&DS');
  } else if (/\b(mechanical|mech)\b/i.test(normalized)) {
    programId = 'prog-btech-mech';
    facultyId = 'fac-engineering-technology';
    matchedKeywords.push('program:B.Tech Mechanical');
  }

  // 6. Match Subject
  let matchedSubject: SubjectEntry | null = null;
  let highestScore = 0;

  for (const s of CATALOG_SUBJECTS) {
    let score = 0;

    // Direct Code Match (e.g. CSE102, MATH101, BCA101)
    if (s.code && new RegExp(`\\b${s.code}\\b`, 'i').test(normalized)) {
      score = 1.0;
      matchedKeywords.push(`code:${s.code}`);
    } else {
      // Slug match (e.g. 'dsa', 'c-programming')
      if (s.subjectId === 'dsa' && /\b(dsa|data structures)\b/i.test(normalized)) {
        score = 0.95;
      } else if (s.subjectId === 'bca-dsa' && /\b(dsa|data structures)\b/i.test(normalized) && programId === 'prog-bca') {
        score = 0.95;
      } else if (s.subjectId === 'eng-math-1' && /\b(maths? 1|maths? i|engineering mathematics)\b/i.test(normalized)) {
        score = 0.95;
      } else if (s.subjectId === 'eng-math-2' && /\b(maths? 2|maths? ii)\b/i.test(normalized)) {
        score = 0.95;
      } else if (s.subjectId === 'prog-c' && /\b(c prog|c programming|basics of c)\b/i.test(normalized)) {
        score = 0.95;
      } else if (s.subjectId === 'eng-physics' && /\b(physics|eng physics)\b/i.test(normalized)) {
        score = 0.95;
      } else if (s.subjectId === 'dlco' && /\b(dlco|digital logic)\b/i.test(normalized)) {
        score = 0.95;
      } else if (s.subjectId === 'bca-dbms' && /\b(dbms|database)\b/i.test(normalized)) {
        score = 0.95;
      } else {
        // Keyword overlap match against subject name words
        const sWords = s.subjectName.toLowerCase().split(/\s+/).filter((w) => w.length > 3 && !['basics', 'using', 'with', 'from'].includes(w));
        let matchCount = 0;
        for (const word of sWords) {
          if (tokens.includes(word)) {
            matchCount++;
          }
        }
        if (sWords.length > 0 && matchCount >= sWords.length) {
          score = 0.85;
        } else if (matchCount > 0) {
          score = 0.5 + (matchCount / sWords.length) * 0.3;
        }
      }

      // Bonus if subject belongs to the detected program & semester
      if (score > 0 && s.programId === programId) {
        score = Math.min(1.0, score + 0.1);
      }
    }

    if (score > highestScore) {
      highestScore = score;
      matchedSubject = s;
    }
  }

  // 7. Format clean, professional title
  let suggestedTitle = cleanName;
  if (matchedSubject) {
    suggestedTitle = `${matchedSubject.subjectName} — ${category}`;
    if (examYear) suggestedTitle += ` (${examYear})`;
  } else {
    // Clean formatted original title
    suggestedTitle = cleanName
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const confident = highestScore >= 0.7 && matchedSubject !== null;

  return {
    confident,
    confidenceScore: Math.round(highestScore * 100) / 100,
    suggestedUniversityId: profile?.universityId || 'parul-university',
    suggestedFacultyId: matchedSubject?.facultyId || facultyId,
    suggestedProgramId: matchedSubject?.programId || programId,
    suggestedAcademicTermId: matchedSubject?.termId || termId,
    suggestedSubjectId: matchedSubject?.subjectId || 'general',
    suggestedSubjectName: matchedSubject?.subjectName || 'General Subject',
    suggestedCategory: category,
    suggestedExamYear: examYear,
    suggestedExamSession: examSession,
    suggestedTitle,
    matchedKeywords,
    explanation: confident
      ? `High confidence match based on ${matchedKeywords.join(', ')}.`
      : `Uncertain subject classification (confidence ${Math.round(highestScore * 100)}%). Please confirm or select your subject manually.`,
  };
}
