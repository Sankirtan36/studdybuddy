import { getDb } from '../db/mongo';
import type { AcademicDoubt, DoubtAnswer } from '../../types';
import { ObjectId } from 'mongodb';
import fs from 'node:fs';
import path from 'node:path';
import { awardReputation, REPUTATION_REWARDS } from '../reputation/reputationService';
import { createNotification } from '../notifications/notificationService';

import os from 'node:os';

function getDataDir(): string {
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    (typeof process.cwd === 'function' && process.cwd().startsWith('/var/task'))
  );

  if (isServerless) {
    const tmp = path.join(os.tmpdir(), 'studdybuddy-data');
    try {
      if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
    } catch {}
    return tmp;
  }

  const p1 = path.resolve(process.cwd(), '.data');
  if (fs.existsSync(p1)) return p1;
  const p2 = path.resolve(process.cwd(), 'studdybuddy', '.data');
  if (fs.existsSync(p2)) return p2;

  try {
    if (!fs.existsSync(p1)) fs.mkdirSync(p1, { recursive: true });
    return p1;
  } catch {
    const tmp = path.join(os.tmpdir(), 'studdybuddy-data');
    try {
      if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
    } catch {}
    return tmp;
  }
}

function ensureDataDir(): string {
  const dir = getDataDir();
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {}
  return dir;
}

