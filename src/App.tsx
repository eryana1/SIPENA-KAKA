import React, { useState, useEffect } from "react";
import { 
  User as FirebaseUser 
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs,
  query,
  where
} from "firebase/firestore";
import { 
  LayoutDashboard, 
  Calendar as CalendarIcon, 
  Clock, 
  Sparkles, 
  GitBranch, 
  BarChart2, 
  Grid, 
  BookOpen, 
  Settings as SettingsIcon, 
  LogOut, 
  GraduationCap, 
  ShieldCheck, 
  ArrowRight,
  Database,
  CloudLightning,
  Loader2,
  RefreshCw,
  Save,
  Check
} from "lucide-react";

import { 
  loginWithGoogle, 
  logoutUser, 
  initAuthListener, 
  db, 
  saveUserToDb, 
  getUserFromDb,
  updateUserProfile,
  saveDocumentToDb,
  getDocumentFromDb,
  saveVersionToDb,
  getVersionsFromDb,
  getContextDocId
} from "./lib/firebase";

import { 
  Jenjang, 
  Fase, 
  UserProfile, 
  CalendarData, 
  JadwalItem, 
  TPData, 
  ATPData, 
  PROTAData, 
  PROSEMData, 
  RPPData, 
  VersionHistory 
} from "./types";

