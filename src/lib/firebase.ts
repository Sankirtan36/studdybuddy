import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
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
 */
export async function signInWithGoogle(): Promise<{ user: FirebaseUser; idToken: string }> {
  const result = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();
  return { user: result.user, idToken };
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