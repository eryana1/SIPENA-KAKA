import { Fase } from "../types";

export const isSameKelas = (k1: string, k2: string): boolean => {
  if (!k1 || !k2) return false;
  const norm = (k: string) => {
    const val = k.trim().toUpperCase();
    const ROMAN_TO_ARABIC: { [key: string]: string } = {
      "I": "1", "II": "2", "III": "3", "IV": "4", "V": "5", "VI": "6",
      "VII": "7", "VIII": "8", "IX": "9", "X": "10", "XI": "11", "XII": "12",
      "Satu": "1", "Dua": "2", "Tiga": "3", "Empat": "4", "Lima": "5", "Enam": "6"
    };
    return ROMAN_TO_ARABIC[val] || val;
  };
  return norm(String(k1)) === norm(String(k2));
};

export const getDefaultKelasForFase = (currentFase: Fase) => {
  switch (currentFase) {
    case Fase.A: return "1";
    case Fase.B: return "3";
    case Fase.C: return "5";
    case Fase.D: return "7";
    case Fase.E: return "10";
    case Fase.F: return "11";
    default: return "1";
  }
};

export interface TeacherDetails {
  nama: string;
  nip: string;
  jabatan?: string;
  tandaTangan?: string;
  jenisGuru?: "Guru Kelas" | "Guru Mapel";
  mapel?: string;
}

export const getTeacherForKelas = (profile: any, targetKelas: string, targetMapel?: string): TeacherDetails => {
  const defaultTeacher: TeacherDetails = {
    nama: profile?.nama || "___________________",
    nip: profile?.nip || "-",
    jabatan: profile?.jabatan || "Guru Kelas/Mata Pelajaran",
    tandaTangan: ""
  };

  if (!profile) {
    return defaultTeacher;
  }

  // 1. Coba cari di koleksi dinamis teachersList (banyak guru)
  if (Array.isArray(profile.teachersList) && profile.teachersList.length > 0 && targetKelas) {
    // Jika targetMapel tersedia, utamakan cari Guru Mapel yang mengampu mapel tersebut
    if (targetMapel) {
      const matchMapel = profile.teachersList.find(t => 
        (t.jenisGuru === "Guru Mapel" || !!t.mapel) &&
        t.mapel && t.mapel.trim().toLowerCase() === targetMapel.trim().toLowerCase()
      );

      if (matchMapel) {
        return {
          nama: matchMapel.nama,
          nip: matchMapel.nip,
          jabatan: matchMapel.jabatan || `Guru Mata Pelajaran ${targetMapel}`,
          tandaTangan: matchMapel.tandaTangan || "",
          jenisGuru: matchMapel.jenisGuru,
          mapel: matchMapel.mapel
        };
      }
    }

    // Jika tidak cocok dengan mapel atau mapel tidak dispesifikasikan, cari guru pertama yang mengampu kelas tersebut (Guru Kelas)
    const matchKelas = profile.teachersList.find(t => t.jenisGuru !== "Guru Mapel" && isSameKelas(t.kelas, targetKelas));
    if (matchKelas) {
      return {
        nama: matchKelas.nama,
        nip: matchKelas.nip,
        jabatan: matchKelas.jabatan || `Guru Kelas ${targetKelas}`,
        tandaTangan: matchKelas.tandaTangan || "",
        jenisGuru: matchKelas.jenisGuru || "Guru Kelas",
        mapel: matchKelas.mapel
      };
    }
  }

  // 2. Fallback ke guruPerKelas lama
  if (profile.guruPerKelas && targetKelas) {
    const key = Object.keys(profile.guruPerKelas).find(k => isSameKelas(k, targetKelas));
    if (key && profile.guruPerKelas[key]) {
      const gt = profile.guruPerKelas[key];
      return {
        nama: gt.nama || defaultTeacher.nama,
        nip: gt.nip || defaultTeacher.nip,
        jabatan: gt.jabatan || `Guru Kelas ${targetKelas}`,
        tandaTangan: gt.tandaTangan || ""
      };
    }
  }

  // 3. Fallback ke profil global default
  return defaultTeacher;
};
