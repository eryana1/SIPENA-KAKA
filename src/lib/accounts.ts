import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { AppAccount } from "../types";

const LOCAL_ACCOUNTS_KEY = "e12win_app_accounts_v1";
const LOCAL_DELETED_KEY = "e12win_app_accounts_deleted_v1";

const getDeletedAccountIds = (): Set<string> => {
  try {
    const val = localStorage.getItem(LOCAL_DELETED_KEY);
    return val ? new Set(JSON.parse(val)) : new Set();
  } catch (e) {
    return new Set();
  }
};

const addDeletedAccountId = (id: string) => {
  try {
    const set = getDeletedAccountIds();
    set.add(id.toLowerCase());
    localStorage.setItem(LOCAL_DELETED_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.error("Error saving deleted account ID:", e);
  }
};

const removeDeletedAccountId = (id: string) => {
  try {
    const set = getDeletedAccountIds();
    set.delete(id.toLowerCase());
    localStorage.setItem(LOCAL_DELETED_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.error("Error removing deleted account ID:", e);
  }
};

// Helper to safely get from localStorage
const getLocalAccounts = (): AppAccount[] => {
  try {
    const val = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    return val ? JSON.parse(val) : [];
  } catch (e) {
    console.error("Error reading accounts from localStorage:", e);
    return [];
  }
};

// Helper to safely set to localStorage
const setLocalAccounts = (accounts: AppAccount[]) => {
  try {
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.error("Error saving accounts to localStorage:", e);
  }
};

// Default accounts created if none exist
export const DEFAULT_ADMIN_ACCOUNT: AppAccount = {
  id: "admin",
  username: "admin",
  password: "admin123",
  schoolName: "Administrator Sistem SIPENA KAKA",
  teacherName: "Super Admin",
  maxDevices: 99,
  role: "admin",
  status: "active",
  createdAt: new Date().toISOString(),
  notes: "Akun pengelola utama sistem."
};

export const DEFAULT_SAMPLE_ACCOUNT: AppAccount = {
  id: "sdn1_rancah",
  username: "sdn1_rancah",
  password: "guru123",
  schoolName: "SDN 1 Rancah",
  teacherName: "Guru SDN 1 Rancah",
  maxDevices: 13,
  role: "user",
  status: "active",
  createdAt: new Date().toISOString(),
  notes: "Akun sekolah SDN 1 Rancah (Batas 13 Perangkat/Guru)."
};

// Load all accounts from Firestore with local fallback
export const getAllAccounts = async (): Promise<AppAccount[]> => {
  const localList = getLocalAccounts();
  const deletedSet = getDeletedAccountIds();
  const mergedMap = new Map<string, AppAccount>();

  // Always seed super admin
  mergedMap.set(DEFAULT_ADMIN_ACCOUNT.id.toLowerCase(), DEFAULT_ADMIN_ACCOUNT);

  // Seed sample account only if not previously deleted
  if (!deletedSet.has(DEFAULT_SAMPLE_ACCOUNT.id.toLowerCase())) {
    mergedMap.set(DEFAULT_SAMPLE_ACCOUNT.id.toLowerCase(), DEFAULT_SAMPLE_ACCOUNT);
  }

  // Merge local cache
  localList.forEach((acc) => {
    if (acc && (acc.id || acc.username)) {
      const key = (acc.id || acc.username).toLowerCase();
      if (!deletedSet.has(key)) {
        mergedMap.set(key, acc);
      }
    }
  });

  // Fetch from Firestore
  try {
    const colRef = collection(db, "app_accounts");
    const snap = await getDocs(colRef);

    snap.forEach((d) => {
      const data = d.data() as AppAccount;
      if (data && (data.id || data.username)) {
        const key = (data.id || data.username).toLowerCase();
        if (!deletedSet.has(key)) {
          mergedMap.set(key, data);
        }
      }
    });
  } catch (err) {
    console.warn("Firestore getAllAccounts failed (using local cache):", err);
  }

  const finalList = Array.from(mergedMap.values());
  setLocalAccounts(finalList);

  // Sync missing defaults to Firestore in background
  try {
    const colRef = collection(db, "app_accounts");
    const snap = await getDocs(colRef);
    const existingIds = new Set(snap.docs.map((d) => d.id.toLowerCase()));

    if (!existingIds.has("admin")) {
      await saveAccount(DEFAULT_ADMIN_ACCOUNT);
    }
    if (!deletedSet.has("sdn1_rancah") && !existingIds.has("sdn1_rancah")) {
      await saveAccount(DEFAULT_SAMPLE_ACCOUNT);
    }
  } catch (e) {
    // Ignore error if offline
  }

  return finalList;
};

// Save or update an account
export const saveAccount = async (account: AppAccount): Promise<void> => {
  const accounts = getLocalAccounts();
  const accId = (account.id || account.username).toLowerCase();

  // If re-creating or saving an account, un-delete it
  removeDeletedAccountId(accId);

  const index = accounts.findIndex((a) => (a.id || "").toLowerCase() === accId || (a.username || "").toLowerCase() === accId);
  
  if (index >= 0) {
    accounts[index] = { ...accounts[index], ...account };
  } else {
    accounts.push(account);
  }

  setLocalAccounts(accounts);

  try {
    const docRef = doc(db, "app_accounts", accId);
    await setDoc(docRef, account, { merge: true });
  } catch (err) {
    console.warn("Firestore saveAccount failed (saved locally):", err);
  }
};

// Delete an account
export const deleteAccount = async (id: string): Promise<void> => {
  if (!id) return;
  const accId = id.toLowerCase();
  if (accId === "admin") {
    throw new Error("Akun Administrator Utama tidak dapat dihapus!");
  }

  // Record deletion
  addDeletedAccountId(accId);

  // Filter local accounts
  const accounts = getLocalAccounts().filter((a) => (a.id || "").toLowerCase() !== accId && (a.username || "").toLowerCase() !== accId);
  setLocalAccounts(accounts);

  try {
    const docRef = doc(db, "app_accounts", accId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn("Firestore deleteAccount failed:", err);
  }
};

// Authenticate user with Username/Code and Password
export const authenticateUser = async (usernameInput: string, passwordInput: string): Promise<{ success: boolean; account?: AppAccount; error?: string }> => {
  const cleanUsername = usernameInput.trim().toLowerCase();
  const cleanPassword = passwordInput.trim();

  if (!cleanUsername || !cleanPassword) {
    return { success: false, error: "Username dan password wajib diisi!" };
  }

  const allAccounts = await getAllAccounts();
  const normInput = cleanUsername.replace(/[^a-z0-9]/g, "");

  const account = allAccounts.find((a) => {
    const uName = (a.username || "").trim().toLowerCase();
    const accId = (a.id || "").trim().toLowerCase();
    const sName = (a.schoolName || "").trim().toLowerCase();

    // Exact matches
    if (uName === cleanUsername || accId === cleanUsername) return true;

    // Normalized alphanumeric match (e.g., "sdn 1 rancah" matches "sdn1_rancah")
    if (normInput.length > 0) {
      if (uName.replace(/[^a-z0-9]/g, "") === normInput) return true;
      if (accId.replace(/[^a-z0-9]/g, "") === normInput) return true;
      if (sName.replace(/[^a-z0-9]/g, "") === normInput) return true;
    }

    return false;
  });

  if (!account) {
    return { success: false, error: `Username / Kode Login "${usernameInput}" tidak ditemukan! Silakan periksa kembali.` };
  }

  if (account.password.trim() !== cleanPassword) {
    return { success: false, error: "Password yang Anda masukkan salah!" };
  }

  if (account.status === "disabled") {
    return { success: false, error: "Akun ini sedang dinonaktifkan oleh Administrator Sekolah. Silakan hubungi Admin." };
  }

  // Update last login
  account.lastLogin = new Date().toISOString();
  saveAccount(account).catch(() => {});

  return { success: true, account };
};
