import type { APIRoute } from 'astro';
import { readFirestoreCollection, saveFirestoreDocument, addFirestoreDocument } from '../../../lib/firebase';
import { readLocalResources } from '../../../server/repositories/resourceRepository';
import { readLocalUsers } from '../../../server/auth/userStore';
import fs from 'node:fs';
import path from 'node:path';

/**
 * GET /api/firebase/database?collection=resources&limit=20
 * Strictly restricted to Platform Administrators and Owners
 */
export const GET: APIRoute = async ({ url, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
    return new Response(
      JSON.stringify({ error: '403 Forbidden — Database inspection is restricted to platform administrators.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const colName = url.searchParams.get('collection') || 'resources';
    const limitCount = parseInt(url.searchParams.get('limit') || '50', 10);

    let documents = await readFirestoreCollection(colName, limitCount);

    // If Firestore has 0 documents for this collection, check local storage store
    if (!documents || documents.length === 0) {
      if (colName === 'resources') {
        documents = readLocalResources().slice(0, limitCount);
      } else if (colName === 'users') {
        // Strip sensitive password hashes before returning
        documents = readLocalUsers().slice(0, limitCount).map(u => ({
          _id: u._id,
          email: u.email,
          displayName: u.displayName,
          role: u.role,
          status: u.status,
          createdAt: u.createdAt,
          lastLoginAt: u.lastLoginAt,
        }));
      } else {
        const localFile = path.resolve(process.cwd(), '.data', `${colName}.json`);
        if (fs.existsSync(localFile)) {
          try {
            documents = JSON.parse(fs.readFileSync(localFile, 'utf8')).slice(0, limitCount);
          } catch {}
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        collection: colName,
        count: documents?.length || 0,
        data: documents || [],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Failed to read database collection' }),
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
    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return new Response(
        JSON.stringify({ error: '403 Forbidden — Administrative privileges required' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
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
