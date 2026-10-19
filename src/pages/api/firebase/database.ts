import type { APIRoute } from 'astro';
import { readFirestoreCollection, saveFirestoreDocument, addFirestoreDocument } from '../../../lib/firebase';

/**
 * GET /api/firebase/database?collection=resources&limit=20
 * Reads documents from a Firestore collection
 */
export const GET: APIRoute = async ({ url }) => {
  try {
    const colName = url.searchParams.get('collection') || 'resources';
    const limitCount = parseInt(url.searchParams.get('limit') || '50', 10);

    const documents = await readFirestoreCollection(colName, limitCount);

    return new Response(
      JSON.stringify({
        ok: true,
        collection: colName,
        count: documents.length,
        data: documents,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Failed to read Firestore collection' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

/**
 * POST /api/firebase/database
 * Adds or updates a document in a Firestore collection
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required to write to database' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { collection: colName, docId, data } = body;

    if (!colName || !data) {
      return new Response(
        JSON.stringify({ error: 'Missing collection name or document data' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (docId) {
      await saveFirestoreDocument(colName, docId, {
        ...data,
        updatedBy: user.email,
      });
      return new Response(
        JSON.stringify({ ok: true, message: `Document ${docId} updated in ${colName}` }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      const newId = await addFirestoreDocument(colName, {
        ...data,
        createdBy: user.email,
      });
      return new Response(
        JSON.stringify({ ok: true, id: newId, message: `Document created in ${colName}` }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Failed to write to Firestore' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
