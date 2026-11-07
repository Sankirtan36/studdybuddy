import type { APIRoute } from 'astro';
import { getAllTransactions, getRevenueSummary, recordPayment } from '../../../server/repositories/revenueRepository';

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
    return new Response(JSON.stringify({ error: '403 Forbidden - Admin only' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const [transactions, summary] = await Promise.all([
      getAllTransactions(),
      getRevenueSummary(),
    ]);

    return new Response(JSON.stringify({ ok: true, summary, transactions }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || 'Failed to fetch payments' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
    return new Response(JSON.stringify({ error: '403 Forbidden - Admin only' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { amount, planName, description, userEmail, userName, type, paymentMethod } = body;

    if (!amount || !planName || !userEmail) {
      return new Response(JSON.stringify({ error: 'Missing required payment fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const tx = await recordPayment({
      amount: Number(amount),
      planName,
      description: description || 'Administrative manual payment entry',
      userEmail,
      userName: userName || userEmail.split('@')[0],
      type: type || 'campus_partner',
      paymentMethod: paymentMethod || 'Direct',
    });

    return new Response(JSON.stringify({ ok: true, transaction: tx }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || 'Failed to record payment' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

