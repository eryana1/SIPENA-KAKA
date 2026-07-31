import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc,
  serverTimestamp,
  orderBy
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

// Initialize Google OAuth Provider with required Workspace scopes
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/drive.file");
googleProvider.addScope("https://www.googleapis.com/auth/userinfo.email");
googleProvider.addScope("https://www.googleapis.com/auth/userinfo.profile");

// Cache for access token
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Sign in with Google (using popup suitable for iframe/cross-origin)
export const loginWithGoogle = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) return null;
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Gagal mendapatkan access token Google Drive dari autentikasi.");
    }
    cachedAccessToken = credential.accessToken;
    
    // Save user data to Firestore
    await saveUserToDb(result.user);
    
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error("Firebase Login Error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Sign out
export const logoutUser = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// Listen to Auth State Changes
export const initAuthListener = (
  onSuccess: (user: User, token: string | null) => void,
  onFailure: () => void
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Note: in onAuthStateChanged, the token might need to be re-retrieved if cachedAccessToken is empty,
      // but in standard Firebase client SDK, signInWithPopup gives the credential token once.
      // If cachedAccessToken is null but the user is signed in, we can ask them to sign in again to re-grant Drive access.
      onSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      onFailure();
    }
  });
};

// Save or Update User profile in Firestore
// Helper to safely get from localStorage
const getLocal = (key: string): any | null => {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch (e) {
    console.error("Error reading localStorage:", e);
    return null;
  }
};

// Helper to safely set to localStorage
const setLocal = (key: string, value: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Error writing localStorage:", e);
  }
};

export const saveUserToDb = async (user: User, additionalData: any = {}) => {
  const localKey = `e12win_user_${user.uid}`;
  const localData = getLocal(localKey) || {};
  
  const mergedData = {
    uid: user.uid,
    nama: user.displayName || localData.nama || "Guru SIPENA KAKA",
    email: user.email || localData.email || "",
    sekolah: additionalData.sekolah || localData.sekolah || "",
    driveFolder: additionalData.driveFolder || localData.driveFolder || "",
    apiKey: additionalData.apiKey || localData.apiKey || "",
    tanggalDibuat: localData.tanggalDibuat || new Date().toISOString(),
    ...localData,
    ...additionalData
  };

  // Always save locally first
  setLocal(localKey, mergedData);

  try {
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, mergedData, { merge: true });
  } catch (error) {
    console.warn("Firestore saveUserToDb failed (offline fallback active):", error);
  }
};

// Retrieve User profile from Firestore
export const getUserFromDb = async (uid: string) => {
  const localKey = `e12win_user_${uid}`;
  const localData = getLocal(localKey);
  
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const remoteData = snap.data();
      if (localData && localData.updatedAt && remoteData.updatedAt) {
        if (new Date(localData.updatedAt).getTime() > new Date(remoteData.updatedAt).getTime()) {
          return localData;
        }
      }
      setLocal(localKey, remoteData);
      return remoteData;
    }
  } catch (error) {
    console.warn("Firestore getUserFromDb failed (reading from local cache):", error);
  }
  
  return localData;
};

// Update User profile directly
export const updateUserProfile = async (uid: string, data: any) => {
  const localKey = `e12win_user_${uid}`;
  const localData = getLocal(localKey) || {};
  const mergedData = { ...localData, ...data, updatedAt: new Date().toISOString() };
  
  setLocal(localKey, mergedData);

  try {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, mergedData, { merge: true });
  } catch (error) {
    console.warn("Firestore updateUserProfile failed (offline fallback active):", error);
  }
};

