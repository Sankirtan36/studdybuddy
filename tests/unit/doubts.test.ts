import { describe, it, expect } from 'vitest';
import {
  createAcademicDoubt,
  getDoubtById,
  addDoubtAnswer,
  acceptDoubtAnswer,
} from '../../src/server/repositories/doubtRepository';
import { createUser, findUserById } from '../../src/server/auth/userStore';

describe('Module 5 & 6: Doubt Solving & Senior-Junior Guidance', () => {
  it('creates an academic doubt with code formatting', async () => {
    const doubt = await createAcademicDoubt({
      title: 'How to implement Binary Search Tree traversal in C++?',
      content: 'I am getting a segmentation fault during in-order traversal recursion.',
      codeSnippet: 'void inorder(Node* root) { inorder(root->left); cout << root->val; }',
      codeLanguage: 'cpp',
      authorId: 'usr-student-junior',
      authorName: 'Junior Student',
      universityId: 'parul-university',
      programId: 'btech-cse',
      subjectId: 'dsa',
      tags: ['C++', 'DSA', 'Trees'],
    });

    expect(doubt._id).toBeDefined();
    expect(doubt.codeLanguage).toBe('cpp');

    const fetched = await getDoubtById(doubt._id!.toString());
    expect(fetched).not.toBeNull();
    expect(fetched?.doubt.title).toContain('Binary Search Tree');
  });

  it('allows senior student to post guidance answer and asker to accept it', async () => {
    // 1. Create Senior user
    const senior = await createUser({
      email: `senior-${Date.now()}@parul.ac.in`,
      displayName: 'Aditya Senior',
      passwordHash: 'dummy',
      role: 'user',
      status: 'active',
      isVerifiedSenior: true,
      currentSemester: 'Semester 7',
      reputationPoints: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const seniorId = senior._id!.toString();

    // 2. Create Doubt
    const doubt = await createAcademicDoubt({
      title: 'Base case missing in recursion',
      content: 'Can someone inspect my base case?',
      authorId: 'usr-junior-asker',
      authorName: 'Junior Dev',
      universityId: 'parul-university',
      programId: 'btech-cse',
      subjectId: 'dsa',
      tags: ['Recursion'],
    });
    const doubtId = doubt._id!.toString();

    // 3. Senior answers
    const answer = await addDoubtAnswer(
      doubtId,
      'You are missing the base case `if (root == nullptr) return;` before calling recursion.',
      'if (!root) return;\ninorder(root->left);\ncout << root->val;\ninorder(root->right);',
      seniorId,
      'Aditya Senior',
      true
    );

    expect(answer.isSeniorGuidance).toBe(true);

    // 4. Asker accepts the answer
    const acceptRes = await acceptDoubtAnswer(doubtId, answer._id!.toString(), 'usr-junior-asker');
    expect(acceptRes.success).toBe(true);

    // 5. Verify senior received +15 reputation points
    const updatedSenior = await findUserById(seniorId);
    expect(updatedSenior?.reputationPoints).toBe(15);
  });

  it('prevents another student from accepting an answer for a question they did not ask', async () => {
    const doubt = await createAcademicDoubt({
      title: 'Question for Asker Only',
      content: 'Testing permission boundary',
      authorId: 'usr-real-asker',
      authorName: 'Real Asker',
      universityId: 'parul-university',
      programId: 'btech-cse',
      subjectId: 'dsa',
      tags: ['Auth'],
    });

    const ans = await addDoubtAnswer(doubt._id!.toString(), 'A valid answer', undefined, 'usr-helper', 'Helper');

    const unauthorizedAccept = await acceptDoubtAnswer(doubt._id!.toString(), ans._id!.toString(), 'usr-random-person');
    expect(unauthorizedAccept.success).toBe(false);
    expect(unauthorizedAccept.error).toContain('Only the student who asked');
  });
});

