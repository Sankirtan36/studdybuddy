import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail, 
  updatePassword, 
  EmailAuthProvider, 
  reauthenticateWithCredential, 
  type User as FirebaseUser 
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  setDoc, 
  addDoc, 
  query, 
  limit as firestoreLimit 
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

function cleanConfig(val: any): string {
  if (!val) return '';
  let str = String(val).trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }
  if (str.endsWith(',')) {
    str = str.slice(0, -1).trim();
  }
  return str;
}

const rawApiKey = (import.meta as any).env?.PUBLIC_FIREBASE_API_KEY || (typeof process !== 'undefined' ? process.env?.PUBLIC_FIREBASE_API_KEY : '');
const rawAuthDomain = (import.meta as any).env?.PUBLIC_FIREBASE_AUTH_DOMAIN || (typeof process !== 'undefined' ? process.env?.PUBLIC_FIREBASE_AUTH_DOMAIN : '');
const rawProjectId = (import.meta as any).env?.PUBLIC_FIREBASE_PROJECT_ID || (typeof process !== 'undefined' ? process.env?.PUBLIC_FIREBASE_PROJECT_ID : '');
const rawStorageBucket = (import.meta as any).env?.PUBLIC_FIREBASE_STORAGE_BUCKET || (typeof process !== 'undefined' ? process.env?.PUBLIC_FIREBASE_STORAGE_BUCKET : '');
const rawMessagingSenderId = (import.meta as any).env?.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || (typeof process !== 'undefined' ? process.env?.PUBLIC_FIREBASE_MESSAGING_SENDER_ID : '');
const rawAppId = (import.meta as any).env?.PUBLIC_FIREBASE_APP_ID || (typeof process !== 'undefined' ? process.env?.PUBLIC_FIREBASE_APP_ID : '');
const rawMeasurementId = (import.meta as any).env?.PUBLIC_FIREBASE_MEASUREMENT_ID || (typeof process !== 'undefined' ? process.env?.PUBLIC_FIREBASE_MEASUREMENT_ID : '');

// Firebase configuration provided by user
export const firebaseConfig = {
  apiKey: cleanConfig(rawApiKey),
  authDomain: cleanConfig(rawAuthDomain),
  projectId: cleanConfig(rawProjectId),
  storageBucket: cleanConfig(rawStorageBucket),
  messagingSenderId: cleanConfig(rawMessagingSenderId),
  appId: cleanConfig(rawAppId),
  measurementId: cleanConfig(rawMeasurementId),
};

// Initialize Firebase App safely (singleton pattern that NEVER crashes on module load)
export const app = (() => {
  try {
    if (getApps().length > 0) return getApp();
    if (firebaseConfig.apiKey) {
      return initializeApp(firebaseConfig);
    }
  } catch (err) {
    console.warn('Firebase initialization warning:', err);
  }
  return getApps()[0] || initializeApp({ apiKey: 'placeholder-api-key', projectId: 'studdybuddy-49db8' });
})();

// Initialize Firebase Services safely
export const auth = (() => {
  try {
    return getAuth(app);
  } catch (err) {
    console.warn('Firebase Auth service unavailable:', err);
    return null as any;
  }
})();

export const googleProvider = new GoogleAuthProvider();
try {
  googleProvider.setCustomParameters({ prompt: 'select_account' });
} catch {}

export const firestore = (() => {
  try {
    return getFirestore(app);
  } catch (err) {
    return null as any;
  }
})();

export const storage = (() => {
  try {
    return getStorage(app);
  } catch (err) {
    return null as any;
  }
})();

/**
 * Sign in with Google via direct in-page redirect (stays in the exact same tab; no new popup tab opens)
 */
export async function signInWithGoogle(): Promise<{ user: FirebaseUser; idToken: string } | null> {
  if (!auth) {
    throw new Error('Firebase Auth is not available. Check configuration.');
  }
  // Direct redirect in the current tab — guarantees no new tab or popup opens
  await signInWithRedirect(auth, googleProvider);
  return null;
}

/**
 * Sign in with Google via direct page redirect (completely bypasses popup blockers)
 */
export async function signInWithGoogleRedirect(): Promise<void> {
  if (!auth) throw new Error('Firebase Auth is not available.');
  await signInWithRedirect(auth, googleProvider);
}

/**
 * Check if the user is returning from a Google redirect sign-in
 */
export async function checkGoogleRedirectResult(): Promise<{ user: FirebaseUser; idToken: string } | null> {
  if (!auth) return null;
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      const idToken = await result.user.getIdToken();
      return { user: result.user, idToken };
    }
    return null;
  } catch (err: any) {
    console.warn('Google redirect check:', err?.message || err);
    return null;
  }
}

