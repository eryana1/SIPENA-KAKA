import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  BarChart, 
  Download, 
  Save, 
  Edit3, 
  Loader2, 
  Check, 
  FolderSync, 
  AlertCircle,
  Trash2,
  CheckCircle2
} from "lucide-react";
import { generatePROTA } from "../lib/ai";
import { generatePROTADocx } from "../lib/docxGenerator";
import { downloadBlob } from "../lib/downloadHelper";
import { uploadFileToDrive } from "../lib/drive";
import { Fase, PROTAItem, PROTAData, ATPItem, Jenjang } from "../types";

interface ProtaPanelProps {
  profile: any;
  savedAtps: ATPItem[];
  protaData: PROTAData | null;
  weeksEffective?: number;
  onSaveProta: (data: PROTAData) => Promise<void>;
  onLoadAtp?: (ctx: { mapel: string; kelas: string; fase: Fase }) => Promise<void>;
  onLoadProta?: (ctx: { mapel: string; kelas: string; fase: Fase }) => Promise<void>;
  apiKey?: string;
  driveFolderId?: string;
  accessToken?: string | null;
}

import { 
  isSameKelas, 
  getDefaultKelasForFase, 
  getKelasForFase, 
  getValidClassesForFase, 
  isClassInSameFase, 
  normKelas 
} from "../lib/profileHelper";

