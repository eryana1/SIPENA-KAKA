export enum Jenjang {
  SD = "SD",
  SMP = "SMP",
  SMA = "SMA"
}

export enum Fase {
  A = "Fase A (Kelas 1-2)",
  B = "Fase B (Kelas 3-4)",
  C = "Fase C (Kelas 5-6)",
  D = "Fase D (Kelas 7-9)",
  E = "Fase E (Kelas 10)",
  F = "Fase F (Kelas 11-12)"
}

export interface UserProfile {
  uid: string;
  nama: string;
  email: string;
  sekolah: string;
  driveFolder?: string;
  apiKey?: string;
  tanggalDibuat: string;
  
  // Dashboard fields
  jenjang?: Jenjang;
  fase?: Fase;
  kelas?: string;
  nip?: string;
  kepalaSekolah?: string;
  nipKepalaSekolah?: string;
  tahunPelajaran?: string;
  semester?: "1" | "2";

  // Perbaikan Identitas Satuan Pendidikan
  npsn?: string;
  jenjangPendidikan?: string;
  statusSekolah?: string; // Negeri / Swasta
  alamatSekolah?: string;
  desa?: string;
  kecamatan?: string;
  kabupaten?: string;
  provinsi?: string;
  kodePos?: string;

  // Identitas Kepala Sekolah
  pangkatKepalaSekolah?: string;
  jabatanKepalaSekolah?: string;

  // Identitas Guru per Kelas
  guruPerKelas?: {
    [kelas: string]: {
      nama: string;
      nip: string;
      jabatan?: string;
      tandaTangan?: string; // image string or draw initials
    };
  };
  
  // Koleksi Dinamis Guru (Banyak Guru)
  teachersList?: TeacherProfile[];
}

export interface AppAccount {
  id: string;
  username: string;
  password: string;
  schoolName: string;
  teacherName: string;
  maxDevices: number;
  role: "admin" | "user";
  status: "active" | "disabled";
  createdAt: string;
  notes?: string;
  lastLogin?: string;
}

export interface TeacherProfile {
  id: string;
  nama: string;
  nip: string;
  jabatan: string;
  kelas: string;
  jenisGuru?: "Guru Kelas" | "Guru Mapel";
  mapel?: string;
  tandaTangan?: string; // Tanda tangan digital (base64 image)
}

export interface TPItem {
  id: string;
  mapel?: string;
  cp?: string;
  elemen?: string;
  kompetensi: string;
  konten: string;
  tujuanPembelajaran: string;
  materi?: string;
  glosarium?: string;
  checked?: boolean;
  kelas?: string;
}

export interface TPData {
  jenjang: Jenjang;
  fase: Fase;
  mapel: string;
  capaianPembelajaran: string;
  items: TPItem[];
  createdAt: string;
  kelas?: string;
  tahunPelajaran?: string;
  semester?: string;
  extractedElements?: { namaElemen: string; deskripsiCpElemenAsli: string }[];
}

export interface ATPItem {
  tpId: string;
  cp?: string;
  elemen?: string;
  kelas?: string;
  tujuanPembelajaran: string;
  perkiraanJam: number;
  topik: string;
  glosarium: string;
  order: number;
  mapel?: string; // separated per subject
}

export interface ATPData {
  mapel: string;
  fase: Fase;
  kelas: string;
  items: ATPItem[];
  createdAt: string;
}

export interface PROTAItem {
  atpId: string;
  tujuanPembelajaran: string;
  alokasiWaktu: number; // in hours
  semester: "1" | "2";
  topik: string;
  mapel?: string; // separated per subject
  cp?: string;
  elemen?: string;
}

export interface PROTAData {
  fase: Fase;
  mapel: string;
  kelas: string;
  items: PROTAItem[];
  createdAt: string;
}

export interface PROSEMWeek {
  weekNum: number;
  checked: boolean;
}

export interface PROSEMItem {
  atpId: string;
  tujuanPembelajaran: string;
  alokasiWaktu: number;
  weeks: { [monthAndWeek: string]: boolean }; // e.g. "Jul-1": true
  mapel?: string; // separated per subject
  semester?: "1" | "2"; // separated per semester
  cp?: string;
  elemen?: string;
}

export interface PROSEMData {
  semester: "1" | "2";
  mapel: string;
  fase: Fase;
  kelas: string;
  items: PROSEMItem[];
  months: string[]; // List of months in that semester, e.g. ["Juli", "Agustus", ...]
  weeksPerMonth: number; // usually 4 or 5
  createdAt: string;
}

export interface RPPData {
  id: string;
  // Identitas
  namaSekolah: string;
  mapel: string;
  fase: Fase;
  kelas: string;
  semester: "1" | "2";
  tahunPelajaran: string;
  alokasiWaktu: string;
  pertemuan: string;
  
  cp: string;
  elemen?: string;
  materi: string;
  tujuanPembelajaran: string;
  
  profilLulusan: string[]; // Selected profile items
  kearifanLokal?: string; // Kearifan lokal to be integrated
  modelPembelajaran: string;
  metodePembelajaran: string;
  glosarium?: string;
  kesiapanPesertaDidik?: string;
  mediaPembelajaran: string;
  alatPembelajaran: string;
  sumberBelajar: string;
  
  evaluasi: string;
  pengayaan: string;
  remedial: string;
  
  refleksiGuru: string;
  refleksiSiswa: string;
  
  lampiran: string;
  lampiranLKPD?: string;
  lampiranAsesmen?: string;
  lampiranRubrik?: string;
  lampiranBahanBacaan?: string;
  
  // Tables / Sintaks
  sintaksTable: {
    tahap: string;
    sintaks: string;
    deskripsi: string;
    alokasi: string;
  }[];
  
  fullContentHtml?: string; // Content of tiptap editor
  createdAt: string;
}

export interface VersionHistory {
  id: string;
  documentType: "TP" | "ATP" | "PROTA" | "PROSEM" | "RPP";
  documentId: string; // can be mapel-fase etc
  versionName: string;
  data: any;
  timestamp: string;
}

export interface CalendarData {
  hariEfektif: number;
  hariTidakEfektif: number;
  jumlahMinggu: number;
  seninCount: number;
  selasaCount: number;
  rabuCount: number;
  kamisCount: number;
  jumatCount: number;
  sabtuCount: number;
  liburNasional: string;
  liburSemester: string;
  liburKhusus: string;
  rawFileName?: string;
  rawExtractedText?: string;
}

export interface JadwalItem {
  id: string;
  hari: "Senin" | "Selasa" | "Rabu" | "Kamis" | "Jumat" | "Sabtu";
  jam: string; // e.g. "07:30 - 08:10"
  mapel: string;
  kelas: string;
  jenjang?: Jenjang;
}