// Import modular panels
import DashboardPanel from "./components/DashboardPanel";
import CalendarPanel from "./components/CalendarPanel";
import SchedulePanel from "./components/SchedulePanel";
import TpPanel from "./components/TpPanel";
import AtpPanel from "./components/AtpPanel";
import ProtaPanel from "./components/ProtaPanel";
import ProsemPanel from "./components/ProsemPanel";
import RppPanel from "./components/RppPanel";
import { DisdikLogo } from "./components/DisdikLogo";
import SettingsPanel from "./components/SettingsPanel";

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);

  // Applet Data States
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [localTahunPelajaran, setLocalTahunPelajaran] = useState<string>("2026/2027");
  const [isTahunPelajaranSaved, setIsTahunPelajaranSaved] = useState<boolean>(true);

  useEffect(() => {
    if (profile?.tahunPelajaran) {
      setLocalTahunPelajaran(profile.tahunPelajaran);
      setIsTahunPelajaranSaved(true);
    }
  }, [profile?.tahunPelajaran]);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [schedule, setSchedule] = useState<JadwalItem[]>([]);
  const [tpData, setTpData] = useState<TPData | null>(null);
  const [atpData, setAtpData] = useState<ATPData | null>(null);
  const [protaData, setProtaData] = useState<PROTAData | null>(null);
  const [prosemData, setProsemData] = useState<PROSEMData | null>(null);
  const [rpps, setRpps] = useState<RPPData[]>([]);
  const [versions, setVersions] = useState<VersionHistory[]>([]);
  
  // Custom API key & drive folder states
  const [apiKey, setApiKey] = useState<string>("");
  const [driveFolderId, setDriveFolderId] = useState<string>("");

  const [authError, setAuthError] = useState<React.ReactNode | null>(null);

  // State for Training/Guest Mode
  const [guestName, setGuestName] = useState<string>("");
  const [guestSchool, setGuestSchool] = useState<string>("");

  // Complete Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = initAuthListener(
      async (firebaseUser, token) => {
        setUser(firebaseUser);
        if (token) setAccessToken(token);
        await loadUserData(firebaseUser.uid, firebaseUser);
        setLoading(false);
      },
      async () => {
        // Restore guest session only if both are set, otherwise show the landing/login screen
        const localUid = localStorage.getItem("e12win_local_uid");
        const savedName = localStorage.getItem("e12win_guest_name");
        
        if (localUid && savedName) {
          const guestUser = {
            uid: localUid,
            displayName: savedName,
            email: "peserta@e12win.id",
            emailVerified: false,
            isAnonymous: true,
            metadata: {},
            providerData: [],
            refreshToken: "",
            tenantId: null,
            delete: async () => {},
            getIdToken: async () => "",
            getIdTokenResult: async () => ({} as any),
            reload: async () => {},
            toJSON: () => ({})
          } as unknown as FirebaseUser;

          setUser(guestUser);
          setAccessToken(null);
          await loadUserData(localUid, guestUser);
        } else {
          setUser(null);
          setAccessToken(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch all user records from Firestore
  const loadUserData = async (uid: string, authUser?: any) => {
    const activeUser = authUser || user;

    const tasks = [
      // 1. Load Profile
      (async () => {
        try {
          const userProfile = await getUserFromDb(uid);
          if (userProfile) {
            setProfile(userProfile as UserProfile);
            if (userProfile.apiKey) setApiKey(userProfile.apiKey);
            if (userProfile.driveFolder) setDriveFolderId(userProfile.driveFolder);
          } else {
            // Create initial default profile
            const savedSchool = localStorage.getItem("e12win_guest_school") || "";
            const initialProfile: UserProfile = {
              uid,
              nama: activeUser?.displayName || "Guru SIPENA KAKA",
              email: activeUser?.email || "",
              sekolah: savedSchool,
              jenjang: Jenjang.SD,
              fase: Fase.A,
              kelas: "IV",
              tahunPelajaran: "2026/2027",
              semester: "1",
              tanggalDibuat: new Date().toISOString()
            };
            try {
              if (activeUser) {
                await saveUserToDb(activeUser, initialProfile);
              } else {
                const fallbackUser = {
                  uid,
                  displayName: "Guru SIPENA KAKA",
                  email: ""
                };
                await saveUserToDb(fallbackUser as any, initialProfile);
              }
            } catch (saveErr) {
              console.error("Error saving initial profile to Firestore:", saveErr);
            }
            setProfile(initialProfile);
          }
        } catch (errProfile: any) {
          console.error("Error loading user profile from Firestore:", errProfile);
          // Provide safe fallback profile so components don't crash
          const savedSchool = localStorage.getItem("e12win_guest_school") || "";
          const fallbackProfile: UserProfile = {
            uid,
            nama: activeUser?.displayName || "Guru SIPENA KAKA",
            email: activeUser?.email || "",
            sekolah: savedSchool,
            jenjang: Jenjang.SD,
            fase: Fase.A,
            kelas: "IV",
            tahunPelajaran: "2026/2027",
            semester: "1",
            tanggalDibuat: new Date().toISOString()
          };
          setProfile(fallbackProfile);
        }
      })(),

      // 2. Load Calendar
      (async () => {
        try {
          const cal = await getDocumentFromDb(uid, "academic_data", "calendar");
          if (cal) setCalendarData(cal as CalendarData);
        } catch (errCal: any) {
          console.error("Error loading calendar:", errCal);
        }
      })(),

      // 3. Load Schedule
      (async () => {
        try {
          const schedDoc = await getDocumentFromDb(uid, "academic_data", "schedule");
          if (schedDoc && schedDoc.items) {
            setSchedule(schedDoc.items as JadwalItem[]);
          }
        } catch (errSched: any) {
          console.error("Error loading schedule:", errSched);
        }
      })(),

      // 9. Load Saved Checkpoint Versions
      (async () => {
        try {
          const list = await getVersionsFromDb(uid);
          setVersions(list as VersionHistory[]);
        } catch (errVer: any) {
          console.error("Error loading versions:", errVer);
        }
      })()
    ];

    // Wait for all loads to settle, or unblock loading state within 2.5s using Promise.race
    await Promise.race([
      Promise.all(tasks),
      new Promise((resolve) => setTimeout(resolve, 2500))
    ]);
  };

  const handleGuestLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!guestName.trim()) {
      alert("Silakan masukkan nama Anda.");
      return;
    }
    if (!guestSchool.trim()) {
      alert("Silakan masukkan nama sekolah Anda.");
      return;
    }
    setAuthError(null);
    setLoading(true);
    try {
      const sanitizeStr = (str: string) => str.trim().toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");
      const guestUid = "user_" + sanitizeStr(guestName) + "_" + sanitizeStr(guestSchool);

      localStorage.setItem("e12win_local_uid", guestUid);
      localStorage.setItem("e12win_guest_name", guestName.trim());
      localStorage.setItem("e12win_guest_school", guestSchool.trim());

      const guestUser = {
        uid: guestUid,
        displayName: guestName.trim(),
        email: "peserta@e12win.id",
        emailVerified: false,
        isAnonymous: true,
        metadata: {},
        providerData: [],
        refreshToken: "",
        tenantId: null,
        delete: async () => {},
        getIdToken: async () => "",
        getIdTokenResult: async () => ({} as any),
        reload: async () => {},
        toJSON: () => ({})
      } as unknown as FirebaseUser;

      setUser(guestUser);
      setAccessToken(null); // Optional Google Drive connection is managed inside the Settings panel
      await loadUserData(guestUid, guestUser);
    } catch (err: any) {
      console.error("Guest login error:", err);
      setAuthError(<p className="text-red-400">Gagal masuk: {err.message}</p>);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setAuthError(null);
    try {
      const result = await loginWithGoogle();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        await loadUserData(result.user.uid, result.user);
      }
    } catch (error: any) {
      console.error("Auth error caught in App.tsx:", error);
      const errMsg = error.message || "";
      
      if (errMsg.includes("popup-closed-by-user") || errMsg.includes("closed-by-user")) {
        setAuthError(
          <div className="space-y-3 text-left text-xs text-red-200">
            <div className="flex items-center gap-1.5 font-bold text-sm text-red-400">
              <span className="text-base">⚠️</span> Jendela Masuk Ditutup / Terblokir
            </div>
            <p className="leading-relaxed">Sesi masuk dihentikan karena jendela masuk Google ditutup sebelum selesai atau diblokir oleh browser.</p>
            <div className="p-3 bg-red-950/40 rounded-xl border border-red-500/20 text-[11px] leading-relaxed space-y-1.5 text-red-200/90">
              <p className="font-bold text-white uppercase tracking-wider text-[9px]">Langkah Pemecahan Masalah:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Klik tombol <span className="font-bold text-sky-400">"Buka di Tab Baru"</span> (ikon panah keluar) di bagian kanan atas layar pratinjau ini untuk menghindari batasan iframe.</li>
                <li>Pastikan browser Anda tidak memblokir jendela popup. Jika ada ikon bertanda silang di baris alamat, klik dan pilih <span className="font-bold text-white">"Selalu izinkan popup"</span>.</li>
                <li>Setelah itu, silakan klik tombol masuk kembali.</li>
              </ul>
            </div>
          </div>
        );
      } else if (errMsg.includes("popup-blocked") || errMsg.includes("cancelled-popup-request")) {
        setAuthError(
          <div className="space-y-3 text-left text-xs text-red-200">
            <div className="flex items-center gap-1.5 font-bold text-sm text-red-400">
              <span className="text-base">⚠️</span> Jendela Masuk Diblokir Browser
            </div>
            <p className="leading-relaxed">Browser Anda mendeteksi dan memblokir jendela popup otomatis untuk masuk akun Google.</p>
            <div className="p-3 bg-red-950/40 rounded-xl border border-red-500/20 text-[11px] leading-relaxed space-y-1.5 text-red-200/90">
              <p className="font-bold text-white uppercase tracking-wider text-[9px]">Langkah Pemecahan Masalah:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Klik tombol <span className="font-bold text-sky-400">"Buka di Tab Baru"</span> di kanan atas layar pratinjau ini untuk memisahkan aplikasi dari bingkai sandbox.</li>
                <li>Atau izinkan popup melalui pengaturan browser (biasanya muncul notifikasi di kanan atas baris alamat).</li>
              </ul>
            </div>
          </div>
        );
      } else {
        setAuthError(
          <div className="space-y-1.5 text-left text-xs text-red-200">
            <p className="font-bold text-sm text-red-400">⚠️ Gagal Melakukan Autentikasi Google</p>
            <p className="leading-relaxed">{errMsg || "Terjadi masalah koneksi atau konfigurasi Firebase. Silakan coba kembali."}</p>
          </div>
        );
      }
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      // First clear localStorage so the auth state change listener won't auto-restore the guest session
      localStorage.removeItem("e12win_local_uid");
      localStorage.removeItem("e12win_guest_name");
      localStorage.removeItem("e12win_guest_school");

      // Then sign out of Firebase Auth
      await logoutUser();
      
      // Clear React states
      setUser(null);
      setAccessToken(null);
      setProfile(null);
      
      // Clear states
      setCalendarData(null);
      setSchedule([]);
      setTpData(null);
      setAtpData(null);
      setProtaData(null);
      setProsemData(null);
      setRpps([]);
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkGoogleDrive = async () => {
    try {
      await logoutUser();
      setAccessToken(null);
    } catch (err) {
      console.error("Error unlinking Drive:", err);
    }
  };

  // Modular Panel Save Handlers
  const handleSaveProfile = async (updatedFields: Partial<UserProfile>) => {
    if (!user) return;
    const newProfile = { ...profile, ...updatedFields } as UserProfile;
    await updateUserProfile(user.uid, updatedFields);
    setProfile(newProfile);
  };

  const handleSaveCalendar = async (cal: CalendarData) => {
    if (!user) return;
    await saveDocumentToDb(user.uid, "academic_data", "calendar", cal);
    setCalendarData(cal);
  };

  const handleSaveSchedule = async (items: JadwalItem[]) => {
    if (!user) return;
    await saveDocumentToDb(user.uid, "academic_data", "schedule", { items });
    setSchedule(items);
  };

  const handleLoadTp = async (ctx: { mapel: string; kelas: string; fase: string }) => {
    if (!user) return;
    const activeProfile = (profile || {
      tahunPelajaran: "2026/2027",
      semester: "1"
    }) as any;
    const docId = getContextDocId("tp", activeProfile, ctx.mapel, "Fase", ctx.fase);
    try {
      const tp = await getDocumentFromDb(user.uid, "academic_data", docId);
      setTpData(tp ? (tp as TPData) : null);
    } catch (err) {
      console.error("Error loading TP:", err);
      setTpData(null);
    }
  };

  const handleSaveTp = async (data: TPData) => {
    if (!user) return;
    const activeProfile = (profile || {
      tahunPelajaran: "2026/2027",
      semester: "1"
    }) as any;
    const docId = getContextDocId("tp", activeProfile, data.mapel, "Fase", data.fase);
    const updatedData = { ...data, kelas: "Fase" };
    await saveDocumentToDb(user.uid, "academic_data", docId, updatedData);
    setTpData(updatedData);
  };

  const handleLoadAtp = async (ctx: { mapel: string; kelas: string; fase: string }) => {
    if (!user) return;
    const activeProfile = (profile || {
      tahunPelajaran: "2026/2027",
      semester: "1"
    }) as any;
    const docId = getContextDocId("atp", activeProfile, ctx.mapel, "Fase", ctx.fase);
    try {
      const atp = await getDocumentFromDb(user.uid, "academic_data", docId);
      setAtpData(atp ? (atp as ATPData) : null);
    } catch (err) {
      console.error("Error loading ATP:", err);
      setAtpData(null);
    }
  };

  const handleSaveAtp = async (data: ATPData) => {
    if (!user) return;
    const activeProfile = (profile || {
      tahunPelajaran: "2026/2027",
      semester: "1"
    }) as any;
    const docId = getContextDocId("atp", activeProfile, data.mapel, "Fase", data.fase);
    const updatedData = { ...data, kelas: "Fase" };
    await saveDocumentToDb(user.uid, "academic_data", docId, updatedData);
    setAtpData(updatedData);
  };

  const getAlternateKelas = (kls: string): string | null => {
    if (!kls) return null;
    const val = kls.trim().toUpperCase();
    const mapping: { [key: string]: string } = {
      "1": "I", "2": "II", "3": "III", "4": "IV", "5": "V", "6": "VI",
      "7": "VII", "8": "VIII", "9": "IX", "10": "X", "11": "XI", "12": "XII",
      "I": "1", "II": "2", "III": "3", "IV": "4", "V": "5", "VI": "6",
      "VII": "7", "VIII": "8", "IX": "9", "X": "10", "XI": "11", "XII": "12"
    };
    return mapping[val] || null;
  };

  const handleLoadProta = async (ctx: { mapel: string; kelas: string; fase: string }) => {
    if (!user) return;
    const activeProfile = (profile || {
      tahunPelajaran: "2026/2027",
      semester: "1"
    }) as any;
    let docId = getContextDocId("prota", activeProfile, ctx.mapel, ctx.kelas, ctx.fase);
    try {
      let prota = await getDocumentFromDb(user.uid, "academic_data", docId);
      if (!prota) {
        const altKls = getAlternateKelas(ctx.kelas);
        if (altKls) {
          const altDocId = getContextDocId("prota", activeProfile, ctx.mapel, altKls, ctx.fase);
          prota = await getDocumentFromDb(user.uid, "academic_data", altDocId);
        }
      }

      if (!prota) {
        const FASE_CLASSES: { [key: string]: string[] } = {
          A: ["1", "2", "I", "II"],
          B: ["3", "4", "III", "IV"],
          C: ["5", "6", "V", "VI"],
          D: ["7", "8", "9", "VII", "VIII", "IX"],
          E: ["10", "X"],
          F: ["11", "12", "XI", "XII"]
        };
        const candidateClasses = FASE_CLASSES[ctx.fase] || ["1", "2", "Fase"];
        for (const k of candidateClasses) {
          const fDocId = getContextDocId("prota", activeProfile, ctx.mapel, k, ctx.fase);
          prota = await getDocumentFromDb(user.uid, "academic_data", fDocId);
          if (prota) break;
        }
      }

      if (!prota) {
        const faseDocId = getContextDocId("prota", activeProfile, ctx.mapel, "Fase", ctx.fase);
        prota = await getDocumentFromDb(user.uid, "academic_data", faseDocId);
      }

      setProtaData(prota ? (prota as PROTAData) : null);
    } catch (err) {
      console.error("Error loading PROTA:", err);
      setProtaData(null);
    }
  };

  const handleSaveProta = async (data: PROTAData) => {
    if (!user) return;
    const activeProfile = (profile || {
      tahunPelajaran: "2026/2027",
      semester: "1"
    }) as any;
    const docId = getContextDocId("prota", activeProfile, data.mapel, data.kelas, data.fase);
    await saveDocumentToDb(user.uid, "academic_data", docId, data);
    setProtaData(data);
  };

  const handleLoadProsem = async (ctx: { mapel: string; kelas: string; fase: string }) => {
    if (!user) return;
    const activeProfile = (profile || {
      tahunPelajaran: "2026/2027",
      semester: "1"
    }) as any;
    let docId = getContextDocId("prosem", activeProfile, ctx.mapel, ctx.kelas, ctx.fase);
    try {
      let prosem = await getDocumentFromDb(user.uid, "academic_data", docId);
      if (!prosem) {
        const altKls = getAlternateKelas(ctx.kelas);
        if (altKls) {
          const altDocId = getContextDocId("prosem", activeProfile, ctx.mapel, altKls, ctx.fase);
          prosem = await getDocumentFromDb(user.uid, "academic_data", altDocId);
        }
      }

      if (!prosem) {
        const FASE_CLASSES: { [key: string]: string[] } = {
          A: ["1", "2", "I", "II"],
          B: ["3", "4", "III", "IV"],
          C: ["5", "6", "V", "VI"],
          D: ["7", "8", "9", "VII", "VIII", "IX"],
          E: ["10", "X"],
          F: ["11", "12", "XI", "XII"]
        };
        const candidateClasses = FASE_CLASSES[ctx.fase] || ["1", "2", "Fase"];
        for (const k of candidateClasses) {
          const fDocId = getContextDocId("prosem", activeProfile, ctx.mapel, k, ctx.fase);
          prosem = await getDocumentFromDb(user.uid, "academic_data", fDocId);
          if (prosem) break;
        }
      }

      if (!prosem) {
        const faseDocId = getContextDocId("prosem", activeProfile, ctx.mapel, "Fase", ctx.fase);
        prosem = await getDocumentFromDb(user.uid, "academic_data", faseDocId);
      }

      setProsemData(prosem ? (prosem as PROSEMData) : null);
    } catch (err) {
      console.error("Error loading PROSEM:", err);
      setProsemData(null);
    }
  };

  const handleSaveProsem = async (data: PROSEMData) => {
    if (!user) return;
    const activeProfile = (profile || {
      tahunPelajaran: "2026/2027",
      semester: "1"
    }) as any;
    const docId = getContextDocId("prosem", activeProfile, data.mapel, data.kelas, data.fase);
    await saveDocumentToDb(user.uid, "academic_data", docId, data);
    setProsemData(data);
  };

  const handleLoadRppList = async (ctx: { mapel: string; kelas: string; fase: string }) => {
    if (!user) return;
    const activeProfile = (profile || {
      tahunPelajaran: "2026/2027",
      semester: "1"
    }) as any;
    let docId = getContextDocId("rpp_main", activeProfile, ctx.mapel, ctx.kelas, ctx.fase);
    try {
      let rppDoc = await getDocumentFromDb(user.uid, "academic_data", docId);
      if (!rppDoc) {
        const altKls = getAlternateKelas(ctx.kelas);
        if (altKls) {
          const altDocId = getContextDocId("rpp_main", activeProfile, ctx.mapel, altKls, ctx.fase);
          rppDoc = await getDocumentFromDb(user.uid, "academic_data", altDocId);
        }
      }
      if (rppDoc) {
        if (rppDoc.items && Array.isArray(rppDoc.items)) {
          setRpps(rppDoc.items as RPPData[]);
        } else {
          setRpps([rppDoc as RPPData]);
        }
      } else {
        setRpps([]);
      }
    } catch (err) {
      console.error("Error loading RPP list:", err);
      setRpps([]);
    }
  };

  const handleSaveRpp = async (data: RPPData) => {
    if (!user) return;
    const activeProfile = (profile || {
      tahunPelajaran: "2026/2027",
      semester: "1"
    }) as any;
    const docId = getContextDocId("rpp_main", activeProfile, data.mapel, data.kelas, data.fase);
    setRpps(prev => {
      const copy = [...prev];
      const index = copy.findIndex(r => r.mapel === data.mapel);
      if (index !== -1) {
        copy[index] = data;
      } else {
        copy.push(data);
      }
      saveDocumentToDb(user!.uid, "academic_data", docId, { items: copy }).catch(err => {
        console.error("Failed to save RPP to Firestore:", err);
      });
      return copy;
    });
  };

  const handleSaveVersion = async (ver: VersionHistory) => {
    if (!user) return;
    await saveVersionToDb(user.uid, ver);
    setVersions(prev => [...prev, ver]);
  };

  // Backup handlers
  const handleExportBackup = async (): Promise<string> => {
    const dataObj = {
      profile,
      calendarData,
      schedule,
      tpData,
      atpData,
      protaData,
      prosemData,
      rpps,
      versions
    };
    return JSON.stringify(dataObj, null, 2);
  };

  const handleImportBackup = async (jsonData: string) => {
    if (!user) return;
    const dataObj = JSON.parse(jsonData);
    
    // Write profile
    if (dataObj.profile) {
      await updateUserProfile(user.uid, dataObj.profile);
      setProfile(dataObj.profile);
    }
    // Write calendar
    if (dataObj.calendarData) {
      await saveDocumentToDb(user.uid, "academic_data", "calendar", dataObj.calendarData);
      setCalendarData(dataObj.calendarData);
    }
    // Write schedule
    if (dataObj.schedule) {
      await saveDocumentToDb(user.uid, "academic_data", "schedule", { items: dataObj.schedule });
      setSchedule(dataObj.schedule);
    }
    // Write TP
    if (dataObj.tpData) {
      await saveDocumentToDb(user.uid, "academic_data", "tp", dataObj.tpData);
      setTpData(dataObj.tpData);
    }
    // Write ATP
    if (dataObj.atpData) {
      await saveDocumentToDb(user.uid, "academic_data", "atp", dataObj.atpData);
      setAtpData(dataObj.atpData);
    }
    // Write PROTA
    if (dataObj.protaData) {
      await saveDocumentToDb(user.uid, "academic_data", "prota", dataObj.protaData);
      setProtaData(dataObj.protaData);
    }
    // Write PROSEM
    if (dataObj.prosemData) {
      await saveDocumentToDb(user.uid, "academic_data", "prosem", dataObj.prosemData);
      setProsemData(dataObj.prosemData);
    }
    // Write RPP
    if (dataObj.rpps && dataObj.rpps.length > 0) {
      await saveDocumentToDb(user.uid, "academic_data", "rpp_main", dataObj.rpps[0]);
      setRpps(dataObj.rpps);
    }
    // Write versions
    if (dataObj.versions) {
      for (const ver of dataObj.versions) {
        await saveVersionToDb(user.uid, ver);
      }
      setVersions(dataObj.versions);
    }
  };

  // Compute completeness stats
  const mapelPresets: { [key in Jenjang]: string[] } = {
    [Jenjang.SD]: [
      "PAIBP",
      "Pancasila",
      "Bahasa Indonesia",
      "Matematika",
      "IPAS",
      "Seni Rupa",
      "Seni Musik",
      "Seni Tari",
      "Seni Teater",
      "PJOK",
      "Bahasa Inggris",
      "Koding dan Kecerdasan Afiliasi",
      "Bahasa Daerah"
    ],
    [Jenjang.SMP]: ["Bahasa Indonesia", "Matematika", "IPA", "IPS", "Bahasa Inggris", "Pendidikan Pancasila", "Informatika", "PJOK", "Seni Budaya"],
    [Jenjang.SMA]: ["Bahasa Indonesia", "Matematika", "Fisika", "Kimia", "Biologi", "Sejarah", "Geografi", "Ekonomi", "Sosiologi", "Bahasa Inggris", "Informatika"]
  };

  const activeJenjang = profile?.jenjang || Jenjang.SD;
  const activeSubjects = mapelPresets[activeJenjang] || [];
  const totalSubjects = activeSubjects.length || 1;

  const tpFilledCount = activeSubjects.filter(sub => tpData?.items?.some(it => it.mapel?.toLowerCase().trim() === sub.toLowerCase().trim())).length;
  const atpFilledCount = activeSubjects.filter(sub => atpData?.items?.some(it => it.mapel?.toLowerCase().trim() === sub.toLowerCase().trim())).length;
  const protaFilledCount = activeSubjects.filter(sub => protaData?.items?.some(it => it.mapel?.toLowerCase().trim() === sub.toLowerCase().trim())).length;
  const prosemFilledCount = activeSubjects.filter(sub => prosemData?.items?.some(it => it.mapel?.toLowerCase().trim() === sub.toLowerCase().trim())).length;
  const rppFilledCount = activeSubjects.filter(sub => rpps?.some(it => it.mapel?.toLowerCase().trim() === sub.toLowerCase().trim() && it.fullContentHtml)).length;

  const completeness = {
    tp: Math.round((tpFilledCount / totalSubjects) * 100),
    atp: Math.round((atpFilledCount / totalSubjects) * 100),
    prota: Math.round((protaFilledCount / totalSubjects) * 100),
    prosem: Math.round((prosemFilledCount / totalSubjects) * 100),
    rpp: Math.round((rppFilledCount / totalSubjects) * 100),
  };

  // Render Loading Spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <h2 className="mt-4 font-bold text-slate-800">Menyiapkan Workspace SIPENA KAKA...</h2>
        <p className="text-xs text-slate-400 mt-1">Menghubungkan ke database aman &amp; server AI</p>
      </div>
    );
  }

  // Render Landing Page if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white flex flex-col">
        {/* Navbar */}
        <header className="border-b border-white/10 px-6 py-4 flex justify-between items-center bg-black/20 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-2 mx-auto sm:mx-0">
            <div className="w-9 h-9 bg-white/95 rounded-lg flex items-center justify-center shadow-md p-1 shrink-0">
              <DisdikLogo className="w-full h-full" />
            </div>
            <span className="font-extrabold tracking-tight text-xl bg-gradient-to-r from-blue-400 to-sky-300 bg-clip-text text-transparent">SIPENA KAKA</span>
          </div>
        </header>

        {/* Hero Area */}
        <main className="flex-1 flex flex-col items-center justify-center text-center px-6 max-w-4xl mx-auto py-12 space-y-8">
          <div className="inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-300 py-1 px-3.5 rounded-full text-xs font-bold uppercase tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            Edisi Kurikulum Merdeka Kemendikbudristek 2026
          </div>
          
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Penyusunan Perangkat Pembelajaran <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-emerald-300 bg-clip-text text-transparent">Otomatis dengan AI</span>
          </h1>
          
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-2xl">
            Asisten cerdas terintegrasi untuk guru menyusun TP, ATP, Program Tahunan (PROTA), Program Semester (PROSEM), dan RPP Mendalam secara otomatis, didukung penyimpanan awan dan ekspor dokumen Microsoft Word.
          </p>

          <div className="w-full max-w-md mx-auto pt-2">
            <form onSubmit={handleGuestLogin} className="w-full bg-slate-900/80 border border-white/10 p-6 rounded-2xl space-y-4 shadow-2xl text-left backdrop-blur-md">
              <div className="text-left space-y-1.5 border-b border-white/5 pb-3">
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Masuk / Akses Proyek
                </h3>
                <p className="text-xs text-slate-400 leading-normal">
                  Masukkan Nama Lengkap &amp; Sekolah Anda untuk memulai atau melanjutkan proyek yang pernah Anda simpan sebelumnya.
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nama Lengkap Beserta Gelar <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Contoh: Budi Santoso, S.Pd."
                  required
                  className="w-full p-3 border border-white/15 rounded-xl bg-slate-950/80 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium placeholder-slate-600 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nama Sekolah / Satuan Pendidikan <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={guestSchool}
                  onChange={(e) => setGuestSchool(e.target.value)}
                  placeholder="Contoh: SDN 1 Cijantung"
                  required
                  className="w-full p-3 border border-white/15 rounded-xl bg-slate-950/80 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium placeholder-slate-600 transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-500 to-sky-500 hover:from-blue-600 hover:to-sky-600 text-white font-extrabold text-sm rounded-xl transition shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 mt-4 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                Mulai Masuk &amp; Susun Dokumen
              </button>

              <div className="p-3 bg-blue-950/30 rounded-xl border border-blue-500/10 text-[10px] leading-relaxed text-slate-400 space-y-1">
                <p className="font-bold text-blue-300">💡 Tips Sinkronisasi Multi-Perangkat:</p>
                <p>
                  Sistem menyimpan proyek Anda secara aman di Cloud. Jika berganti perangkat atau browser, cukup masukkan kembali <strong>Nama Lengkap</strong> dan <strong>Nama Sekolah</strong> yang persis sama untuk memuat data Anda kembali.
                </p>
              </div>
            </form>
          </div>

          {authError && (
            <div className="p-4 bg-red-950/40 border border-red-500/30 text-red-200 rounded-xl text-sm max-w-md mx-auto shadow-lg backdrop-blur-sm">
              {authError}
            </div>
          )}

          {/* Grid items */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 pt-8 w-full text-left">
            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl">
              <ShieldCheck className="w-8 h-8 text-emerald-400 mb-3" />
              <h3 className="font-bold text-sm text-white">Cloud Database</h3>
              <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">Seluruh rincian dokumen Anda disimpan secara otomatis dan permanen di cloud database.</p>
            </div>
            
            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl">
              <Database className="w-8 h-8 text-blue-400 mb-3" />
              <h3 className="font-bold text-sm text-white">Sinkronisasi Instan</h3>
              <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">Beralih perangkat kerja tanpa takut kehilangan data berkat pencocokan data cerdas.</p>
            </div>

            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl">
              <Sparkles className="w-8 h-8 text-purple-400 mb-3" />
              <h3 className="font-bold text-sm text-white">Penyusunan RPP AI</h3>
              <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">Menyusun RPP Pembelajaran Mendalam (Deep Learning) secara runut menggunakan model Gemini.</p>
            </div>

            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl">
              <CloudLightning className="w-8 h-8 text-amber-400 mb-3" />
              <h3 className="font-bold text-sm text-white">Word .docx Export</h3>
              <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">Unduh file Word .docx rapi sekali klik untuk dicetak atau dibagikan ke pihak sekolah.</p>
            </div>
          </div>
        </main>

        <footer className="border-t border-white/10 py-6 text-center text-xs text-slate-500">
          SIPENA KAKA &copy; 2026. Dikembangkan untuk Guru Profesional Indonesia.
        </footer>
      </div>
    );
  }

  // Active Panel switcher
  const renderActivePanel = () => {
    // Provide safe fallback profile so components don't crash with TypeError
    const defaultProfile: UserProfile = {
      uid: user?.uid || "",
      nama: user?.displayName || "Guru SIPENA KAKA",
      email: user?.email || "",
      sekolah: "",
      jenjang: Jenjang.SD,
      fase: Fase.A,
      kelas: "IV",
      tahunPelajaran: "2026/2027",
      semester: "1",
      tanggalDibuat: new Date().toISOString()
    };
    const activeProfile = profile || defaultProfile;

    switch (activeTab) {
      case "dashboard":
        return (
          <DashboardPanel
            profile={activeProfile}
            onSaveProfile={handleSaveProfile}
            completeness={completeness}
            apiKey={apiKey}
            onSaveApiKey={(key) => {
              setApiKey(key);
              handleSaveProfile({ apiKey: key });
            }}
          />
        );
      case "calendar":
        return (
          <CalendarPanel
            calendarData={calendarData}
            onSaveCalendar={handleSaveCalendar}
            apiKey={apiKey}
            profile={activeProfile}
          />
        );
      case "schedule":
        return (
          <SchedulePanel
            profile={activeProfile}
            schedule={schedule}
            onSaveSchedule={handleSaveSchedule}
            apiKey={apiKey}
          />
        );
      case "tp":
        return (
          <TpPanel
            profile={activeProfile}
            tpData={tpData}
            onSaveTp={handleSaveTp}
            onLoadTp={handleLoadTp}
            apiKey={apiKey}
            driveFolderId={driveFolderId}
            accessToken={accessToken}
          />
        );
      case "atp":
        return (
          <AtpPanel
            profile={activeProfile}
            savedTps={tpData ? tpData.items : []}
            atpData={atpData}
            onSaveAtp={handleSaveAtp}
            onLoadTp={handleLoadTp}
            onLoadAtp={handleLoadAtp}
            apiKey={apiKey}
            driveFolderId={driveFolderId}
            accessToken={accessToken}
          />
        );
      case "prota":
        return (
          <ProtaPanel
            profile={activeProfile}
            savedAtps={atpData ? atpData.items : []}
            protaData={protaData}
            weeksEffective={calendarData ? calendarData.jumlahMinggu : 20}
            onSaveProta={handleSaveProta}
            onLoadAtp={handleLoadAtp}
            onLoadProta={handleLoadProta}
            apiKey={apiKey}
            driveFolderId={driveFolderId}
            accessToken={accessToken}
          />
        );
      case "prosem":
        return (
          <ProsemPanel
            profile={activeProfile}
            savedProtas={protaData ? protaData.items : []}
            savedAtps={atpData ? atpData.items : []}
            prosemData={prosemData}
            calendarData={calendarData}
            schedule={schedule}
            onSaveProsem={handleSaveProsem}
            onLoadProta={handleLoadProta}
            onLoadAtp={handleLoadAtp}
            onLoadProsem={handleLoadProsem}
            apiKey={apiKey}
            driveFolderId={driveFolderId}
            accessToken={accessToken}
          />
        );
      case "rpp":
        return (
          <RppPanel
            profile={activeProfile}
            rppDataList={rpps}
            savedTps={tpData ? tpData.items : []}
            savedAtps={atpData ? atpData.items : []}
            onSaveRpp={handleSaveRpp}
            onLoadTp={handleLoadTp}
            onLoadAtp={handleLoadAtp}
            onLoadProsem={handleLoadProsem}
            onLoadRppList={handleLoadRppList}
            savedVersions={versions}
            onSaveVersion={handleSaveVersion}
            apiKey={apiKey}
            driveFolderId={driveFolderId}
            accessToken={accessToken}
            prosemData={prosemData}
          />
        );
      case "settings":
        return (
          <SettingsPanel
            apiKey={apiKey}
            onSaveApiKey={(key) => {
              setApiKey(key);
              handleSaveProfile({ apiKey: key });
            }}
            accessToken={accessToken}
            onLinkGoogleDrive={handleLogin}
            onUnlinkGoogleDrive={handleUnlinkGoogleDrive}
            driveFolderId={driveFolderId}
            onSetDriveFolderId={(id) => {
              setDriveFolderId(id);
              handleSaveProfile({ driveFolder: id });
            }}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
          />
        );
      default:
        return <div>Konstruksi panel</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans" id="e12win_app">
      {/* Sidebar - responsive: full width on mobile, fixed 64 width on md+ */}
      <aside className="w-full md:w-64 bg-[#005A9E] text-white flex flex-col justify-between shrink-0 md:h-screen md:sticky md:top-0 border-b md:border-b-0 md:border-r border-blue-900/40 print:hidden">
        <div className="flex flex-col">
          {/* Logo / Brand Header */}
          <div className="p-5 flex items-center gap-3 bg-[#004a87] border-b border-white/10">
            <div className="w-8 h-8 bg-white rounded flex items-center justify-center shadow-sm p-0.5 shrink-0">
              <DisdikLogo className="w-full h-full" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-white block leading-none">SIPENA KAKA</span>
              <span className="text-[9px] text-white/75 font-bold uppercase tracking-wider mt-1 block">12-WIN AI</span>
            </div>
          </div>

          {/* Quick stats progress bar inside sidebar */}
          <div className="bg-white/10 border border-white/10 p-3.5 rounded-xl m-4">
            <span className="text-[9px] text-white/70 font-bold uppercase tracking-wider block">Progress Kelengkapan</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-extrabold text-white">
                {Math.round((completeness.tp + completeness.atp + completeness.prota + completeness.prosem + completeness.rpp) / 5)}%
              </span>
              <span className="text-[10px] text-white/60 font-semibold">selesai</span>
            </div>
            <div className="mt-2 w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
              <div className="bg-white h-full transition-all duration-300" style={{ width: `${Math.round((completeness.tp + completeness.atp + completeness.prota + completeness.prosem + completeness.rpp) / 5)}%` }}></div>
            </div>
          </div>

          {/* Sidebar Navigation */}
          <nav className="space-y-0.5 px-2">
            {[
              { id: "dashboard", label: "Dashboard Guru", icon: LayoutDashboard },
              { id: "calendar", label: "Kalender Pendidikan", icon: CalendarIcon },
              { id: "schedule", label: "Jadwal Pelajaran", icon: Clock },
              { id: "tp", label: "Penyusunan TP", icon: Sparkles },
              { id: "atp", label: "Alur Tujuan (ATP)", icon: GitBranch },
              { id: "prota", label: "Program Tahunan", icon: BarChart2 },
              { id: "prosem", label: "Program Semester", icon: Grid },
              { id: "rpp", label: "RPP Mendalam", icon: BookOpen },
              { id: "settings", label: "Pengaturan & Backup", icon: SettingsIcon }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 py-2 px-3 rounded-lg text-xs font-semibold transition text-left ${isActive ? "bg-white/10 border-l-4 border-white text-white font-bold" : "text-white/80 hover:bg-white/5 hover:text-white"}`}
                >
                  <Icon className="w-4 h-4 shrink-0 opacity-85" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-white/10 bg-[#004a87]/30">
          {/* Quick switcher for academic year */}
          <div className="mb-3">
            <label className="block text-[9px] font-bold text-white/50 uppercase mb-1">Tahun Ajaran</label>
            <div className="relative flex items-center">
              <input 
                type="text"
                value={localTahunPelajaran}
                onChange={(e) => {
                  setLocalTahunPelajaran(e.target.value);
                  setIsTahunPelajaranSaved(false);
                }}
                onBlur={() => {
                  if (localTahunPelajaran.trim() && localTahunPelajaran !== profile?.tahunPelajaran) {
                    handleSaveProfile({ tahunPelajaran: localTahunPelajaran.trim() });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && localTahunPelajaran.trim()) {
                    handleSaveProfile({ tahunPelajaran: localTahunPelajaran.trim() });
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="Contoh: 2026/2027"
                className="w-full text-xs p-1.5 pr-8 border border-white/10 rounded bg-[#005A9E]/50 text-white font-semibold focus:outline-none focus:ring-1 focus:ring-white/30"
              />
              <button
                type="button"
                onClick={() => {
                  if (localTahunPelajaran.trim()) {
                    handleSaveProfile({ tahunPelajaran: localTahunPelajaran.trim() });
                  }
                }}
                className={`absolute right-2 p-0.5 rounded transition-colors ${isTahunPelajaranSaved ? "text-emerald-300" : "text-amber-300 hover:text-white"}`}
                title={isTahunPelajaranSaved ? "Tersimpan" : "Klik untuk menyimpan"}
              >
                {isTahunPelajaranSaved ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-3 py-2 px-3.5 rounded-lg text-xs font-bold text-amber-200 hover:bg-white/5 hover:text-white transition text-left cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 shrink-0 text-amber-300 animate-spin-hover" />
            Mulai Sesi Baru
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col md:h-screen md:overflow-hidden bg-slate-50 print:h-auto print:overflow-visible">
        {/* Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200/80 flex items-center justify-between px-6 md:px-8 shadow-sm shrink-0 print:hidden">
          <div className="flex items-center gap-4">
            <h2 className="text-base md:text-lg font-bold text-slate-800 tracking-tight">
              {activeTab === "dashboard" ? "Dashboard Guru" : 
               activeTab === "calendar" ? "Kalender Pendidikan" :
               activeTab === "schedule" ? "Jadwal Pelajaran" :
               activeTab === "tp" ? "Penyusunan TP" :
               activeTab === "atp" ? "Alur Tujuan Pembelajaran (ATP)" :
               activeTab === "prota" ? "Program Tahunan (PROTA)" :
               activeTab === "prosem" ? "Program Semester (PROSEM)" :
               activeTab === "rpp" ? "Penyusunan RPP Mendalam" :
               activeTab === "settings" ? "Pengaturan & Backup" : "Workspace"}
            </h2>
            {apiKey ? (
              <div className="flex items-center gap-2 px-2.5 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold rounded-full border border-green-200/50">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                Gemini AI: Kunci Kustom Aktif
              </div>
            ) : (
              <div className="flex items-center gap-2 px-2.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full border border-amber-200/50">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                Gemini AI: Menggunakan Kunci Bawaan
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-900 leading-none">{user.displayName || "Guru Indonesia"}</p>
              <p className="text-[10px] text-slate-500 mt-1">
                {profile?.sekolah ? profile.sekolah : "Sekolah Belum Diisi"}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[#005A9E] shadow-sm text-sm">
              {user.displayName ? user.displayName.slice(0, 2).toUpperCase() : "G"}
            </div>
          </div>
        </header>

        {/* Scrollable Content View */}
        <main className="flex-1 p-6 overflow-y-auto space-y-6 print:p-0 print:overflow-visible">
          {renderActivePanel()}
        </main>

        {/* Footer Status */}
        <footer className="h-10 bg-slate-100 border-t border-slate-200 flex items-center px-6 justify-between text-[10px] font-medium text-slate-500 shrink-0 print:hidden">
          <div className="flex gap-4">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Database Connected</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> {driveFolderId ? "Drive Synced" : "Drive Unlinked"}</span>
          </div>
          <div>© 2026 SIPENA KAKA • Powered by Gemini AI Studio</div>
        </footer>
      </div>

      {/* Logout/New Session Custom Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-100 shadow-2xl overflow-hidden p-6 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5 text-amber-500" />
              </div>
              <div className="space-y-1.5 text-left">
                <h3 className="font-extrabold text-slate-900 text-base">Konfirmasi Mulai Sesi Baru</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Apakah Anda yakin ingin memulai sesi baru?
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Seluruh perangkat pembelajaran Anda saat ini <strong>telah aman tersimpan di cloud database</strong>. Dengan memulai sesi baru, Anda akan keluar dari sesi aktif ini dan dialihkan kembali ke halaman awal.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowLogoutConfirm(false);
                  await handleLogout();
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-lg text-xs transition shadow-sm cursor-pointer"
              >
                Ya, Sesi Baru
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