export default function ProtaPanel({ 
  profile, 
  savedAtps, 
  protaData, 
  weeksEffective = 20, 
  onSaveProta, 
  onLoadAtp,
  onLoadProta,
  apiKey, 
  driveFolderId, 
  accessToken 
}: ProtaPanelProps) {
  const [mapel, setMapel] = useState("Bahasa Indonesia");
  const [fase, setFase] = useState<Fase>(profile.fase || Fase.A);
  const [kelas, setKelas] = useState(() => getKelasForFase(profile.fase || Fase.A, profile.kelas));
  const [items, setItems] = useState<PROTAItem[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [msg, setMsg] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ cp: "", elemen: "", tujuanPembelajaran: "", alokasiWaktu: 2, semester: "1" as "1" | "2", topik: "" });

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

  useEffect(() => {
    if (onLoadAtp) {
      onLoadAtp({ mapel, kelas, fase });
    }
    if (onLoadProta) {
      onLoadProta({ mapel, kelas, fase });
    }
  }, [mapel, kelas, fase, profile.tahunPelajaran, profile.semester]);

  useEffect(() => {
    if (protaData) {
      const isStale = (
        protaData.mapel?.toLowerCase() !== mapel.toLowerCase() ||
        !isSameKelas(protaData.kelas, kelas) ||
        protaData.fase !== fase
      );

      if (!isStale) {
        const loadedItems = (protaData.items || []).map(item => {
          const matchingAtp = savedAtps.find(atp => atp.tujuanPembelajaran === item.tujuanPembelajaran);
          return {
            ...item,
            mapel: item.mapel || protaData.mapel || "Bahasa Indonesia",
            cp: item.cp || matchingAtp?.cp || "",
            elemen: item.elemen || matchingAtp?.elemen || ""
          };
        });
        setItems(loadedItems);
      } else {
        setItems([]);
      }
    } else {
      setItems([]);
    }
  }, [protaData, savedAtps, mapel, kelas, fase]);

  useEffect(() => {
    if (mapelPresets[currentJenjang] && !mapelPresets[currentJenjang].includes(mapel) && mapel !== "") {
      setMapel(mapelPresets[currentJenjang][0]);
    }
  }, [currentJenjang]);

  const filterAtpForContext = (atp: ATPItem) => {
    if ((atp.mapel || "").toLowerCase().trim() !== mapel.toLowerCase().trim()) return false;
    const atpKelas = atp.kelas || "";
    if (!atpKelas || atpKelas.toUpperCase() === "FASE") return true;
    return isClassInSameFase(atpKelas, kelas, fase);
  };

  const currentActiveAtps = savedAtps.filter(filterAtpForContext);

  const displayedItems = items.filter(item => item.mapel === mapel);

  // Validation
  const hasAtp = currentActiveAtps.length > 0;
  const countMismatch = displayedItems.length > 0 && currentActiveAtps.length !== displayedItems.length;
  const missingAtpsFromProta = currentActiveAtps.filter(atp => 
    !displayedItems.some(item => 
      (item.tujuanPembelajaran || "").toLowerCase().trim() === (atp.tujuanPembelajaran || "").toLowerCase().trim()
    )
  );
  const isProtaValid = hasAtp && displayedItems.length > 0 && !countMismatch && missingAtpsFromProta.length === 0;

  const handleGeneratePROTA = async () => {
    const activeAtps = savedAtps.filter(filterAtpForContext);
    if (activeAtps.length === 0) {
      alert(`Belum ada data ATP Kelas ${kelas} untuk mata pelajaran ${mapel}. Silakan selesaikan penyusunan ATP terlebih dahulu.`);
      return;
    }

    setLoading(true);
    setMsg("");
    try {
      const data = await generatePROTA(fase, mapel, kelas, activeAtps, weeksEffective, { apiKey });
      const formatted: PROTAItem[] = data.items.map((item: any, index: number) => {
        const matchingAtp = activeAtps.find(atp => atp.tujuanPembelajaran === item.tujuanPembelajaran);
        return {
          atpId: `prota-atp-${index}-${Math.random().toString(36).substr(2, 5)}`,
          mapel: mapel,
          cp: item.cp || matchingAtp?.cp || "",
          elemen: item.elemen || matchingAtp?.elemen || "",
          tujuanPembelajaran: item.tujuanPembelajaran,
          alokasiWaktu: item.alokasiWaktu || 2,
          semester: (item.semester === "2" || item.semester === 2) ? "2" : "1",
          topik: item.topik || ""
        };
      });
      
      const remaining = items.filter(item => item.mapel !== mapel);
      const mergedProta = [...remaining, ...formatted];
      setItems(mergedProta);
      autoPersistProta(mergedProta);
      setMsg("✅ Program Tahunan (PROTA) berhasil didistribusikan per Semester dan Jam Pelajaran (JP) oleh Gemini AI!");
    } catch (error: any) {
      setMsg(`🔴 Gagal menyusun PROTA: ${error.message || "Kesalahan server"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadAtpManual = () => {
    const activeAtps = savedAtps.filter(filterAtpForContext);
    if (activeAtps.length === 0) {
      alert(`Belum ada data ATP Kelas ${kelas} untuk mata pelajaran ${mapel}. Silakan selesaikan penyusunan ATP terlebih dahulu.`);
      return;
    }
    const formatted: PROTAItem[] = activeAtps.map((atp, index) => ({
      atpId: atp.tpId || `prota-atp-manual-${index}-${Math.random().toString(36).substr(2, 5)}`,
      mapel: mapel,
      cp: atp.cp || "",
      elemen: atp.elemen || "",
      tujuanPembelajaran: atp.tujuanPembelajaran,
      alokasiWaktu: atp.perkiraanJam || 2,
      semester: "1",
      topik: atp.topik || ""
    }));
    const remaining = items.filter(item => item.mapel !== mapel);
    const mergedProta = [...remaining, ...formatted];
    setItems(mergedProta);
    autoPersistProta(mergedProta);
    setMsg("📋 Data ATP berhasil dimuat! Silakan tentukan pembagian Semester, JP, CP, dan Topik langsung pada tabel di bawah ini.");
  };

  const handleAddNewItem = () => {
    const newItemId = `prota-manual-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newItem: PROTAItem = {
      atpId: newItemId,
      mapel: mapel,
      cp: "",
      elemen: "",
      tujuanPembelajaran: "Tujuan Pembelajaran baru",
      alokasiWaktu: 2,
      semester: "1",
      topik: "Topik/Materi baru"
    };
    
    setItems(prev => {
      const updated = [...prev, newItem];
      const absoluteIndex = updated.length - 1;
      setEditingId(absoluteIndex);
      setEditForm({
        cp: "",
        elemen: "",
        tujuanPembelajaran: "Tujuan Pembelajaran baru",
        alokasiWaktu: 2,
        semester: "1",
        topik: "Topik/Materi baru"
      });
      return updated;
    });
    setMsg("💡 Baris baru berhasil ditambahkan! Silakan edit isinya.");
  };

  const handleEditStart = (item: PROTAItem, indexInDisplayed: number) => {
    const absoluteIndex = items.findIndex(it => it.atpId === displayedItems[indexInDisplayed].atpId);
    if (absoluteIndex !== -1) {
      setEditingId(absoluteIndex);
      setEditForm({
        cp: items[absoluteIndex].cp || "",
        elemen: items[absoluteIndex].elemen || "",
        tujuanPembelajaran: items[absoluteIndex].tujuanPembelajaran,
        alokasiWaktu: items[absoluteIndex].alokasiWaktu,
        semester: items[absoluteIndex].semester,
        topik: items[absoluteIndex].topik
      });
    }
  };

  const autoPersistProta = (updatedItems: PROTAItem[]) => {
    const payload: PROTAData = {
      fase,
      mapel,
      kelas,
      items: updatedItems,
      createdAt: new Date().toISOString(),
      tahunPelajaran: profile.tahunPelajaran,
      semester: profile.semester
    } as any;
    onSaveProta(payload).catch(err => console.warn("Auto-save PROTA failed:", err));
  };

  const handleEditSave = (absoluteIndex: number) => {
    const copy = [...items];
    copy[absoluteIndex] = { ...copy[absoluteIndex], ...editForm };
    setItems(copy);
    autoPersistProta(copy);
    setEditingId(null);
    setMsg("💡 Detail Program Tahunan berhasil diubah.");
  };

  const handleDeleteItem = (indexInDisplayed: number) => {
    const targetId = displayedItems[indexInDisplayed].atpId;
    const updated = items.filter(item => item.atpId !== targetId);
    setItems(updated);
    autoPersistProta(updated);
    setMsg("💡 Item PROTA dihapus.");
  };

  const handleSaveToDb = async () => {
    setSaving(true);
    try {
      const payload: PROTAData = {
        fase,
        mapel,
        kelas,
        items, // Save all items!
        createdAt: new Date().toISOString(),
        tahunPelajaran: profile.tahunPelajaran,
        semester: profile.semester
      } as any;
      await onSaveProta(payload);
      setMsg("✅ Seluruh data Program Tahunan berhasil disimpan ke Firestore!");
      setTimeout(() => setMsg(""), 4000);
    } catch (error: any) {
      setMsg(`🔴 Gagal menyimpan ke Firestore: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadWord = async () => {
    try {
      if (displayedItems.length === 0) {
        alert("Selesaikan pembagian PROTA terlebih dahulu sebelum diunduh.");
        return;
      }
      const blob = await generatePROTADocx(profile, mapel, displayedItems, kelas);
      const filename = `Program Tahunan_${mapel}.docx`;
      
      downloadBlob(blob, filename);
      setMsg("✅ File Program Tahunan (.docx) berhasil dibuat dan diunduh!");
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
      const blob = await generatePROTADocx(profile, mapel, displayedItems, kelas);
      const filename = `Program Tahunan_${mapel}.docx`;
      
      await uploadFileToDrive(accessToken, blob, filename, driveFolderId);
      setMsg("✅ Dokumen Program Tahunan berhasil diunggah langsung ke folder Google Drive Anda!");
    } catch (error: any) {
      setMsg(`🔴 Gagal mengunggah ke Google Drive: ${error.message}`);
    } finally {
      setSyncingDrive(false);
    }
  };

  return (
    <div className="space-y-6" id="prota_panel">
      {/* Selector card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 p-4">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <BarChart className="w-5 h-5 text-blue-600" />
            Program Tahunan (PROTA)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Berdasarkan rincian Alur Tujuan Pembelajaran (ATP), AI akan mendistribusikan alokasi jam pembelajaran secara adil di semester ganjil (1) dan semester genap (2) dengan mematuhi batas hari efektif belajar kalender pendidikan.</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Mata Pelajaran</label>
              <select
                value={mapel}
                onChange={(e) => setMapel(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {mapelPresets[currentJenjang]?.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Fase</label>
              <select
                value={fase}
                onChange={(e) => {
                  const newFase = e.target.value as Fase;
                  setFase(newFase);
                  setKelas(getKelasForFase(newFase, kelas));
                }}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.values(Fase).map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Kelas</label>
              <select
                value={normKelas(kelas)}
                onChange={(e) => setKelas(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(() => {
                  const options = [...getValidClassesForFase(fase)];
                  const currentNorm = normKelas(kelas);
                  if (currentNorm && !options.includes(currentNorm)) {
                    options.push(currentNorm);
                  }
                  return options.map((k) => (
                    <option key={k} value={k}>Kelas {k}</option>
                  ));
                })()}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Total Minggu Efektif (Kalender)</label>
              <input
                type="text"
                value={`${weeksEffective} Minggu`}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50"
                readOnly
              />
            </div>
          </div>

          {savedAtps.filter(atp => {
            if (atp.mapel?.toLowerCase() !== mapel.toLowerCase()) return false;
            const atpKelas = atp.kelas || getDefaultKelasForFase(fase);
            return isSameKelas(atpKelas, kelas);
          }).length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Belum ada data Alur Tujuan Pembelajaran (ATP) tersimpan untuk mata pelajaran <strong>{mapel}</strong> Kelas <strong>{kelas}</strong>. Silakan susun data di menu <strong>Alur Tujuan Pembelajaran</strong> terlebih dahulu.</span>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
              <div className="bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-300 transition duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
                      <BarChart className="w-4 h-4" />
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm">Distribusi Otomatis (Gemini AI)</h4>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Gemini AI akan menganalisis dan mendistribusikan semua ATP ke dalam Semester 1 & 2 serta memetakan alokasi JP secara proporsional sesuai jumlah minggu efektif secara otomatis.
                  </p>
                </div>
                <div className="shrink-0 w-full md:w-64">
                  <button
                    onClick={handleGeneratePROTA}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-semibold py-2.5 px-4 rounded-lg transition shadow-sm disabled:opacity-50 text-xs"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Memproses Distribusi AI...
                      </>
                    ) : (
                      <>
                        <BarChart className="w-4 h-4" />
                        Jalankan Distribusi AI
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {msg && (
            <div className={`p-3 rounded-lg text-sm font-semibold ${msg.includes("🔴") ? "bg-red-50 text-red-700 border border-red-100" : "bg-emerald-50 text-emerald-800 border border-emerald-100"}`}>
              {msg}
            </div>
          )}
        </div>
      </div>

      {/* Table Display */}
      {displayedItems.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
          {/* Validation Banner */}
          <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
            isProtaValid 
              ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}>
            <div className="flex items-start gap-3">
              {isProtaValid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                  Status Validasi Alur Data (Integritas SIPENA: ATP &rarr; PROTA)
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {isProtaValid 
                    ? `Seluruh data dari tahap ATP telah terserap 100% sempurna (${displayedItems.length} dari ${currentActiveAtps.length} ATP aktif). Konsistensi urutan, isi, dan pembagian semester terjaga penuh!` 
                    : `Terdapat catatan kelayakan data PROTA: ${!hasAtp ? "Rujukan ATP belum tersedia untuk Kelas & Mapel aktif. " : ""}${countMismatch ? `Jumlah item PROTA (${displayedItems.length}) tidak sama dengan jumlah item ATP rujukan (${currentActiveAtps.length}). ` : ""}${missingAtpsFromProta.length > 0 ? `Ada ${missingAtpsFromProta.length} ATP yang belum terdistribusi ke dalam PROTA Anda. ` : ""}`}
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isProtaValid 
                  ? "bg-emerald-200 text-emerald-900" 
                  : "bg-amber-200 text-amber-900"
              }`}>
                {isProtaValid ? "100% Sesuai & Valid" : "Butuh Distribusi Ulang"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Daftar Distribusi Program Tahunan ({mapel})</h3>
              <p className="text-xs text-slate-500">Anda dapat mengubah isi Capaian Pembelajaran, Tujuan Pembelajaran, Topik, Alokasi JP, dan Semester langsung pada tabel.</p>
            </div>
            <button
              onClick={handleAddNewItem}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-1.5 px-3 rounded-lg text-xs transition border border-slate-200 shadow-xs"
            >
              <Check className="w-3.5 h-3.5 text-blue-500" />
              + Tambah Baris Manual
            </button>
          </div>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700 uppercase">
                  <th className="p-3 w-12 text-center">No</th>
                  <th className="p-3 w-1/4">Capaian Pembelajaran (CP)</th>
                  <th className="p-3">Tujuan Pembelajaran (TP)</th>
                  <th className="p-3 w-32">Topik Konten</th>
                  <th className="p-3 w-28 text-center">Alokasi Waktu</th>
                  <th className="p-3 w-36 text-center">Semester</th>
                  <th className="p-3 w-24 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayedItems.map((item, index) => {
                  const absoluteIndex = items.findIndex(it => it.atpId === item.atpId);
                  const isEditing = editingId === absoluteIndex;
                  return (
                    <tr key={item.atpId || index} className="hover:bg-slate-50 transition">
                      <td className="p-3 text-center text-slate-500 font-medium">{index + 1}</td>
                      
                      <td className="p-3">
                        {isEditing ? (
                          <div className="space-y-2">
                            <div>
                              <label className="text-[10px] font-bold text-blue-600 uppercase">Elemen:</label>
                              <input
                                type="text"
                                value={editForm.elemen}
                                onChange={(e) => setEditForm(p => ({ ...p, elemen: e.target.value }))}
                                className="p-1 border rounded bg-white w-full text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase">CP:</label>
                              <textarea
                                value={editForm.cp}
                                onChange={(e) => setEditForm(p => ({ ...p, cp: e.target.value }))}
                                className="p-1 border rounded bg-white w-full text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                rows={3}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {item.elemen && (
                              <span className="text-blue-600 font-bold mb-1 text-[10px] uppercase tracking-wide block bg-blue-50 px-1.5 py-0.5 rounded-md w-fit">
                                Elemen: {item.elemen}
                              </span>
                            )}
                            <span className="text-slate-600 font-medium leading-relaxed block max-h-24 overflow-y-auto whitespace-normal">{item.cp || "-"}</span>
                          </div>
                        )}
                      </td>

                      <td className="p-3">
                        {isEditing ? (
                          <textarea
                            value={editForm.tujuanPembelajaran}
                            onChange={(e) => setEditForm(p => ({ ...p, tujuanPembelajaran: e.target.value }))}
                            className="p-1 border rounded bg-white w-full text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            rows={3}
                          />
                        ) : (
                          <span className="text-slate-800 font-medium">{item.tujuanPembelajaran}</span>
                        )}
                      </td>

                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.topik}
                            onChange={(e) => setEditForm(p => ({ ...p, topik: e.target.value }))}
                            className="p-1 border rounded bg-white w-full text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        ) : (
                          <span className="text-slate-600 font-medium">{item.topik}</span>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        {isEditing ? (
                          <div className="flex items-center gap-1 justify-center">
                            <input
                              type="number"
                              value={editForm.alokasiWaktu}
                              onChange={(e) => setEditForm(p => ({ ...p, alokasiWaktu: parseInt(e.target.value) || 2 }))}
                              className="p-1 border rounded w-16 bg-white text-center text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-slate-500 font-bold">JP</span>
                          </div>
                        ) : (
                          <span className="font-bold text-slate-700">{item.alokasiWaktu} JP</span>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        <select
                          value={isEditing ? editForm.semester : item.semester}
                          onChange={(e) => {
                            const newSem = e.target.value as "1" | "2";
                            if (isEditing) {
                              setEditForm(p => ({ ...p, semester: newSem }));
                            } else {
                              setItems(prev => {
                                const copy = [...prev];
                                const idx = copy.findIndex(it => it.atpId === item.atpId);
                                if (idx !== -1) {
                                  copy[idx] = { ...copy[idx], semester: newSem };
                                }
                                return copy;
                              });
                              setMsg("💡 Pembagian semester berhasil diperbarui!");
                              setTimeout(() => setMsg(""), 3000);
                            }
                          }}
                          className="mx-auto p-1.5 border border-slate-300 rounded-lg bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="1">Semester 1</option>
                          <option value="2">Semester 2</option>
                        </select>
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex justify-center items-center gap-2">
                          {isEditing ? (
                            <button
                              onClick={() => handleEditSave(absoluteIndex)}
                              className="text-emerald-600 hover:text-emerald-800 p-1"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleEditStart(item, index)}
                              className="text-blue-500 hover:text-blue-700 p-1"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteItem(index)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
              {saving ? "Menyimpan..." : "Simpan Data PROTA ke Firestore"}
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
      )}
    </div>
  );
}
