import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  CloudLightning, 
  Check, 
  AlertCircle
} from "lucide-react";

interface SettingsPanelProps {
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  accessToken?: string | null;
  onLinkGoogleDrive?: () => void;
  onUnlinkGoogleDrive?: () => void;
  driveFolderId?: string;
  onSetDriveFolderId?: (id: string) => void;
  onImportBackup?: (jsonData: string) => Promise<void>;
  onExportBackup?: () => Promise<string>;
}

export default function SettingsPanel({
  apiKey,
  onSaveApiKey
}: SettingsPanelProps) {
  const [localKey, setLocalKey] = useState(apiKey || "");
  const [checkingApi, setCheckingApi] = useState(false);
  const [apiStatus, setApiStatus] = useState<"unchecked" | "valid" | "invalid">("unchecked");
  const [apiError, setApiError] = useState<string>("");
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
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-1.5 px-3 rounded-lg text-xs transition border border-slate-200 disabled:opacity-50 cursor-pointer"
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

          {msg && (
            <div className={`p-3 rounded-lg text-xs font-semibold ${msg.includes("🔴") ? "bg-red-50 text-red-700 border border-red-100" : "bg-emerald-50 text-emerald-800 border border-emerald-100"}`}>
              {msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

