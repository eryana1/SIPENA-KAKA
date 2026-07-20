import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  Settings, 
  Key, 
  CloudLightning, 
  FolderSync, 
  Download, 
  Upload, 
  RefreshCw, 
  Check, 
  AlertCircle,
  Database
} from "lucide-react";
import { setupDriveStructure } from "../lib/drive";

interface SettingsPanelProps {
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  accessToken: string | null;
  onLinkGoogleDrive: () => void;
  onUnlinkGoogleDrive: () => void;
  driveFolderId: string;
  onSetDriveFolderId: (id: string) => void;
  onImportBackup: (jsonData: string) => Promise<void>;
  onExportBackup: () => Promise<string>;
}

export default function SettingsPanel({
  apiKey,
  onSaveApiKey,
  accessToken,
  onLinkGoogleDrive,
  onUnlinkGoogleDrive,
  driveFolderId,
  onSetDriveFolderId,
  onImportBackup,
  onExportBackup
}: SettingsPanelProps) {
  const [localKey, setLocalKey] = useState(apiKey || "");
  const [checkingApi, setCheckingApi] = useState(false);
  const [apiStatus, setApiStatus] = useState<"unchecked" | "valid" | "invalid">("unchecked");
  const [apiError, setApiError] = useState<string>("");
  
  const [provisioningDrive, setProvisioningDrive] = useState(false);
  const [driveStatusMsg, setDriveStatusMsg] = useState("");

  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSaveKey = () => {
    onSaveApiKey(localKey);
    setMsg("✅ Kunci API Gemini berhasil diperbarui secara lokal!");
    setTimeout(() => setMsg(""), 3000);
  };

  const handleCheckApi = async () => {
    setCheckingApi(true);
    setApiStatus("unchecked");
    setApiError("");
    try {
      // Test proxy generate endpoint
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Test connection. Reply with 'OK'",
          apiKey: localKey || undefined
        })
      });
      const data = await response.json().catch(() => ({ error: "Format respons server tidak valid." }));
      if (response.ok && data.text) {
        setApiStatus("valid");
      } else {
        setApiStatus("invalid");
        setApiError(data.error || "Kunci API tidak diterima oleh model AI.");
      }
    } catch (err: any) {
      setApiStatus("invalid");
      setApiError(err.message || "Gagal menghubungi server backend.");
    } finally {
      setCheckingApi(false);
    }
  };

  const handleProvisionFolders = async () => {
    if (!accessToken) {
      alert("Silakan hubungkan Google Drive terlebih dahulu.");
      return;
    }
    setProvisioningDrive(true);
    setDriveStatusMsg("Sedang membuat struktur folder SIPENA KAKA di Google Drive Anda...");
    try {
      const structure = await setupDriveStructure(accessToken);
      const rootFolderId = structure.rootId;
      onSetDriveFolderId(rootFolderId);
      setDriveStatusMsg("✅ Sukses! Folder utama '/SIPENA KAKA' beserta subfolder (TP, ATP, PROTA, PROSEM, RPP) berhasil dibuat otomatis!");
    } catch (error: any) {
      setDriveStatusMsg(`🔴 Gagal membuat folder: ${error.message || "Kesalahan token"}`);
    } finally {
      setProvisioningDrive(false);
    }
  };

  const handleExport = async () => {
    try {
      const jsonStr = await onExportBackup();
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SIPENA_KAKA_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMsg("✅ Seluruh data berhasil diekspor sebagai file JSON!");
    } catch (error: any) {
      setMsg(`🔴 Gagal ekspor data: ${error.message}`);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setImporting(true);
    setMsg("Mengimpor berkas cadangan...");
    try {
      const text = await file.text();
      // Basic validation
      JSON.parse(text); 
      await onImportBackup(text);
      setMsg("✅ Pemulihan sukses! Seluruh data pembelajaran berhasil dipulihkan dari cadangan!");
    } catch (error: any) {
      setMsg(`🔴 Gagal mengimpor cadangan: ${error.message || "Format JSON tidak valid"}`);
    } finally {
      setImporting(false);
      e.target.value = ""; // reset
    }
  };

  return (
    <div className="space-y-6" id="settings_panel">
      {/* API Key management */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-white p-5 flex items-center justify-between">
          <h2 className="font-extrabold text-slate-800 flex items-center gap-2">
            <span className="w-1 h-6 bg-[#005A9E] rounded-full"></span>
            Konfigurasi Google Gemini AI
          </h2>
          <p className="text-xs text-slate-400 hidden md:block font-medium">Model AI: Gemini (Hasil Konsisten untuk Versi Gratis &amp; Advanced)</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Kunci API Gemini Anda (Wajib)</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={localKey}
                onChange={(e) => setLocalKey(e.target.value)}
                placeholder="Masukkan Kunci API Gemini Anda (misal: AIzaSy... atau AQ...)"
                className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#005A9E]"
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                onClick={handleSaveKey}
                className="bg-[#005A9E] hover:bg-[#004a87] text-white font-bold py-2 px-4 rounded-lg text-xs transition uppercase tracking-wider cursor-pointer"
              >
                Terapkan
              </motion.button>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleCheckApi}
              disabled={checkingApi}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-1.5 px-3 rounded-lg text-xs transition border border-slate-200 disabled:opacity-50"
            >
              <CloudLightning className="w-4 h-4 text-amber-500" />
              {checkingApi ? "Menguji Koneksi..." : "Uji Koneksi AI"}
            </button>

            {apiStatus === "valid" && (
              <span className="text-emerald-600 text-xs font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                <Check className="w-4 h-4" /> Kunci API Aktif &amp; Terhubung Lancar!
              </span>
            )}
            {apiStatus === "invalid" && (
              <span className="text-red-600 text-xs font-semibold flex flex-col items-start gap-1 bg-red-50 p-2 rounded border border-red-100 max-w-full">
                <div className="flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 shrink-0" /> 
                  <span>Kunci API Tidak Valid / Jaringan Terputus.</span>
                </div>
                {apiError && (
                  <span className="text-[10px] text-red-500 font-mono mt-1 break-all bg-red-100/40 px-1.5 py-0.5 rounded border border-red-200/50">
                    Detail Error: {apiError}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Google Drive automatic structures */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-white p-5">
          <h2 className="font-extrabold text-slate-800 flex items-center gap-2">
            <span className="w-1 h-6 bg-[#005A9E] rounded-full"></span>
            Integrasi Google Drive Cloud
          </h2>
          <p className="text-xs text-slate-400 mt-1">Sinkronkan hasil ekspor secara langsung ke penyimpanan cloud Google Drive pribadi Anda secara rapi.</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200/60">
            <div>
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide">Status Google Account</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {accessToken 
                  ? "✅ Terhubung secara resmi dengan akun Google Belajar.id / Personal Anda" 
                  : "⚪ Belum terhubung dengan Google Drive"
                }
              </p>
            </div>
            
            <div>
              {accessToken ? (
                <button
                  onClick={onUnlinkGoogleDrive}
                  className="bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2 px-4 rounded-lg text-xs transition border border-red-200"
                >
                  Putuskan Koneksi Drive
                </button>
              ) : (
                <button
                  onClick={onLinkGoogleDrive}
                  className="bg-[#005A9E] hover:bg-[#004a87] text-white font-bold py-2 px-4 rounded-lg text-xs transition shadow-sm uppercase tracking-wider"
                >
                  Hubungkan Google Drive
                </button>
              )}
            </div>
          </div>

          {accessToken && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleProvisionFolders}
                  disabled={provisioningDrive}
                  className="flex items-center gap-2 bg-[#005A9E] hover:bg-[#004a87] text-white font-bold py-2.5 px-4 rounded-lg text-xs transition shadow-sm disabled:opacity-50"
                >
                  <FolderSync className="w-4 h-4" />
                  {provisioningDrive ? "Membuat Folder..." : "Buat Otomatis Struktur Folder SIPENA KAKA"}
                </button>
              </div>

              {driveStatusMsg && (
                <div className={`p-3 rounded-lg text-xs font-semibold ${driveStatusMsg.includes("🔴") ? "bg-red-50 text-red-700 border border-red-100" : "bg-blue-50 text-blue-800 border border-blue-100"}`}>
                  {driveStatusMsg}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* JSON Backup export & import */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-white p-5">
          <h2 className="font-extrabold text-slate-800 flex items-center gap-2">
            <span className="w-1 h-6 bg-[#005A9E] rounded-full"></span>
            Cadangkan &amp; Pulihkan Seluruh Data
          </h2>
          <p className="text-xs text-slate-400 mt-1">Ekspor semua dokumen kurikulum sekolah Anda ke berkas tunggal JSON untuk keamanan ganda atau migrasi perangkat.</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Export */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide">Ekspor Seluruh Cadangan</h3>
                <p className="text-xs text-slate-500 mt-1">Unduh satu berkas JSON berisi seluruh profil satuan pendidikan, jadwal, TP, ATP, PROTA, PROSEM, dan RPP Anda.</p>
              </div>
              <button
                onClick={handleExport}
                className="mt-4 flex items-center gap-1.5 justify-center bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-lg text-xs transition border border-slate-200 shadow-sm"
              >
                <Download className="w-4 h-4 text-[#005A9E]" />
                Unduh Berkas JSON (.json)
              </button>
            </div>

            {/* Import */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide">Impor / Pulihkan Cadangan</h3>
                <p className="text-xs text-slate-500 mt-1">Unggah berkas JSON hasil ekspor sebelumnya untuk menimpa database lokal dengan semua dokumen belajar Anda.</p>
              </div>
              
              <div className="mt-4">
                <input
                  type="file"
                  id="backup-import"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                  disabled={importing}
                />
                <label
                  htmlFor="backup-import"
                  className="flex items-center gap-1.5 justify-center bg-[#005A9E] hover:bg-[#004a87] text-white font-bold py-2 px-4 rounded-lg text-xs transition shadow-sm cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  {importing ? "Memulihkan..." : "Pilih Berkas JSON"}
                </label>
              </div>
            </div>
          </div>

          {msg && (
            <div className={`p-3 rounded-lg text-sm font-semibold ${msg.includes("🔴") ? "bg-red-50 text-red-700 border border-red-100" : "bg-emerald-50 text-emerald-800 border border-emerald-100"}`}>
              {msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
