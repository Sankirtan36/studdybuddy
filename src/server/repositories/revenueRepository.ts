import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { getDb } from '../db/mongo';

export interface PaymentTransaction {
  _id?: string;
  id: string;
  amount: number; // in INR
  currency: 'INR' | 'USD';
  type: 'subscription' | 'microtransaction' | 'campus_partner' | 'contribution';
  planName: string;
  description: string;
  userEmail: string;
  userName: string;
  status: 'completed' | 'pending' | 'refunded';
  paymentMethod: 'UPI' | 'Card' | 'NetBanking' | 'Razorpay' | 'Direct';
  createdAt: Date;
}

export interface RevenueSummary {
  totalRevenueAllTime: number;
  revenueThisMonth: number;
  revenueThisWeek: number;
  revenueToday: number;
  totalTransactionsCount: number;
  averageOrderValue: number;
  activeSubscribersCount: number;
}

function getDataDir(): string {
  const p1 = path.resolve(process.cwd(), '.data');
  const p2 = path.resolve(process.cwd(), 'studdybuddy', '.data');
  const dir = fs.existsSync(p2) ? p2 : p1;
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {}
  return dir;
}

// Seed default platform transactions for initial launch & analytics demonstration
const SEED_TRANSACTIONS: PaymentTransaction[] = [
  {
    id: 'tx-1001',
    amount: 499,
    currency: 'INR',
    type: 'subscription',
    planName: 'StuddyBuddy Pro Pass (Semester)',
    description: 'Unlimited PDF downloads & priority processing',
    userEmail: 'student@studdybuddy.in',
    userName: 'Kunal Sharma',
    status: 'completed',
    paymentMethod: 'UPI',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
  },
  {
    id: 'tx-1002',
    amount: 199,
    currency: 'INR',
    type: 'microtransaction',
    planName: 'Exam Cram Bundle Pack',
    description: 'Computer Architecture Solved Papers Pack',
    userEmail: 'aryan@gmail.com',
    userName: 'Aryan Admin',
    status: 'completed',
    paymentMethod: 'Card',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
  },
  {
    id: 'tx-1003',
    amount: 2499,
    currency: 'INR',
    type: 'campus_partner',
    planName: 'Institutional Campus License',
    description: 'Annual verified branch study material indexing for GTU Department',
    userEmail: 'admin@gtu.edu.in',
    userName: 'GTU Faculty Representative',
    status: 'completed',
    paymentMethod: 'NetBanking',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
  },
  {
    id: 'tx-1004',
    amount: 499,
    currency: 'INR',
    type: 'subscription',
    planName: 'StuddyBuddy Pro Pass (Semester)',
    description: 'High-speed cloud PDF merging & document access',
    userEmail: 'neha.patel@paruluniversity.ac.in',
    userName: 'Neha Patel',
    status: 'completed',
    paymentMethod: 'UPI',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
  },
  {
    id: 'tx-1005',
    amount: 350,
    currency: 'INR',
    type: 'contribution',
    planName: 'Student Contributor Tip',
    description: 'Peer contribution for comprehensive Engineering Mathematics notes',
    userEmail: 'rohit.v@gmail.com',
    userName: 'Rohit Verma',
    status: 'completed',
    paymentMethod: 'UPI',
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
  },
  {
    id: 'tx-1006',
    amount: 499,
    currency: 'INR',
    type: 'subscription',
    planName: 'StuddyBuddy Pro Pass (Semester)',
    description: 'Semester 4 Study Pack & fast PDF tool suite',
    userEmail: 'aditi.m@du.ac.in',
    userName: 'Aditi Mathur',
    status: 'completed',
    paymentMethod: 'UPI',
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
  },
];

export function readLocalTransactions(): PaymentTransaction[] {
  const file = path.join(getDataDir(), 'payments.json');
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8');
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) {
        return list.map((t: any) => ({
          ...t,
          createdAt: new Date(t.createdAt),
        }));
      }
    }
  } catch {}

  // Initialize with seed data
  writeLocalTransactions(SEED_TRANSACTIONS);
  return [...SEED_TRANSACTIONS];
}

export function writeLocalTransactions(items: PaymentTransaction[]) {
  const file = path.join(getDataDir(), 'payments.json');
  try {
    fs.writeFileSync(file, JSON.stringify(items, null, 2), 'utf8');
  } catch (err: any) {
    console.warn('[RevenueRepo] Could not write transactions to disk:', err?.message);
  }
}

/**
 * Retrieve all transactions (checks MongoDB first, falls back to disk store)
 */
export async function getAllTransactions(): Promise<PaymentTransaction[]> {
  try {
    const db = await getDb();
    const list = await db
      .collection<PaymentTransaction>('payments')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    if (list && list.length > 0) {
      return list.map((t) => ({ ...t, createdAt: new Date(t.createdAt) }));
    }
  } catch {}

  return readLocalTransactions().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Record a new payment or earning transaction
 */
export async function recordPayment(data: {
  amount: number;
  currency?: 'INR' | 'USD';
  type: PaymentTransaction['type'];
  planName: string;
  description: string;
  userEmail: string;
  userName: string;
  paymentMethod?: PaymentTransaction['paymentMethod'];
}): Promise<PaymentTransaction> {
  const transaction: PaymentTransaction = {
    id: `tx-${Date.now()}-${randomBytes(3).toString('hex')}`,
    amount: Math.round(data.amount),
    currency: data.currency || 'INR',
    type: data.type,
    planName: data.planName,
    description: data.description,
    userEmail: data.userEmail,
    userName: data.userName,
    status: 'completed',
    paymentMethod: data.paymentMethod || 'UPI',
    createdAt: new Date(),
  };

  // Local storage write
  const current = readLocalTransactions();
  current.unshift(transaction);
  writeLocalTransactions(current);

  // MongoDB write
  try {
    const db = await getDb();
    await db.collection('payments').insertOne({ ...transaction });
  } catch {}

  return transaction;
}

/**
 * Calculate comprehensive platform revenue & earnings metrics
 */
export async function getRevenueSummary(): Promise<RevenueSummary> {
  const transactions = await getAllTransactions();
  const completed = transactions.filter((t) => t.status === 'completed');

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let totalRevenueAllTime = 0;
  let revenueThisMonth = 0;
  let revenueThisWeek = 0;
  let revenueToday = 0;
  const subscriberEmails = new Set<string>();

  for (const t of completed) {
    const amt = t.amount || 0;
    totalRevenueAllTime += amt;

    const tDate = new Date(t.createdAt);
    if (tDate >= startOfDay) {
      revenueToday += amt;
    }
    if (tDate >= startOfWeek) {
      revenueThisWeek += amt;
    }
    if (tDate >= startOfMonth) {
      revenueThisMonth += amt;
    }

    if (t.type === 'subscription' || t.type === 'campus_partner') {
      subscriberEmails.add(t.userEmail.toLowerCase());
    }
  }

  const totalTransactionsCount = completed.length;
  const averageOrderValue = totalTransactionsCount > 0 ? Math.round(totalRevenueAllTime / totalTransactionsCount) : 0;

  return {
    totalRevenueAllTime,
    revenueThisMonth,
    revenueThisWeek,
    revenueToday,
    totalTransactionsCount,
    averageOrderValue,
    activeSubscribersCount: subscriberEmails.size,
  };
}

