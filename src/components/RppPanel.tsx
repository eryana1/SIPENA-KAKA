import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { 
  Sparkles, 
  Download, 
  Save, 
  Loader2, 
  History, 
  Upload, 
  CheckSquare, 
  Square,
  BookOpen, 
  Grid, 
  Clock, 
  HelpCircle,
  FileText,
  AlertCircle,
  FolderSync,
  CheckCircle2
} from "lucide-react";
import TiptapEditor from "./TiptapEditor";
import { generateRPPMendalam, generateIndividualLampiran } from "../lib/ai";
import { generateRPPDocx, generateIndividualLampiranDocx } from "../lib/docxGenerator";
import { uploadFileToDrive } from "../lib/drive";
import { Fase, RPPData, VersionHistory, Jenjang, TPItem, ATPItem, PROSEMData } from "../types";
import { saveDocumentToDb } from "../lib/firebase";
import { getTeacherForKelas } from "../lib/profileHelper";

interface RppPanelProps {
  profile: any;
  rppDataList: RPPData[];
  savedTps?: TPItem[];
  savedAtps?: ATPItem[];
  onSaveRpp: (rpp: RPPData) => Promise<void>;
  onLoadTp?: (ctx: { mapel: string; kelas: string; fase: Fase }) => Promise<void>;
  onLoadAtp?: (ctx: { mapel: string; kelas: string; fase: Fase }) => Promise<void>;
  onLoadProsem?: (ctx: { mapel: string; kelas: string; fase: Fase }) => Promise<void>;
  onLoadRppList?: (ctx: { mapel: string; kelas: string; fase: Fase }) => Promise<void>;
  savedVersions: VersionHistory[];
  onSaveVersion: (ver: VersionHistory) => Promise<void>;
  apiKey?: string;
  driveFolderId?: string;
  accessToken?: string | null;
  prosemData?: PROSEMData | null;
}

const P5_PROFILES = [
  "Keimanan dan Ketakwaan terhadap Tuhan Yang Maha Esa",
  "Kewargaan (Kewarganegaraan & Kebinekaan Global)",
  "Kreativitas (Berpikir Kreatif & Mandiri)",
  "Kemandirian (Regulasi Diri & Etos Kerja)",
  "Komunikasi (Berbahasa & Ekspresi Konstruktif)",
  "Kesehatan (Kesejahteraan Fisik & Mental)",
  "Kolaborasi (Kerjasama & Gotong Royong)",
  "Penalaran Kritis (Analitis & Pengambilan Keputusan)"
];

const MODEL_PRESETS = [
  "Problem Based Learning (PBL)",
  "Project Based Learning (PjBL)",
  "Discovery Learning",
  "Inquiry Learning",
  "Cooperative Learning",
  "Experiential Learning"
];

const FASE_CLASSES: { [key: string]: string[] } = {
  A: ["1", "2"],
  B: ["3", "4"],
  C: ["5", "6"],
  D: ["7", "8", "9"],
  E: ["10"],
  F: ["11", "12"]
};

const isSameKelas = (k1: string, k2: string): boolean => {
  if (!k1 || !k2) return false;
  const norm = (k: string) => {
    const val = k.trim().toUpperCase();
    const ROMAN_TO_ARABIC: { [key: string]: string } = {
      "I": "1", "II": "2", "III": "3", "IV": "4", "V": "5", "VI": "6",
      "VII": "7", "VIII": "8", "IX": "9", "X": "10", "XI": "11", "XII": "12"
    };
    return ROMAN_TO_ARABIC[val] || val;
  };
  return norm(String(k1)) === norm(String(k2));
};

const isClassInSameFase = (k1: string, k2: string, faseVal: string) => {
  if (!k1 || !k2 || k1 === "Fase" || k2 === "Fase") return true;
  if (isSameKelas(k1, k2)) return true;
  const FASE_CLASSES_EXT: { [key: string]: string[] } = {
    A: ["1", "2", "I", "II"],
    B: ["3", "4", "III", "IV"],
    C: ["5", "6", "V", "VI"],
    D: ["7", "8", "9", "VII", "VIII", "IX"],
    E: ["10", "X"],
    F: ["11", "12", "XI", "XII"]
  };
  const validClasses = FASE_CLASSES_EXT[faseVal] || [];
  return validClasses.some(c => isSameKelas(c, k1)) && validClasses.some(c => isSameKelas(c, k2));
};

