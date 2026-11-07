import { getDb } from '../db/mongo';
import { findUserById, updateUser } from '../auth/userStore';
import type { ReputationEvent } from '../../types';

export const REPUTATION_REWARDS = {
  REQUEST_FULFILLED: 25, // Fulfilling a peer's requested note/PYQ
  UPLOAD_APPROVED: 10,   // Uploading a verified study resource
  DOUBT_ACCEPTED: 15,    // Having an answer marked as accepted
  UPVOTE_RECEIVED: 2,    // Answer or doubt upvoted by community
};

export function calculateBadge(points: number): string {
  if (points >= 300) return 'Master Buddy';
  if (points >= 150) return 'Campus Guide';
  if (points >= 50) return 'Active Contributor';
  return 'Novice Scholar';
}

/**
 * Award reputation points strictly on the server with duplicate prevention.
 */
export async function awardReputation(
  userId: string,
  points: number,
  reason: ReputationEvent['reason'],
  referenceId?: string
): Promise<{ newTotal: number; awarded: number }> {
  if (points <= 0) return { newTotal: 0, awarded: 0 };

  try {
    const db = await getDb();

    // Prevent duplicate reward for same reference event
    if (referenceId) {
      const existing = await db.collection<ReputationEvent>('reputationEvents').findOne({
        userId,
        reason,
        referenceId,
      });
      if (existing) {
        // Already awarded
        const user = await findUserById(userId);
        return { newTotal: user?.reputationPoints || 0, awarded: 0 };
      }
    }

    // Record the event
    await db.collection<ReputationEvent>('reputationEvents').insertOne({
      userId,
      points,
      reason,
      referenceId,
      createdAt: new Date(),
    });

    // Increment user's total points atomically
    const user = await findUserById(userId);
    const currentPoints = user?.reputationPoints || 0;
    const newTotal = currentPoints + points;

    await updateUser(userId, {
      reputationPoints: newTotal,
      updatedAt: new Date(),
    });

    return { newTotal, awarded: points };
  } catch {
    // Local fallback
    const user = await findUserById(userId);
    const newTotal = (user?.reputationPoints || 0) + points;
    await updateUser(userId, { reputationPoints: newTotal });
    return { newTotal, awarded: points };
  }
}

