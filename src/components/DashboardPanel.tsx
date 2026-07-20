import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { 
  Save, 
  Award, 
  ClipboardCheck, 
  BookOpen, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  CloudLightning,
  School,
  UserCheck,
  PenTool,
  Upload,
  Trash2,
  X,
  Check,
  Plus,
  Edit,
  Users
} from "lucide-react";
import { Jenjang, Fase, TeacherProfile } from "../types";

// Canvas Drawing Pad Component for digital signatures
function CanvasDrawingPad({ 
  onSave, 
  onClear, 
  hasInitial 
}: { 
  onSave: (dataUrl: string) => void; 
  onClear: () => void;
  hasInitial: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = "#0f172a"; // Slate 900
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    e.preventDefault();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL("image/png");
      onSave(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onClear();
  };

  return (
    <div className="space-y-2">
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-inner">
        <canvas
          ref={canvasRef}
          width={300}
          height={120}
          className="w-full h-[120px] bg-slate-50 cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-slate-400">Gambar tanda tangan dengan mouse/layar sentuh Anda.</span>
        <button
          type="button"
          onClick={clearCanvas}
          className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded hover:bg-red-50 transition"
        >
          Bersihkan Pad
        </button>
      </div>
    </div>
  );
}

interface DashboardPanelProps {
  profile: any;
  onSaveProfile: (profile: any) => Promise<void>;
  completeness: {
    tp: number;
    atp: number;
    prota: number;
    prosem: number;
    rpp: number;
  };
  apiKey: string;
  onSaveApiKey: (key: string) => void;
}

const getKelasOptions = (jenjang?: Jenjang) => {
  if (jenjang === Jenjang.SMP) {
    return [
      { num: "7", label: "Kelas VII (7)" },
      { num: "8", label: "Kelas VIII (8)" },
      { num: "9", label: "Kelas IX (9)" }
    ];
  }
  if (jenjang === Jenjang.SMA) {
    return [
      { num: "10", label: "Kelas X (10)" },
      { num: "11", label: "Kelas XI (11)" },
      { num: "12", label: "Kelas XII (12)" }
    ];
  }
  // Default SD
  return [
    { num: "1", label: "Kelas I (1)" },
    { num: "2", label: "Kelas II (2)" },
    { num: "3", label: "Kelas III (3)" },
    { num: "4", label: "Kelas IV (4)" },
    { num: "5", label: "Kelas V (5)" },
    { num: "6", label: "Kelas VI (6)" }
  ];
};

const getMapelOptions = (jenjang?: Jenjang) => {
  if (jenjang === Jenjang.SMP) {
    return ["Bahasa Indonesia", "Matematika", "IPA", "IPS", "Bahasa Inggris", "Pendidikan Pancasila", "Informatika", "PJOK", "Seni Budaya"];
  }
  if (jenjang === Jenjang.SMA) {
    return ["Bahasa Indonesia", "Matematika", "Fisika", "Kimia", "Biologi", "Sejarah", "Geografi", "Ekonomi", "Sosiologi", "Bahasa Inggris", "Informatika"];
  }
  // Default SD
  return [
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
  ];
};

export default function DashboardPanel({ profile, onSaveProfile, completeness, apiKey, onSaveApiKey }: DashboardPanelProps) {
  const [formData, setFormData] = useState({
    sekolah: "",
    jenjang: Jenjang.SD,
    fase: Fase.A,
    kelas: "",
    nama: "",
    nip: "",
    kepalaSekolah: "",
    nipKepalaSekolah: "",
    tahunPelajaran: "2026/2027",
    semester: "1" as "1" | "2",
    
    // Perbaikan Identitas Satuan Pendidikan
    npsn: "",
    jenjangPendidikan: "",
    statusSekolah: "Negeri",
    alamatSekolah: "",
    desa: "",
    kecamatan: "",
    kabupaten: "",
    provinsi: "",
    kodePos: "",

    // Identitas Kepala Sekolah
    pangkatKepalaSekolah: "",
    jabatanKepalaSekolah: "Kepala Sekolah",

    // Identitas Guru per Kelas
    guruPerKelas: {} as {
      [kelas: string]: {
        nama: string;
        nip: string;
        jabatan?: string;
        tandaTangan?: string;
      };
    },

    // Koleksi dinamis guru
    teachersList: [] as TeacherProfile[]
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [localApiKey, setLocalApiKey] = useState(apiKey || "");
  const [checkingApi, setCheckingApi] = useState(false);
  const [apiStatus, setApiStatus] = useState<"unchecked" | "valid" | "invalid">("unchecked");
  const [apiKeyMsg, setApiKeyMsg] = useState("");

  // Sub-tabs for the settings area
  const [activeFormTab, setActiveFormTab] = useState<"sekolah" | "kepsek" | "guru_kelas">("sekolah");
  // Current class being configured/edited in Tab 3
  const [selectedKelasEdit, setSelectedKelasEdit] = useState<string>("1");

  // State untuk modal tambah/edit guru
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherProfile | null>(null);
  const [teacherForm, setTeacherForm] = useState({
    nama: "",
    nip: "",
    jabatan: "",
    kelas: "1",
    jenisGuru: "Guru Kelas" as "Guru Kelas" | "Guru Mapel",
    mapel: "",
    customMapel: "",
    tandaTangan: ""
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        sekolah: profile.sekolah || "",
        jenjang: profile.jenjang || Jenjang.SD,
        fase: profile.fase || Fase.A,
        kelas: profile.kelas || "",
        nama: profile.nama || "",
        nip: profile.nip || "",
        kepalaSekolah: profile.kepalaSekolah || "",
        nipKepalaSekolah: profile.nipKepalaSekolah || "",
        tahunPelajaran: profile.tahunPelajaran || "2026/2027",
        semester: profile.semester || "1",
        
        npsn: profile.npsn || "",
        jenjangPendidikan: profile.jenjangPendidikan || "",
        statusSekolah: profile.statusSekolah || "Negeri",
        alamatSekolah: profile.alamatSekolah || "",
        desa: profile.desa || "",
        kecamatan: profile.kecamatan || "",
        kabupaten: profile.kabupaten || "",
        provinsi: profile.provinsi || "",
        kodePos: profile.kodePos || "",
        
        pangkatKepalaSekolah: profile.pangkatKepalaSekolah || "",
        jabatanKepalaSekolah: profile.jabatanKepalaSekolah || "Kepala Sekolah",
        
        guruPerKelas: profile.guruPerKelas || {},
        teachersList: profile.teachersList || [],
      });
    }
  }, [profile]);

  useEffect(() => {
    if (apiKey) {
      setLocalApiKey(apiKey);
    }
  }, [apiKey]);

  const handleOpenAddTeacher = () => {
    let defaultKelas = "1";
    if (formData.jenjang === Jenjang.SMP) {
      defaultKelas = "7";
    } else if (formData.jenjang === Jenjang.SMA) {
      defaultKelas = "10";
    }

    setEditingTeacher(null);
    setTeacherForm({
      nama: "",
      nip: "",
      jabatan: "",
      kelas: defaultKelas,
      jenisGuru: "Guru Kelas",
      mapel: "",
      customMapel: "",
      tandaTangan: ""
    });
    setIsTeacherModalOpen(true);
  };

  const handleOpenEditTeacher = (teacher: TeacherProfile) => {
    const isMapel = !!teacher.mapel;
    const presets = getMapelOptions(formData.jenjang);
    const isPreset = teacher.mapel ? presets.includes(teacher.mapel) : false;

    setEditingTeacher(teacher);
    setTeacherForm({
      nama: teacher.nama || "",
      nip: teacher.nip || "",
      jabatan: teacher.jabatan || "",
      kelas: teacher.kelas || "1",
      jenisGuru: teacher.jenisGuru || (isMapel ? "Guru Mapel" : "Guru Kelas"),
      mapel: teacher.mapel ? (isPreset ? teacher.mapel : "Lainnya") : "",
      customMapel: teacher.mapel && !isPreset ? teacher.mapel : "",
      tandaTangan: teacher.tandaTangan || ""
    });
    setIsTeacherModalOpen(true);
  };

  const handleDeleteTeacher = (id: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus data guru ini?")) {
      setFormData(prev => ({
        ...prev,
        teachersList: (prev.teachersList || []).filter(t => t.id !== id)
      }));
    }
  };

  const handleSaveTeacherInList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherForm.nama) {
      alert("Nama Guru harus diisi!");
      return;
    }
    if (!teacherForm.nip) {
      alert("NIP harus diisi! Tulis '-' jika non-NIP.");
      return;
    }

    const finalMapel = teacherForm.jenisGuru === "Guru Mapel"
      ? (teacherForm.mapel === "Lainnya" ? teacherForm.customMapel : teacherForm.mapel)
      : "";

    if (teacherForm.jenisGuru === "Guru Mapel" && !finalMapel) {
      alert("Mata Pelajaran harus diisi!");
      return;
    }

    const finalTeacherData: TeacherProfile = {
      id: editingTeacher ? editingTeacher.id : "teacher_" + Date.now(),
      nama: teacherForm.nama,
      nip: teacherForm.nip,
      jabatan: teacherForm.jabatan,
      kelas: teacherForm.kelas,
      jenisGuru: teacherForm.jenisGuru,
      mapel: finalMapel,
      tandaTangan: teacherForm.tandaTangan
    };

    if (editingTeacher) {
      setFormData(prev => ({
        ...prev,
        teachersList: (prev.teachersList || []).map(t => t.id === editingTeacher.id ? finalTeacherData : t)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        teachersList: [...(prev.teachersList || []), finalTeacherData]
      }));
    }

    setIsTeacherModalOpen(false);
    setEditingTeacher(null);
  };

  const handleSaveApiKey = () => {
    onSaveApiKey(localApiKey);
    setApiKeyMsg("✅ Kunci API Gemini berhasil disimpan ke database Anda!");
    setTimeout(() => setApiKeyMsg(""), 4000);
  };

  const handleCheckApi = async () => {
    setCheckingApi(true);
    setApiStatus("unchecked");
    try {
      const response = await fetch("/api/check-api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: localApiKey || undefined })
      });
      const data = await response.json();
      if (response.ok && data.valid) {
        setApiStatus("valid");
      } else {
        setApiStatus("invalid");
      }
    } catch (err) {
      setApiStatus("invalid");
    } finally {
      setCheckingApi(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      await onSaveProfile(formData);
      setMsg("✅ Data Satuan Pendidikan berhasil disimpan ke database!");
      setTimeout(() => setMsg(""), 4000);
    } catch (error: any) {
      setMsg(`🔴 Error: ${error.message || "Gagal menyimpan"}`);
    } finally {
      setSaving(false);
    }
  };

  const totalProgress = Math.round(
    (completeness.tp + completeness.atp + completeness.prota + completeness.prosem + completeness.rpp) / 5
  );

  return (
    <div className="space-y-6" id="dashboard_panel">
      {/* Banner */}
      <div className="bg-gradient-to-r from-[#005A9E] to-[#2B579A] text-white p-6 rounded-2xl shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight">Selamat Datang di SIPENA KAKA</h1>
        <p className="text-white/80 mt-1.5 text-sm md:text-base italic">
          Asisten AI Guru Profesional Indonesia untuk menyusun seluruh perangkat pembelajaran Kurikulum Merdeka secara otomatis dan sejalan dengan standar Kemendikbudristek.
        </p>
        <p className="text-blue-100/95 mt-2 text-xs md:text-sm font-medium">
          Sistem Perencanaan Pembelajaran Berbasis Kearifan Lokal dan Kecerdasan Artifisial
        </p>
      </div>

      {/* Progress Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main completeness circular-like gauge card */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Progress Kelengkapan</h3>
            <div className="flex justify-between items-end mt-4">
              <h3 className="text-3xl font-extrabold text-[#005A9E]">{totalProgress}%</h3>
              <span className="text-green-600 text-xs font-bold bg-green-50 px-2 py-0.5 rounded border border-green-200/50">
                {totalProgress === 100 ? "Selesai" : "Proses"}
              </span>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-[#005A9E] h-full transition-all duration-500" 
                style={{ width: `${totalProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Breakdown progress checklist */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm md:col-span-2">
          <h3 className="text-slate-800 font-bold text-sm mb-4 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-[#005A9E]" />
            Detail Progress Dokumen Kurikulum
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="flex flex-col items-center bg-slate-50 p-3 rounded-lg border border-slate-200/60 text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">TP</span>
              <span className="text-lg font-bold text-[#005A9E] mt-1">{completeness.tp}%</span>
              <div className="w-full bg-slate-200 h-1 rounded-full mt-2 overflow-hidden">
                <div className="bg-[#005A9E] h-full" style={{ width: `${completeness.tp}%` }} />
              </div>
            </div>
            <div className="flex flex-col items-center bg-slate-50 p-3 rounded-lg border border-slate-200/60 text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ATP</span>
              <span className="text-lg font-bold text-[#005A9E] mt-1">{completeness.atp}%</span>
              <div className="w-full bg-slate-200 h-1 rounded-full mt-2 overflow-hidden">
                <div className="bg-[#005A9E] h-full" style={{ width: `${completeness.atp}%` }} />
              </div>
            </div>
            <div className="flex flex-col items-center bg-slate-50 p-3 rounded-lg border border-slate-200/60 text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">PROTA</span>
              <span className="text-lg font-bold text-[#005A9E] mt-1">{completeness.prota}%</span>
              <div className="w-full bg-slate-200 h-1 rounded-full mt-2 overflow-hidden">
                <div className="bg-[#005A9E] h-full" style={{ width: `${completeness.prota}%` }} />
              </div>
            </div>
            <div className="flex flex-col items-center bg-slate-50 p-3 rounded-lg border border-slate-200/60 text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">PROSEM</span>
              <span className="text-lg font-bold text-[#005A9E] mt-1">{completeness.prosem}%</span>
              <div className="w-full bg-slate-200 h-1 rounded-full mt-2 overflow-hidden">
                <div className="bg-[#005A9E] h-full" style={{ width: `${completeness.prosem}%` }} />
              </div>
            </div>
            <div className="flex flex-col items-center bg-slate-50 p-3 rounded-lg border border-slate-200/60 text-center col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">RPP</span>
              <span className="text-lg font-bold text-[#005A9E] mt-1">{completeness.rpp}%</span>
              <div className="w-full bg-slate-200 h-1 rounded-full mt-2 overflow-hidden">
                <div className="bg-[#005A9E] h-full" style={{ width: `${completeness.rpp}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gemini API Key custom setup card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-white p-5 flex items-center justify-between">
          <h2 className="font-extrabold text-slate-800 flex items-center gap-2">
            <span className="w-1 h-6 bg-amber-500 rounded-full"></span>
            🔑 Pengaturan Kunci API Gemini Anda (Penting)
          </h2>
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${apiKey ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200 animate-pulse"}`}>
            {apiKey ? "KUNCI API AKTIF" : "BELUM DIKONFIGURASI (WAJIB)"}
          </span>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            Demi kestabilan kecepatan respons AI dan kemandirian kuota masing-masing pengguna, SIPENA KAKA mewajibkan Anda untuk menggunakan <strong>Gemini API Key Pribadi Anda Sendiri (100% Gratis)</strong>. Kunci API disimpan aman di database akun Anda dan tidak akan diakses oleh orang lain.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <div className="md:col-span-2 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1.5">Masukkan Kunci API Gemini Anda (Wajib)</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={localApiKey}
                    onChange={(e) => setLocalApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#005A9E]"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    onClick={handleSaveApiKey}
                    className="bg-[#005A9E] hover:bg-[#004a87] text-white font-bold py-2.5 px-5 rounded-lg text-xs transition uppercase tracking-wider whitespace-nowrap shadow-sm cursor-pointer"
                  >
                    Simpan Kunci
                  </motion.button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleCheckApi}
                  disabled={checkingApi}
                  className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-1.5 px-3 rounded-lg text-xs transition border border-slate-200 disabled:opacity-50"
                >
                  <CloudLightning className="w-4 h-4 text-amber-500" />
                  {checkingApi ? "Menguji Koneksi..." : "Uji Koneksi AI"}
                </button>

                {apiStatus === "valid" && (
                  <span className="text-emerald-600 text-xs font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Koneksi Berhasil &amp; Kunci Aktif!
                  </span>
                )}
                {apiStatus === "invalid" && (
                  <span className="text-red-600 text-xs font-semibold flex items-center gap-1 bg-red-50 px-2 py-1 rounded border border-red-100">
                    <AlertCircle className="w-4 h-4 text-red-500" /> Kunci API Tidak Valid / Jaringan Terputus.
                  </span>
                )}
              </div>

              {apiKeyMsg && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
                  {apiKeyMsg}
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-xs space-y-2">
              <span className="font-bold text-slate-700 block">Cara Mendapatkan Kunci Gratis:</span>
              <ol className="list-decimal pl-4 space-y-1.5 text-slate-600 font-medium leading-relaxed">
                <li>Buka situs <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-[#005A9E] hover:underline font-extrabold">Google AI Studio ↗</a>.</li>
                <li>Masuk menggunakan akun Gmail pribadi Anda.</li>
                <li>Klik tombol <span className="font-bold text-slate-800">"Get API Key"</span> di pojok kiri atas.</li>
                <li>Klik <span className="font-bold text-slate-800">"Create API Key"</span>, salin kodenya, dan simpan di form ini.</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Profile settings form with sub-tabs */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" id="profile_settings_card">
        <div className="border-b border-slate-100 bg-slate-50/50 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-extrabold text-slate-800 flex items-center gap-2">
              <span className="w-1 h-6 bg-[#005A9E] rounded-full"></span>
              Pengaturan Identitas &amp; Dokumen
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">Lengkapi identitas sekolah, kepala sekolah, dan masing-masing guru kelas.</p>
          </div>

          {/* Tab buttons */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveFormTab("sekolah")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeFormTab === "sekolah" ? "bg-white text-[#005A9E] shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
            >
              <School className="w-3.5 h-3.5" />
              Profil Sekolah
            </button>
            <button
              type="button"
              onClick={() => setActiveFormTab("kepsek")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeFormTab === "kepsek" ? "bg-white text-[#005A9E] shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Kepala Sekolah
            </button>
            <button
              type="button"
              onClick={() => setActiveFormTab("guru_kelas")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeFormTab === "guru_kelas" ? "bg-white text-[#005A9E] shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
            >
              <Users className="w-3.5 h-3.5" />
              Identitas Guru
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {activeFormTab === "sekolah" && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
              id="form_tab_sekolah"
            >
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4 flex items-center gap-2">
                <School className="w-4 h-4 text-[#005A9E]" />
                Profil Lengkap Satuan Pendidikan
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Nama Satuan Pendidikan <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="sekolah"
                    value={formData.sekolah}
                    onChange={handleChange}
                    placeholder="Contoh: SD Negeri 1 Jakarta"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">NPSN</label>
                  <input
                    type="text"
                    name="npsn"
                    value={formData.npsn}
                    onChange={handleChange}
                    placeholder="Masukkan NPSN"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Jenjang Pendidikan</label>
                  <input
                    type="text"
                    name="jenjangPendidikan"
                    value={formData.jenjangPendidikan}
                    onChange={handleChange}
                    placeholder="Contoh: Sekolah Dasar (SD)"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Jenjang Kurikulum</label>
                  <select
                    name="jenjang"
                    value={formData.jenjang}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                  >
                    <option value={Jenjang.SD}>SD</option>
                    <option value={Jenjang.SMP}>SMP</option>
                    <option value={Jenjang.SMA}>SMA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Status Sekolah</label>
                  <select
                    name="statusSekolah"
                    value={formData.statusSekolah}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                  >
                    <option value="Negeri">Negeri</option>
                    <option value="Swasta">Swasta</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Alamat Lengkap Sekolah</label>
                <input
                  type="text"
                  name="alamatSekolah"
                  value={formData.alamatSekolah}
                  onChange={handleChange}
                  placeholder="Nama jalan, nomor, RT/RW"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Desa/Kelurahan</label>
                  <input
                    type="text"
                    name="desa"
                    value={formData.desa}
                    onChange={handleChange}
                    placeholder="Desa"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Kecamatan</label>
                  <input
                    type="text"
                    name="kecamatan"
                    value={formData.kecamatan}
                    onChange={handleChange}
                    placeholder="Kecamatan"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Kabupaten/Kota</label>
                  <input
                    type="text"
                    name="kabupaten"
                    value={formData.kabupaten}
                    onChange={handleChange}
                    placeholder="Kabupaten/Kota"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Provinsi</label>
                  <input
                    type="text"
                    name="provinsi"
                    value={formData.provinsi}
                    onChange={handleChange}
                    placeholder="Provinsi"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Kode Pos</label>
                  <input
                    type="text"
                    name="kodePos"
                    value={formData.kodePos}
                    onChange={handleChange}
                    placeholder="Kode Pos"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <div className="max-w-xs">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Tahun Pelajaran <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="tahunPelajaran"
                    value={formData.tahunPelajaran}
                    onChange={handleChange}
                    placeholder="Contoh: 2026/2027"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Default Teacher credentials for fallback */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 mt-4 space-y-4">
                <span className="text-xs font-bold text-slate-700 block uppercase tracking-wide">Identitas Guru Utama (Default / Akun)</span>
                <p className="text-[11px] text-slate-500">Identitas guru ini akan digunakan jika guru kelas tertentu belum dikonfigurasi secara kustom.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Nama Lengkap Guru</label>
                    <input
                      type="text"
                      name="nama"
                      value={formData.nama}
                      onChange={handleChange}
                      placeholder="Nama Lengkap &amp; Gelar"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">NIP Guru</label>
                    <input
                      type="text"
                      name="nip"
                      value={formData.nip}
                      onChange={handleChange}
                      placeholder="NIP Guru (Tulis '-' jika Non-NIP)"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeFormTab === "kepsek" && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
              id="form_tab_kepsek"
            >
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#005A9E]" />
                Identitas Kepala Sekolah (Penandatangan Dokumen)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Nama Kepala Sekolah <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="kepalaSekolah"
                    value={formData.kepalaSekolah}
                    onChange={handleChange}
                    placeholder="Nama Kepala Sekolah beserta Gelar"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">NIP Kepala Sekolah <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="nipKepalaSekolah"
                    value={formData.nipKepalaSekolah}
                    onChange={handleChange}
                    placeholder="NIP Kepala Sekolah"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Pangkat / Golongan Ruang (Opsional)</label>
                  <input
                    type="text"
                    name="pangkatKepalaSekolah"
                    value={formData.pangkatKepalaSekolah}
                    onChange={handleChange}
                    placeholder="Contoh: Pembina Tingkat I / IVb"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Jabatan Kepala Sekolah</label>
                  <input
                    type="text"
                    name="jabatanKepalaSekolah"
                    value={formData.jabatanKepalaSekolah}
                    onChange={handleChange}
                    placeholder="Contoh: Kepala Sekolah"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {activeFormTab === "guru_kelas" && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
              id="form_tab_guru_kelas"
            >
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#005A9E]" />
                    Daftar Guru &amp; Tanda Tangan
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Kelola data guru untuk masing-masing kelas. Data ini akan otomatis digunakan sebagai penandatangan dokumen (TP, ATP, PROTA, PROSEM, RPP) sesuai kelasnya.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddTeacher}
                  className="flex items-center gap-1.5 bg-[#005A9E] hover:bg-[#004a87] text-white font-bold py-2 px-4 rounded-lg text-xs transition shadow-sm cursor-pointer self-start"
                >
                  <Plus className="w-4 h-4" /> Tambah Guru
                </button>
              </div>

              {/* Data Table */}
              {formData.teachersList && formData.teachersList.length > 0 ? (
                <div className="overflow-x-auto border border-slate-200/80 rounded-xl bg-white shadow-xs">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-tight w-[60px]">No</th>
                        <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-tight">Nama Guru</th>
                        <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-tight">NIP</th>
                        <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-tight">Jabatan</th>
                        <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-tight">Kelas Diampu</th>
                        <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-tight">Mata Pelajaran</th>
                        <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-tight">Tanda Tangan</th>
                        <th scope="col" className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-tight w-[160px]">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {formData.teachersList.map((teacher, idx) => {
                        const displayLabel = (() => {
                          if (teacher.jenisGuru === "Guru Mapel") {
                            return "Semua Kelas";
                          }
                          const ROMAN_MAP: { [key: string]: string } = {
                            "1": "Kelas I", "2": "Kelas II", "3": "Kelas III", "4": "Kelas IV", "5": "Kelas V", "6": "Kelas VI",
                            "7": "Kelas VII", "8": "Kelas VIII", "9": "Kelas IX", "10": "Kelas X", "11": "Kelas XI", "12": "Kelas XII"
                          };
                          return ROMAN_MAP[teacher.kelas] || `Kelas ${teacher.kelas}`;
                        })();

                        return (
                          <tr key={teacher.id || idx} className="hover:bg-slate-50/50 transition">
                            <td className="px-4 py-3.5 text-xs text-slate-400 font-medium font-mono">{idx + 1}</td>
                            <td className="px-4 py-3.5 text-xs text-slate-800 font-bold">{teacher.nama}</td>
                            <td className="px-4 py-3.5 text-xs text-slate-500 font-mono">{teacher.nip}</td>
                            <td className="px-4 py-3.5 text-xs text-slate-600">{teacher.jabatan || "-"}</td>
                            <td className="px-4 py-3.5 text-xs text-slate-800 font-semibold">{displayLabel}</td>
                            <td className="px-4 py-3.5 text-xs text-slate-600">
                              {teacher.mapel ? (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium border border-slate-200">
                                  {teacher.mapel}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">Semua Mapel</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-xs">
                              {teacher.tandaTangan ? (
                                <div className="flex items-center gap-1.5">
                                  <img 
                                    src={teacher.tandaTangan} 
                                    alt="Tanda tangan" 
                                    className="max-h-[24px] object-contain border border-slate-100 p-0.5 rounded bg-white" 
                                    referrerPolicy="no-referrer"
                                  />
                                  <span className="text-[9px] px-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-sm font-semibold">✍️ TTD</span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">Belum Ada</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-xs text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditTeacher(teacher)}
                                  className="flex items-center gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 rounded-md transition border border-blue-200 text-[11px] font-bold cursor-pointer"
                                >
                                  <Edit className="w-3 h-3" /> Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTeacher(teacher.id)}
                                  className="flex items-center gap-1 bg-red-50 text-red-700 hover:bg-red-100 px-2 py-1 rounded-md transition border border-red-200 text-[11px] font-bold cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" /> Hapus
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-10 text-center flex flex-col items-center justify-center">
                  <Users className="w-8 h-8 text-slate-400 mb-2" />
                  <span className="text-xs text-slate-600 font-semibold">Belum ada data guru kelas yang ditambahkan.</span>
                  <span className="text-[11px] text-slate-400 mt-1 max-w-sm">
                    Silakan klik tombol "Tambah Guru" di kanan atas untuk mengisi daftar guru yang mengampu kelas beserta tanda tangannya.
                  </span>
                </div>
              )}

              {/* Modal Pop-up Kelola Guru */}
              {isTeacherModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
                  >
                    <div className="flex justify-between items-center bg-slate-50 border-b border-slate-100 px-6 py-4">
                      <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#005A9E]" />
                        {editingTeacher ? "Ubah Identitas Guru" : "Tambah Guru Baru"}
                      </h3>
                      <button 
                        type="button" 
                        onClick={() => setIsTeacherModalOpen(false)}
                        className="text-slate-400 hover:text-slate-600 rounded-full p-1 transition hover:bg-slate-100 cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Nama Lengkap Guru <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={teacherForm.nama}
                            onChange={(e) => setTeacherForm(prev => ({ ...prev, nama: e.target.value }))}
                            placeholder="Nama Lengkap beserta Gelar"
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">NIP Guru <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={teacherForm.nip}
                            onChange={(e) => setTeacherForm(prev => ({ ...prev, nip: e.target.value }))}
                            placeholder="NIP (Tulis '-' jika Non-NIP)"
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Jenis Guru <span className="text-red-500">*</span></label>
                          <select
                            value={teacherForm.jenisGuru}
                            onChange={(e) => {
                              const selectedType = e.target.value as "Guru Kelas" | "Guru Mapel";
                              setTeacherForm(prev => ({ 
                                ...prev, 
                                jenisGuru: selectedType,
                                mapel: selectedType === "Guru Kelas" ? "" : (getMapelOptions(formData.jenjang)[0] || "")
                              }));
                            }}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                          >
                            <option value="Guru Kelas">Guru Kelas</option>
                            <option value="Guru Mapel">Guru Mapel</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Jabatan (Opsional)</label>
                          <input
                            type="text"
                            value={teacherForm.jabatan}
                            onChange={(e) => setTeacherForm(prev => ({ ...prev, jabatan: e.target.value }))}
                            placeholder={teacherForm.jenisGuru === "Guru Kelas" ? "Contoh: Guru Kelas, Wali Kelas" : "Contoh: Guru Mapel"}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        {teacherForm.jenisGuru === "Guru Kelas" ? (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Kelas yang Diampu <span className="text-red-500">*</span></label>
                            <select
                              value={teacherForm.kelas}
                              onChange={(e) => setTeacherForm(prev => ({ ...prev, kelas: e.target.value }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                            >
                              {getKelasOptions(formData.jenjang).map(opt => (
                                <option key={opt.num} value={opt.num}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Mata Pelajaran <span className="text-red-500">*</span></label>
                            <select
                              value={teacherForm.mapel}
                              onChange={(e) => setTeacherForm(prev => ({ ...prev, mapel: e.target.value }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                            >
                              {getMapelOptions(formData.jenjang).map(subject => (
                                <option key={subject} value={subject}>{subject}</option>
                              ))}
                              <option value="Lainnya">Lainnya (Tulis Kustom)</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {teacherForm.jenisGuru === "Guru Mapel" && teacherForm.mapel === "Lainnya" && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Tulis Mata Pelajaran Kustom <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            placeholder="Contoh: Seni Teater, Bahasa Jerman, dll."
                            value={teacherForm.customMapel || ""}
                            onChange={(e) => setTeacherForm(prev => ({ ...prev, customMapel: e.target.value }))}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#005A9E] focus:outline-none"
                            required
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                        <div className="space-y-2">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight">Tanda Tangan Digital (Gambar / Coret)</span>
                          <CanvasDrawingPad 
                            onSave={(dataUrl) => setTeacherForm(prev => ({ ...prev, tandaTangan: dataUrl }))}
                            onClear={() => setTeacherForm(prev => ({ ...prev, tandaTangan: "" }))}
                            hasInitial={!!teacherForm.tandaTangan}
                          />
                        </div>

                        <div className="space-y-4 flex flex-col justify-between">
                          <div className="space-y-2">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight">Atau Unggah File Tanda Tangan (PNG/JPG)</span>
                            <div className="flex gap-2">
                              <input
                                type="file"
                                id="modal-ttd-upload"
                                accept="image/*"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    const reader = new FileReader();
                                    reader.onload = (loadEv) => {
                                      const base64 = loadEv.target?.result as string;
                                      setTeacherForm(prev => ({ ...prev, tandaTangan: base64 }));
                                    };
                                    reader.readAsDataURL(e.target.files[0]);
                                  }
                                }}
                                className="hidden"
                              />
                              <label
                                htmlFor="modal-ttd-upload"
                                className="flex items-center gap-1.5 justify-center bg-white hover:bg-slate-100 text-slate-700 font-semibold py-2 px-4 rounded-lg text-xs transition border border-slate-300 shadow-sm cursor-pointer"
                              >
                                <Upload className="w-4 h-4 text-slate-500" />
                                Pilih Berkas Gambar
                              </label>

                              {teacherForm.tandaTangan && (
                                <button
                                  type="button"
                                  onClick={() => setTeacherForm(prev => ({ ...prev, tandaTangan: "" }))}
                                  className="text-xs text-red-500 hover:text-red-700 font-bold border border-red-200 hover:bg-red-50 px-3 rounded-lg transition"
                                >
                                  Hapus TTD
                                </button>
                              )}
                            </div>
                          </div>

                          {teacherForm.tandaTangan ? (
                            <div className="bg-slate-50 p-3 border border-slate-200 rounded-xl max-w-[200px] flex flex-col items-center">
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mb-1 block">Pratinjau Tanda Tangan</span>
                              <img 
                                src={teacherForm.tandaTangan} 
                                alt="Tanda tangan guru" 
                                className="max-h-[80px] object-contain"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : (
                            <div className="bg-slate-100/40 p-4 rounded-xl border border-dashed border-slate-200 text-center flex flex-col items-center justify-center min-h-[100px]">
                              <span className="text-xs text-slate-400 italic">Belum ada file / coretan tanda tangan.</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 px-6 py-4 bg-slate-50 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsTeacherModalOpen(false)}
                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition rounded-lg hover:bg-slate-100 cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveTeacherInList}
                        className="px-4 py-2 text-xs font-bold text-white bg-[#005A9E] hover:bg-[#004a87] transition rounded-lg shadow-sm cursor-pointer"
                      >
                        Simpan Identitas Guru
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {msg && (
            <div className={`p-3 rounded-lg text-sm font-semibold ${msg.includes("🔴") ? "bg-red-50 text-red-700 border border-red-100" : "bg-emerald-50 text-emerald-800 border border-emerald-100"}`}>
              {msg}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-[#005A9E] hover:bg-[#004a87] text-white font-bold py-2.5 px-6 rounded-lg transition shadow-md disabled:opacity-50 text-xs uppercase tracking-wider cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saving ? "Menyimpan..." : "Simpan Semua Data"}
            </motion.button>
          </div>
        </form>
      </div>
    </div>
  );
}
