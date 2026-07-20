import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Sparkles, 
  Download, 
  CloudLightning, 
  Plus, 
  Trash2, 
  Save, 
  Edit3, 
  Loader2, 
  Check, 
  RefreshCw,
  FolderSync,
  Upload,
  FileText,
  X,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { generateTujuanPembelajaran, extractCapaianPembelajaranOnly, generateTpFromElements } from "../lib/ai";
import { generateTPDocx } from "../lib/docxGenerator";
import { uploadFileToDrive } from "../lib/drive";
import { Jenjang, Fase, TPItem, TPData } from "../types";

interface TpPanelProps {
  profile: any;
  tpData: TPData | null;
  onSaveTp: (data: TPData) => Promise<void>;
  onLoadTp?: (ctx: { mapel: string; kelas: string; fase: Fase }) => Promise<void>;
  apiKey?: string;
  driveFolderId?: string;
  accessToken?: string | null;
}

const FASE_CLASSES: { [key: string]: string[] } = {
  A: ["1", "2"],
  B: ["3", "4"],
  C: ["5", "6"],
  D: ["7", "8", "9"],
  E: ["10"],
  F: ["11", "12"]
};

export default function TpPanel({ profile, tpData, onSaveTp, onLoadTp, apiKey, driveFolderId, accessToken }: TpPanelProps) {
  const [jenjang, setJenjang] = useState<Jenjang>(profile.jenjang || Jenjang.SD);
  const [fase, setFase] = useState<Fase>(profile.fase || Fase.A);
  const [kelas, setKelas] = useState("Fase");
  const [mapel, setMapel] = useState("Bahasa Indonesia");
  const [cp, setCp] = useState("");
  const [items, setItems] = useState<TPItem[]>([]);
  const [customCp, setCustomCp] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedElements, setExtractedElements] = useState<{ namaElemen: string; deskripsiCpElemenAsli: string }[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingExtract, setLoadingExtract] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [msg, setMsg] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ elemen: "", cp: "", kompetensi: "", konten: "", tujuanPembelajaran: "" });

  const [manualAdd, setManualAdd] = useState(false);
  const [manualForm, setManualForm] = useState({ elemen: "", cp: "", kompetensi: "", konten: "", tujuanPembelajaran: "" });

  // Mapel presets based on Jenjang
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

  useEffect(() => {
    if (onLoadTp) {
      onLoadTp({ mapel, kelas, fase });
    }
  }, [mapel, kelas, fase, profile.tahunPelajaran, profile.semester]);

  useEffect(() => {
    if (tpData) {
      setJenjang(tpData.jenjang);
      setFase(tpData.fase);
      
      const defaultMapel = mapel || tpData.mapel || "Bahasa Indonesia";
      setMapel(defaultMapel);
      
      // Load and safely map items with back-compatibility for mapel and cp
      const loadedItems = (tpData.items || []).map(item => ({
        ...item,
        mapel: item.mapel || tpData.mapel || "Bahasa Indonesia",
        cp: item.cp || tpData.capaianPembelajaran || "Capaian Pembelajaran"
      }));
      setItems(loadedItems);

      if (tpData.extractedElements) {
        setExtractedElements(tpData.extractedElements);
      } else {
        // Build extractedElements from loadedItems if not present
        const uniqueElMap: { [key: string]: string } = {};
        loadedItems.forEach(it => {
          if (it.elemen && it.cp) {
            uniqueElMap[it.elemen] = it.cp;
          }
        });
        const derived = Object.entries(uniqueElMap).map(([namaElemen, deskripsiCpElemenAsli]) => ({
          namaElemen,
          deskripsiCpElemenAsli
        }));
        setExtractedElements(derived);
      }

      // Set CP to current active mapel CP if present
      const currentMapelItems = loadedItems.filter(it => it.mapel === defaultMapel);
      if (currentMapelItems.length > 0) {
        setCp(currentMapelItems[0].cp || "");
      } else if (tpData.mapel === defaultMapel) {
        setCp(tpData.capaianPembelajaran || "");
      }
    } else {
      setItems([]);
      setCp("");
      setExtractedElements([]);
    }
  }, [tpData]);

  // Adjust mapel preset on jenjang change
  useEffect(() => {
    if (mapelPresets[jenjang] && !mapelPresets[jenjang].includes(mapel) && mapel !== "") {
      setMapel(mapelPresets[jenjang][0]);
    }
  }, [jenjang]);

  // Sync CP state with chosen mapel from list of items
  useEffect(() => {
    if (mapel) {
      const matched = items.filter(it => it.mapel === mapel);
      if (matched.length > 0) {
        setCp(matched[0].cp || "");
      } else {
        setCp("");
      }
    }
  }, [mapel, items]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const resultStr = reader.result as string;
        const base64 = resultStr.split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleExtractCpOnly = async () => {
    setLoadingExtract(true);
    setMsg("");
    try {
      let filePayload = null;
      if (uploadedFile) {
        try {
          const base64Data = await fileToBase64(uploadedFile);
          filePayload = {
            data: base64Data,
            mimeType: uploadedFile.type || "application/octet-stream"
          };
        } catch (fileErr) {
          console.error("Gagal membaca file CP:", fileErr);
        }
      }

      const data = await extractCapaianPembelajaranOnly(
        jenjang,
        fase,
        mapel,
        customCp || undefined,
        { apiKey },
        filePayload
      );

      if (data.mismatchDetected) {
        throw new Error(data.mismatchDetails || `Mata pelajaran dalam dokumen CP tidak sesuai dengan mata pelajaran "${mapel}" yang Anda pilih.`);
      }

      const newCpText = data.capaianPembelajaran || customCp || "Capaian Pembelajaran";
      setCp(newCpText);
      
      if (data.elements && data.elements.length > 0) {
        setExtractedElements(data.elements);
      } else {
        setExtractedElements([{ namaElemen: "Umum", deskripsiCpElemenAsli: newCpText }]);
      }

      if (uploadedFile) {
        setMsg(`✅ Dokumen Capaian Pembelajaran (CP) "${uploadedFile.name}" berhasil dibaca, diekstraksi, dan divalidasi sebagai dokumen CP ASLI secara utuh tanpa diringkas atau disederhanakan!`);
      } else {
        setMsg("✅ Capaian Pembelajaran (CP) berhasil diidentifikasi dan divalidasi sebagai dokumen CP ASLI secara utuh tanpa diringkas atau disederhanakan!");
      }
    } catch (error: any) {
      setMsg(`🔴 Gagal mengekstrak CP asli: ${error.message || "Kesalahan server"}`);
    } finally {
      setLoadingExtract(false);
    }
  };

  const handleFormulateTpFromElements = async () => {
    if (extractedElements.length === 0) {
      setMsg("🔴 Silakan masukkan dokumen/teks CP asli lalu klik 'Ekstrak & Validasi CP Asli' terlebih dahulu.");
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      const data = await generateTpFromElements(
        jenjang,
        fase,
        mapel,
        extractedElements,
        { apiKey }
      );

      const formattedItems = data.items.map((it: any, index: number) => ({
        id: `tp-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
        mapel: mapel,
        elemen: it.elemen || "",
        cp: it.cp || cp,
        kompetensi: it.kompetensi,
        konten: it.konten,
        tujuanPembelajaran: it.tujuanPembelajaran,
        checked: true,
        kelas: kelas
      }));

      setItems(prev => {
        const otherMapelItems = prev.filter(item => item.mapel !== mapel);
        return [...otherMapelItems, ...formattedItems];
      });

      setMsg(`✅ Berhasil memformulasikan minimal 8 Tujuan Pembelajaran (TP) terstruktur untuk masing-masing elemen CP asli!`);
    } catch (error: any) {
      setMsg(`🔴 Gagal memformulasikan TP dari elemen CP asli: ${error.message || "Kesalahan server"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAI = async () => {
    setLoading(true);
    setMsg("");
    try {
      let filePayload = null;
      if (uploadedFile) {
        try {
          const base64Data = await fileToBase64(uploadedFile);
          filePayload = {
            data: base64Data,
            mimeType: uploadedFile.type || "application/octet-stream"
          };
        } catch (fileErr) {
          console.error("Gagal membaca file CP:", fileErr);
        }
      }

      const data = await generateTujuanPembelajaran(
        jenjang,
        fase,
        mapel,
        customCp || undefined,
        { apiKey },
        filePayload
      );

      if (data.mismatchDetected) {
        throw new Error(data.mismatchDetails || `Mata pelajaran dalam dokumen CP tidak sesuai dengan mata pelajaran "${mapel}" yang Anda pilih.`);
      }

      const newCpText = data.capaianPembelajaran || customCp || "Capaian Pembelajaran";
      setCp(newCpText);
      
      const formattedItems = data.items.map((it: any, index: number) => ({
        id: `tp-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
        mapel: mapel,
        elemen: it.elemen || "",
        cp: it.cp || newCpText,
        kompetensi: it.kompetensi,
        konten: it.konten,
        tujuanPembelajaran: it.tujuanPembelajaran,
        checked: true,
        kelas: kelas
      }));

      // Append items instead of overwriting!
      setItems(prev => [...prev, ...formattedItems]);
      if (uploadedFile) {
        setMsg(`✅ Capaian Pembelajaran (CP) berhasil diidentifikasi dari berkas "${uploadedFile.name}" untuk mapel ${mapel} Fase ${fase}, dan Tujuan Pembelajaran (TP) berhasil diformulasikan!`);
      } else {
        setMsg("✅ Tujuan Pembelajaran (TP) berhasil diformulasikan oleh Gemini AI dan ditambahkan ke daftar!");
      }
    } catch (error: any) {
      setMsg(`🔴 Gagal memformulasikan TP: ${error.message || "Kesalahan server"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditStart = (item: TPItem) => {
    setEditingId(item.id);
    setEditForm({
      elemen: item.elemen || "",
      cp: item.cp || "",
      kompetensi: item.kompetensi,
      konten: item.konten,
      tujuanPembelajaran: item.tujuanPembelajaran
    });
  };

  const handleEditSave = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...editForm } : item));
    setEditingId(null);
    setMsg("💡 Tujuan Pembelajaran berhasil diubah.");
  };

  const handleDelete = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    setMsg("💡 Tujuan Pembelajaran berhasil dihapus dari daftar.");
  };

  const handleOpenManualAdd = () => {
    setManualForm({
      elemen: "",
      cp: cp || "",
      kompetensi: "",
      konten: "",
      tujuanPembelajaran: ""
    });
    setManualAdd(true);
  };

  const handleManualAdd = () => {
    if (!manualForm.tujuanPembelajaran) return;
    const newItem: TPItem = {
      id: `tp-${Date.now()}-manual-${Math.random().toString(36).substr(2, 5)}`,
      mapel: mapel,
      elemen: manualForm.elemen || "Umum",
      cp: manualForm.cp || cp || "Capaian Pembelajaran",
      kompetensi: manualForm.kompetensi || "Umum",
      konten: manualForm.konten || "Umum",
      tujuanPembelajaran: manualForm.tujuanPembelajaran,
      checked: true,
      kelas: kelas
    };
    setItems(prev => [...prev, newItem]);
    setManualAdd(false);
    setManualForm({ elemen: "", cp: "", kompetensi: "", konten: "", tujuanPembelajaran: "" });
    setMsg("💡 Tujuan Pembelajaran manual berhasil ditambahkan.");
  };

  const handleSaveToDb = async () => {
    setSaving(true);
    try {
      const payload: TPData = {
        jenjang,
        fase,
        mapel,
        capaianPembelajaran: cp,
        items, // This contains ALL items across all subjects, each tagged with their 'mapel'!
        createdAt: new Date().toISOString(),
        kelas,
        tahunPelajaran: profile.tahunPelajaran,
        semester: profile.semester,
        extractedElements: extractedElements
      } as any;
      await onSaveTp(payload);
      setMsg("✅ Seluruh data Tujuan Pembelajaran berhasil disimpan ke Firestore!");
      setTimeout(() => setMsg(""), 4000);
    } catch (error: any) {
      setMsg(`🔴 Gagal menyimpan ke Firestore: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const displayedItems = items.filter(item => 
    item.mapel?.toLowerCase().trim() === mapel.toLowerCase().trim()
  );

  // Group displayedItems by Elemen and CP for validation
  const validationElements: { [key: string]: number } = {};
  displayedItems.forEach(item => {
    const el = item.elemen || "Umum";
    validationElements[el] = (validationElements[el] || 0) + 1;
  });

  const hasCp = cp.trim().length > 0;
  const hasItems = displayedItems.length > 0;
  const elementsWithFewerThan8 = Object.entries(validationElements).filter(([_, count]) => count < 8);
  const isTpValid = hasCp && hasItems && elementsWithFewerThan8.length === 0;

  const handleDownloadWord = async () => {
    try {
      const activeItems = displayedItems.filter(it => it.checked !== false);
      if (activeItems.length === 0) {
        alert("Pilih minimal 1 Tujuan Pembelajaran untuk diunduh.");
        return;
      }
      const blob = await generateTPDocx(profile, mapel, activeItems, kelas);
      const filename = `Tujuan Pembelajaran_${mapel}.docx`;
      
      const fileSaver = await import("file-saver");
      fileSaver.saveAs(blob, filename);
      setMsg("✅ File Microsoft Word (.docx) berhasil dibuat dan diunduh!");
    } catch (error: any) {
      setMsg(`🔴 Gagal mengunduh berkas Word: ${error.message}`);
    }
  };

  const handleSyncToDrive = async () => {
    if (!accessToken || !driveFolderId) {
      alert("Silakan hubungkan Google Drive terlebih dahulu di tab Pengaturan.");
      return;
    }
    
    setSyncingDrive(true);
    setMsg("Mengunggah dokumen ke Google Drive...");
    try {
      const activeItems = displayedItems.filter(it => it.checked !== false);
      const blob = await generateTPDocx(profile, mapel, activeItems, kelas);
      const filename = `Tujuan Pembelajaran_${mapel}.docx`;
      
      await uploadFileToDrive(accessToken, blob, filename, driveFolderId);
      setMsg("✅ Dokumen Tujuan Pembelajaran berhasil diunggah langsung ke folder Google Drive Anda!");
    } catch (error: any) {
      setMsg(`🔴 Gagal mengunggah ke Google Drive: ${error.message}`);
    } finally {
      setSyncingDrive(false);
    }
  };

  return (
    <div className="space-y-6" id="tp_panel">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 p-4">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            Penyusunan Tujuan Pembelajaran (TP)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Rumuskan Capaian Pembelajaran secara otomatis, lalu AI akan mengekstrak kompetensi, konten, dan tujuan pembelajaran secara mendalam.</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Controls form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Jenjang</label>
              <select
                value={jenjang}
                onChange={(e) => setJenjang(e.target.value as Jenjang)}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-sm"
              >
                <option value={Jenjang.SD}>SD</option>
                <option value={Jenjang.SMP}>SMP</option>
                <option value={Jenjang.SMA}>SMA</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Fase</label>
              <select
                value={fase}
                onChange={(e) => {
                  setFase(e.target.value as Fase);
                }}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-sm"
              >
                <option value={Fase.A}>{Fase.A}</option>
                <option value={Fase.B}>{Fase.B}</option>
                <option value={Fase.C}>{Fase.C}</option>
                <option value={Fase.D}>{Fase.D}</option>
                <option value={Fase.E}>{Fase.E}</option>
                <option value={Fase.F}>{Fase.F}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Mata Pelajaran</label>
              <select
                value={mapel}
                onChange={(e) => setMapel(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-sm"
              >
                {mapelPresets[jenjang]?.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* CP Input Options: Upload File OR Custom Paste */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Upload CP File */}
            <div className="bg-[#F0F4F8] p-4 rounded-xl border border-blue-200/60 flex flex-col justify-between space-y-3">
              <div>
                <label className="block text-xs font-bold text-blue-800 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-blue-600" />
                  Unggah Dokumen CP (PDF/Word/Text/Gambar)
                </label>
                <p className="text-[11px] text-slate-500 leading-normal">
                  AI akan membaca dokumen ini secara pintar dan mengambil CP yang sesuai dengan <strong>Mata Pelajaran {mapel}</strong> dan <strong>Fase {fase}</strong> secara otomatis.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <input
                  type="file"
                  id="cp-upload"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setUploadedFile(e.target.files[0]);
                    }
                  }}
                  accept=".pdf,.xlsx,.xls,.docx,.doc,.txt,.png,.jpg,.jpeg"
                  className="hidden"
                />
                {!uploadedFile ? (
                  <label
                    htmlFor="cp-upload"
                    className="flex items-center justify-center gap-2 bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 font-semibold py-2 px-4 rounded-lg cursor-pointer transition text-xs shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Pilih File Dokumen CP
                  </label>
                ) : (
                  <div className="flex items-center justify-between bg-white border border-blue-200 rounded-lg p-2 shadow-xs">
                    <div className="flex items-center gap-2 truncate text-xs font-medium text-slate-700">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="truncate">{uploadedFile.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUploadedFile(null)}
                      className="text-slate-400 hover:text-red-500 p-1 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Custom CP Paste Textarea */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col justify-between space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Atau Tempel CP Kustom (Opsional)
                </label>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Jika Anda tidak memiliki berkas dokumen, Anda dapat langsung menempelkan teks CP secara manual di bawah ini.
                </p>
              </div>
              <textarea
                value={customCp}
                onChange={(e) => setCustomCp(e.target.value)}
                placeholder="Tempelkan paragraf Capaian Pembelajaran (CP) di sini..."
                rows={2}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400 font-sans"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleGenerateAI}
              disabled={loading}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-semibold py-2.5 px-5 rounded-lg transition shadow-md disabled:opacity-50 text-sm cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Membaca CP &amp; Memformulasikan TP...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Baca CP &amp; Formulasikan TP
                </>
              )}
            </button>
          </div>

          {msg && (
            <div className={`p-3 rounded-lg text-sm font-semibold ${msg.includes("🔴") ? "bg-red-50 text-red-700 border border-red-100" : "bg-emerald-50 text-emerald-800 border border-emerald-100"}`}>
              {msg}
            </div>
          )}
        </div>
      </div>

      {/* CP & Table Display */}
      {(cp || displayedItems.length > 0) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-6 p-6">
          {/* Validation Banner */}
          <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
            isTpValid 
              ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}>
            <div className="flex items-start gap-3">
              {isTpValid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                  Status Validasi Alur Data (Integritas SIPENA: CP &rarr; TP)
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {isTpValid 
                    ? "Seluruh elemen Capaian Pembelajaran (CP) asli telah dianalisis dan divalidasi 100% lengkap dengan minimal 8 Tujuan Pembelajaran (TP) per elemen sesuai anjuran!" 
                    : `Terdapat beberapa catatan integritas data: ${!hasCp ? "Dokumen CP asli belum dimuat. " : ""}${!hasItems ? "Tujuan Pembelajaran belum diformulasikan. " : ""}${elementsWithFewerThan8.length > 0 ? `Elemen [${elementsWithFewerThan8.map(([el]) => el).join(", ")}] memiliki kurang dari 8 TP (Anjuran minimal 8 TP per elemen).` : ""}`}
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isTpValid 
                  ? "bg-emerald-200 text-emerald-900" 
                  : "bg-amber-200 text-amber-900"
              }`}>
                {isTpValid ? "100% Sesuai & Valid" : "Butuh Penyelarasan"}
              </span>
            </div>
          </div>

          {cp && (
            <div>
              <h3 className="font-bold text-slate-800 text-sm mb-2 uppercase tracking-wide">Capaian Pembelajaran (CP)</h3>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                {cp}
              </div>
            </div>
          )}

          {/* Table of TPs */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Daftar Rumusan Tujuan Pembelajaran (TP)</h3>
              <button
                onClick={handleOpenManualAdd}
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-1.5 px-3 rounded-lg text-xs transition border border-slate-200"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                Tambah TP Manual
              </button>
            </div>

            {/* Add Manual Form Modal style */}
            {manualAdd && (
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-3">
                <h4 className="font-bold text-xs text-blue-800 uppercase">Tambah Tujuan Pembelajaran Baru</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Elemen (misal: Menyimak / Aljabar)</label>
                      <input
                        type="text"
                        placeholder="Nama Elemen"
                        value={manualForm.elemen}
                        onChange={(e) => setManualForm(prev => ({ ...prev, elemen: e.target.value }))}
                        className="w-full p-2 border border-slate-300 rounded bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Capaian Pembelajaran (CP) Elemen</label>
                      <textarea
                        placeholder="Deskripsi CP Elemen terkait..."
                        value={manualForm.cp}
                        onChange={(e) => setManualForm(prev => ({ ...prev, cp: e.target.value }))}
                        className="w-full p-2 border border-slate-300 rounded bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        rows={1}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Kompetensi</label>
                      <input
                        type="text"
                        placeholder="Kompetensi (misal: Memahami, Menghitung)"
                        value={manualForm.kompetensi}
                        onChange={(e) => setManualForm(prev => ({ ...prev, kompetensi: e.target.value }))}
                        className="w-full p-2 border border-slate-300 rounded bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Konten</label>
                      <input
                        type="text"
                        placeholder="Konten (misal: Pecahan Senilai)"
                        value={manualForm.konten}
                        onChange={(e) => setManualForm(prev => ({ ...prev, konten: e.target.value }))}
                        className="w-full p-2 border border-slate-300 rounded bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rumusan Tujuan Pembelajaran (TP)</label>
                      <input
                        type="text"
                        placeholder="Deskripsi Tujuan Pembelajaran (TP)"
                        value={manualForm.tujuanPembelajaran}
                        onChange={(e) => setManualForm(prev => ({ ...prev, tujuanPembelajaran: e.target.value }))}
                        className="w-full p-2 border border-slate-300 rounded bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setManualAdd(false)}
                    className="px-3 py-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleManualAdd}
                    className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded"
                  >
                    Tambahkan
                  </button>
                </div>
              </div>
            )}

            {/* List */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700 uppercase text-xs">
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3 w-80">Elemen &amp; Capaian Pembelajaran (CP)</th>
                    <th className="p-3">Daftar Rincian Tujuan Pembelajaran (TP)</th>
                    <th className="p-3 w-36 text-center">Aksi Elemen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {(() => {
                    // Group displayedItems by Elemen and CP
                    const groupedItems: { [key: string]: { elemen: string; cp: string; items: typeof displayedItems } } = {};
                    
                    displayedItems.forEach(item => {
                      const key = item.elemen || "Umum";
                      if (!groupedItems[key]) {
                        groupedItems[key] = {
                          elemen: item.elemen || "Umum",
                          cp: item.cp || "",
                          items: []
                        };
                      }
                      groupedItems[key].items.push(item);
                    });

                    const groupedList = Object.values(groupedItems);

                    if (groupedList.length === 0) {
                      return (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-400 font-medium">
                            Belum ada data Tujuan Pembelajaran (TP). Silakan gunakan tombol di atas untuk memformulasikan secara otomatis atau menambahkan secara manual.
                          </td>
                        </tr>
                      );
                    }

                    return groupedList.map((group, groupIndex) => {
                      return (
                        <tr key={group.elemen} className="hover:bg-slate-50/30 transition align-top">
                          <td className="p-3 text-center font-medium text-slate-500 border-r border-slate-100">{groupIndex + 1}</td>
                          
                          <td className="p-3 border-r border-slate-100">
                            <div className="space-y-2">
                              <span className="inline-block bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-100 uppercase tracking-wider">
                                {group.elemen}
                              </span>
                              <div className="text-slate-600 font-medium text-[11px] leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto pr-1">
                                {group.cp || "-"}
                              </div>
                            </div>
                          </td>

                          <td className="p-3 border-r border-slate-100">
                            <div className="space-y-3">
                              {group.items.map((tpItem, tpIdx) => {
                                const isEditing = editingId === tpItem.id;
                                if (isEditing) {
                                  return (
                                    <div key={tpItem.id} className="p-3 bg-white rounded-lg border-2 border-blue-400 space-y-3 shadow-sm text-left">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Elemen</label>
                                          <input
                                            type="text"
                                            value={editForm.elemen}
                                            onChange={(e) => setEditForm(p => ({ ...p, elemen: e.target.value }))}
                                            className="p-1.5 border rounded w-full bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="Nama Elemen"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Deskripsi CP</label>
                                          <textarea
                                            value={editForm.cp}
                                            onChange={(e) => setEditForm(p => ({ ...p, cp: e.target.value }))}
                                            className="p-1.5 border rounded w-full bg-white text-xs h-10 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="Capaian Pembelajaran"
                                          />
                                        </div>
                                      </div>
                                      
                                      <div>
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Rumusan Tujuan Pembelajaran (TP)</label>
                                        <textarea
                                          value={editForm.tujuanPembelajaran}
                                          onChange={(e) => setEditForm(p => ({ ...p, tujuanPembelajaran: e.target.value }))}
                                          className="p-1.5 border rounded w-full bg-white text-xs h-16 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                      </div>
                                      
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Kompetensi</label>
                                          <input
                                            type="text"
                                            value={editForm.kompetensi}
                                            onChange={(e) => setEditForm(p => ({ ...p, kompetensi: e.target.value }))}
                                            className="p-1.5 border rounded w-full bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Konten</label>
                                          <input
                                            type="text"
                                            value={editForm.konten}
                                            onChange={(e) => setEditForm(p => ({ ...p, konten: e.target.value }))}
                                            className="p-1.5 border rounded w-full bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                          />
                                        </div>
                                      </div>
                                      
                                      <div className="flex justify-end gap-2 pt-1.5 border-t border-slate-100">
                                        <button
                                          onClick={() => setEditingId(null)}
                                          className="px-3 py-1 text-[10px] text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                                        >
                                          Batal
                                        </button>
                                        <button
                                          onClick={() => handleEditSave(tpItem.id)}
                                          className="px-4 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded flex items-center gap-1 shadow-sm cursor-pointer"
                                        >
                                          <Check className="w-3 h-3" />
                                          Simpan
                                        </button>
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <div key={tpItem.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200/60 flex justify-between items-start gap-4 hover:border-slate-300 hover:bg-slate-100/40 transition text-left">
                                    <div className="space-y-1.5 flex-1">
                                      <div className="font-semibold text-slate-800 text-[11px] leading-relaxed">
                                        {tpIdx + 1}. {tpItem.tujuanPembelajaran}
                                      </div>
                                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 bg-white/60 py-1 px-2 rounded border border-slate-100 inline-block">
                                        <span><strong>Kompetensi:</strong> <span className="text-slate-700 font-medium">{tpItem.kompetensi}</span></span>
                                        <span className="text-slate-300">|</span>
                                        <span><strong>Konten:</strong> <span className="text-slate-700 font-medium">{tpItem.konten}</span></span>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        onClick={() => handleEditStart(tpItem)}
                                        className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-white border border-transparent hover:border-slate-200 transition cursor-pointer"
                                        title="Edit TP"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDelete(tpItem.id)}
                                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-white border border-transparent hover:border-slate-200 transition cursor-pointer"
                                        title="Hapus TP"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>

                          <td className="p-3 text-center align-middle">
                            <div className="flex flex-col gap-2 items-center justify-center">
                              <button
                                onClick={() => {
                                  setManualForm({
                                    elemen: group.elemen,
                                    cp: group.cp,
                                    kompetensi: "",
                                    konten: "",
                                    tujuanPembelajaran: ""
                                  });
                                  setManualAdd(true);
                                }}
                                className="flex items-center justify-center gap-1 bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 hover:border-blue-300 font-semibold py-1.5 px-2 rounded text-[10px] transition shadow-xs w-full"
                                title="Tambah TP ke Elemen Ini"
                              >
                                <Plus className="w-3 h-3" />
                                Tambah TP
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Apakah Anda yakin ingin menghapus seluruh elemen "${group.elemen}" beserta semua Tujuan Pembelajaran di dalamnya?`)) {
                                    const idsToDelete = group.items.map(it => it.id);
                                    setItems(prev => prev.filter(item => !idsToDelete.includes(item.id)));
                                    setMsg(`💡 Elemen "${group.elemen}" dan seluruh Tujuan Pembelajaran di dalamnya berhasil dihapus.`);
                                  }
                                }}
                                className="flex items-center justify-center gap-1 bg-white hover:bg-red-50 text-red-500 border border-red-100 hover:border-red-200 font-semibold py-1.5 px-2 rounded text-[10px] transition shadow-xs w-full"
                                title="Hapus Elemen Ini"
                              >
                                <Trash2 className="w-3 h-3" />
                                Hapus Elemen
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Sync actions */}
            <div className="flex flex-wrap gap-3 justify-between items-center pt-4 border-t border-slate-100">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                onClick={handleSaveToDb}
                disabled={saving}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg text-xs transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {saving ? "Menyimpan..." : "Simpan Data TP ke Firestore"}
              </motion.button>

              <div className="flex gap-2">
                {accessToken && driveFolderId && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    onClick={handleSyncToDrive}
                    disabled={syncingDrive}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2 px-4 rounded-lg text-xs transition shadow-sm cursor-pointer"
                  >
                    <FolderSync className="w-4 h-4" />
                    {syncingDrive ? "Mengunggah..." : "Simpan ke Google Drive"}
                  </motion.button>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  onClick={handleDownloadWord}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-semibold py-2 px-4 rounded-lg text-xs transition shadow-sm cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Unduh Microsoft Word (.docx)
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
