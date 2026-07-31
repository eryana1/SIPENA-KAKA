import React, { useState, useEffect } from "react";
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Key, 
  Trash2, 
  Edit3, 
  Search, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Monitor, 
  School, 
  User, 
  Lock, 
  Plus, 
  Save, 
  AlertCircle,
  Eye,
  EyeOff
} from "lucide-react";
import { AppAccount } from "../types";
import { getAllAccounts, saveAccount, deleteAccount } from "../lib/accounts";

interface AdminPanelProps {
  currentAccount: AppAccount;
  onLogoutAdmin?: () => void;
}

export default function AdminPanel({ currentAccount, onLogoutAdmin }: AdminPanelProps) {
  const [accounts, setAccounts] = useState<AppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState<AppAccount | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<AppAccount | null>(null);
  const [showChangeAdminPassword, setShowChangeAdminPassword] = useState(false);

  // Form Fields
  const [formAccount, setFormAccount] = useState({
    username: "",
    password: "",
    schoolName: "",
    teacherName: "",
    maxDevices: 13,
    notes: "",
    role: "user" as "admin" | "user"
  });

  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [adminOldPass, setAdminOldPass] = useState("");
  const [adminNewPass, setAdminNewPass] = useState("");
  const [showPass, setShowPass] = useState<{ [key: string]: boolean }>({});

  const loadAll = async () => {
    setLoading(true);
    try {
      const list = await getAllAccounts();
      setAccounts(list);
    } catch (err) {
      console.error("Error loading accounts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAccount.username.trim() || !formAccount.password.trim()) {
      setMsg({ type: "error", text: "Mohon isi Username dan Password!" });
      return;
    }

    const cleanUsername = formAccount.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    
    // Check duplicate
    if (accounts.some((a) => a.username.toLowerCase() === cleanUsername)) {
      setMsg({ type: "error", text: `Username "${cleanUsername}" sudah digunakan oleh sekolah/user lain!` });
      return;
    }

    const formattedSchoolName = cleanUsername.toUpperCase().replace(/_/g, " ");

    const newAcc: AppAccount = {
      id: cleanUsername,
      username: cleanUsername,
      password: formAccount.password.trim(),
      schoolName: formAccount.schoolName.trim() || formattedSchoolName,
      teacherName: formAccount.teacherName.trim() || "Guru Sekolah",
      maxDevices: Number(formAccount.maxDevices) || 13,
      role: "user",
      status: "active",
      createdAt: new Date().toISOString(),
      notes: "Akun Sekolah"
    };

    try {
      await saveAccount(newAcc);
      setMsg({ type: "success", text: `Akun baru "${newAcc.username}" berhasil dibuat!` });
      setShowAddModal(false);
      setFormAccount({
        username: "",
        password: "",
        schoolName: "",
        teacherName: "",
        maxDevices: 13,
        notes: "",
        role: "user"
      });
      await loadAll();
    } catch (err: any) {
      setMsg({ type: "error", text: `Gagal menyimpan akun: ${err.message}` });
    }
  };

  const handleToggleStatus = async (account: AppAccount) => {
    if (account.id.toLowerCase() === "admin") {
      alert("Akun Super Admin tidak dapat dinonaktifkan!");
      return;
    }

    const updated: AppAccount = {
      ...account,
      status: account.status === "active" ? "disabled" : "active"
    };

    try {
      await saveAccount(updated);
      setMsg({
        type: "success",
        text: `Status akun "${account.username}" diubah menjadi ${updated.status === "active" ? "AKTIF" : "NONAKTIF"}`
      });
      await loadAll();
    } catch (err: any) {
      setMsg({ type: "error", text: `Gagal mengubah status: ${err.message}` });
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showResetModal || !newPasswordInput.trim()) return;

    const updated: AppAccount = {
      ...showResetModal,
      password: newPasswordInput.trim()
    };

    try {
      await saveAccount(updated);
      setMsg({ type: "success", text: `Password untuk akun "${showResetModal.username}" berhasil diperbarui!` });
      setShowResetModal(null);
      setNewPasswordInput("");
      await loadAll();
    } catch (err: any) {
      setMsg({ type: "error", text: `Gagal mereset password: ${err.message}` });
    }
  };

  const handleDeleteUser = (account: AppAccount) => {
    if (account.id.toLowerCase() === "admin") {
      alert("Akun Super Admin tidak dapat dihapus!");
      return;
    }
    setShowDeleteConfirmModal(account);
  };

  const confirmDeleteAccount = async () => {
    if (!showDeleteConfirmModal) return;
    const target = showDeleteConfirmModal;
    setShowDeleteConfirmModal(null);
    setLoading(true);
    try {
      await deleteAccount(target.id || target.username);
      setMsg({ type: "success", text: `Akun "${target.username}" berhasil dihapus!` });
      await loadAll();
    } catch (err: any) {
      setMsg({ type: "error", text: `Gagal menghapus akun: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleChangeAdminPassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminNewPass.trim()) {
      setMsg({ type: "error", text: "Password baru wajib diisi!" });
      return;
    }

    const adminAcc = accounts.find((a) => a.id.toLowerCase() === "admin") || currentAccount;
    if (adminOldPass.trim() !== adminAcc.password) {
      setMsg({ type: "error", text: "Password lama Admin tidak sesuai!" });
      return;
    }

    const updatedAdmin: AppAccount = {
      ...adminAcc,
      password: adminNewPass.trim()
    };

    try {
      await saveAccount(updatedAdmin);
      setMsg({ type: "success", text: "Password Admin berhasil diperbarui!" });
      setShowChangeAdminPassword(false);
      setAdminOldPass("");
      setAdminNewPass("");
      await loadAll();
    } catch (err: any) {
      setMsg({ type: "error", text: `Gagal mengubah password admin: ${err.message}` });
    }
  };

  const filteredAccounts = accounts.filter((a) =>
    a.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.schoolName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.teacherName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl border border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/30">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Panel Kelola User &amp; Password Sekolah
            </h1>
          </div>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-2xl">
            Atur seluruh akun login guru &amp; sekolah. Diberikan batas akses perangkat (misal 13 PC/Guru per sekolah) agar 1 akun dapat dipakai bersama secara aman dalam 1 sekolah.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowChangeAdminPassword(true)}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-3.5 rounded-xl text-xs transition border border-white/20 cursor-pointer"
          >
            <Key className="w-4 h-4 text-amber-300" />
            Ubah Password Admin
          </button>
          
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-blue-500 to-sky-500 hover:from-blue-600 hover:to-sky-600 text-white font-extrabold py-2 px-4 rounded-xl text-xs transition shadow-lg shadow-blue-500/30 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Tambah User Sekolah
          </button>
        </div>
      </div>

      {/* Message Banner */}
      {msg && (
        <div className={`p-4 rounded-xl border text-xs flex justify-between items-center ${
          msg.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"
        }`}>
          <div className="flex items-center gap-2 font-medium">
            {msg.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="font-bold hover:underline cursor-pointer">Tutup</button>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total User Registered</span>
            <span className="text-2xl font-black text-slate-800">{accounts.length}</span>
            <span className="text-xs text-slate-500 block">Akun Sekolah / Admin</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">User Aktif</span>
            <span className="text-2xl font-black text-emerald-600">{accounts.filter(a => a.status === "active").length}</span>
            <span className="text-xs text-slate-500 block">Dapat Login Kapan Saja</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Standar Batas Perangkat</span>
            <span className="text-2xl font-black text-indigo-600">13 PC / User</span>
            <span className="text-xs text-slate-500 block">Akses Paralel Per Sekolah</span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Monitor className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Controls header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Username, Sekolah, atau Guru..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAll}
              className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-300 px-3 py-2 rounded-xl font-semibold shadow-2xs hover:bg-slate-100 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
              Muat Ulang
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                <th className="p-3.5 w-12 text-center">No</th>
                <th className="p-3.5">Username / Kode Login</th>
                <th className="p-3.5">Password</th>
                <th className="p-3.5">Nama Sekolah</th>
                <th className="p-3.5">Penanggung Jawab / Guru</th>
                <th className="p-3.5 text-center">Batas Perangkat</th>
                <th className="p-3.5 text-center">Role</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center w-36">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                    {loading ? "Memuat data akun..." : "Tidak ada akun user yang ditemukan."}
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc, idx) => (
                  <tr key={acc.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 text-center font-bold text-slate-400">{idx + 1}</td>
                    
                    <td className="p-3.5">
                      <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{acc.username}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">ID: {acc.id}</span>
                    </td>

                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono bg-slate-100 text-slate-800 px-2 py-1 rounded border border-slate-200 text-[11px] font-bold">
                          {showPass[acc.id] ? acc.password : "••••••••"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowPass(p => ({ ...p, [acc.id]: !p[acc.id] }))}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer"
                          title="Lihat Password"
                        >
                          {showPass[acc.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>

                    <td className="p-3.5 font-semibold text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <School className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{acc.schoolName}</span>
                      </div>
                    </td>

                    <td className="p-3.5 text-slate-600">
                      {acc.teacherName || "-"}
                    </td>

                    <td className="p-3.5 text-center font-bold">
                      <span className="bg-sky-50 text-sky-800 px-2 py-1 rounded-full border border-sky-200 inline-flex items-center gap-1 text-[11px]">
                        <Monitor className="w-3 h-3 text-sky-600" />
                        {acc.maxDevices} PC
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                        acc.role === "admin" 
                          ? "bg-purple-100 text-purple-800 border border-purple-200" 
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}>
                        {acc.role}
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleToggleStatus(acc)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer ${
                          acc.status === "active"
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300"
                            : "bg-red-100 text-red-800 hover:bg-red-200 border border-red-300"
                        }`}
                        title="Klik untuk mengubah status"
                      >
                        {acc.status === "active" ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {acc.status === "active" ? "Aktif" : "Nonaktif"}
                      </button>
                    </td>

                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setShowResetModal(acc);
                            setNewPasswordInput(acc.password);
                          }}
                          className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg border border-amber-200 transition cursor-pointer"
                          title="Reset Password"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>

                        {acc.id.toLowerCase() !== "admin" && (
                          <button
                            onClick={() => handleDeleteUser(acc)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200 transition cursor-pointer"
                            title="Hapus Akun"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Tambah User Baru */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-gradient-to-r from-slate-900 to-blue-950 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" />
                <h3 className="font-extrabold text-base">Tambah Akun Sekolah / Guru Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 text-xs text-slate-700">
              <div className="space-y-1">
                <label className="block font-bold text-slate-800 uppercase text-[10px]">
                  Username / Kode Login Sekolah <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: sdn1_rancah"
                  value={formAccount.username}
                  onChange={(e) => setFormAccount(p => ({ ...p, username: e.target.value }))}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                />
                <p className="text-[10px] text-slate-400">Gunakan huruf kecil tanpa spasi (misal: sdn1_rancah atau gurujabar01)</p>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-800 uppercase text-[10px]">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Password untuk login"
                  value={formAccount.password}
                  onChange={(e) => setFormAccount(p => ({ ...p, password: e.target.value }))}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-800 uppercase text-[10px]">
                  Batas Maksimal PC / Perangkat
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formAccount.maxDevices}
                  onChange={(e) => setFormAccount(p => ({ ...p, maxDevices: parseInt(e.target.value) || 13 }))}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-blue-700"
                />
                <p className="text-[10px] text-slate-400">Default: 13 PC per sekolah</p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  Simpan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reset Password */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 bg-amber-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                <h3 className="font-extrabold text-sm">Reset Password Akun</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowResetModal(null)}
                className="text-amber-200 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Akun:</span>
                <p className="font-bold text-slate-800 text-sm">{showResetModal.username}</p>
                <p className="text-slate-600 text-xs">{showResetModal.schoolName}</p>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-800 uppercase text-[10px]">
                  Password Baru <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masukkan password baru"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowResetModal(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md transition cursor-pointer"
                >
                  Simpan Password Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Konfirmasi Hapus Akun */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 bg-red-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-100" />
                <h3 className="font-extrabold text-sm">Konfirmasi Hapus Akun</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(null)}
                className="text-red-200 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block">Akun Yang Akan Dihapus:</span>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{showDeleteConfirmModal.username}</p>
                <p className="text-slate-600 text-xs">{showDeleteConfirmModal.schoolName}</p>
              </div>

              <p className="text-slate-600 leading-relaxed font-medium">
                Apakah Anda yakin ingin menghapus akun ini secara permanen? Akun tidak dapat digunakan lagi untuk login setelah dihapus.
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirmModal(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteAccount}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition cursor-pointer"
                >
                  Ya, Hapus Akun
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Ubah Password Admin */}
      {showChangeAdminPassword && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-sm">Ubah Password Super Admin</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowChangeAdminPassword(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangeAdminPassSubmit} className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-800 uppercase text-[10px]">
                  Password Lama Admin <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="Password lama"
                  value={adminOldPass}
                  onChange={(e) => setAdminOldPass(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-800 uppercase text-[10px]">
                  Password Baru Admin <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="Password baru"
                  value={adminNewPass}
                  onChange={(e) => setAdminNewPass(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowChangeAdminPassword(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition cursor-pointer"
                >
                  Perbarui Password Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
