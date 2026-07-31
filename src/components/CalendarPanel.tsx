import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Upload, Calendar, Calculator, Edit3, Save, FileText, Loader2, Download } from "lucide-react";
import { analyzeAcademicCalendar } from "../lib/ai";
import { CalendarData } from "../types";
import { generateCalendarDocx } from "../lib/docxGenerator";
import { downloadBlob } from "../lib/downloadHelper";

interface CalendarPanelProps {
  calendarData: CalendarData | null;
  onSaveCalendar: (data: CalendarData) => Promise<void>;
  apiKey?: string;
  profile?: any;
}

export default function CalendarPanel({ calendarData, onSaveCalendar, apiKey, profile }: CalendarPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [msg, setMsg] = useState("");

  const [stats, setStats] = useState<CalendarData>({
    hariEfektif: 132,
    hariTidakEfektif: 48,
    jumlahMinggu: 22,
    seninCount: 22,
    selasaCount: 22,
    rabuCount: 22,
    kamisCount: 22,
    jumatCount: 22,
    sabtuCount: 22,
    liburNasional: "17 Agustus, 29 Oktober, 25 Desember",
    liburSemester: "Libur Semester 1: 21 Des - 2 Jan",
    liburKhusus: "Libur awal Ramadhan & Idul Fitri",
  });

  useEffect(() => {
    if (calendarData) {
      setStats(calendarData);
    }
  }, [calendarData]);

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
      setPastedText(`File Kalender Pendidikan diunggah: ${selected.name} (${Math.round(selected.size / 1024)} KB)`);
    }
  };

  const handleAnalyze = async () => {
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

      const textToAnalyze = pastedText || "Kalender Pendidikan Semester Ganjil 2026/2027. Efektif Juli s.d Desember. Hari efektif 132 hari. Libur Nasional 17 Agustus, 29 Oktober. Libur Semester 21 Desember.";
      const result = await analyzeAcademicCalendar(textToAnalyze, filePayload, { apiKey });
      
      const newStats = {
        ...result,
        rawFileName: file ? file.name : "Input manual",
        rawExtractedText: textToAnalyze,
      };
      
      setStats(newStats);
      setMsg("✅ Kalender berhasil dianalisis secara cerdas oleh Gemini AI!");
    } catch (error: any) {
      setMsg(`🔴 Kesalahan AI: ${error.message || "Gagal menganalisis kalender"}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStatChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setStats((prev) => ({
      ...prev,
      [name]: name.endsWith("Count") || name === "hariEfektif" || name === "hariTidakEfektif" || name === "jumlahMinggu"
        ? parseInt(value) || 0
        : value,
    }));
  };

  const handleSave = async () => {
    try {
      await onSaveCalendar(stats);
      setMsg("✅ Statistik Kalender Pendidikan berhasil disimpan ke database!");
      setTimeout(() => setMsg(""), 4000);
    } catch (error: any) {
      setMsg(`🔴 Gagal menyimpan: ${error.message}`);
    }
  };

  const handleDownloadWord = async () => {
    try {
      const blob = await generateCalendarDocx(profile || {}, stats);
      const filename = `Analisis_Kalender_Pendidikan.docx`;
      
      downloadBlob(blob, filename);
      setMsg("✅ File Analisis Kalender (.docx) berhasil dibuat dan diunduh!");
      setTimeout(() => setMsg(""), 4000);
    } catch (error: any) {
      setMsg(`🔴 Gagal mengunduh berkas Word: ${error.message}`);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" id="calendar_panel">
      <div className="border-b border-slate-200 bg-slate-50 p-4">
        <h2 className="font-bold text-slate-800 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          Kalender Pendidikan
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">Unggah Kalender Pendidikan sekolah untuk menghitung rincian minggu dan hari efektif pembelajaran.</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Upload Block */}
        <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-6 transition flex flex-col items-center justify-center bg-slate-50">
          <Upload className="w-10 h-10 text-slate-400 mb-2" />
          <p className="text-sm text-slate-600 font-medium">Tarik &amp; lepas file Kalender Pendidikan di sini</p>
          <p className="text-xs text-slate-400 mt-1">Mendukung format PDF, Excel, Word, atau Gambar</p>
          
          <div className="mt-4">
            <input
              type="file"
              id="calendar-upload"
              onChange={handleFileChange}
              accept=".pdf,.xlsx,.xls,.docx,.doc,.png,.jpg,.jpeg"
              className="hidden"
            />
            <label
              htmlFor="calendar-upload"
              className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-lg cursor-pointer transition text-xs shadow-sm"
            >
              Pilih Dokumen Kalender
            </label>
          </div>

          {file && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 py-1 px-3 rounded-full border border-blue-100">
              <FileText className="w-3.5 h-3.5" />
              <span>{file.name}</span>
            </div>
          )}
        </div>

        {/* Input Text Area for Pasting info if no file / fine tuning */}
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
            Tempel Teks Kalender / Catatan Tambahan (Opsional)
          </label>
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Tempel rincian tanggal, hari libur, atau data kalender di sini agar AI membaca rinciannya secara akurat..."
            className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none h-24"
          />
        </div>

        <div className="flex justify-start">
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-semibold py-2 px-5 rounded-lg transition shadow disabled:opacity-50 text-sm"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Menganalisis Kalender...
              </>
            ) : (
              <>
                <Calculator className="w-4 h-4" />
                Analisis Otomatis dengan AI
              </>
            )}
          </button>
        </div>

        {msg && (
          <div className={`p-3 rounded-lg text-sm font-semibold ${msg.includes("🔴") ? "bg-red-50 text-red-700 border border-red-100" : "bg-emerald-50 text-emerald-800 border border-emerald-100"}`}>
            {msg}
          </div>
        )}

        <hr className="border-slate-100" />

        {/* Calculated results */}
        <div className="space-y-4">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
            <Edit3 className="w-4 h-4 text-blue-600" />
            Statistik Hasil Analisis (Dapat Diedit Kembali)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Counts */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Hari Efektif Belajar (HEB)</label>
                <input
                  type="number"
                  name="hariEfektif"
                  value={stats.hariEfektif}
                  onChange={handleStatChange}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Hari Tidak Efektif</label>
                <input
                  type="number"
                  name="hariTidakEfektif"
                  value={stats.hariTidakEfektif}
                  onChange={handleStatChange}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Jumlah Minggu Efektif</label>
                <input
                  type="number"
                  name="jumlahMinggu"
                  value={stats.jumlahMinggu}
                  onChange={handleStatChange}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Day distribution counts */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 grid grid-cols-2 gap-3">
              <div className="col-span-2 text-xs font-bold text-slate-600 uppercase border-b border-slate-200 pb-1">Distribusi Hari Efektif</div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Senin</label>
                <input
                  type="number"
                  name="seninCount"
                  value={stats.seninCount}
                  onChange={handleStatChange}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Selasa</label>
                <input
                  type="number"
                  name="selasaCount"
                  value={stats.selasaCount}
                  onChange={handleStatChange}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Rabu</label>
                <input
                  type="number"
                  name="rabuCount"
                  value={stats.rabuCount}
                  onChange={handleStatChange}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Kamis</label>
                <input
                  type="number"
                  name="kamisCount"
                  value={stats.kamisCount}
                  onChange={handleStatChange}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Jumat</label>
                <input
                  type="number"
                  name="jumatCount"
                  value={stats.jumatCount}
                  onChange={handleStatChange}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Sabtu</label>
                <input
                  type="number"
                  name="sabtuCount"
                  value={stats.sabtuCount}
                  onChange={handleStatChange}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white text-sm"
                />
              </div>
            </div>

            {/* Holidays text details */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Hari Libur Nasional</label>
                <textarea
                  name="liburNasional"
                  value={stats.liburNasional}
                  onChange={handleStatChange}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 h-16"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Libur Semester</label>
                <textarea
                  name="liburSemester"
                  value={stats.liburSemester}
                  onChange={handleStatChange}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 h-16"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Libur Khusus / Keagamaan</label>
                <textarea
                  name="liburKhusus"
                  value={stats.liburKhusus}
                  onChange={handleStatChange}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 h-16"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 justify-between items-center pt-4 border-t border-slate-100">
            <motion.button
              whileHover={{ scale: 1.02, translateY: -1 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              onClick={handleSave}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-semibold py-2.5 px-6 rounded-lg transition shadow-md text-sm cursor-pointer animate-fade-in"
            >
              <Save className="w-4 h-4" />
              Simpan Hasil Kalender ke Database
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02, translateY: -1 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              onClick={handleDownloadWord}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-semibold py-2.5 px-6 rounded-lg transition shadow-md text-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Unduh Microsoft Word (.docx)
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
