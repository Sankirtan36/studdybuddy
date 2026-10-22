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

// Firebase configuration provided by user
export const firebaseConfig = {
  apiKey: "AIzaSyB9PQsxEze-qr2vbVL-1kOHVnjpozvAzEo",
  authDomain: "studdybuddy-49db8.firebaseapp.com",
  projectId: "studdybuddy-49db8",
  storageBucket: "studdybuddy-49db8.firebasestorage.app",
  messagingSenderId: "1002920824791",
  appId: "1:1002920824791:web:b28a7ec17842e988740592",
  measurementId: "G-MT9KTZK2PL"
};

// Initialize Firebase App safely (singleton pattern)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const firestore = getFirestore(app);
export const storage = getStorage(app);

/**
 * Sign in with Google Popup
 * If pop-up is blocked by browser, callers can fall back to signInWithGoogleRedirect
 */
export async function signInWithGoogle(): Promise<{ user: FirebaseUser; idToken: string }> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken();
    return { user: result.user, idToken };
  } catch (err: any) {
    // If popup was explicitly blocked by browser, attempt automatic redirect fallback
    if (err?.code === 'auth/popup-blocked') {
      console.warn('Google Popup was blocked by browser. Falling back to signInWithRedirect...');
      await signInWithRedirect(auth, googleProvider);
      // Wait for page redirection to begin
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    throw err;
  }
}

/**
 * Sign in with Google via direct page redirect (completely bypasses popup blockers)
 */
export async function signInWithGoogleRedirect(): Promise<void> {
  await signInWithRedirect(auth, googleProvider);
}

/**
 * Check if the user is returning from a Google redirect sign-in
 */
export async function checkGoogleRedirectResult(): Promise<{ user: FirebaseUser; idToken: string } | null> {
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
  const res = await signInWithEmailAndPassword(auth, email, pass);
  return res.user;
}

/**
 * Register with Email and Password
 */
export async function registerWithEmail(email: string, pass: string): Promise<FirebaseUser> {
  const res = await createUserWithEmailAndPassword(auth, email, pass);
  return res.user;
}

/**
 * Logout from Firebase
 */
export async function logoutFirebase(): Promise<void> {
  await signOut(auth);
}

/**
 * Send password reset email via Firebase Auth
 */
export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Change / Update user password with Firebase Auth
 * Automatically handles re-authentication or user session sync
 */
export async function changeFirebasePassword(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
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
      // If credential fails or provider mismatch, fallback to sign in below
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
    // If the user does not exist in Firebase yet (e.g. legacy/local user), create Firebase user with new password
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
  const docRef = doc(firestore, collectionName, docId);
  await setDoc(docRef, {
    ...data,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

/**
 * Add a new document to a Firestore collection
 */
export async function addFirestoreDocument(collectionName: string, data: any): Promise<string> {
  const colRef = collection(firestore, collectionName);
  const docRef = await addDoc(colRef, {
    ...data,
    createdAt: new Date().toISOString()
  });
  return docRef.id;
}