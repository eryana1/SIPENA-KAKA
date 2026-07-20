import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  GitBranch, 
  Download, 
  Plus, 
  Trash2, 
  Save, 
  Edit3, 
  Loader2, 
  Check, 
  FolderSync, 
  HelpCircle,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { generateATP } from "../lib/ai";
import { generateATPDocx } from "../lib/docxGenerator";
import { uploadFileToDrive } from "../lib/drive";
import { Fase, ATPItem, ATPData, TPItem, Jenjang } from "../types";
import { getAuth } from "firebase/auth";
import { getDocumentFromDb, getContextDocId } from "../lib/firebase";

interface AtpPanelProps {
  profile: any;
  savedTps: TPItem[];
  atpData: ATPData | null;
  onSaveAtp: (data: ATPData) => Promise<void>;
  onLoadTp?: (ctx: { mapel: string; kelas: string; fase: Fase }) => Promise<void>;
  onLoadAtp?: (ctx: { mapel: string; kelas: string; fase: Fase }) => Promise<void>;
  apiKey?: string;
  driveFolderId?: string;
  accessToken?: string | null;
}

export const getDefaultKelasForFase = (fase: Fase) => {
  switch (fase) {
    case Fase.A: return "1";
    case Fase.B: return "3";
    case Fase.C: return "5";
    case Fase.D: return "7";
    case Fase.E: return "10";
    case Fase.F: return "11";
    default: return "1";
  }
};

