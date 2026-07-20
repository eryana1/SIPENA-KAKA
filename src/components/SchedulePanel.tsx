import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Plus, Trash2, Save, Calendar, Clock, BookOpen, GraduationCap, Upload, FileText, Loader2, Sparkles } from "lucide-react";
import { JadwalItem, Jenjang } from "../types";
import { analyzeSchedule } from "../lib/ai";

interface SchedulePanelProps {
  profile?: any;
  schedule: JadwalItem[];
  onSaveSchedule: (schedule: JadwalItem[]) => Promise<void>;
  apiKey?: string;
}

const classOptionsByJenjang: Record<Jenjang, string[]> = {
  [Jenjang.SD]: ["I", "II", "III", "IV", "V", "VI"],
  [Jenjang.SMP]: ["VII", "VIII", "IX"],
  [Jenjang.SMA]: ["X", "XI", "XII"]
};

export default function SchedulePanel({ profile, schedule, onSaveSchedule, apiKey }: SchedulePanelProps) {
  const [items, setItems] = useState<JadwalItem[]>(schedule || []);
  const [msg, setMsg] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedJenjang, setSelectedJenjang] = useState<string>("Semua");
  const [selectedKelas, setSelectedKelas] = useState<string>("Semua");
  const [isCustomKelas, setIsCustomKelas] = useState(false);
  
  const [newItem, setNewItem] = useState<{
    hari: "Senin" | "Selasa" | "Rabu" | "Kamis" | "Jumat" | "Sabtu";
    jam: string;
    mapel: string;
    kelas: string;
    jenjang: Jenjang;
  }>({
    hari: "Senin",
    jam: "07:30 - 08:45",
    mapel: "Bahasa Indonesia",
    kelas: profile?.kelas || "IV-A",
    jenjang: profile?.jenjang || Jenjang.SD,
  });

  // Sync state on mount and profile changes
  useEffect(() => {
    if (profile?.kelas) {
      setSelectedKelas(profile.kelas);
    }
    if (profile?.jenjang) {
      setSelectedJenjang(profile.jenjang);
    }
  }, [profile?.kelas, profile?.jenjang]);

  // Sync state when selectedKelas changes to prefill newItem.kelas
  useEffect(() => {
    if (selectedKelas !== "Semua") {
      const isStd = classOptionsByJenjang[newItem.jenjang]?.includes(selectedKelas);
      setIsCustomKelas(!isStd);
      setNewItem((prev) => ({ ...prev, kelas: selectedKelas }));
    }
  }, [selectedKelas]);

  // Sync state when selectedJenjang changes to prefill newItem.jenjang
  useEffect(() => {
    if (selectedJenjang !== "Semua") {
      const nextJenjang = selectedJenjang as Jenjang;
      setNewItem((prev) => ({ 
        ...prev, 
        jenjang: nextJenjang,
        kelas: classOptionsByJenjang[nextJenjang]?.[0] || ""
      }));
      setIsCustomKelas(false);
    }
  }, [selectedJenjang]);

  // Sync items when parent schedule prop updates
  useEffect(() => {
    setItems(schedule || []);
  }, [schedule]);

  const handleAddItem = () => {
    const itemToAdd: JadwalItem = {
      id: `schedule-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      ...newItem,
    };
    const updated = [...items, itemToAdd];
    setItems(updated);
    setMsg("💡 Slot jadwal baru ditambahkan ke tabel sementara.");
  };

  const handleCopyScheduleFrom = (sourceKelas: string) => {
    if (!sourceKelas || sourceKelas === "Semua" || sourceKelas === selectedKelas) return;
    const sourceItems = items.filter((it) => it.kelas === sourceKelas);
    if (sourceItems.length === 0) {
      setMsg(`💡 Tidak ada jadwal di Kelas ${sourceKelas} untuk disalin.`);
      return;
    }
    
    // Check if there are already items in the target class
    const targetHasItems = items.some((it) => it.kelas === selectedKelas);
    if (targetHasItems && !window.confirm(`Kelas ${selectedKelas} sudah memiliki jadwal. Apakah Anda ingin menambahkan jadwal dari Kelas ${sourceKelas} ke dalam Kelas ${selectedKelas}?`)) {
      return;
    }

    const duplicatedItems = sourceItems.map((it) => ({
      ...it,
      id: `schedule-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      kelas: selectedKelas,
    }));
    
    setItems((prev) => [...prev, ...duplicatedItems]);
    setMsg(`✅ Berhasil menyalin ${duplicatedItems.length} jadwal dari Kelas ${sourceKelas} ke Kelas ${selectedKelas}! Silakan simpan jadwal.`);
    setTimeout(() => setMsg(""), 5000);
  };

  const handleClearClassSchedule = () => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus semua jadwal untuk Kelas ${selectedKelas}?`)) {
      const updated = items.filter((it) => it.kelas !== selectedKelas);
      setItems(updated);
      setMsg(`💡 Seluruh jadwal Kelas ${selectedKelas} dihapus dari tabel sementara.`);
      setTimeout(() => setMsg(""), 5000);
    }
  };

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPastedText(`File Jadwal Pelajaran diunggah: ${selected.name} (${Math.round(selected.size / 1024)} KB)`);
    }
  };

  const handleAnalyzeSchedule = async () => {
    setAnalyzing(true);
    setMsg("");
    try {
      let filePayload = null;
      if (file) {
        try {
          const base64Data = await fileToBase64(file);
          filePayload = {
            data: base64Data,
            mimeType: file.type || "application/octet-stream"
          };
        } catch (fileErr) {
          console.error("Gagal membaca file:", fileErr);
        }
      }

      const textToAnalyze = pastedText || "Silakan analisa jadwal dari dokumen yang diunggah.";
      const result = await analyzeSchedule(textToAnalyze, filePayload, { apiKey });
      
      if (result && Array.isArray(result.items)) {
        const parsedItems: JadwalItem[] = result.items.map((it: any) => {
          let itemJenjang = Jenjang.SD;
          if (it.jenjang) {
            const rawJenjang = String(it.jenjang).toUpperCase();
            if (rawJenjang.includes("SMP")) itemJenjang = Jenjang.SMP;
            else if (rawJenjang.includes("SMA") || rawJenjang.includes("SMK")) itemJenjang = Jenjang.SMA;
          } else if (profile?.jenjang) {
            itemJenjang = profile.jenjang;
          }
          return {
            id: `schedule-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            hari: it.hari || "Senin",
            jam: it.jam || "07:30 - 08:45",
            mapel: it.mapel || "Mata Pelajaran",
            kelas: it.kelas || "Umum",
            jenjang: itemJenjang,
          };
        });
        
        setItems(parsedItems);
        setMsg(`✅ Berhasil mengekstrak ${parsedItems.length} slot jadwal pelajaran dari dokumen menggunakan Gemini AI! Silakan simpan jadwal di bagian bawah.`);
      } else {
        setMsg("🔴 Kesalahan AI: Gagal mengekstrak slot jadwal pelajaran dalam format yang sesuai.");
      }
    } catch (error: any) {
      setMsg(`🔴 Kesalahan AI: ${error.message || "Gagal menganalisis jadwal"}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteItem = (id: string) => {
    const updated = items.filter((item) => item.id !== id);
    setItems(updated);
    setMsg("💡 Slot jadwal dihapus dari tabel sementara.");
  };

  const handleSave = async () => {
    try {
      await onSaveSchedule(items);
      setMsg("✅ Jadwal Pelajaran berhasil disimpan permanen ke database!");
      setTimeout(() => setMsg(""), 4000);
    } catch (error: any) {
      setMsg(`🔴 Error menyimpan: ${error.message || "Gagal"}`);
    }
  };

  const daysList: ("Senin" | "Selasa" | "Rabu" | "Kamis" | "Jumat" | "Sabtu")[] = [
    "Senin",
    "Selasa",
    "Rabu",
    "Kamis",
    "Jumat",
    "Sabtu",
  ];

  const uniqueClasses = Array.from(
    new Set([
      ...(selectedJenjang === "Semua"
        ? Object.values(classOptionsByJenjang).flat()
        : classOptionsByJenjang[selectedJenjang as Jenjang] || []),
      ...(profile?.kelas && (selectedJenjang === "Semua" || profile.jenjang === selectedJenjang)
        ? [profile.kelas]
        : []),
      ...items
        .filter((it) => selectedJenjang === "Semua" || it.jenjang === selectedJenjang)
        .map((it) => it.kelas)
        .filter(Boolean)
    ])
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" id="schedule_panel">
      <div className="border-b border-slate-200 bg-slate-50 p-4">
        <h2 className="font-bold text-slate-800 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          Jadwal Pelajaran Mingguan
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">Atur jadwal mengajar Anda di kelas. Jadwal ini akan terintegrasi dalam perhitungan Program Semester (PROSEM).</p>
      </div>

      {/* Class Selector Control Bar */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-5 h-5 text-blue-600 shrink-0" />
            <span className="text-sm font-bold text-slate-700">Pilih Jenjang:</span>
            <div className="relative inline-block">
              <select
                value={selectedJenjang}
                onChange={(e) => {
                  setSelectedJenjang(e.target.value);
                  setSelectedKelas("Semua"); // reset kelas filter on jenjang change
                }}
                className="text-sm font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer shadow-sm min-w-[120px]"
              >
                <option value="Semua">✨ Semua Jenjang</option>
                <option value={Jenjang.SD}>SD</option>
                <option value={Jenjang.SMP}>SMP</option>
                <option value={Jenjang.SMA}>SMA</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-700">Pilih Kelas:</span>
            <div className="relative inline-block">
              <select
                value={selectedKelas}
                onChange={(e) => setSelectedKelas(e.target.value)}
                className="text-sm font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer shadow-sm min-w-[140px]"
              >
                <option value="Semua">✨ Semua Kelas</option>
                {uniqueClasses.map((kls) => (
                  <option key={kls} value={kls}>Kelas {kls}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Copy / Clear utilities for the selected class */}
        {selectedKelas !== "Semua" && (
          <div className="flex flex-wrap gap-2 items-center">
            {uniqueClasses.filter(c => c !== selectedKelas).length > 0 && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                <span className="text-[10px] font-bold text-slate-500 pl-2 uppercase">Salin Dari:</span>
                <select
                  onChange={(e) => {
                    const src = e.target.value;
                    if (src) {
                      handleCopyScheduleFrom(src);
                      e.target.value = ""; // Reset dropdown
                    }
                  }}
                  className="text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Pilih Kelas --</option>
                  {uniqueClasses.filter(c => c !== selectedKelas).map(c => (
                    <option key={c} value={c}>Kelas {c}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleClearClassSchedule}
              className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 bg-white px-3 py-1.5 rounded-lg transition shadow-sm flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Bersihkan Jadwal Kelas {selectedKelas}
            </button>
          </div>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Upload Block for Schedule */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start bg-blue-50/20 p-5 rounded-2xl border border-blue-100">
          <div className="md:col-span-2 space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
              Unggah / Analisis Jadwal Mingguan dengan AI
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Punya jadwal berupa foto, dokumen PDF, tabel Excel, Word, atau coretan catatan?
              Unggah di sini atau tempel di kotak teks. AI Gemini akan mengekstraksinya langsung ke format tabel mingguan secara otomatis.
            </p>

            <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-5 transition flex flex-col items-center justify-center bg-white shadow-inner">
              <Upload className="w-8 h-8 text-slate-400 mb-2" />
              <p className="text-xs text-slate-600 font-medium">Tarik &amp; lepas file Jadwal Pelajaran di sini</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Format Gambar (JPG/PNG), PDF, Excel, Word, dll</p>
              
              <div className="mt-3">
                <input
                  type="file"
                  id="schedule-upload"
                  onChange={handleFileChange}
                  accept=".pdf,.xlsx,.xls,.docx,.doc,.png,.jpg,.jpeg"
                  className="hidden"
                />
                <label
                  htmlFor="schedule-upload"
                  className="bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold py-1.5 px-3.5 rounded cursor-pointer transition text-[11px] shadow-sm flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  Pilih Berkas Jadwal
                </label>
              </div>

              {file && (
                <div className="mt-2.5 flex items-center gap-1 text-[11px] text-blue-600 bg-blue-50 py-1 px-3 rounded-full border border-blue-100">
                  <FileText className="w-3 h-3 shrink-0" />
                  <span className="truncate max-w-[180px]">{file.name}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                Catatan / Salinan Jadwal Teks
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Misal: 'Matematika Senin jam 1-2 di kelas 4, Bahasa Indonesia Selasa jam 3-4...'"
                rows={4}
                className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400 font-sans"
              />
            </div>

            <button
              onClick={handleAnalyzeSchedule}
              disabled={analyzing}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-bold py-2 px-4 rounded-lg transition shadow text-xs"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Mengekstraksi dengan AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                  Analisis Jadwal &amp; Ekstrak
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Add Form */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
          <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-3">Tambah Jam Mengajar Baru</h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hari</label>
              <select
                value={newItem.hari}
                onChange={(e) => setNewItem((p) => ({ ...p, hari: e.target.value as any }))}
                className="w-full p-2 text-sm border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {daysList.map((day) => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Alokasi Jam</label>
              <input
                type="text"
                value={newItem.jam}
                onChange={(e) => setNewItem((p) => ({ ...p, jam: e.target.value }))}
                placeholder="Contoh: 07:30 - 08:45"
                className="w-full p-2 text-sm border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mata Pelajaran</label>
              <input
                type="text"
                value={newItem.mapel}
                onChange={(e) => setNewItem((p) => ({ ...p, mapel: e.target.value }))}
                placeholder="Contoh: Matematika"
                className="w-full p-2 text-sm border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Jenjang</label>
              <select
                value={newItem.jenjang}
                onChange={(e) => {
                  const nextJenjang = e.target.value as Jenjang;
                  setNewItem((p) => ({ 
                    ...p, 
                    jenjang: nextJenjang,
                    kelas: classOptionsByJenjang[nextJenjang]?.[0] || ""
                  }));
                  setIsCustomKelas(false);
                }}
                className="w-full p-2 text-sm border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={Jenjang.SD}>SD</option>
                <option value={Jenjang.SMP}>SMP</option>
                <option value={Jenjang.SMA}>SMA</option>
              </select>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Kelas</label>
                  {isCustomKelas && (
                    <button
                      type="button"
                      onClick={() => {
                        const stdOpts = classOptionsByJenjang[newItem.jenjang];
                        setIsCustomKelas(false);
                        if (stdOpts && stdOpts.length > 0) {
                          setNewItem((p) => ({ ...p, kelas: stdOpts[0] }));
                        }
                      }}
                      className="text-[9px] font-bold text-blue-600 hover:underline"
                    >
                      Pilih dari Daftar
                    </button>
                  )}
                </div>
                {isCustomKelas ? (
                  <input
                    type="text"
                    value={newItem.kelas}
                    onChange={(e) => setNewItem((p) => ({ ...p, kelas: e.target.value }))}
                    placeholder="Contoh: IV-A atau Lainnya"
                    className="w-full p-2 text-sm border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                ) : (
                  <select
                    value={newItem.kelas}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "custom") {
                        setIsCustomKelas(true);
                        setNewItem((p) => ({ ...p, kelas: "" }));
                      } else {
                        setNewItem((p) => ({ ...p, kelas: val }));
                      }
                    }}
                    className="w-full p-2 text-sm border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {(classOptionsByJenjang[newItem.jenjang] || []).map((kls) => (
                      <option key={kls} value={kls}>Kelas {kls}</option>
                    ))}
                    <option value="custom">✍️ Ketik Manual...</option>
                  </select>
                )}
              </div>
              <button
                onClick={handleAddItem}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold p-2.5 rounded transition flex items-center justify-center self-end"
                title="Tambahkan"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {msg && (
          <div className={`p-3 rounded-lg text-xs font-semibold ${msg.includes("🔴") ? "bg-red-50 text-red-700 border border-red-100" : "bg-blue-50 text-blue-800 border border-blue-100"}`}>
            {msg}
          </div>
        )}

        {/* Weekly display by columns */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {daysList.map((day) => {
            const dayItems = items.filter(
              (it) => it.hari === day && 
                (selectedJenjang === "Semua" || it.jenjang === selectedJenjang) &&
                (selectedKelas === "Semua" || it.kelas === selectedKelas)
            );
            return (
              <div key={day} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden flex flex-col min-h-[220px]">
                <div className="bg-blue-600 text-white text-xs font-bold text-center py-2 uppercase tracking-wide">
                  {day}
                </div>
                <div className="p-2 space-y-2 flex-1 flex flex-col justify-start">
                  {dayItems.length === 0 ? (
                    <div className="text-[10px] text-slate-400 text-center my-auto italic">Tidak ada KBM</div>
                  ) : (
                    dayItems.map((it) => (
                      <div key={it.id} className="bg-white p-2 rounded border border-slate-200 text-xs relative group hover:border-red-300 transition">
                        <button
                          onClick={() => handleDeleteItem(it.id)}
                          className="absolute right-1 top-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                          title="Hapus"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <div className="flex items-center gap-1 font-semibold text-slate-800">
                          <BookOpen className="w-3 h-3 text-blue-500 shrink-0" />
                          <span className="truncate pr-3">{it.mapel}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{it.jam}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                          <GraduationCap className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{it.jenjang || "SD"} - Kelas {it.kelas}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Table representation for easier editing */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase">
                <th className="p-3">Hari</th>
                <th className="p-3">Alokasi Jam</th>
                <th className="p-3">Mata Pelajaran</th>
                <th className="p-3">Jenjang</th>
                <th className="p-3">Kelas</th>
                <th className="p-3 text-center w-16">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(() => {
                const filteredTableItems = items.filter(
                  (it) => 
                    (selectedJenjang === "Semua" || it.jenjang === selectedJenjang) &&
                    (selectedKelas === "Semua" || it.kelas === selectedKelas)
                );
                if (filteredTableItems.length === 0) {
                  return (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                        {selectedKelas === "Semua" && selectedJenjang === "Semua"
                          ? "Belum ada jadwal mengajar yang dimasukkan. Tambahkan di atas!" 
                          : "Belum ada jadwal mengajar untuk kriteria filter terpilih. Tambahkan di atas atau salin dari kelas lain!"}
                      </td>
                    </tr>
                  );
                }
                return filteredTableItems.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-semibold text-slate-800">{it.hari}</td>
                    <td className="p-3 text-slate-600">{it.jam}</td>
                    <td className="p-3 text-slate-600 font-medium">{it.mapel}</td>
                    <td className="p-3 text-slate-600 font-semibold">{it.jenjang || "SD"}</td>
                    <td className="p-3 text-slate-600">{it.kelas}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleDeleteItem(it.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>

        {/* Action Bottom */}
        <div className="flex justify-end pt-2">
          <motion.button
            whileHover={{ scale: 1.02, translateY: -1 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            onClick={handleSave}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-2.5 px-6 rounded-lg transition shadow-md text-sm cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Simpan Seluruh Jadwal Mengajar
          </motion.button>
        </div>
      </div>
    </div>
  );
}