/**
 * Sign in with Email and Password
 */
export async function signInWithEmail(email: string, pass: string): Promise<FirebaseUser> {
  if (!auth) throw new Error('Firebase Auth is not available.');
  const res = await signInWithEmailAndPassword(auth, email, pass);
  return res.user;
}

/**
 * Register with Email and Password
 */
export async function registerWithEmail(email: string, pass: string): Promise<FirebaseUser> {
  if (!auth) throw new Error('Firebase Auth is not available.');
  const res = await createUserWithEmailAndPassword(auth, email, pass);
  return res.user;
}

/**
 * Logout from Firebase
 */
export async function logoutFirebase(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

/**
 * Send password reset email via Firebase Auth
 */
export async function sendPasswordReset(email: string): Promise<void> {
  if (!auth) throw new Error('Firebase Auth is not available.');
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Change / Update user password with Firebase Auth
 */
export async function changeFirebasePassword(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  if (!auth) throw new Error('Firebase Auth is not available.');
  const cleanEmail = email.trim();
  let currentUser = auth.currentUser;

  if (currentUser && currentUser.email?.toLowerCase() === cleanEmail.toLowerCase()) {
    try {
      const cred = EmailAuthProvider.credential(cleanEmail, currentPassword);
      await reauthenticateWithCredential(currentUser, cred);
      await updatePassword(currentUser, newPassword);
      return;
    } catch (reauthErr: any) {
      if (reauthErr?.code === 'auth/wrong-password' || reauthErr?.code === 'auth/invalid-credential') {
        throw new Error('Current password does not match.');
      }
    }
  }

  // Not signed in to Firebase client session, or needs fresh login
  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, currentPassword);
    if (cred.user) {
      await updatePassword(cred.user, newPassword);
      return;
    }
  } catch (err: any) {
    if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
      throw new Error('Current password is not correct.');
    }
    if (err?.code === 'auth/user-not-found' || err?.code === 'auth/invalid-email') {
      try {
        await createUserWithEmailAndPassword(auth, cleanEmail, newPassword);
        return;
      } catch (createErr: any) {
        throw new Error(createErr?.message || 'Failed to update password with Firebase Auth.');
      }
    }
    throw new Error(err?.message || 'Failed to update password with Firebase Auth.');
  }
}

/**
 * Read all documents from a Firestore collection
 */
export async function readFirestoreCollection(collectionName: string, maxItems = 50): Promise<any[]> {
  if (!firestore) return [];
  try {
    const colRef = collection(firestore, collectionName);
    const q = query(colRef, firestoreLimit(maxItems));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      _id: d.id,
      ...d.data()
    }));
  } catch (err: any) {
    console.warn(`Firestore read failed for collection "${collectionName}":`, err?.message || err);
    return [];
  }
}

/**
 * Read a single document from Firestore
 */
export async function readFirestoreDocument(collectionName: string, docId: string): Promise<any | null> {
  if (!firestore) return null;
  try {
    const docRef = doc(firestore, collectionName, docId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return {
      _id: snap.id,
      ...snap.data()
    };
  } catch (err: any) {
    console.warn(`Firestore read failed for doc "${collectionName}/${docId}":`, err?.message || err);
    return null;
  }
}

/**
 * Save/Set a document in Firestore
 */
export async function saveFirestoreDocument(collectionName: string, docId: string, data: any): Promise<void> {
  if (!firestore) return;
  try {
    const docRef = doc(firestore, collectionName, docId);
    await setDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err: any) {
    console.warn('saveFirestoreDocument skipped/failed:', err?.message || err);
  }
}

/**
 * Add a new document to a Firestore collection
 */
export async function addFirestoreDocument(collectionName: string, data: any): Promise<string> {
  if (!firestore) return '';
  try {
    const colRef = collection(firestore, collectionName);
    const docRef = await addDoc(colRef, {
      ...data,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (err: any) {
    console.warn('addFirestoreDocument skipped/failed:', err?.message || err);
    return '';
  }
}

/**
 * Delete a document from Firestore
 */
export async function deleteFirestoreDocument(collectionName: string, docId: string): Promise<void> {
  if (!firestore) return;
  try {
    const { deleteDoc } = await import('firebase/firestore');
    const docRef = doc(firestore, collectionName, docId);
    await deleteDoc(docRef);
  } catch (err: any) {
    console.warn('deleteFirestoreDocument skipped/failed:', err?.message || err);
  }
}