export default function AtpPanel({ 
  profile, 
  savedTps, 
  atpData, 
  onSaveAtp, 
  onLoadTp,
  onLoadAtp,
  apiKey, 
  driveFolderId, 
  accessToken 
}: AtpPanelProps) {
  const [mapel, setMapel] = useState("Bahasa Indonesia");
  const [fase, setFase] = useState<Fase>(profile.fase || Fase.A);
  const [kelas, setKelas] = useState("Fase");
  const [items, setItems] = useState<ATPItem[]>([]);
  
  const [selectedTpIds, setSelectedTpIds] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [msg, setMsg] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ cp: "", elemen: "", kelas: "Fase", tujuanPembelajaran: "", perkiraanJam: 2, topik: "", glosarium: "" });

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
    if (onLoadTp) {
      onLoadTp({ mapel, kelas, fase });
    }
    if (onLoadAtp) {
      onLoadAtp({ mapel, kelas, fase });
    }
  }, [mapel, kelas, fase, profile.tahunPelajaran, profile.semester]);

  useEffect(() => {
    if (atpData) {
      const defaultMapel = mapel || atpData.mapel || (mapelPresets[currentJenjang] ? mapelPresets[currentJenjang][0] : "Bahasa Indonesia");
      setMapel(defaultMapel);
      setFase(atpData.fase || profile.fase || Fase.A);
      setKelas("Fase");
      
      const loadedItems = (atpData.items || []).map(item => ({
        ...item,
        mapel: item.mapel || atpData.mapel || "Bahasa Indonesia"
      }));
      setItems(loadedItems);
    } else {
      setItems([]);
    }
  }, [atpData]);

  useEffect(() => {
    if (mapelPresets[currentJenjang] && !mapelPresets[currentJenjang].includes(mapel) && mapel !== "") {
      setMapel(mapelPresets[currentJenjang][0]);
    }
  }, [currentJenjang]);

  const filteredTps = savedTps.filter(tp => 
    tp.mapel?.toLowerCase().trim() === mapel.toLowerCase().trim()
  );
  const displayedItems = items.filter(item => 
    item.mapel?.toLowerCase().trim() === mapel.toLowerCase().trim()
  );

  // Check how many checked TPs are actively selected for formulation
  const activeSelectedTpCount = Object.values(selectedTpIds).filter(Boolean).length;

  // Let's analyze data integrity of ATP
  // Check if count of ATP matches count of selected TPs
  const hasSelectedTps = activeSelectedTpCount > 0;
  const countMismatch = displayedItems.length > 0 && activeSelectedTpCount !== displayedItems.length;

  // Missing selected TPs in generated ATP items?
  const selectedTps = filteredTps.filter(tp => !!selectedTpIds[tp.id]);
  const missingTpsFromAtp = selectedTps.filter(tp => 
    !displayedItems.some(item => 
      (item.tujuanPembelajaran || "").toLowerCase().trim() === (tp.tujuanPembelajaran || "").toLowerCase().trim()
    )
  );

  const isAtpValid = hasSelectedTps && displayedItems.length > 0 && !countMismatch && missingTpsFromAtp.length === 0;

  // Handle auto-select all saved TPs as default for checklist
  useEffect(() => {
    if (filteredTps && filteredTps.length > 0) {
      const selections: { [key: string]: boolean } = {};
      filteredTps.forEach(tp => {
        selections[tp.id] = true;
      });
      setSelectedTpIds(selections);
    }
  }, [mapel, savedTps]);

  const handleCheckboxChange = (id: string) => {
    setSelectedTpIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleGenerateATP = async () => {
    const checkedTps = filteredTps.filter(tp => !!selectedTpIds[tp.id]);
    if (checkedTps.length === 0) {
      setMsg("🔴 Silakan pilih/centang minimal 1 Tujuan Pembelajaran (TP) dari daftar untuk disusun.");
      return;
    }

    setLoading(true);
    setMsg("");

    const chosenTps = checkedTps.map(tp => ({
      cp: tp.cp || "",
      elemen: tp.elemen || "",
      tujuanPembelajaran: tp.tujuanPembelajaran
    }));

    try {
      const data = await generateATP(mapel, fase, kelas, chosenTps, { apiKey });
      const returnedItems = data.items || [];

      // Reconcile: identify if there are chosen TPs that Gemini missed/omitted
      const missingTps = chosenTps.filter(chosen => 
        !returnedItems.some((ret: any) => 
          (ret.tujuanPembelajaran || "").toLowerCase().trim() === (chosen.tujuanPembelajaran || "").toLowerCase().trim()
        )
      );

      // If there are missing items, append them with safe defaults so we preserve 100% data
      const reconciledItems = [...returnedItems];
      missingTps.forEach(missing => {
        reconciledItems.push({
          elemen: missing.elemen || "Umum",
          cp: missing.cp || "",
          tujuanPembelajaran: missing.tujuanPembelajaran,
          kelas: getDefaultKelasForFase(fase),
          perkiraanJam: 2,
          topik: "Materi Terkait",
          glosarium: "-"
        });
      });

      const formatted: ATPItem[] = reconciledItems.map((item: any, index: number) => ({
        tpId: `atp-item-${index}-${Math.random().toString(36).substr(2, 5)}`,
        mapel: mapel,
        cp: item.cp || "",
        elemen: item.elemen || "",
        kelas: item.kelas || getDefaultKelasForFase(fase),
        tujuanPembelajaran: item.tujuanPembelajaran,
        perkiraanJam: item.perkiraanJam || 2,
        topik: item.topik || "Topik Terkait",
        glosarium: item.glosarium || "-",
        order: index + 1
      }));
      
      // Overwrite only the current subject's items, keep other subjects intact
      setItems(prev => {
        const remaining = prev.filter(item => item.mapel?.toLowerCase().trim() !== mapel.toLowerCase().trim());
        return [...remaining, ...formatted];
      });

      setMsg("✅ Alur Tujuan Pembelajaran (ATP) berhasil disusun otomatis menggunakan 100% data TP pilihan Anda secara lengkap!");
    } catch (error: any) {
      setMsg(`🔴 Gagal menyusun ATP: ${error.message || "Kesalahan server"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditStart = (item: ATPItem, indexInDisplayed: number) => {
    // Find absolute index in full items list
    const absoluteIndex = items.findIndex(it => it.tpId === displayedItems[indexInDisplayed].tpId);
    if (absoluteIndex !== -1) {
      setEditingId(absoluteIndex);
      setEditForm({
        cp: items[absoluteIndex].cp || "",
        elemen: items[absoluteIndex].elemen || "",
        kelas: items[absoluteIndex].kelas || kelas,
        tujuanPembelajaran: items[absoluteIndex].tujuanPembelajaran,
        perkiraanJam: items[absoluteIndex].perkiraanJam,
        topik: items[absoluteIndex].topik,
        glosarium: items[absoluteIndex].glosarium
      });
    }
  };

  const handleEditSave = (absoluteIndex: number) => {
    setItems(prev => {
      const copy = [...prev];
      copy[absoluteIndex] = { ...copy[absoluteIndex], ...editForm };
      return copy;
    });
    setEditingId(null);
    setMsg("💡 Detail Alur Tujuan Pembelajaran berhasil diubah.");
  };

  const handleDeleteItem = (indexInDisplayed: number) => {
    const targetId = displayedItems[indexInDisplayed].tpId;
    setItems(prev => prev.filter(item => item.tpId !== targetId));
    setMsg("💡 Item ATP berhasil dihapus.");
  };

  const handleSaveToDb = async () => {
    setSaving(true);
    try {
      const payload: ATPData = {
        mapel,
        fase,
        kelas,
        items, // Save all items!
        createdAt: new Date().toISOString(),
        tahunPelajaran: profile.tahunPelajaran,
        semester: profile.semester
      } as any;
      await onSaveAtp(payload);
      setMsg("✅ Seluruh data Alur Tujuan Pembelajaran berhasil disimpan ke Firestore!");
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
        alert("Selesaikan penyusunan ATP terlebih dahulu sebelum diunduh.");
        return;
      }
      const blob = await generateATPDocx(profile, mapel, displayedItems, kelas);
      const filename = `Alur Tujuan Pembelajaran_${mapel}.docx`;
      
      const fileSaver = await import("file-saver");
      fileSaver.saveAs(blob, filename);
      setMsg("✅ File Alur Tujuan Pembelajaran (.docx) berhasil dibuat dan diunduh!");
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
      const blob = await generateATPDocx(profile, mapel, displayedItems, kelas);
      const filename = `Alur Tujuan Pembelajaran_${mapel}.docx`;
      
      await uploadFileToDrive(accessToken, blob, filename, driveFolderId);
      setMsg("✅ Dokumen Alur Tujuan Pembelajaran berhasil diunggah langsung ke folder Google Drive Anda!");
    } catch (error: any) {
      setMsg(`🔴 Gagal mengunggah ke Google Drive: ${error.message}`);
    } finally {
      setSyncingDrive(false);
    }
  };

  return (
    <div className="space-y-6" id="atp_panel">
      {/* Selector card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 p-4">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-blue-600" />
            Alur Tujuan Pembelajaran (ATP)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Berdasarkan data TP yang tersimpan, AI akan menyusun pemetaan alur pembelajaran yang sistematis, mendistribusikan estimasi jam (JP), topik utama, dan glosarium pendukung.</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Mata Pelajaran</label>
              <select
                value={mapel}
                onChange={(e) => setMapel(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-sm"
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
                  setFase(e.target.value as Fase);
                }}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.values(Fase).map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>

          {/* TP Checklist selection */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1">
              Pilih Tujuan Pembelajaran (TP) yang Tersedia
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            </h3>
            
            {filteredTps.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Belum ada data Tujuan Pembelajaran (TP) tersimpan untuk mata pelajaran <strong>{mapel}</strong>. Silakan kunjungi menu <strong>Tujuan Pembelajaran</strong> terlebih dahulu untuk memformulasikan TP.</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50">
                {filteredTps.map((tp) => (
                  <label key={tp.id} className="flex items-start gap-2.5 p-2 bg-white rounded border border-slate-200/60 cursor-pointer hover:bg-blue-50/20 text-xs">
                    <input
                      type="checkbox"
                      checked={!!selectedTpIds[tp.id]}
                      onChange={() => handleCheckboxChange(tp.id)}
                      className="text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-0.5"
                    />
                    <div className="text-slate-700 font-medium leading-normal">
                      <span className="font-bold text-blue-600">[{tp.kompetensi}]</span> {tp.tujuanPembelajaran}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {filteredTps.length > 0 && (
            <div className="flex justify-start">
              <button
                onClick={handleGenerateATP}
                disabled={loading}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-semibold py-2.5 px-5 rounded-lg transition shadow-md disabled:opacity-50 text-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyusun Alur (ATP) Sekolah...
                  </>
                ) : (
                  <>
                    <GitBranch className="w-4 h-4" />
                    Susun Alur ATP dengan AI
                  </>
                )}
              </button>
            </div>
          )}

          {msg && (
            <div className={`p-3 rounded-lg text-sm font-semibold ${msg.includes("🔴") ? "bg-red-50 text-red-700 border border-red-100" : "bg-emerald-50 text-emerald-800 border border-emerald-100"}`}>
              {msg}
            </div>
          )}
        </div>
      </div>

      {/* ATP Result list display */}
      {displayedItems.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
          {/* Validation Banner */}
          <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
            isAtpValid 
              ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}>
            <div className="flex items-start gap-3">
              {isAtpValid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                  Status Validasi Alur Data (Integritas SIPENA: TP &rarr; ATP)
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {isAtpValid 
                    ? `Seluruh data dari tahap TP telah terserap 100% sempurna (${displayedItems.length} dari ${activeSelectedTpCount} TP terpilih). Konsistensi urutan, isi, dan elemen terjaga penuh!` 
                    : `Terdapat catatan kelayakan data: ${!hasSelectedTps ? "Tujuan Pembelajaran belum dipilih. " : ""}${countMismatch ? `Jumlah item ATP (${displayedItems.length}) tidak sama dengan jumlah TP pilihan (${activeSelectedTpCount}). ` : ""}${missingTpsFromAtp.length > 0 ? `Ada ${missingTpsFromAtp.length} TP yang tidak terpetakan dalam ATP Anda. ` : ""}`}
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isAtpValid 
                  ? "bg-emerald-200 text-emerald-900" 
                  : "bg-amber-200 text-amber-900"
              }`}>
                {isAtpValid ? "100% Sesuai & Valid" : "Butuh Sinkronisasi"}
              </span>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Struktur Urutan Alur Pembelajaran (ATP)</h3>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700 uppercase">
                  <th className="p-3 w-12 text-center">Urutan</th>
                  <th className="p-3 w-28">Kelas</th>
                  <th className="p-3 w-32">Elemen</th>
                  <th className="p-3 w-64">Capaian Pembelajaran (CP)</th>
                  <th className="p-3">Tujuan Pembelajaran (TP)</th>
                  <th className="p-3 w-28 text-center">Alokasi Waktu</th>
                  <th className="p-3 w-44">Topik Utama</th>
                  <th className="p-3 w-48">Glosarium Istilah</th>
                  <th className="p-3 w-24 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayedItems.map((item, index) => {
                  const absoluteIndex = items.findIndex(it => it.tpId === item.tpId);
                  const isEditing = editingId === absoluteIndex;
                  return (
                    <tr key={item.tpId || index} className="hover:bg-slate-50 transition">
                      <td className="p-3 text-center">
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                          {index + 1}
                        </span>
                      </td>

                      <td className="p-3">
                        <select
                          value={item.kelas || getDefaultKelasForFase(fase)}
                          onChange={(e) => {
                            const newKelas = e.target.value;
                            setItems(prev => {
                              const copy = [...prev];
                              const idx = copy.findIndex(it => it.tpId === item.tpId);
                              if (idx !== -1) {
                                copy[idx] = { ...copy[idx], kelas: newKelas };
                              }
                              return copy;
                            });
                          }}
                          className="p-1 border border-slate-300 rounded bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                        >
                          {(() => {
                            const getKelasOptionsForFase = (currentFase: Fase) => {
                              switch (currentFase) {
                                case Fase.A: return ["1", "2", "I", "II"];
                                case Fase.B: return ["3", "4", "III", "IV"];
                                case Fase.C: return ["5", "6", "V", "VI"];
                                case Fase.D: return ["7", "8", "9", "VII", "VIII", "IX"];
                                case Fase.E: return ["10", "X"];
                                case Fase.F: return ["11", "12", "XI", "XII"];
                                default: return ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
                              }
                            };
                            const options = [...getKelasOptionsForFase(fase)];
                            const currentVal = item.kelas || getDefaultKelasForFase(fase);
                            if (currentVal && !options.includes(currentVal)) {
                              options.push(currentVal);
                            }
                            return options.map((k) => (
                              <option key={k} value={k}>Kelas {k}</option>
                            ));
                          })()}
                        </select>
                      </td>

                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.elemen}
                            onChange={(e) => setEditForm(p => ({ ...p, elemen: e.target.value }))}
                            className="p-1 border rounded bg-white w-full text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                          />
                        ) : (
                          <span className="text-slate-700 font-semibold bg-slate-100 px-2 py-1 rounded block text-center max-w-[120px] truncate" title={item.elemen || "-"}>
                            {item.elemen || "-"}
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        {isEditing ? (
                          <textarea
                            value={editForm.cp}
                            onChange={(e) => setEditForm(p => ({ ...p, cp: e.target.value }))}
                            className="p-1 border rounded bg-white w-full text-xs h-16 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        ) : (
                          <span className="text-slate-600 font-medium block max-w-xs break-words">{item.cp || "-"}</span>
                        )}
                      </td>

                      <td className="p-3">
                        {isEditing ? (
                          <textarea
                            value={editForm.tujuanPembelajaran}
                            onChange={(e) => setEditForm(p => ({ ...p, tujuanPembelajaran: e.target.value }))}
                            className="p-1 border rounded bg-white w-full text-xs h-16 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        ) : (
                          <span className="font-medium text-slate-700">{item.tujuanPembelajaran}</span>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        {isEditing ? (
                          <div className="flex items-center gap-1 justify-center">
                            <input
                              type="number"
                              value={editForm.perkiraanJam}
                              onChange={(e) => setEditForm(p => ({ ...p, perkiraanJam: parseInt(e.target.value) || 2 }))}
                              className="p-1 border rounded w-16 bg-white text-center text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="font-semibold text-slate-500">JP</span>
                          </div>
                        ) : (
                          <span className="font-bold text-slate-600">{item.perkiraanJam} JP</span>
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

                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.glosarium}
                            onChange={(e) => setEditForm(p => ({ ...p, glosarium: e.target.value }))}
                            className="p-1 border rounded bg-white w-full text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        ) : (
                          <span className="text-slate-500 italic">{item.glosarium || "-"}</span>
                        )}
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
              {saving ? "Menyimpan..." : "Simpan Data ATP ke Firestore"}
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