function readLocalDoubts(): AcademicDoubt[] {
  const file = path.join(ensureDataDir(), 'doubts.json');
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function writeLocalDoubts(items: AcademicDoubt[]) {
  try {
    const file = path.join(ensureDataDir(), 'doubts.json');
    fs.writeFileSync(file, JSON.stringify(items, null, 2), 'utf8');
  } catch (err: any) {
    console.warn('[DoubtRepo] Could not write doubts to disk:', err?.message);
  }
}

function readLocalAnswers(): DoubtAnswer[] {
  const file = path.join(ensureDataDir(), 'doubt_answers.json');
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function writeLocalAnswers(items: DoubtAnswer[]) {
  try {
    const file = path.join(ensureDataDir(), 'doubt_answers.json');
    fs.writeFileSync(file, JSON.stringify(items, null, 2), 'utf8');
  } catch (err: any) {
    console.warn('[DoubtRepo] Could not write answers to disk:', err?.message);
  }
}

export async function createAcademicDoubt(
  data: Omit<AcademicDoubt, '_id' | 'createdAt' | 'updatedAt' | 'upvotesCount' | 'answersCount'>
): Promise<AcademicDoubt> {
  const now = new Date();
  const newDoubt: AcademicDoubt = {
    ...data,
    _id: `doubt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    upvotesCount: 0,
    answersCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const db = await getDb();
    const result = await db.collection('academicDoubts').insertOne(newDoubt as any);
    if (result.insertedId) {
      newDoubt._id = result.insertedId.toString();
    }
  } catch {}

  const local = readLocalDoubts();
  local.unshift(newDoubt);
  writeLocalDoubts(local);

  return newDoubt;
}

export async function searchAcademicDoubts(options: {
  programId?: string;
  subjectId?: string;
  tag?: string;
  limit?: number;
} = {}): Promise<AcademicDoubt[]> {
  const limit = options.limit || 20;

  try {
    const db = await getDb();
    const query: any = {};
    if (options.programId) query.programId = options.programId;
    if (options.subjectId) query.subjectId = options.subjectId;
    if (options.tag) query.tags = options.tag;

    return await db.collection<AcademicDoubt>('academicDoubts').find(query).sort({ createdAt: -1 }).limit(limit).toArray();
  } catch {
    const local = readLocalDoubts();
    return local
      .filter((d) => {
        if (options.programId && d.programId !== options.programId) return false;
        if (options.subjectId && d.subjectId !== options.subjectId) return false;
        if (options.tag && !d.tags?.includes(options.tag)) return false;
        return true;
      })
      .slice(0, limit);
  }
}

export async function getDoubtById(id: string): Promise<{ doubt: AcademicDoubt; answers: DoubtAnswer[] } | null> {
  let doubt: AcademicDoubt | null = null;
  let answers: DoubtAnswer[] = [];

  try {
    const db = await getDb();
    let query: any = { _id: id };
    if (ObjectId.isValid(id)) {
      query = { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
    }
    doubt = await db.collection<AcademicDoubt>('academicDoubts').findOne(query);
    if (doubt) {
      answers = await db
        .collection<DoubtAnswer>('doubtAnswers')
        .find({ doubtId: id })
        .sort({ isAccepted: -1, upvotesCount: -1, createdAt: 1 })
        .toArray();
    }
  } catch {}

  if (!doubt) {
    const local = readLocalDoubts();
    doubt = local.find((d) => d._id === id || d._id?.toString() === id) || null;
    if (doubt) {
      const localAnswers = readLocalAnswers();
      answers = localAnswers.filter((a) => a.doubtId === id);
    }
  }

  if (!doubt) return null;
  return { doubt, answers };
}

export async function addDoubtAnswer(
  doubtId: string,
  content: string,
  codeSnippet: string | undefined,
  authorId: string,
  authorName: string,
  isSeniorGuidance: boolean = false
): Promise<DoubtAnswer> {
  const now = new Date();
  const answerId = `ans-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newAnswer: DoubtAnswer = {
    _id: answerId,
    doubtId,
    content,
    codeSnippet,
    authorId,
    authorName,
    isSeniorGuidance,
    isAccepted: false,
    upvotesCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const db = await getDb();
    await db.collection('doubtAnswers').insertOne(newAnswer as any);
    let query: any = { _id: doubtId };
    if (ObjectId.isValid(doubtId)) {
      query = { $or: [{ _id: new ObjectId(doubtId) }, { _id: doubtId }] };
    }
    await db.collection('academicDoubts').updateOne(query, { $inc: { answersCount: 1 } });
  } catch {}

  const localAnswers = readLocalAnswers();
  localAnswers.push(newAnswer);
  writeLocalAnswers(localAnswers);

  const localDoubts = readLocalDoubts();
  const dIdx = localDoubts.findIndex((d) => d._id === doubtId || d._id?.toString() === doubtId);
  if (dIdx !== -1) {
    localDoubts[dIdx].answersCount = (localDoubts[dIdx].answersCount || 0) + 1;
    writeLocalDoubts(localDoubts);

    // Notify the question asker
    await createNotification(
      localDoubts[dIdx].authorId,
      'doubt_answered',
      'New Answer to Your Question',
      `${authorName} posted an answer to "${localDoubts[dIdx].title}".`,
      `/community?doubtId=${doubtId}`
    );
  }

  return newAnswer;
}

export async function acceptDoubtAnswer(
  doubtId: string,
  answerId: string,
  askerUserId: string
): Promise<{ success: boolean; error?: string }> {
  const data = await getDoubtById(doubtId);
  if (!data) return { success: false, error: 'Question not found' };

  if (data.doubt.authorId !== askerUserId) {
    return { success: false, error: 'Only the student who asked this doubt can accept an answer.' };
  }

  const answer = data.answers.find((a) => a._id === answerId || a._id?.toString() === answerId);
  if (!answer) return { success: false, error: 'Answer not found' };

  try {
    const db = await getDb();
    let dQuery: any = { _id: doubtId };
    if (ObjectId.isValid(doubtId)) dQuery = { $or: [{ _id: new ObjectId(doubtId) }, { _id: doubtId }] };
    await db.collection('academicDoubts').updateOne(dQuery, { $set: { acceptedAnswerId: answerId } });

    let aQuery: any = { _id: answerId };
    if (ObjectId.isValid(answerId)) aQuery = { $or: [{ _id: new ObjectId(answerId) }, { _id: answerId }] };
    await db.collection('doubtAnswers').updateOne(aQuery, { $set: { isAccepted: true } });
  } catch {}

  const localAnswers = readLocalAnswers();
  const aIdx = localAnswers.findIndex((a) => a._id === answerId || a._id?.toString() === answerId);
  if (aIdx !== -1) {
    localAnswers[aIdx].isAccepted = true;
    writeLocalAnswers(localAnswers);
  }

  // Award +15 reputation points to the answer author
  await awardReputation(answer.authorId, REPUTATION_REWARDS.DOUBT_ACCEPTED, 'doubt_accepted', answerId);

  // Notify the answer author
  await createNotification(
    answer.authorId,
    'reputation_awarded',
    'Answer Accepted! (+15 Rep Points)',
    `Your solution to "${data.doubt.title}" was accepted as the verified answer!`,
    `/community?doubtId=${doubtId}`
  );

  return { success: true };
}