// Database generic operations for curriculum documents under user subcollection
// e.g., users/{uid}/documents/{docId}
export const getContextDocId = (
  baseType: string,
  profile: { tahunPelajaran?: string; semester?: string },
  mapel: string,
  kelas: string,
  fase: string
) => {
  const tp = (profile.tahunPelajaran || "2025_2026").replace(/\//g, "_");
  const sem = profile.semester || "1";
  const kls = (kelas || "1").replace(/\s+/g, "_");
  const f = (fase || "A").replace(/Fase\s+/g, "").replace(/\s*\(.*\)/g, "").trim();
  const mp = (mapel || "Bahasa Indonesia").replace(/[^a-zA-Z0-9]/g, "_");
  
  return `${baseType}_${tp}_Sm${sem}_Kls${kls}_Fase${f}_Mapel${mp}`;
};

// Map to store pending debounced Firestore writes per document key
const pendingDocWrites = new Map<string, { timeoutId: NodeJS.Timeout; data: any; execute: () => Promise<void> }>();

export const saveDocumentToDb = async (uid: string, collectionName: string, docId: string, data: any) => {
  const localKey = `e12win_doc_${uid}_${collectionName}_${docId}`;
  const docKey = `${uid}_${collectionName}_${docId}`;
  const dataWithTime = {
    ...data,
    updatedAt: new Date().toISOString()
  };
  
  // 1. Always update localStorage immediately for instant resilience and no data loss
  setLocal(localKey, dataWithTime);

  // 2. Debounce Firestore write stream to prevent "Write stream exhausted maximum allowed queued writes"
  if (pendingDocWrites.has(docKey)) {
    clearTimeout(pendingDocWrites.get(docKey)!.timeoutId);
  }

  const executeWrite = async () => {
    try {
      const docRef = doc(db, "users", uid, collectionName, docId);
      await setDoc(docRef, dataWithTime, { merge: true });
    } catch (error: any) {
      console.warn(`Firestore saveDocumentToDb warning for ${collectionName}/${docId}:`, error?.message || error);
    } finally {
      pendingDocWrites.delete(docKey);
    }
  };

  const timeoutId = setTimeout(() => {
    executeWrite();
  }, 1000); // 1 second debounce window for Firestore network sync

  pendingDocWrites.set(docKey, { timeoutId, data: dataWithTime, execute: executeWrite });
};

export const getDocumentFromDb = async (uid: string, collectionName: string, docId: string) => {
  const localKey = `e12win_doc_${uid}_${collectionName}_${docId}`;
  const localData = getLocal(localKey);

  try {
    const docRef = doc(db, "users", uid, collectionName, docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const remoteData = snap.data();
      if (localData && localData.updatedAt && remoteData.updatedAt) {
        const localTime = new Date(localData.updatedAt).getTime();
        const remoteTime = new Date(remoteData.updatedAt).getTime();
        if (localTime > remoteTime) {
          return localData;
        }
      }
      setLocal(localKey, remoteData);
      return remoteData;
    }
  } catch (error) {
    console.warn(`Firestore getDocumentFromDb failed for ${collectionName}/${docId} (reading from local cache):`, error);
  }

  return localData;
};

// Save a checkpoint version history
export const saveVersionToDb = async (uid: string, ver: any) => {
  const localKey = `e12win_versions_${uid}`;
  const localList = getLocal(localKey) || [];
  
  const filtered = localList.filter((v: any) => v.id !== ver.id);
  const updatedList = [...filtered, ver];
  setLocal(localKey, updatedList);

  try {
    const versionRef = doc(db, "users", uid, "versions", ver.id);
    await setDoc(versionRef, ver);
  } catch (error) {
    console.warn("Firestore saveVersionToDb failed (offline fallback active):", error);
  }
};

// Retrieve all versions
export const getVersionsFromDb = async (uid: string) => {
  const localKey = `e12win_versions_${uid}`;

  try {
    const versionsRef = collection(db, "users", uid, "versions");
    const versionsSnap = await getDocs(versionsRef);
    const list: any[] = [];
    versionsSnap.forEach((doc) => {
      list.push(doc.data());
    });
    setLocal(localKey, list);
    return list;
  } catch (error) {
    console.warn("Firestore getVersionsFromDb failed (reading from local cache):", error);
  }

  return getLocal(localKey) || [];
};

export { auth, db };
