import { Fase } from "../types";

export const normKelas = (k: string | number): string => {
  if (!k) return "1";
  const val = String(k).trim().toUpperCase();
  const ROMAN_TO_ARABIC: { [key: string]: string } = {
    "I": "1", "II": "2", "III": "3", "IV": "4", "V": "5", "VI": "6",
    "VII": "7", "VIII": "8", "IX": "9", "X": "10", "XI": "11", "XII": "12",
    "SATU": "1", "DUA": "2", "TIGA": "3", "EMPAT": "4", "LIMA": "5", "ENAM": "6"
  };
  return ROMAN_TO_ARABIC[val] || val;
};

export const isSameKelas = (k1: string, k2: string): boolean => {
  if (!k1 || !k2) return false;
  return normKelas(k1) === normKelas(k2);
};

export const FASE_CLASSES: { [key in Fase]: string[] } = {
  [Fase.A]: ["1", "2"],
  [Fase.B]: ["3", "4"],
  [Fase.C]: ["5", "6"],
  [Fase.D]: ["7", "8", "9"],
  [Fase.E]: ["10"],
  [Fase.F]: ["11", "12"]
};

export const getValidClassesForFase = (currentFase: Fase): string[] => {
  return FASE_CLASSES[currentFase] || ["1", "2"];
};

export const getDefaultKelasForFase = (currentFase: Fase): string => {
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

export const getKelasForFase = (currentFase: Fase, inputKelas?: string): string => {
  const valid = getValidClassesForFase(currentFase);
  if (inputKelas) {
    const normIn = normKelas(inputKelas);
    const isValid = valid.some(c => normKelas(c) === normIn);
    if (isValid) return normIn;
  }
  return getDefaultKelasForFase(currentFase);
};

export const isClassInSameFase = (k1: string, k2: string, currentFase: Fase): boolean => {
  if (!k1 || !k2 || k1.toUpperCase() === "FASE" || k2.toUpperCase() === "FASE") return true;
  if (isSameKelas(k1, k2)) return true;
  const valid = getValidClassesForFase(currentFase);
  const n1 = normKelas(k1);
  const n2 = normKelas(k2);
  return valid.includes(n1) && valid.includes(n2);
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