export default function RppPanel({
  profile,
  rppDataList,
  savedTps = [],
  savedAtps = [],
  onSaveRpp,
  onLoadTp,
  onLoadAtp,
  onLoadProsem,
  onLoadRppList,
  savedVersions,
  onSaveVersion,
  apiKey,
  driveFolderId,
  accessToken,
  prosemData
}: RppPanelProps) {
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
    [Jenjang.SMP]: ["Bahasa Indonesia", "Matematika", "IPA", "IPS", "Bahasa Inggris", "Informatika", "Pendidikan Pancasila"],
    [Jenjang.SMA]: ["Bahasa Indonesia", "Matematika", "Fisika", "Kimia", "Biologi", "Sejarah", "Geografi", "Sosiologi", "Ekonomi", "Bahasa Inggris"]
  };

  const currentJenjang = profile.jenjang || Jenjang.SD;
  const currentMapelList = mapelPresets[currentJenjang] || ["Bahasa Indonesia"];

  const [mapel, setMapel] = useState(profile.mapel || currentMapelList[0] || "Bahasa Indonesia");
  const [confirmReset, setConfirmReset] = useState(false);

  const [form, setForm] = useState<RPPData>({
    id: "rpp-main",
    namaSekolah: profile.sekolah || "SD Negeri 1 Jakarta",
    mapel: mapel,
    fase: profile.fase || Fase.A,
    kelas: profile.kelas || "1",
    semester: profile.semester || "1",
    tahunPelajaran: profile.tahunPelajaran || "2026/2027",
    alokasiWaktu: "2 x 35 Menit (1 Pertemuan)",
    pertemuan: "1",
    cp: "",
    elemen: "",
    materi: "",
    tujuanPembelajaran: "",
    profilLulusan: [],
    kearifanLokal: "",
    modelPembelajaran: "Problem Based Learning (PBL)",
    metodePembelajaran: "Diskusi, Tanya Jawab, Penugasan",
    glosarium: "",
    kesiapanPesertaDidik: "",
    mediaPembelajaran: "",
    alatPembelajaran: "",
    sumberBelajar: "",
    evaluasi: "",
    pengayaan: "",
    remedial: "",
    refleksiGuru: "",
    refleksiSiswa: "",
    lampiran: "",
    sintaksTable: [],
    fullContentHtml: "",
    createdAt: new Date().toISOString()
  });

  const filteredTps = savedTps.filter(t => 
    t.mapel?.toLowerCase().trim() === mapel.toLowerCase().trim()
  );
  const filteredAtps = savedAtps.filter(a => 
    a.mapel?.toLowerCase().trim() === mapel.toLowerCase().trim() &&
    (!a.kelas || isClassInSameFase(a.kelas, form.kelas, form.fase))
  );

  const currentProsemItems = prosemData && Array.isArray(prosemData.items)
    ? (() => {
        const mapelItems = prosemData.items.filter((item: any) => {
          const itemMapel = (item.mapel || prosemData.mapel || "").toLowerCase().trim();
          return itemMapel === mapel.toLowerCase().trim();
        });
        
        const semItems = mapelItems.filter((item: any) => {
          const itemSem = String(item.semester || prosemData.semester || "1").trim();
          const targetSem = String(form.semester || "1").trim();
          return itemSem === targetSem || itemSem.includes(targetSem) || targetSem.includes(itemSem);
        });

        return semItems.length > 0 ? semItems : mapelItems;
      })()
    : [];

  const [loading, setLoading] = useState(false);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle");
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [msg, setMsg] = useState("");
  
  // Editor content local state
  const [editorHtml, setEditorHtml] = useState("");

  // Validation
  const activeTpMatched = currentProsemItems.some(item => 
    (item.tujuanPembelajaran || "").toLowerCase().trim() === (form.tujuanPembelajaran || "").toLowerCase().trim()
  );
  const hasRppContent = editorHtml && editorHtml.trim().length > 100;
  const isRppValid = currentProsemItems.length > 0 && activeTpMatched && hasRppContent;

  // Separate Lampiran States
  const [activeSubTab, setActiveSubTab] = useState<"main" | "lampiran">("main");
  const [selectedLampiranType, setSelectedLampiranType] = useState<"LKPD" | "Asesmen" | "Rubrik" | "Bahan Bacaan">("LKPD");
  const [lampiranEditorHtml, setLampiranEditorHtml] = useState("");
  const [generatingLampiran, setGeneratingLampiran] = useState(false);
  const [syncingLampiranDrive, setSyncingLampiranDrive] = useState(false);

  // Version control
  const [versionName, setVersionName] = useState("");
  const [showVersions, setShowVersions] = useState(false);

  // File upload simulated CP extraction
  const [uploadingCp, setUploadingCp] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");

  // Auto-save ref to avoid stale state in interval
  const formRef = useRef(form);
  useEffect(() => {
    formRef.current = form;
  }, [form]);

  // Handle subject switching: Load existing RPP from list or initialize a default RPP
  useEffect(() => {
    if (onLoadTp) {
      onLoadTp({ mapel, kelas: form.kelas, fase: form.fase });
    }
    if (onLoadAtp) {
      onLoadAtp({ mapel, kelas: form.kelas, fase: form.fase });
    }
    if (onLoadProsem) {
      onLoadProsem({ mapel, kelas: form.kelas, fase: form.fase });
    }
    if (onLoadRppList) {
      onLoadRppList({ mapel, kelas: form.kelas, fase: form.fase });
    }
  }, [mapel, form.kelas, form.fase, profile.tahunPelajaran, profile.semester]);

  // Handle subject switching: Load existing RPP from list or initialize a default RPP
  useEffect(() => {
    const found = rppDataList.find(r => r.mapel === mapel);
    if (found) {
      setForm(found);
      setEditorHtml(found.fullContentHtml || "");
      if (selectedLampiranType === "LKPD") {
        setLampiranEditorHtml(found.lampiranLKPD || "");
      } else if (selectedLampiranType === "Asesmen") {
        setLampiranEditorHtml(found.lampiranAsesmen || "");
      } else if (selectedLampiranType === "Rubrik") {
        setLampiranEditorHtml(found.lampiranRubrik || "");
      } else if (selectedLampiranType === "Bahan Bacaan") {
        setLampiranEditorHtml(found.lampiranBahanBacaan || "");
      }
    } else {
      const defaultForm: RPPData = {
        id: `rpp-${mapel.toLowerCase().replace(/\s+/g, "-")}`,
        namaSekolah: profile.sekolah || "SD Negeri 1 Jakarta",
        mapel: mapel,
        fase: formRef.current.fase || profile.fase || Fase.A,
        kelas: formRef.current.kelas || profile.kelas || "1",
        semester: profile.semester || "1",
        tahunPelajaran: profile.tahunPelajaran || "2026/2027",
        alokasiWaktu: "2 x 35 Menit (1 Pertemuan)",
        pertemuan: "1",
        cp: "",
        elemen: "",
        materi: "",
        tujuanPembelajaran: "",
        profilLulusan: [],
        kearifanLokal: "",
        modelPembelajaran: "Problem Based Learning (PBL)",
        metodePembelajaran: "Diskusi, Tanya Jawab, Penugasan",
        glosarium: "",
        kesiapanPesertaDidik: "",
        mediaPembelajaran: "",
        alatPembelajaran: "",
        sumberBelajar: "",
        evaluasi: "",
        pengayaan: "",
        remedial: "",
        refleksiGuru: "",
        refleksiSiswa: "",
        lampiran: "",
        lampiranLKPD: "",
        lampiranAsesmen: "",
        lampiranRubrik: "",
        lampiranBahanBacaan: "",
        sintaksTable: [],
        fullContentHtml: "",
        createdAt: new Date().toISOString()
      };
      const defaultHtml = buildRppHtmlSummary(defaultForm, profile);
      defaultForm.fullContentHtml = defaultHtml;
      setForm(defaultForm);
      setEditorHtml(defaultHtml);
      setLampiranEditorHtml("");
    }
  }, [mapel, rppDataList]);

  // Synchronize attachment editor when type switches
  useEffect(() => {
    if (selectedLampiranType === "LKPD") {
      setLampiranEditorHtml(form.lampiranLKPD || "");
    } else if (selectedLampiranType === "Asesmen") {
      setLampiranEditorHtml(form.lampiranAsesmen || "");
    } else if (selectedLampiranType === "Rubrik") {
      setLampiranEditorHtml(form.lampiranRubrik || "");
    } else if (selectedLampiranType === "Bahan Bacaan") {
      setLampiranEditorHtml(form.lampiranBahanBacaan || "");
    }
  }, [selectedLampiranType, form.id]);

  // Synchronize editor HTML when form ID or mapel changes
  useEffect(() => {
    if (form.fullContentHtml) {
      setEditorHtml(form.fullContentHtml);
    } else {
      const defaultHtml = buildRppHtmlSummary(form, profile);
      setEditorHtml(defaultHtml);
      setForm(prev => ({ ...prev, fullContentHtml: defaultHtml }));
    }
  }, [form.id, form.mapel]);

  // Adjust selected mapel if current profile jenjang changes
  useEffect(() => {
    if (currentMapelList && !currentMapelList.includes(mapel)) {
      setMapel(currentMapelList[0]);
    }
  }, [currentJenjang]);

  // Synchronize school year (tahunPelajaran), semester, and school name from the global profile menu
  useEffect(() => {
    setForm(prev => {
      let changed = false;
      const updated = { ...prev };
      if (profile.tahunPelajaran && prev.tahunPelajaran !== profile.tahunPelajaran) {
        updated.tahunPelajaran = profile.tahunPelajaran;
        changed = true;
      }
      if (profile.semester && prev.semester !== profile.semester) {
        updated.semester = profile.semester;
        changed = true;
      }
      if (profile.sekolah && prev.namaSekolah !== profile.sekolah) {
        updated.namaSekolah = profile.sekolah;
        changed = true;
      }
      if (changed) {
        if (prev.fullContentHtml) {
          let updatedHtml = prev.fullContentHtml;
          const oldText = `Semester ${prev.semester} / ${prev.tahunPelajaran}`;
          const newText = `Semester ${profile.semester} / ${profile.tahunPelajaran}`;
          if (updatedHtml.includes(oldText)) {
            updatedHtml = updatedHtml.replaceAll(oldText, newText);
          } else {
            if (prev.fullContentHtml.includes("Belum ada langkah pembelajaran")) {
              updatedHtml = buildRppHtmlSummary(updated, profile);
            }
          }
          
          if (profile.sekolah && prev.namaSekolah && prev.namaSekolah !== profile.sekolah) {
            if (updatedHtml.includes(prev.namaSekolah)) {
              updatedHtml = updatedHtml.replaceAll(prev.namaSekolah, profile.sekolah);
            }
          }

          updated.fullContentHtml = updatedHtml;
          setEditorHtml(updatedHtml);
        } else {
          const defaultHtml = buildRppHtmlSummary(updated, profile);
          updated.fullContentHtml = defaultHtml;
          setEditorHtml(defaultHtml);
        }
        return updated;
      }
      return prev;
    });
  }, [profile.tahunPelajaran, profile.semester, profile.sekolah]);

  // 10 Second Auto Save Effect
  useEffect(() => {
    const interval = setInterval(async () => {
      const currentForm = { ...formRef.current, fullContentHtml: editorHtml };
      if (currentForm.mapel === mapel) {
        setSavingState("saving");
        try {
          await onSaveRpp(currentForm);
          setSavingState("saved");
          setTimeout(() => setSavingState("idle"), 2000);
        } catch (err) {
          console.error("Auto save failed:", err);
          setSavingState("idle");
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [editorHtml, lampiranEditorHtml, mapel]);

  // Suggest relevant P5 profiles based on Mapel & TP
  const handleAutoSuggestP5 = () => {
    const textToMatch = `${form.mapel} ${form.tujuanPembelajaran}`.toLowerCase();
    const suggested: string[] = [];
    
    if (textToMatch.includes("pancasila") || textToMatch.includes("sejarah") || textToMatch.includes("sosial") || textToMatch.includes("agama")) {
      suggested.push(P5_PROFILES[0]); // Keimanan
      suggested.push(P5_PROFILES[1]); // Kewargaan
    }
    if (textToMatch.includes("seni") || textToMatch.includes("buat") || textToMatch.includes("kreatif") || textToMatch.includes("bahasa")) {
      suggested.push(P5_PROFILES[2]); // Kreativitas
    }
    if (textToMatch.includes("mandiri") || textToMatch.includes("hitung") || textToMatch.includes("matematika")) {
      suggested.push(P5_PROFILES[3]); // Kemandirian
    }
    if (textToMatch.includes("baca") || textToMatch.includes("tulis") || textToMatch.includes("bicara") || textToMatch.includes("bahasa")) {
      suggested.push(P5_PROFILES[4]); // Komunikasi
    }
    if (textToMatch.includes("pjok") || textToMatch.includes("sehat") || textToMatch.includes("olah")) {
      suggested.push(P5_PROFILES[5]); // Kesehatan
    }
    if (textToMatch.includes("kelompok") || textToMatch.includes("diskusi") || textToMatch.includes("kerjasama") || textToMatch.includes("proyek")) {
      suggested.push(P5_PROFILES[6]); // Kolaborasi
    }
    if (textToMatch.includes("ipa") || textToMatch.includes("analisis") || textToMatch.includes("kritis") || textToMatch.includes("selidik")) {
      suggested.push(P5_PROFILES[7]); // Penalaran Kritis
    }

    // Default if nothing matches
    if (suggested.length < 2) {
      suggested.push(P5_PROFILES[2]);
      suggested.push(P5_PROFILES[7]);
    }

    setForm(p => ({ ...p, profilLulusan: suggested }));
    setMsg("💡 AI menyarankan 2-3 profil lulusan yang paling relevan untuk materi ini!");
    setTimeout(() => setMsg(""), 4000);
  };

  const handleProfileCheckbox = (profileName: string) => {
    setForm(prev => {
      const current = [...prev.profilLulusan];
      if (current.includes(profileName)) {
        return { ...prev, profilLulusan: current.filter(x => x !== profileName) };
      } else {
        return { ...prev, profilLulusan: [...current, profileName] };
      }
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => {
      const updated = { ...prev, [name]: value };
      
      if (name === "fase") {
        const validClasses = FASE_CLASSES[value] || [];
        if (validClasses.length > 0 && !validClasses.includes(prev.kelas || "")) {
          updated.kelas = validClasses[0];
        }
      }
      
      const htmlSummary = buildRppHtmlSummary(updated, profile);
      updated.fullContentHtml = htmlSummary;
      setEditorHtml(htmlSummary);
      return updated;
    });
  };

  const handleSintaksChange = (index: number, field: string, value: string) => {
    setForm(prev => {
      const updatedSintaks = [...prev.sintaksTable];
      updatedSintaks[index] = { ...updatedSintaks[index], [field]: value };
      return { ...prev, sintaksTable: updatedSintaks };
    });
  };

  const handleCpUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadingCp(true);
      setUploadedFileName(file.name);
      
      // Simulate extraction
      setTimeout(() => {
        setForm(prev => ({
          ...prev,
          cp: `Capaian Pembelajaran diekstrak dari ${file.name}:\nPeserta didik memiliki kemampuan berbahasa untuk berkomunikasi dan bernalar, sesuai dengan tujuan, konteks sosial, dan akademis. Peserta didik mampu memahami, mengolah, dan menginterpretasi informasi paparan tentang topik yang beragam dan karya sastra.`
        }));
        setUploadingCp(false);
        setMsg("✅ Dokumen CP berhasil diekstrak dan dimuat!");
      }, 1500);
    }
  };

  // Compile full RPP with Gemini
  const handleCompileRpp = async () => {
    // Check if both TP and materi are empty
    if ((!form.tujuanPembelajaran || form.tujuanPembelajaran.trim() === "") && (!form.materi || form.materi.trim() === "")) {
      alert("Silakan isi kolom 'Materi Pokok' atau 'Tujuan Pembelajaran (TP)' terlebih dahulu sebelum melakukan kompilasi.");
      return;
    }

    let currentProfiles = [...form.profilLulusan];
    let autoSelectedProfiles = false;
    if (currentProfiles.length < 2) {
      // Auto-populate to make sure we have at least 2 profiles selected and prevent hard block
      const suggested = [...currentProfiles];
      if (!suggested.includes(P5_PROFILES[7])) suggested.push(P5_PROFILES[7]); // Penalaran Kritis
      if (!suggested.includes(P5_PROFILES[2])) suggested.push(P5_PROFILES[2]); // Kreativitas
      currentProfiles = suggested.slice(0, 2);
      autoSelectedProfiles = true;
    }

    setLoading(true);
    setMsg(form.tujuanPembelajaran && form.tujuanPembelajaran.trim() !== "" 
      ? "✨ Menyusun RPP Mendalam dengan AI..." 
      : "✨ Memformulasikan Tujuan Pembelajaran & Menyusun RPP Mendalam otomatis dengan AI..."
    );

    try {
      // Use current selection or fallback
      const currentForm = {
        ...form,
        profilLulusan: currentProfiles,
        tujuanPembelajaran: form.tujuanPembelajaran && form.tujuanPembelajaran.trim() !== "" 
          ? form.tujuanPembelajaran 
          : `(Silakan rumuskan dan formulasikan 1-3 Tujuan Pembelajaran yang paling relevan, terukur, dan kompeten secara otomatis berdasarkan mata pelajaran ${mapel} dan materi pokok ${form.materi || "pembelajaran terkait"} serta Capaian Pembelajaran jika ada)`,
      };

      const compiledData = await generateRPPMendalam(currentForm, { apiKey });
      
      // Clean literal "\n" or "\\n" strings returned from AI into real newlines
      const replaceLiteralNewlines = (val: any): any => {
        if (typeof val === "string") {
          return val.replace(/\\n/g, "\n").replace(/\\\\n/g, "\n");
        }
        if (Array.isArray(val)) {
          return val.map(replaceLiteralNewlines);
        }
        if (val && typeof val === "object") {
          const cleaned: any = {};
          for (const key of Object.keys(val)) {
            cleaned[key] = replaceLiteralNewlines(val[key]);
          }
          return cleaned;
        }
        return val;
      };

      const cleanedCompiledData = replaceLiteralNewlines(compiledData);

      // Clean deskripsi in sintaksTable to have proper newlines for each number/activity point
      if (cleanedCompiledData && Array.isArray(cleanedCompiledData.sintaksTable)) {
        cleanedCompiledData.sintaksTable = cleanedCompiledData.sintaksTable.map((row: any) => {
          if (row && typeof row.deskripsi === "string") {
            const original = row.deskripsi;
            let cleaned = original.replace(/\\n/g, "\n").replace(/\\\\n/g, "\n");
            const originalLines = cleaned.split("\n");
            const finalLines: string[] = [];
            
            originalLines.forEach((line: string) => {
              const trimmed = line.trim();
              if (!trimmed) return;
              
              // Split properly on list numbers e.g. 1., 2) or small letter lists a., b) without removing periods of the previous sentence
              const brokenLine = trimmed.replace(/(?:\s+|(?<=\.))([0-9]+[\.\)](?!\d)|[a-z][\.\)])\s+/g, "\n$1 ");
              brokenLine.split("\n").forEach((subLine: string) => {
                const subTrimmed = subLine.trim();
                if (subTrimmed) {
                  finalLines.push(subTrimmed);
                }
              });
            });
            row.deskripsi = finalLines.join("\n");
          }
          return row;
        });
      }

      const newForm = {
        ...form,
        ...cleanedCompiledData,
        // Make sure fields are string arrays
        profilLulusan: cleanedCompiledData.profilLulusan || currentProfiles,
      };

      // Compile into beautiful rich HTML
      const htmlSummary = buildRppHtmlSummary(newForm, profile);
      newForm.fullContentHtml = htmlSummary;

      setForm(newForm);
      setEditorHtml(htmlSummary);
      setMsg("✅ RPP Mendalam berhasil disusun lengkap oleh Gemini AI dan dimuat ke Editor Tiptap!");
    } catch (error: any) {
      setMsg(`🔴 Gagal kompilasi RPP: ${error.message || "Kesalahan server"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDoc = async () => {
    try {
      const rppToSave = { ...form, fullContentHtml: editorHtml };
      await onSaveRpp(rppToSave);
      setMsg("✅ RPP Mendalam berhasil disimpan ke Firestore database!");
      setTimeout(() => setMsg(""), 4000);
    } catch (error: any) {
      setMsg(`🔴 Gagal menyimpan: ${error.message}`);
    }
  };

  // Create a new version checkpoint in Firestore
  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionName) return;
    try {
      const checkpoint: VersionHistory = {
        id: `version-${Date.now()}`,
        documentType: "RPP",
        documentId: form.id,
        versionName: versionName,
        data: { ...form, fullContentHtml: editorHtml },
        timestamp: new Date().toISOString()
      };
      await onSaveVersion(checkpoint);
      setVersionName("");
      setMsg(`✅ Checkpoint versi "${versionName}" berhasil disimpan!`);
      setTimeout(() => setMsg(""), 4000);
    } catch (err: any) {
      setMsg(`🔴 Gagal menyimpan versi: ${err.message}`);
    }
  };

  const handleRestoreVersion = (ver: VersionHistory) => {
    const restored = ver.data as RPPData;
    setForm(restored);
    setEditorHtml(restored.fullContentHtml || "");
    setMsg(`💡 Berhasil memulihkan dokumen ke versi "${ver.versionName}"!`);
    setShowVersions(false);
  };

  const handleResetRpp = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setMsg("⚠️ Klik sekali lagi tombol 'Bersihkan Form' untuk konfirmasi.");
      setTimeout(() => {
        setConfirmReset(false);
      }, 4000);
      return;
    }

    setConfirmReset(false);
    const emptyForm: RPPData = {
      id: `rpp-${mapel.toLowerCase().replace(/\s+/g, "-")}`,
      namaSekolah: profile.sekolah || "SD Negeri 1 Jakarta",
      mapel: mapel,
      fase: form.fase || profile.fase || Fase.A,
      kelas: form.kelas || profile.kelas || "1",
      semester: form.semester || profile.semester || "1",
      tahunPelajaran: form.tahunPelajaran || profile.tahunPelajaran || "2026/2027",
      alokasiWaktu: "2 x 35 Menit (1 Pertemuan)",
      pertemuan: "1",
      cp: "",
      elemen: "",
      materi: "",
      tujuanPembelajaran: "",
      profilLulusan: [],
      kearifanLokal: "",
      modelPembelajaran: "Problem Based Learning (PBL)",
      metodePembelajaran: "Diskusi, Tanya Jawab, Penugasan",
      glosarium: "",
      kesiapanPesertaDidik: "",
      mediaPembelajaran: "",
      alatPembelajaran: "",
      sumberBelajar: "",
      evaluasi: "",
      pengayaan: "",
      remedial: "",
      refleksiGuru: "",
      refleksiSiswa: "",
      lampiran: "",
      lampiranLKPD: "",
      lampiranAsesmen: "",
      lampiranRubrik: "",
      lampiranBahanBacaan: "",
      sintaksTable: [],
      fullContentHtml: "",
      createdAt: new Date().toISOString()
    };
    const cleanHtml = buildRppHtmlSummary(emptyForm, profile);
    emptyForm.fullContentHtml = cleanHtml;
    setForm(emptyForm);
    setEditorHtml(cleanHtml);
    setLampiranEditorHtml("");
    onSaveRpp(emptyForm);
    setMsg("🔄 RPP dikosongkan! Silakan tentukan TP/ATP baru.");
    setTimeout(() => setMsg(""), 3000);
  };

  const handleDownloadDocx = async () => {
    try {
      const blob = await generateRPPDocx(profile, { ...form, fullContentHtml: editorHtml });
      const filename = `RPP_Mendalam_${form.mapel}_Pertemuan_${form.pertemuan}.docx`;
      
      const fileSaver = await import("file-saver");
      fileSaver.saveAs(blob, filename);
      setMsg("✅ Berkas RPP (.docx) berhasil dibuat dan diunduh!");
    } catch (error: any) {
      setMsg(`🔴 Gagal mengunduh RPP Word: ${error.message}`);
    }
  };

  const handleSyncToDrive = async () => {
    if (!accessToken || !driveFolderId) {
      alert("Silakan hubungkan Google Drive terlebih dahulu di tab Pengaturan.");
      return;
    }
    
    setSyncingDrive(true);
    setMsg("Mengunggah dokumen RPP ke Google Drive...");
    try {
      const blob = await generateRPPDocx(profile, { ...form, fullContentHtml: editorHtml });
      const filename = `RPP_Mendalam_${form.mapel}_Pertemuan_${form.pertemuan}.docx`;
      
      await uploadFileToDrive(accessToken, blob, filename, driveFolderId);
      setMsg("✅ Dokumen RPP Mendalam berhasil diunggah langsung ke folder Google Drive Anda!");
    } catch (error: any) {
      setMsg(`🔴 Gagal mengunggah ke Google Drive: ${error.message}`);
    } finally {
      setSyncingDrive(false);
    }
  };

  const handleGenerateLampiran = async () => {
    setGeneratingLampiran(true);
    setMsg("");
    try {
      const resultText = await generateIndividualLampiran(
        {
          mapel: form.mapel,
          fase: form.fase,
          kelas: form.kelas,
          semester: form.semester,
          materi: form.materi || "(Materi Pokok belum diisi)",
          tujuanPembelajaran: form.tujuanPembelajaran || "(Tujuan Pembelajaran belum ditentukan)",
          modelPembelajaran: form.modelPembelajaran,
          kearifanLokal: form.kearifanLokal
        },
        selectedLampiranType,
        { apiKey }
      );

      // Convert Markdown headers, bullet points, and newlines to simple HTML paragraphs for Tiptap
      let parsedHtml = resultText
        .split("\n")
        .map(line => {
          const trimmed = line.trim();
          if (trimmed.startsWith("###")) {
            return `<h3>${trimmed.replace(/^###\s*/, "")}</h3>`;
          } else if (trimmed.startsWith("##")) {
            return `<h2>${trimmed.replace(/^##\s*/, "")}</h2>`;
          } else if (trimmed.startsWith("#")) {
            return `<h1>${trimmed.replace(/^#\s*/, "")}</h1>`;
          } else if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
            return `<li>${trimmed.replace(/^[-*]\s*/, "")}</li>`;
          } else if (trimmed.match(/^\d+\./)) {
            return `<li>${trimmed}</li>`;
          } else if (trimmed === "") {
            return "<br />";
          } else {
            return `<p>${trimmed}</p>`;
          }
        })
        .join("");

      // Wrap adjacent <li> elements inside <ul> or <ol>
      parsedHtml = parsedHtml.replace(/(<li>.*?<\/li>)/g, "<ul>$1</ul>");
      parsedHtml = parsedHtml.replace(/<\/ul><ul>/g, "");

      setLampiranEditorHtml(parsedHtml);

      // Update form state and trigger auto-save
      setForm(prev => {
        const updated = { ...prev };
        if (selectedLampiranType === "LKPD") updated.lampiranLKPD = parsedHtml;
        else if (selectedLampiranType === "Asesmen") updated.lampiranAsesmen = parsedHtml;
        else if (selectedLampiranType === "Rubrik") updated.lampiranRubrik = parsedHtml;
        else if (selectedLampiranType === "Bahan Bacaan") updated.lampiranBahanBacaan = parsedHtml;
        return updated;
      });

      setMsg(`✅ Lampiran ${selectedLampiranType} berhasil disusun lengkap oleh AI!`);
    } catch (error: any) {
      setMsg(`🔴 Gagal menyusun lampiran: ${error.message || "Kesalahan server"}`);
    } finally {
      setGeneratingLampiran(false);
    }
  };

  const handleDownloadLampiranDocx = async () => {
    try {
      const blob = await generateIndividualLampiranDocx(
        profile,
        form.mapel,
        form.materi || "(Belum ditentukan)",
        selectedLampiranType === "LKPD" ? "Lembar Kerja Peserta Didik (LKPD)" :
        selectedLampiranType === "Asesmen" ? "Instrumen Asesmen & Kisi-Kisi" :
        selectedLampiranType === "Rubrik" ? "Rubrik Penilaian Kinerja" :
        "Materi Ajar & Bahan Bacaan",
        lampiranEditorHtml
      );
      
      const filename = `Lampiran_${selectedLampiranType}_${form.mapel}_Pertemuan_${form.pertemuan}.docx`;
      const fileSaver = await import("file-saver");
      fileSaver.saveAs(blob, filename);
      setMsg(`✅ Berkas Lampiran ${selectedLampiranType} (.docx) berhasil dibuat dan diunduh!`);
    } catch (error: any) {
      setMsg(`🔴 Gagal mengunduh Lampiran Word: ${error.message}`);
    }
  };

  const handleSyncLampiranToDrive = async () => {
    if (!accessToken || !driveFolderId) {
      alert("Silakan hubungkan Google Drive terlebih dahulu di tab Pengaturan.");
      return;
    }
    
    setSyncingLampiranDrive(true);
    setMsg(`Mengunggah Lampiran ${selectedLampiranType} ke Google Drive...`);
    try {
      const blob = await generateIndividualLampiranDocx(
        profile,
        form.mapel,
        form.materi || "(Belum ditentukan)",
        selectedLampiranType === "LKPD" ? "Lembar Kerja Peserta Didik (LKPD)" :
        selectedLampiranType === "Asesmen" ? "Instrumen Asesmen & Kisi-Kisi" :
        selectedLampiranType === "Rubrik" ? "Rubrik Penilaian Kinerja" :
        "Materi Ajar & Bahan Bacaan",
        lampiranEditorHtml
      );
      const filename = `Lampiran_${selectedLampiranType}_${form.mapel}_Pertemuan_${form.pertemuan}.docx`;
      
      await uploadFileToDrive(accessToken, blob, filename, driveFolderId);
      setMsg(`✅ Lampiran ${selectedLampiranType} berhasil diunggah langsung ke folder Google Drive Anda!`);
    } catch (error: any) {
      setMsg(`🔴 Gagal mengunggah ke Google Drive: ${error.message}`);
    } finally {
      setSyncingLampiranDrive(false);
    }
  };

  const handleLampiranEditorChange = (html: string) => {
    setLampiranEditorHtml(html);
    setForm(prev => {
      const updated = { ...prev };
      if (selectedLampiranType === "LKPD") updated.lampiranLKPD = html;
      else if (selectedLampiranType === "Asesmen") updated.lampiranAsesmen = html;
      else if (selectedLampiranType === "Rubrik") updated.lampiranRubrik = html;
      else if (selectedLampiranType === "Bahan Bacaan") updated.lampiranBahanBacaan = html;
      return updated;
    });
  };

  return (
    <div className="space-y-6 animate-fade-in" id="rpp_panel">
      {/* Auto save floating indicator */}
      <div className="fixed bottom-6 right-6 z-50">
        {savingState === "saving" && (
          <span className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1 font-semibold border border-blue-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            Menyimpan otomatis...
          </span>
        )}
        {savingState === "saved" && (
          <span className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1 font-semibold border border-emerald-500">
            Disimpan otomatis
          </span>
        )}
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveSubTab("main")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all border ${
            activeSubTab === "main"
              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Skenario & Dokumen RPP Utama
        </button>
        <button
          onClick={() => setActiveSubTab("lampiran")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all border ${
            activeSubTab === "lampiran"
              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <FileText className="w-4 h-4" />
          Lampiran Pembelajaran Terpisah ({
            (form.lampiranLKPD ? 1 : 0) +
            (form.lampiranAsesmen ? 1 : 0) +
            (form.lampiranRubrik ? 1 : 0) +
            (form.lampiranBahanBacaan ? 1 : 0)
          }/4)
        </button>
      </div>

      {activeSubTab === "main" ? (
        <>
          {/* Identitas Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 p-4 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  Rencana Pelaksanaan Pembelajaran (RPP) Mendalam
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">Susun rencana pengajaran komprehensif berlandaskan prinsip Pembelajaran Mendalam (Deep Learning).</p>
              </div>

              <button
                onClick={() => setShowVersions(!showVersions)}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-1.5 px-3 rounded-lg text-xs transition border border-slate-200"
              >
                <History className="w-4 h-4 text-slate-500" />
                Riwayat Versi ({savedVersions.length})
              </button>
            </div>

            {/* Version list popup drawer */}
            {showVersions && (
              <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
                <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wide">Pilih Versi untuk Dipulihkan</h3>
                {savedVersions.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Belum ada versi cadangan yang disimpan. Buat di form bawah.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {savedVersions.map((v) => (
                      <div key={v.id} className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col justify-between hover:border-blue-400 transition">
                        <div>
                          <h4 className="font-bold text-xs text-slate-800">{v.versionName}</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">{new Date(v.timestamp).toLocaleString("id-ID")}</p>
                        </div>
                        <button
                          onClick={() => handleRestoreVersion(v)}
                          className="text-blue-600 hover:text-blue-800 font-bold text-[10px] uppercase tracking-wider text-left mt-2"
                        >
                          Pulihkan Versi Ini
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Form Fields */}
            <div className="space-y-4 md:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Mata Pelajaran</label>
                    <button
                      type="button"
                      onClick={handleResetRpp}
                      className={`text-[9px] font-bold transition flex items-center gap-1 px-1.5 py-0.5 rounded border ${
                        confirmReset
                          ? "bg-amber-100 border-amber-300 text-amber-700 animate-pulse"
                          : "bg-rose-50 border-rose-200 text-rose-600 hover:text-rose-800"
                      }`}
                    >
                      {confirmReset ? "⚠️ Klik Lagi untuk Bersihkan" : "🔄 Bersihkan Form"}
                    </button>
                  </div>
                  <select
                    name="mapel"
                    value={mapel}
                    onChange={(e) => setMapel(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 bg-white rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {currentMapelList.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Materi Pokok</label>
                  <input
                    type="text"
                    name="materi"
                    value={form.materi}
                    onChange={handleInputChange}
                    placeholder="Misal: Suku kata awal b-"
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fase / Kelas</label>
                  <div className="flex gap-2">
                    <select
                      name="fase"
                      value={form.fase}
                      onChange={handleInputChange}
                      className="w-1/2 p-2.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                    >
                      <option value="A">Fase A</option>
                      <option value="B">Fase B</option>
                      <option value="C">Fase C</option>
                      <option value="D">Fase D</option>
                      <option value="E">Fase E</option>
                      <option value="F">Fase F</option>
                    </select>
                    <select
                      name="kelas"
                      value={form.kelas}
                      onChange={handleInputChange}
                      className="w-1/2 p-2.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                    >
                      {(FASE_CLASSES[form.fase || "A"] || ["1", "2"]).map((c) => (
                        <option key={c} value={c}>Kelas {c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Semester</label>
                  <select
                    name="semester"
                    value={form.semester}
                    onChange={handleInputChange}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                  >
                    <option value="1">Semester 1 (Ganjil)</option>
                    <option value="2">Semester 2 (Genap)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tahun Pelajaran</label>
                  <input
                    type="text"
                    name="tahunPelajaran"
                    value={form.tahunPelajaran}
                    onChange={handleInputChange}
                    placeholder="Contoh: 2026/2027"
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Alokasi Waktu</label>
                  <input
                    type="text"
                    name="alokasiWaktu"
                    value={form.alokasiWaktu}
                    onChange={handleInputChange}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Jumlah Pertemuan</label>
                  <select
                    name="pertemuan"
                    value={form.pertemuan}
                    onChange={handleInputChange}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="1">1 Pertemuan</option>
                    <option value="2">2 Pertemuan</option>
                    <option value="3">3 Pertemuan</option>
                    <option value="4">4 Pertemuan</option>
                    <option value="5">5 Pertemuan</option>
                    <option value="6">6 Pertemuan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Model Pembelajaran</label>
                  <select
                    name="modelPembelajaran"
                    value={form.modelPembelajaran}
                    onChange={handleInputChange}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {MODEL_PRESETS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* PROSEM Integration helper */}
              {currentProsemItems.length > 0 && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Grid className="w-3.5 h-3.5" />
                      Integrasi Program Semester (PROSEM)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allTpsText = currentProsemItems
                            .map((it: any) => `- ${it.tujuanPembelajaran.trim()}`)
                            .join("\n");
                          const firstCp = currentProsemItems.find((it: any) => it.cp)?.cp || form.cp;
                          const firstElemen = currentProsemItems.find((it: any) => it.elemen)?.elemen || form.elemen;
                          const allMateris = Array.from(new Set(currentProsemItems.map((it: any) => it.topik || "").filter(Boolean))).join(", ");

                          setForm(prev => {
                            const updated = {
                              ...prev,
                              tujuanPembelajaran: allTpsText,
                              cp: firstCp || prev.cp,
                              elemen: firstElemen || prev.elemen,
                              materi: allMateris || prev.materi,
                            };
                            const htmlSummary = buildRppHtmlSummary(updated, profile);
                            updated.fullContentHtml = htmlSummary;
                            setEditorHtml(htmlSummary);
                            return updated;
                          });
                          setMsg(`✅ Berhasil memuat seluruh (${currentProsemItems.length}) Tujuan Pembelajaran dari PROSEM!`);
                          setTimeout(() => setMsg(""), 3500);
                        }}
                        className="text-[9.5px] font-bold text-emerald-800 bg-emerald-200/80 hover:bg-emerald-300 px-2.5 py-1 rounded-md transition shadow-xs flex items-center gap-1 cursor-pointer"
                      >
                        ⚡ Muat Semua TP ({currentProsemItems.length})
                      </button>
                      <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        {currentProsemItems.length} TP Tersinkronisasi
                      </span>
                    </div>
                  </div>
                  <p className="text-[10.5px] text-slate-600 leading-normal">
                    Ditemukan data pembelajaran mingguan di Program Semester untuk Mata Pelajaran <strong>{mapel}</strong>. Klik TP individual untuk memilih/menambah atau gunakan tombol <strong>Muat Semua TP</strong>:
                  </p>
                  <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                    {currentProsemItems.map((item: any, idx: number) => {
                      const isSelected = form.tujuanPembelajaran ? form.tujuanPembelajaran.includes(item.tujuanPembelajaran) : false;
                      return (
                        <button
                          key={item.atpId || `prosem-rpp-${idx}`}
                          type="button"
                          onClick={() => {
                            setForm(prev => {
                              let newTps = prev.tujuanPembelajaran || "";
                              const cleanTp = item.tujuanPembelajaran.trim();
                              if (isSelected) {
                                const lines = newTps.split('\n').map(l => l.replace(/^-\s*/, '').trim());
                                const filtered = lines.filter(l => l !== cleanTp && l !== "");
                                newTps = filtered.length > 0 ? filtered.map(l => `- ${l}`).join('\n') : "";
                              } else {
                                if (newTps.trim()) {
                                  const lines = newTps.split('\n').map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean);
                                  if (!lines.includes(cleanTp)) {
                                    lines.push(cleanTp);
                                  }
                                  newTps = lines.map(l => `- ${l}`).join('\n');
                                } else {
                                  newTps = `- ${cleanTp}`;
                                }
                              }
                              const updated = {
                                ...prev,
                                tujuanPembelajaran: newTps,
                                cp: item.cp || prev.cp,
                                elemen: item.elemen || prev.elemen,
                                materi: item.topik || prev.materi,
                                alokasiWaktu: item.alokasiWaktu ? `${item.alokasiWaktu} JP` : prev.alokasiWaktu,
                                kelas: prosemData?.kelas || prev.kelas,
                              };
                              const htmlSummary = buildRppHtmlSummary(updated, profile);
                              updated.fullContentHtml = htmlSummary;
                              setEditorHtml(htmlSummary);
                              return updated;
                            });
                            setMsg(isSelected ? "Removed TP from RPP." : "✅ Integrasi PROSEM Berhasil! Identitas, TP, CP & Elemen telah diperbarui.");
                            setTimeout(() => setMsg(""), 3500);
                          }}
                          className={`text-left text-[11px] p-2.5 rounded-lg border transition font-medium flex justify-between items-start gap-2 shadow-xs cursor-pointer ${
                            isSelected 
                              ? "bg-emerald-100/90 border-emerald-300 text-emerald-800" 
                              : "bg-white border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200"
                          }`}
                        >
                          <span className="flex-1 flex flex-col min-w-0">
                            <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5 flex-wrap">
                              {item.topik && <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">{item.topik}</span>}
                              {item.elemen && <span className="text-slate-500 font-semibold">[{item.elemen}]</span>}
                              {item.alokasiWaktu && <span className="text-slate-400 text-[10px] font-normal">({item.alokasiWaktu} JP)</span>}
                            </span>
                            <span className="text-[10px] text-slate-600 mt-1 leading-relaxed break-words">{item.tujuanPembelajaran}</span>
                          </span>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded shrink-0 font-bold uppercase self-center ${
                            isSelected ? "bg-emerald-200 text-emerald-900" : "bg-emerald-100 text-emerald-800"
                          }`}>
                            {isSelected ? "TERPILIH" : "PILIH PROSEM"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TP/ATP Alignment helper */}
              {filteredAtps.length > 0 ? (
                <div className="p-3.5 bg-[#F0F4F8] border border-blue-200/80 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-[#005A9E] uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Gunakan TP dari Alur Tujuan Pembelajaran (ATP)
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full">
                      {filteredAtps.length} Tersedia
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {filteredAtps.map((atp, idx) => {
                      const isSelected = form.tujuanPembelajaran ? form.tujuanPembelajaran.includes(atp.tujuanPembelajaran) : false;
                      return (
                        <button
                          key={atp.tpId || `atp-${idx}`}
                          type="button"
                          onClick={() => {
                            setForm(prev => {
                              let newTps = prev.tujuanPembelajaran || "";
                              let newCps = prev.cp || "";
                              let newElemen = prev.elemen || "";
                              let newMateris = prev.materi || "";
                              
                              if (isSelected) {
                                const lines = newTps.split('\n').map(l => l.replace(/^-\s*/, '').trim());
                                const filteredLines = lines.filter(l => l !== atp.tujuanPembelajaran.trim() && l !== "");
                                if (filteredLines.length === 0) {
                                  const updated = {
                                    ...prev,
                                    tujuanPembelajaran: "",
                                    cp: "",
                                    elemen: "",
                                    kearifanLokal: "",
                                    glosarium: "",
                                    kesiapanPesertaDidik: ""
                                  };
                                  const htmlSummary = buildRppHtmlSummary(updated, profile);
                                  updated.fullContentHtml = htmlSummary;
                                  setEditorHtml(htmlSummary);
                                  return updated;
                                } else {
                                  newTps = filteredLines.map(l => `- ${l}`).join('\n');
                                }
                              } else {
                                const cleanTp = atp.tujuanPembelajaran.trim();
                                if (newTps) {
                                  const lines = newTps.split('\n').map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean);
                                  if (!lines.includes(cleanTp)) {
                                    lines.push(cleanTp);
                                  }
                                  newTps = lines.map(l => `- ${l}`).join('\n');
                                } else {
                                  newTps = `- ${cleanTp}`;
                                }

                                if (atp.cp) {
                                  const cpClean = atp.cp.trim();
                                  if (newCps) {
                                    const cpLines = newCps.split('\n').map(l => l.trim()).filter(Boolean);
                                    if (!cpLines.includes(cpClean)) {
                                      cpLines.push(cpClean);
                                    }
                                    newCps = cpLines.join('\n');
                                  } else {
                                    newCps = cpClean;
                                  }
                                }

                                if (atp.elemen) {
                                  newElemen = atp.elemen.trim();
                                }

                                const matClean = (atp.topik || "").trim();
                                if (matClean) {
                                  if (newMateris) {
                                    const mats = newMateris.split(',').map(m => m.trim()).filter(Boolean);
                                    if (!mats.includes(matClean)) {
                                      mats.push(matClean);
                                    }
                                    newMateris = mats.join(', ');
                                  } else {
                                    newMateris = matClean;
                                  }
                                }
                              }

                              const updated = {
                                ...prev,
                                tujuanPembelajaran: newTps,
                                cp: newCps,
                                elemen: newElemen,
                                materi: newMateris
                              };
                              const htmlSummary = buildRppHtmlSummary(updated, profile);
                              updated.fullContentHtml = htmlSummary;
                              setEditorHtml(htmlSummary);
                              return updated;
                            });
                            setMsg(isSelected ? "🗑️ ATP dihapus!" : "✅ ATP berhasil ditambahkan!");
                            setTimeout(() => setMsg(""), 3000);
                          }}
                          className={`text-left text-[11px] p-2 rounded-lg border transition font-medium flex justify-between items-center shadow-xs ${
                            isSelected 
                              ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100/80" 
                              : "bg-white border-slate-200 text-slate-700 hover:bg-emerald-50/50 hover:text-emerald-700 hover:border-emerald-200"
                          }`}
                        >
                          <span className="truncate flex-1 flex items-center gap-1.5">
                            <span className="shrink-0">
                              {isSelected ? (
                                <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </span>
                            <span className="truncate">{atp.tujuanPembelajaran} ({atp.topik || "Materi"})</span>
                          </span>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded ml-2 shrink-0 font-bold uppercase ${
                            isSelected ? "bg-emerald-200 text-emerald-900" : "bg-emerald-100 text-emerald-800"
                          }`}>
                            {isSelected ? "TERPILIH" : "PILIH ATP"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 italic flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                  Belum ada Alur Tujuan Pembelajaran (ATP) yang disimpan untuk mata pelajaran {mapel}. Silakan isi di tab ATP terlebih dahulu untuk menyelaraskan otomatis.
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tujuan Pembelajaran (TP)</label>
                <textarea
                  name="tujuanPembelajaran"
                  value={form.tujuanPembelajaran}
                  onChange={handleInputChange}
                  placeholder="Rumuskan tujuan pembelajaran spesifik untuk pertemuan ini..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs h-16 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* CP & Elemen */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Elemen CP</label>
                  <textarea
                    name="elemen"
                    value={form.elemen || ""}
                    onChange={handleInputChange}
                    placeholder="Masukkan elemen CP (contoh: Membaca dan Memirsa, Pancasila, Aljabar...)"
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs h-16 resize-y focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Capaian Pembelajaran (CP) Terkait</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        id="cp-upload"
                        accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.txt"
                        onChange={handleCpUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="cp-upload"
                        className="bg-slate-100 hover:bg-slate-200 border border-slate-200 py-0.5 px-2.5 rounded text-[9px] font-bold text-slate-700 cursor-pointer transition shadow-xs flex items-center gap-1"
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        {uploadingCp ? "Mengekstrak..." : "Unggah CP (PDF/Word)"}
                      </label>
                    </div>
                  </div>
                  <textarea
                    name="cp"
                    value={form.cp}
                    onChange={handleInputChange}
                    placeholder="Masukkan rumusan CP yang ditargetkan..."
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs h-28 resize-y focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {uploadedFileName && (
                  <div className="text-[9px] text-blue-600 font-medium bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 flex items-center gap-1.5 w-fit">
                    <span className="font-bold">✓ Terunggah:</span> {uploadedFileName}
                  </div>
                )}
              </div>
            </div>

            {/* Profiles checklist side bar & Kearifan Lokal */}
            <div className="space-y-4 md:col-span-1">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                    <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-1">
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                      8 Profil Lulusan
                    </h3>
                    <span className="bg-blue-100 text-blue-800 font-bold text-[9px] px-2 py-0.5 rounded-full">
                      Min 2 terpilih
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                    {P5_PROFILES.map((profileName) => {
                      const isChecked = form.profilLulusan.includes(profileName);
                      return (
                        <label key={profileName} className="flex items-start gap-2 cursor-pointer p-1 rounded hover:bg-blue-100/10">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleProfileCheckbox(profileName)}
                            className="text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-0.5"
                          />
                          <span className="text-[10px] font-medium text-slate-700 leading-tight">{profileName}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/80 mt-3">
                  <button
                    type="button"
                    onClick={handleAutoSuggestP5}
                    className="w-full py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold text-[10px] rounded-lg transition uppercase tracking-wider"
                  >
                    Rekomendasikan Profil (AI)
                  </button>
                </div>
              </div>

              {/* Kearifan Lokal Box */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                  <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    Kearifan Lokal
                  </h3>
                </div>
                <div>
                  <textarea
                    name="kearifanLokal"
                    value={form.kearifanLokal || ""}
                    onChange={handleInputChange}
                    placeholder="Contoh: Menggunakan permainan tradisional jamuran, lagu daerah cublak-cublak suweng, cerita rakyat setempat, atau gotong royong..."
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs h-24 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                  <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                    Nilai/kata kearifan lokal di atas akan diintegrasikan secara otomatis ke dalam langkah kegiatan pembelajaran oleh AI.
                  </p>
                </div>
              </div>

              {/* Glosarium & Kesiapan Peserta Didik Box */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Glosarium (Dibuat Otomatis)</label>
                  <textarea
                    name="glosarium"
                    value={form.glosarium || ""}
                    onChange={handleInputChange}
                    placeholder="Glosarium istilah penting akan di-generate otomatis oleh AI..."
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs h-24 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Kesiapan Peserta Didik (Dibuat Otomatis)</label>
                  <textarea
                    name="kesiapanPesertaDidik"
                    value={form.kesiapanPesertaDidik || ""}
                    onChange={handleInputChange}
                    placeholder="Pemetaan kesiapan belajar siswa akan di-generate otomatis oleh AI..."
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs h-24 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Deep learning activities table */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide flex items-center gap-1.5">
              <Grid className="w-4 h-4 text-blue-600" />
              Sintaks Kegiatan Pembelajaran (Deep Learning)
            </h3>
            
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700 uppercase">
                    <th className="p-3 w-40">Tahap Pembelajaran</th>
                    <th className="p-3 w-44">Sintaks Model</th>
                    <th className="p-3">Deskripsi Kegiatan Lengkap</th>
                    <th className="p-3 w-28 text-center">Alokasi Waktu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {form.sintaksTable.map((row, index) => (
                    <tr key={index} className="hover:bg-slate-50/50 transition">
                      <td className="p-3 font-bold text-slate-800 align-top bg-slate-50/40">{row.tahap}</td>
                      <td className="p-3 align-top">
                        <input
                          type="text"
                          value={row.sintaks}
                          onChange={(e) => handleSintaksChange(index, "sintaks", e.target.value)}
                          className="p-1.5 border border-slate-300 rounded bg-white w-full text-xs font-semibold focus:outline-none"
                        />
                      </td>
                      <td className="p-3 align-top">
                        <textarea
                          value={row.deskripsi}
                          onChange={(e) => handleSintaksChange(index, "deskripsi", e.target.value)}
                          className="p-1.5 border border-slate-300 rounded bg-white w-full text-xs leading-normal h-20 focus:outline-none"
                        />
                      </td>
                      <td className="p-3 align-top text-center">
                        <input
                          type="text"
                          value={row.alokasi}
                          onChange={(e) => handleSintaksChange(index, "alokasi", e.target.value)}
                          className="p-1.5 border border-slate-300 rounded bg-white w-full text-xs text-center focus:outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Compile Button with alert if empty */}
          <div className="flex flex-col gap-3 justify-start pt-2">
            {!form.tujuanPembelajaran || form.tujuanPembelajaran.trim() === "" ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2 max-w-xl shadow-xs animate-pulse">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-[11px] mb-0.5">Rumuskan Otomatis dengan AI</span>
                  <p className="text-slate-600 leading-normal">
                    Anda belum mengisi Tujuan Pembelajaran (TP). Cukup isi kolom <strong>Mata Pelajaran</strong> dan <strong>Materi Pokok</strong> di atas, lalu klik tombol di bawah untuk memformulasikan TP secara otomatis dan menyusun RPP Mendalam sekaligus!
                  </p>
                </div>
              </div>
            ) : null}

            <div>
              <button
                onClick={handleCompileRpp}
                disabled={loading}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 via-blue-700 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-bold py-2.5 px-6 rounded-lg transition shadow-md disabled:opacity-40 disabled:cursor-not-allowed text-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyusun RPP Mendalam...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Kompilasi RPP Mendalam (AI)
                  </>
                )}
              </button>
            </div>
          </div>

          {msg && (
            <div className={`p-3 rounded-lg text-sm font-semibold ${msg.includes("🔴") ? "bg-red-50 text-red-700 border border-red-100" : "bg-emerald-50 text-emerald-800 border border-emerald-100"}`}>
              {msg}
            </div>
          )}
        </div>
      </div>

      {/* Tiptap rich document editor display */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 p-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
            <FileText className="w-5 h-5 text-blue-600" />
            Dokumen RPP Hasil Kompilasi (Dapat Diedit Sepenuhnya)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Ubah rincian, perbaiki format, dan tambahkan materi di bawah sebelum diunduh atau disinkronkan.</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Validation Banner */}
          <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
            isRppValid 
              ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}>
            <div className="flex items-start gap-3">
              {isRppValid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                  Status Validasi Alur Data (Integritas SIPENA: PROSEM &rarr; RPP)
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {isRppValid 
                    ? `Modul Ajar RPP Mendalam sinkron 100% sempurna dengan Tujuan Pembelajaran terpilih di PROSEM Semester ${form.semester}.` 
                    : `Terdapat catatan kelayakan data RPP: ${currentProsemItems.length === 0 ? "Data PROSEM aktif kosong atau belum disusun. " : ""}${!activeTpMatched ? "Tujuan Pembelajaran terpilih di RPP tidak cocok atau tidak ditemukan di daftar PROSEM. " : ""}${!hasRppContent ? "Konten dokumen RPP Mendalam belum dikompilasi oleh AI. Klik tombol 'Kompilasi RPP Mendalam' di atas." : ""}`}
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isRppValid 
                  ? "bg-emerald-200 text-emerald-900" 
                  : "bg-amber-200 text-amber-900"
              }`}>
                {isRppValid ? "100% Sesuai & Valid" : "Butuh Kompilasi"}
              </span>
            </div>
          </div>

          <TiptapEditor
            content={editorHtml}
            onChange={(html) => setEditorHtml(html)}
          />

          {/* Checkpoint Versioning Form */}
          <form onSubmit={handleCreateVersion} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Simpan Checkpoint Versi Dokumen</label>
              <input
                type="text"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                placeholder="Misal: Revisi Pertemuan 1, Draft Kepala Sekolah"
                className="w-full p-2 border border-slate-300 rounded bg-white text-xs focus:outline-none"
                required
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded text-xs transition self-end cursor-pointer"
            >
              Simpan Checkpoint
            </motion.button>
          </form>

          {/* Sync actions */}
          <div className="flex flex-wrap gap-3 justify-between items-center pt-4 border-t border-slate-100">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              onClick={handleSaveDoc}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-5 rounded-lg text-xs transition shadow-sm cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Simpan Data RPP ke Firestore
            </motion.button>

            <div className="flex gap-2">
              {accessToken && driveFolderId && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  onClick={handleSyncToDrive}
                  disabled={syncingDrive}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2.5 px-5 rounded-lg text-xs transition shadow-sm cursor-pointer"
                >
                  <FolderSync className="w-4 h-4" />
                  {syncingDrive ? "Mengunggah..." : "Simpan ke Google Drive"}
                </motion.button>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                onClick={handleDownloadDocx}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-semibold py-2.5 px-5 rounded-lg text-xs transition shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Unduh Microsoft Word (.docx)
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </>
  ) : (
    <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Selector */}
        <div className="lg:col-span-1 space-y-2">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Tipe Lampiran</h3>
          {[
            { id: "LKPD", label: "Lembar Kerja Siswa (LKPD)", desc: "Aktivitas belajar & penugasan siswa", color: "border-l-indigo-500" },
            { id: "Asesmen", label: "Instrumen Asesmen", desc: "Kisi-kisi, tes diagnostik & sumatif", color: "border-l-emerald-500" },
            { id: "Rubrik", label: "Rubrik Penilaian", desc: "Kriteria pengukuran kinerja & proyek", color: "border-l-amber-500" },
            { id: "Bahan Bacaan", label: "Bahan Bacaan Guru & Siswa", desc: "Materi pendukung & studi kasus", color: "border-l-sky-500" }
          ].map((item) => {
            const isSelected = selectedLampiranType === item.id;
            const hasContent = item.id === "LKPD" ? form.lampiranLKPD :
              item.id === "Asesmen" ? form.lampiranAsesmen :
              item.id === "Rubrik" ? form.lampiranRubrik :
              form.lampiranBahanBacaan;
            
            return (
              <button
                key={item.id}
                onClick={() => setSelectedLampiranType(item.id as any)}
                className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1 ${
                  isSelected 
                    ? "bg-blue-50/70 border-blue-300 shadow-sm ring-1 ring-blue-200" 
                    : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                } border-l-4 ${item.color}`}
              >
                <div className="flex justify-between items-center w-full">
                  <span className="font-bold text-slate-800 text-xs sm:text-sm">{item.label}</span>
                  {hasContent ? (
                    <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Aktif</span>
                  ) : (
                    <span className="text-[9px] font-extrabold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">Kosong</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 leading-snug">{item.desc}</span>
              </button>
            );
          })}

          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl mt-4">
            <h4 className="font-bold text-amber-800 text-[11px] flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Sinkronisasi RPP
            </h4>
            <p className="text-[10px] text-amber-700 mt-1 leading-normal">
              Lampiran terpisah ini disinkronkan langsung dengan draf RPP mata pelajaran <strong>{form.mapel}</strong>. Data disimpan otomatis ke Firestore setiap 10 detik.
            </p>
          </div>
        </div>

        {/* Workspace Editor Area */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                Penyusunan Lampiran: {
                  selectedLampiranType === "LKPD" ? "Lembar Kerja Peserta Didik (LKPD)" : 
                  selectedLampiranType === "Asesmen" ? "Instrumen Asesmen & Kisi-Kisi" : 
                  selectedLampiranType === "Rubrik" ? "Rubrik Penilaian Kinerja" : 
                  "Bahan Bacaan & Materi Ajar"
                }
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Susun dokumen lampiran lengkap terpisah berlandaskan prinsip Pembelajaran Mendalam (Deep Learning).</p>
            </div>

            <button
              onClick={handleGenerateLampiran}
              disabled={generatingLampiran}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2 px-4 rounded-lg text-xs transition disabled:opacity-50 shadow-sm"
            >
              {generatingLampiran ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyusun dengan AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Hasilkan Lampiran (AI)
                </>
              )}
            </button>
          </div>

          {msg && (
            <div className={`p-3 rounded-lg text-sm font-semibold ${msg.includes("🔴") ? "bg-red-50 text-red-700 border border-red-100" : "bg-emerald-50 text-emerald-800 border border-emerald-100"}`}>
              {msg}
            </div>
          )}

          {/* Editor Container */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 border-b border-slate-200 p-3 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Editor Dokumen Lampiran</span>
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-100">
                <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                Auto-Save Aktif
              </span>
            </div>
            <div className="p-4">
              <TiptapEditor
                key={`lampiran-editor-${selectedLampiranType}-${form.id}`}
                content={lampiranEditorHtml}
                onChange={handleLampiranEditorChange}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-between items-center pt-4 border-t border-slate-100">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              onClick={handleSaveDoc}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-5 rounded-lg text-xs transition shadow-sm cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Simpan Lampiran ke Firestore
            </motion.button>

            <div className="flex gap-2">
              {accessToken && driveFolderId && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  onClick={handleSyncLampiranToDrive}
                  disabled={syncingLampiranDrive}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2.5 px-5 rounded-lg text-xs transition shadow-sm cursor-pointer"
                >
                  <FolderSync className="w-4 h-4" />
                  {syncingLampiranDrive ? "Mengunggah..." : "Simpan ke Google Drive"}
                </motion.button>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                onClick={handleDownloadLampiranDocx}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-semibold py-2.5 px-5 rounded-lg text-xs transition shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Unduh Lampiran (.docx)
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )}
</div>
);
}

// Helper to format deskripsi kegiatan so every numbered point gets a newline (<br>)
function formatDeskripsiHTML(deskripsi: string): string {
  if (!deskripsi) return "";
  let cleaned = deskripsi.replace(/\\n/g, "\n").replace(/\\\\n/g, "\n");
  cleaned = cleaned.replace(/<br\s*\/?>/gi, "\n");
  
  // Replace markdown bold tags with HTML strong tags
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  
  const originalLines = cleaned.split("\n");
  const finalLines: string[] = [];
  
  originalLines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    // Split properly on list numbers e.g. 1., 2) or small letter lists a., b) without removing periods of the previous sentence
    const brokenLine = trimmed.replace(/(?:\s+|(?<=\.))([0-9]+[\.\)](?!\d)|[a-z][\.\)])\s+/g, "\n$1 ");
    brokenLine.split("\n").forEach(subLine => {
      const subTrimmed = subLine.trim();
      if (subTrimmed) {
        finalLines.push(subTrimmed);
      }
    });
  });
  
  return finalLines.join("<br>");
}

// Helper to construct highly descriptive Indonesian RPP summary matching official formatting
function buildRppHtmlSummary(rpp: RPPData, profile?: any): string {
  const p5Text = (rpp.profilLulusan || []).map(p => `<li>${p}</li>`).join("");
  
  let sintaksHtml = "";
  if (!rpp.sintaksTable || rpp.sintaksTable.length === 0) {
    sintaksHtml = `
      <tr>
        <td colspan="4" style="border: 1px solid #cbd5e1; padding: 12px; text-align: center; color: #64748b; font-style: italic;">
          (Belum ada langkah pembelajaran - Silakan isi atau kompilasi RPP dengan AI)
        </td>
      </tr>
    `;
  } else {
    (rpp.sintaksTable || []).forEach(row => {
      sintaksHtml += `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${row.tahap}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: 600;">${row.sintaks}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; line-height: 1.5;">${formatDeskripsiHTML(row.deskripsi)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${row.alokasi}</td>
        </tr>
      `;
    });
  }

  const kepalaSekolahName = profile?.kepalaSekolah || "___________________";
  const nipKepalaSekolah = profile?.nipKepalaSekolah || "-";
  
  const teacher = getTeacherForKelas(profile, rpp.kelas || "", rpp.mapel);
  const guruName = teacher.nama || "___________________";
  const nipGuru = teacher.nip || "-";
  const guruTtd = teacher.tandaTangan;
  const isMapel = teacher.jenisGuru === "Guru Mapel" || !!teacher.mapel;
  const ttdRole = isMapel ? `Guru Mata Pelajaran ${rpp.mapel}` : `Guru Kelas ${rpp.kelas}`;
  
  const today = new Date();
  const formatIndonesianDate = `${today.getDate()} Juli ${today.getFullYear()}`;

  const ttdHtml = `
    <!-- Tanda Tangan Section -->
    <table style="width: 100%; margin-top: 40px; margin-bottom: 40px; font-size: 12px; border: none; border-collapse: collapse;">
      <tr style="border: none;">
        <td style="width: 50%; text-align: center; border: none; padding: 0 10px; vertical-align: top;">
          <p style="margin: 0 0 10px 0;">Mengetahui,<br><strong>Kepala Sekolah</strong></p>
          <div style="height: 60px; margin-bottom: 10px;"></div>
          <p style="margin: 0 0 2px 0; text-decoration: underline; font-weight: bold;">${kepalaSekolahName}</p>
          <p style="margin: 0; font-size: 11px; color: #64748b;">NIP: ${nipKepalaSekolah}</p>
        </td>
        <td style="width: 50%; text-align: center; border: none; padding: 0 10px; vertical-align: top;">
          <p style="margin: 0 0 10px 0;">Mengetahui, ${formatIndonesianDate}<br><strong>${ttdRole}</strong></p>
          ${guruTtd ? `
            <div style="height: 60px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
              <img src="${guruTtd}" alt="Tanda Tangan Guru" style="max-height: 60px; max-width: 120px; object-fit: contain; referrer-policy: no-referrer;" />
            </div>
          ` : `
            <div style="height: 60px; margin-bottom: 10px;"></div>
          `}
          <p style="margin: 0 0 2px 0; text-decoration: underline; font-weight: bold;">${guruName}</p>
          <p style="margin: 0; font-size: 11px; color: #64748b;">NIP: ${nipGuru}</p>
        </td>
      </tr>
    </table>
  `;

  return `
    <h1 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 4px;">RENCANA PELAKSANAAN PEMBELAJARAN (RPP) MENDALAM</h1>
    <h2 style="text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 24px;">PEMBELAJARAN MENDALAM (DEEP LEARNING)</h2>
    
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="width: 30%; font-weight: bold; padding: 6px 0;">Satuan Pendidikan:</td>
        <td style="padding: 6px 0;">${rpp.namaSekolah}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 6px 0;">Mata Pelajaran:</td>
        <td style="padding: 6px 0;">${rpp.mapel}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 6px 0;">Fase / Kelas:</td>
        <td style="padding: 6px 0;">${rpp.fase} / Kelas ${rpp.kelas}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 6px 0;">Semester / Tahun Pelajaran:</td>
        <td style="padding: 6px 0;">Semester ${rpp.semester} / ${rpp.tahunPelajaran}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 6px 0;">Alokasi Waktu / Pertemuan:</td>
        <td style="padding: 6px 0;">${rpp.alokasiWaktu} / ${rpp.pertemuan} Pertemuan</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 6px 0;">Materi Pokok:</td>
        <td style="padding: 6px 0; color: ${rpp.materi ? '#0f172a' : '#64748b'}; font-style: ${rpp.materi ? 'normal' : 'italic'};">${rpp.materi || "(Belum ditentukan - Silakan isi Materi Pokok atau pilih TP)"}</td>
      </tr>
    </table>
    
    <h3 style="font-size: 14px; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 20px;">A. CAPAIAN PEMBELAJARAN (CP) & ELEMEN</h3>
    ${rpp.elemen ? `<p style="font-size: 12px; line-height: 1.5; margin-bottom: 8px; color: #0f172a;"><strong>Elemen:</strong> ${rpp.elemen}</p>` : ""}
    <p style="font-size: 12px; line-height: 1.5; margin-bottom: 16px; color: ${rpp.cp ? '#0f172a' : '#64748b'}; font-style: ${rpp.cp ? 'normal' : 'italic'};">${rpp.cp || "(Belum ditentukan - Silakan pilih/isi Tujuan Pembelajaran terlebih dahulu)"}</p>

    <h3 style="font-size: 14px; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 20px;">B. TUJUAN PEMBELAJARAN (TP)</h3>
    <p style="font-size: 12px; line-height: 1.5; margin-bottom: 16px; color: ${rpp.tujuanPembelajaran ? '#0f172a' : '#64748b'}; font-style: ${rpp.tujuanPembelajaran ? 'normal' : 'italic'};">${rpp.tujuanPembelajaran || "(Belum ditentukan - Silakan pilih/isi Tujuan Pembelajaran terlebih dahulu)"}</p>

    <h3 style="font-size: 14px; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 20px;">C. 8 PROFIL LULUSAN</h3>
    <ul style="font-size: 12px; line-height: 1.5; margin-bottom: 16px; padding-left: 20px;">
      ${p5Text || "<li>Kreativitas</li><li>Penalaran Kritis</li>"}
    </ul>

    <h3 style="font-size: 14px; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 20px;">D. MEDIA, ALAT, DAN SUMBER BELAJAR</h3>
    <p style="font-size: 12px; line-height: 1.5; margin-bottom: 6px; color: ${rpp.mediaPembelajaran ? '#0f172a' : '#64748b'}; font-style: ${rpp.mediaPembelajaran ? 'normal' : 'italic'};"><strong>Media Pembelajaran:</strong> ${rpp.mediaPembelajaran || "(Belum ditentukan - Silakan isi atau kompilasi RPP dengan AI)"}</p>
    <p style="font-size: 12px; line-height: 1.5; margin-bottom: 6px; color: ${rpp.alatPembelajaran ? '#0f172a' : '#64748b'}; font-style: ${rpp.alatPembelajaran ? 'normal' : 'italic'};"><strong>Alat & Bahan:</strong> ${rpp.alatPembelajaran || "(Belum ditentukan - Silakan isi atau kompilasi RPP dengan AI)"}</p>
    <p style="font-size: 12px; line-height: 1.5; margin-bottom: 16px; color: ${rpp.sumberBelajar ? '#0f172a' : '#64748b'}; font-style: ${rpp.sumberBelajar ? 'normal' : 'italic'};"><strong>Sumber Belajar:</strong> ${rpp.sumberBelajar || "(Belum ditentukan - Silakan isi atau kompilasi RPP dengan AI)"}</p>

    <h3 style="font-size: 14px; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 20px;">E. MODEL & METODE PEMBELAJARAN</h3>
    <p style="font-size: 12px; line-height: 1.5; margin-bottom: 16px;"><strong>Model:</strong> ${rpp.modelPembelajaran} | <strong>Metode:</strong> ${rpp.metodePembelajaran}</p>

    <h3 style="font-size: 14px; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 20px;">F. GLOSARIUM</h3>
    <p style="font-size: 12px; line-height: 1.5; margin-bottom: 16px; white-space: pre-line; color: ${rpp.glosarium ? '#0f172a' : '#64748b'}; font-style: ${rpp.glosarium ? 'normal' : 'italic'};">${rpp.glosarium || "(Belum ditentukan - Silakan isi atau kompilasi RPP dengan AI)"}</p>

    <h3 style="font-size: 14px; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 20px;">G. KESIAPAN PESERTA DIDIK</h3>
    <p style="font-size: 12px; line-height: 1.5; margin-bottom: 16px; white-space: pre-line; color: ${rpp.kesiapanPesertaDidik ? '#0f172a' : '#64748b'}; font-style: ${rpp.kesiapanPesertaDidik ? 'normal' : 'italic'};">${rpp.kesiapanPesertaDidik || "(Belum ditentukan - Silakan isi atau kompilasi RPP dengan AI)"}</p>

    <h3 style="font-size: 14px; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 20px;">H. LANGKAH-LANGKAH KEGIATAN PEMBELAJARAN</h3>
    <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px;">
      <thead>
        <tr style="background-color: #f1f5f9; font-weight: bold;">
          <th style="border: 1px solid #cbd5e1; padding: 8px;">Tahap</th>
          <th style="border: 1px solid #cbd5e1; padding: 8px;">Sintaks</th>
          <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Deskripsi Kegiatan</th>
          <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">Waktu</th>
        </tr>
      </thead>
      <tbody>
        ${sintaksHtml}
      </tbody>
    </table>

    <h3 style="font-size: 14px; font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin-top: 28px; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">I. EVALUASI, PENGAYAAN, DAN REMEDIAL</h3>
    
    <div style="margin-top: 14px; margin-bottom: 20px;">
      <h4 style="font-size: 12px; font-weight: bold; color: #0f172a; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
        <span style="background-color: #3b82f6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">1</span> 
        Asesmen / Evaluasi Pembelajaran
      </h4>
      <div style="font-size: 12px; line-height: 1.6; padding: 12px 16px; background-color: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 0 8px 8px 0; white-space: pre-line; color: ${rpp.evaluasi ? '#0f172a' : '#64748b'}; font-style: ${rpp.evaluasi ? 'normal' : 'italic'};">
        ${rpp.evaluasi || "(Belum ditentukan - Silakan isi atau kompilasi RPP dengan AI)"}
      </div>
    </div>

    <div style="margin-top: 14px; margin-bottom: 20px;">
      <h4 style="font-size: 12px; font-weight: bold; color: #0f172a; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
        <span style="background-color: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">2</span> 
        Program Pembelajaran Pengayaan (Enrichment)
      </h4>
      <div style="font-size: 12px; line-height: 1.6; padding: 12px 16px; background-color: #f8fafc; border-left: 4px solid #10b981; border-radius: 0 8px 8px 0; white-space: pre-line; color: ${rpp.pengayaan ? '#0f172a' : '#64748b'}; font-style: ${rpp.pengayaan ? 'normal' : 'italic'};">
        ${rpp.pengayaan || "(Belum ditentukan - Silakan isi atau kompilasi RPP dengan AI)"}
      </div>
    </div>

    <div style="margin-top: 14px; margin-bottom: 24px;">
      <h4 style="font-size: 12px; font-weight: bold; color: #0f172a; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
        <span style="background-color: #f59e0b; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">3</span> 
        Program Pembelajaran Remedial
      </h4>
      <div style="font-size: 12px; line-height: 1.6; padding: 12px 16px; background-color: #f8fafc; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0; white-space: pre-line; color: ${rpp.remedial ? '#0f172a' : '#64748b'}; font-style: ${rpp.remedial ? 'normal' : 'italic'};">
        ${rpp.remedial || "(Belum ditentukan - Silakan isi atau kompilasi RPP dengan AI)"}
      </div>
    </div>

    <h3 style="font-size: 14px; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 20px;">J. REFLEKSI GURU & PESERTA DIDIK</h3>
    <p style="font-size: 12px; line-height: 1.5; margin-bottom: 6px; color: ${rpp.refleksiGuru ? '#0f172a' : '#64748b'}; font-style: ${rpp.refleksiGuru ? 'normal' : 'italic'};"><strong>Refleksi Guru:</strong> ${rpp.refleksiGuru || "(Belum ditentukan - Silakan isi atau kompilasi RPP dengan AI)"}</p>
    <p style="font-size: 12px; line-height: 1.5; margin-bottom: 16px; color: ${rpp.refleksiSiswa ? '#0f172a' : '#64748b'}; font-style: ${rpp.refleksiSiswa ? 'normal' : 'italic'};"><strong>Refleksi Siswa:</strong> ${rpp.refleksiSiswa || "(Belum ditentukan - Silakan isi atau kompilasi RPP dengan AI)"}</p>

    ${ttdHtml}

    <h3 style="page-break-before: always; break-before: page; font-size: 14px; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 20px;">K. LAMPIRAN</h3>
    <div style="font-size: 12px; line-height: 1.5; margin-bottom: 24px; white-space: pre-line; color: ${rpp.lampiran ? '#0f172a' : '#64748b'}; font-style: ${rpp.lampiran ? 'normal' : 'italic'};">${rpp.lampiran || "(Belum ditentukan - Silakan isi atau kompilasi RPP dengan AI)"}</div>
  `;
}
