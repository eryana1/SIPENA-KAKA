// Helper utilities for interacting with E12WIN Gemini AI proxy backend

export interface AICallConfig {
  apiKey?: string;
}

// Simple fetch call to our local backend proxy
const fetchGenerate = async (
  prompt: string,
  systemInstruction?: string,
  responseSchema?: any,
  config?: AICallConfig,
  file?: { data: string; mimeType: string } | null
) => {
  const headers: any = {
    "Content-Type": "application/json",
  };
  if (config?.apiKey) {
    headers["x-gemini-api-key"] = config.apiKey;
  }

  const response = await fetch("/api/generate", {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt,
      systemInstruction,
      responseSchema,
      temperature: 0.2, // low temperature for high precision structured data
      file,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Gagal melakukan generate AI.");
  }

  const data = await response.json();
  return data.text;
};

// 1. Kalender Pendidikan analyzer
export const analyzeAcademicCalendar = async (
  calendarText: string,
  file?: { data: string; mimeType: string } | null,
  config?: AICallConfig
): Promise<any> => {
  const systemInstruction = "Anda adalah asisten AI kurikulum sekolah Indonesia. Menganalisis dokumen kalender pendidikan dan menghitung statistik akademik dengan akurat.";
  const prompt = `
Berikut adalah teks isi dokumen Kalender Pendidikan atau petunjuk terkait yang diunggah oleh guru:
---
${calendarText}
---
Analisislah dokumen atau gambar kalender pendidikan yang disediakan serta teks di atas, lalu hitung secara akurat:
1. Jumlah hari efektif belajar selama tahun ajaran/semester.
2. Jumlah hari tidak efektif (libur, dll).
3. Jumlah minggu efektif belajar.
4. Jumlah hari efektif berdasarkan nama hari: Senin, Selasa, Rabu, Kamis, Jumat, Sabtu.
5. Daftarkan rincian libur nasional, libur semester, dan libur khusus yang tertera.

Berikan output dalam format JSON yang valid sesuai skema yang diminta. Jangan ada teks penjelasan lain selain JSON yang valid.
`;

  const responseSchema = {
    type: "OBJECT",
    properties: {
      hariEfektif: { type: "INTEGER" },
      hariTidakEfektif: { type: "INTEGER" },
      jumlahMinggu: { type: "INTEGER" },
      seninCount: { type: "INTEGER" },
      selasaCount: { type: "INTEGER" },
      rabuCount: { type: "INTEGER" },
      kamisCount: { type: "INTEGER" },
      jumatCount: { type: "INTEGER" },
      sabtuCount: { type: "INTEGER" },
      liburNasional: { type: "STRING" },
      liburSemester: { type: "STRING" },
      liburKhusus: { type: "STRING" },
    },
    required: [
      "hariEfektif",
      "hariTidakEfektif",
      "jumlahMinggu",
      "seninCount",
      "selasaCount",
      "rabuCount",
      "kamisCount",
      "jumatCount",
      "sabtuCount",
      "liburNasional",
      "liburSemester",
      "liburKhusus",
    ],
  };

  const jsonStr = await fetchGenerate(prompt, systemInstruction, responseSchema, config, file);
  return JSON.parse(jsonStr);
};

// 1.5. Jadwal Pelajaran (Schedule) analyzer
export const analyzeSchedule = async (
  scheduleText: string,
  file?: { data: string; mimeType: string } | null,
  config?: AICallConfig
): Promise<any> => {
  const systemInstruction = "Anda adalah asisten AI kurikulum sekolah Indonesia. Menganalisis dokumen jadwal pelajaran (mingguan) dan merumuskannya ke format JSON terstruktur.";
  const prompt = `
Berikut adalah teks isi dokumen Jadwal Pelajaran atau petunjuk terkait yang diunggah oleh guru:
---
\${scheduleText}
---
Analisislah dokumen, gambar, excel, atau teks jadwal pelajaran mingguan yang disediakan, lalu ekstraksi seluruh entri jadwal pelajaran tersebut ke dalam array JSON yang valid.
Setiap item jadwal harus memiliki properti:
1. hari: Salah satu dari "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu". (Pastikan tepat)
2. jam: Alokasi waktu/jam pelajaran (misal: "07:30 - 08:45" atau "Pukul 08:00 - 08:40").
3. mapel: Nama mata pelajaran (misal: "Matematika", "Bahasa Indonesia", "IPAS", dll).
4. kelas: Nama kelas (misal: "IV-A", "Kelas 1", "IV", dll).
5. jenjang: Jenjang pendidikan. Nilai wajib berupa salah satu dari: "SD", "SMP", "SMA". Jika tidak tertera, sesuaikan dengan konteks atau default ke "SD".

Berikan output dalam format JSON yang valid sesuai skema yang diminta. Jangan ada teks penjelasan lain selain JSON yang valid.
`;

  const responseSchema = {
    type: "OBJECT",
    properties: {
      items: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            hari: { type: "STRING" },
            jam: { type: "STRING" },
            mapel: { type: "STRING" },
            kelas: { type: "STRING" },
            jenjang: { type: "STRING" },
          },
          required: ["hari", "jam", "mapel", "kelas", "jenjang"],
        },
      },
    },
    required: ["items"],
  };

  const jsonStr = await fetchGenerate(prompt, systemInstruction, responseSchema, config, file);
  return JSON.parse(jsonStr);
};

// 2. Tujuan Pembelajaran (TP) Generator based on CP
export const generateTujuanPembelajaran = async (
  jenjang: string,
  fase: string,
  mapel: string,
  customCpDocument?: string, // If uploaded custom CP document
  config?: AICallConfig,
  file?: { data: string; mimeType: string } | null
): Promise<any> => {
  const systemInstruction = "Anda adalah ahli pengembang kurikulum Merdeka Kemendikbudristek Indonesia. Anda ahli mengekstrak Capaian Pembelajaran (CP) asli dan merumuskan Tujuan Pembelajaran (TP) berdasarkan Elemen dan deskripsi CP masing-masing Elemen secara presisi, akurat, dan mempertahankan keaslian dokumen sepenuhnya tanpa merangkum atau memotong teks asli.";
  
  let prompt = "";
  if (file) {
    prompt = `
Tugas Utama Anda:
1. Analisislah berkas dokumen atau teks Capaian Pembelajaran (CP) yang diunggah oleh guru di bawah ini.
2. Identifikasi SEMUANYA: Elemen-elemen dan deskripsi Capaian Pembelajaran (CP) masing-masing elemen yang sesuai dengan kriteria berikut:
   - Jenjang: ${jenjang}
   - Fase: ${fase}
   - Mata Pelajaran: ${mapel}
3. Ekstraksi seluruh Elemen tersebut secara lengkap beserta deskripsi CP masing-masing elemen dari berkas/teks tersebut.
4. Gabungkan seluruh Elemen dan deskripsi CP lengkapnya (asli secara utuh, tanpa diringkas, tanpa dipotong, tanpa parafrase, dan tanpa disederhanakan) ke dalam properti 'capaianPembelajaran'.
5. Untuk SETIAP Elemen / Capaian Pembelajaran (CP) yang terdeteksi, breakdown atau formulasikan minimal 8 (delapan) butir rumusan Tujuan Pembelajaran (TP) yang padat, aplikatif, dan terstruktur.
6. Untuk setiap butir di array 'items', sertakan properti 'elemen' (nama elemen), 'cp' (tuliskan isi CAPAIAN PEMBELAJARAN ASLI secara utuh dan lengkap sesuai teks aslinya dari dokumen/sumber untuk elemen terkait, JANGAN PERNAH meringkas, memotong, menyederhanakan, memparafrase, atau mengubah kalimat aslinya), 'kompetensi', 'konten', dan 'tujuanPembelajaran'.
`;
  } else if (customCpDocument) {
    prompt = `
Guru mengunggah dokumen CP khusus untuk jenjang ${jenjang}, ${fase}, mata pelajaran ${mapel}:
---
${customCpDocument}
---
Analisislah isi CP di atas. Identifikasi SEMUA Elemen yang tercantum beserta deskripsi CP masing-masing elemen. 
1. Gabungkan seluruh daftar elemen dan deskripsi CP lengkapnya (asli secara utuh, tanpa diringkas, tanpa dipotong, tanpa parafrase, dan tanpa disederhanakan) ke dalam properti 'capaianPembelajaran'.
2. Breakdown setiap Elemen / Capaian Pembelajaran (CP) menjadi minimal 8 (delapan) butir Tujuan Pembelajaran (TP) terstruktur, padat, dan aplikatif.
3. Setiap butir dalam array 'items' harus memiliki properti 'elemen', 'cp' (tuliskan isi CAPAIAN PEMBELAJARAN ASLI secara utuh dan lengkap sesuai teks aslinya dari dokumen/sumber untuk elemen terkait, JANGAN PERNAH meringkas, memotong, menyederhanakan, memparafrase, atau mengubah kalimat aslinya), 'kompetensi', 'konten', dan 'tujuanPembelajaran'.
`;
  } else {
    prompt = `
Rumuskan seluruh Elemen standar nasional Indonesia dan deskripsi Capaian Pembelajaran (CP) masing-masing elemen untuk Jenjang: ${jenjang}, ${fase}, Mata Pelajaran: ${mapel} berdasarkan standar Kurikulum Merdeka Kemendikbudristek terbaru.
1. Gabungkan seluruh daftar elemen dan deskripsi CP lengkapnya (asli secara utuh, tanpa diringkas, tanpa dipotong, tanpa parafrase, dan tanpa disederhanakan) ke dalam properti 'capaianPembelajaran'.
2. Breakdown setiap Elemen / Capaian Pembelajaran (CP) menjadi minimal 8 (delapan) butir Tujuan Pembelajaran (TP) terstruktur, padat, dan aplikatif.
3. Setiap butir TP wajib dihubungkan secara spesifik ke Elemen dan deskripsi CP Elemen tersebut.
4. Setiap butir dalam array 'items' wajib menyertakan properti 'elemen', 'cp' (tuliskan isi CAPAIAN PEMBELAJARAN ASLI secara utuh dan lengkap sesuai teks aslinya dari dokumen/sumber untuk elemen terkait, JANGAN PERNAH meringkas, memotong, menyederhanakan, memparafrase, atau mengubah kalimat aslinya), 'kompetensi', 'konten', dan 'tujuanPembelajaran'.
`;
  }

  prompt += `
SANGAT PENTING - VALIDASI KESESUAIAN MATA PELAJARAN:
Jika berkas diunggah atau teks Capaian Pembelajaran (CP) khusus dimasukkan oleh guru, Anda WAJIB memvalidasi apakah isi materi dokumen/teks tersebut benar-benar berkaitan dengan Mata Pelajaran terpilih: "${mapel}".
Jika isi dokumen/teks tersebut menceritakan mata pelajaran lain (misal dokumen berisi pelajaran Matematika seperti bilangan, aljabar, geometri, pengukuran, data, namun Mata Pelajaran yang dipilih saat ini adalah "Bahasa Indonesia", atau sebaliknya), Anda harus:
1. Set properti 'mismatchDetected' menjadi true.
2. Tulis penjelasan yang santun, ramah, namun tegas di properti 'mismatchDetails' (contoh: "Dokumen Capaian Pembelajaran yang diunggah berisi materi Matematika (Elemen Bilangan/Aljabar), namun Mata Pelajaran yang Anda pilih saat ini adalah Bahasa Indonesia. Silakan ubah pilihan mata pelajaran Anda terlebih dahulu agar sesuai.").
3. Kosongkan properti 'capaianPembelajaran' ("") dan 'items' ([]).

Jika isi dokumen cocok/relevan dengan Mata Pelajaran terpilih "${mapel}", set 'mismatchDetected' menjadi false, 'mismatchDetails' menjadi kosong (""), dan proses pembuatan Tujuan Pembelajaran seperti biasa.

Berikan output dalam bentuk JSON yang memiliki properti:
- mismatchDetected: boolean (true jika ada ketidaksesuaian mata pelajaran antara dokumen/teks CP yang diunggah dengan pilihan mata pelajaran saat ini, false jika sesuai)
- mismatchDetails: string (penjelasan jika ada mismatch, kosongkan jika tidak ada)
- capaianPembelajaran: seluruh teks gabungan elemen dan deskripsi CP secara lengkap dan utuh sesuai aslinya (SANGAT PENTING: DILARANG MERANGKUM ATAU MEMOTONG TEKS CP ASLI!).
- items: daftar objek yang masing-masing memiliki properti 'elemen', 'cp', 'kompetensi', 'konten', dan 'tujuanPembelajaran'.

ATURAN MUTLAK PENYUSUNAN CAPAIAN PEMBELAJARAN (CP):
1. JANGAN PERNAH MERANGKUM ISI DOKUMEN CP. Pertahankan seluruh isi dokumen asli sebagaimana tertulis tanpa diringkas, disederhanakan, diparafrase, atau dipotong.
2. PERTAHANKAN STRUKTUR DOKUMEN (fase, kelas jika ada, elemen, subelemen, ruang lingkup, penomoran, judul, urutan penyajian).
3. PERTAHANKAN ISI KALIMAT. Setiap kalimat pada dokumen CP harus disimpan sebagaimana tertulis. Jangan mengganti kalimat dengan bentuk yang lebih singkat ataupun lebih panjang.
4. PERTAHANKAN ISTILAH RESMI.
5. JANGAN MEMPERBAIKI REDAKSI (kecuali kesalahan teknis OCR seperti karakter rusak, spasi ganda, kata terpotong).
6. Prioritaskan akurasi penuh dan keutuhan teks.

CATATAN RESILIENSI: Jika Anda kesulitan menemukan atau mengidentifikasi Elemen standar nasional resmi untuk Mata Pelajaran '${mapel}' Jenjang '${jenjang}' Fase '${fase}' ini (misalnya karena merupakan mata pelajaran muatan lokal, keagamaan khusus, atau baru), Anda DIWAJIBKAN untuk merumuskan secara mandiri 2-3 nama Elemen umum yang sangat relevan dan logis (contohnya: 'Pemahaman Konsep' dan 'Keterampilan Proses', atau aspek teoretis dan praktis yang sesuai), kemudian rumuskan minimal 8 (delapan) Tujuan Pembelajaran untuk masing-masing elemen tersebut. JANGAN PERNAH mengembalikan array kosong atau membiarkan output tidak terisi, karena hal ini akan menyebabkan kegagalan sistem.

- Untuk SETIAP Elemen/CP yang Anda temukan/rumuskan, Anda WAJIB membuat minimal 8 (delapan) butir Tujuan Pembelajaran (TP) di dalam array 'items'.
- Di properti 'cp' masing-masing item, tulis teks deskripsi CP asli secara lengkap dan utuh untuk elemen terkait (jangan dirangkum, disingkat, atau dipotong!).
Pastikan bahasa Indonesia yang digunakan formal, tepat sasaran, dan mendalam sesuai standar kurikulum nasional.
`;

  const responseSchema = {
    type: "OBJECT",
    properties: {
      mismatchDetected: { type: "BOOLEAN" },
      mismatchDetails: { type: "STRING" },
      capaianPembelajaran: { type: "STRING" },
      items: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            elemen: { type: "STRING" },
            cp: { type: "STRING" },
            kompetensi: { type: "STRING" },
            konten: { type: "STRING" },
            tujuanPembelajaran: { type: "STRING" },
          },
          required: ["elemen", "cp", "kompetensi", "konten", "tujuanPembelajaran"],
        },
      },
    },
    required: ["mismatchDetected", "mismatchDetails", "capaianPembelajaran", "items"],
  };

  const jsonStr = await fetchGenerate(prompt, systemInstruction, responseSchema, config, file);
  return JSON.parse(jsonStr);
};

export const extractCapaianPembelajaranOnly = async (
  jenjang: string,
  fase: string,
  mapel: string,
  customCpDocument?: string,
  config?: AICallConfig,
  file?: { data: string; mimeType: string } | null
): Promise<any> => {
  const systemInstruction = "Anda adalah ahli pengembang kurikulum Merdeka Kemendikbudristek Indonesia. Anda ahli mengekstrak Capaian Pembelajaran (CP) asli dari dokumen atau teks secara presisi, akurat, dan mempertahankan keaslian dokumen sepenuhnya tanpa merangkum atau memotong teks asli.";

  let prompt = "";
  if (file) {
    prompt = `
Tugas Utama Anda:
1. Analisislah berkas dokumen atau teks Capaian Pembelajaran (CP) yang diunggah di bawah ini.
2. Identifikasi Elemen-elemen dan deskripsi Capaian Pembelajaran (CP) masing-masing elemen yang sesuai dengan kriteria berikut:
   - Jenjang: ${jenjang}
   - Fase: ${fase}
   - Mata Pelajaran: ${mapel}
3. Ekstraksi seluruh Elemen tersebut secara lengkap beserta deskripsi CP masing-masing elemen dari berkas/teks tersebut.
4. Gabungkan seluruh Elemen dan deskripsi CP lengkapnya (asli secara utuh, tanpa diringkas, tanpa dipotong, tanpa parafrase, dan tanpa disederhanakan) ke dalam properti 'capaianPembelajaran'.
`;
  } else if (customCpDocument) {
    prompt = `
Isi teks CP yang diberikan untuk jenjang ${jenjang}, ${fase}, mata pelajaran ${mapel}:
---
${customCpDocument}
---
Analisislah isi CP di atas. Identifikasi SEMUA Elemen yang tercantum beserta deskripsi CP masing-masing elemen.
1. Gabungkan seluruh daftar elemen dan deskripsi CP lengkapnya (asli secara utuh, tanpa diringkas, tanpa dipotong, tanpa parafrase, dan tanpa disederhanakan) ke dalam properti 'capaianPembelajaran'.
`;
  } else {
    prompt = `
Rumuskan seluruh Elemen standar nasional Indonesia dan deskripsi Capaian Pembelajaran (CP) masing-masing elemen untuk Jenjang: ${jenjang}, ${fase}, Mata Pelajaran: ${mapel} berdasarkan standar Kurikulum Merdeka Kemendikbudristek terbaru.
1. Gabungkan seluruh daftar elemen dan deskripsi CP lengkapnya (asli secara utuh, tanpa diringkas, tanpa dipotong, tanpa parafrase, dan tanpa disederhanakan) ke dalam properti 'capaianPembelajaran'.
`;
  }

  prompt += `
SANGAT PENTING - VALIDASI KESESUAIAN MATA PELAJARAN:
Jika berkas diunggah atau teks Capaian Pembelajaran (CP) khusus dimasukkan oleh guru, Anda WAJIB memvalidasi apakah isi materi dokumen/teks tersebut benar-benar berkaitan dengan Mata Pelajaran terpilih: "${mapel}".
Jika isi dokumen/teks tersebut menceritakan mata pelajaran lain (misal dokumen berisi pelajaran Matematika seperti bilangan, aljabar, geometri, pengukuran, data, namun Mata Pelajaran yang dipilih saat ini adalah "Bahasa Indonesia", atau sebaliknya), Anda harus:
1. Set properti 'mismatchDetected' menjadi true.
2. Tulis penjelasan yang santun, ramah, namun tegas di properti 'mismatchDetails' (contoh: "Dokumen Capaian Pembelajaran yang diunggah berisi materi Matematika (Elemen Bilangan/Aljabar), namun Mata Pelajaran yang Anda pilih saat ini adalah Bahasa Indonesia. Silakan ubah pilihan mata pelajaran Anda terlebih dahulu agar sesuai.").
3. Kosongkan properti 'capaianPembelajaran' ("").

Jika isi dokumen cocok/relevan dengan Mata Pelajaran terpilih "${mapel}", set 'mismatchDetected' menjadi false, 'mismatchDetails' menjadi kosong (""), dan ekstrak isi CP asli secara utuh.

Berikan output dalam bentuk JSON yang memiliki properti:
- mismatchDetected: boolean (true jika ada ketidaksesuaian mata pelajaran antara dokumen/teks CP dengan pilihan mata pelajaran saat ini, false jika sesuai)
- mismatchDetails: string (penjelasan jika ada mismatch, kosongkan jika tidak ada)
- capaianPembelajaran: seluruh teks gabungan elemen dan deskripsi CP secara lengkap dan utuh sesuai aslinya (SANGAT PENTING: DILARANG MERANGKUM ATAU MEMOTONG TEKS CP ASLI!).
- elements: daftar objek elemen yang diekstraksi, masing-masing memiliki properti 'namaElemen' (string) dan 'deskripsiCpElemenAsli' (string, isi deskripsi asli utuh untuk elemen terkait).

ATURAN MUTLAK PENYUSUNAN CAPAIAN PEMBELAJARAN (CP):
1. JANGAN PERNAH MERANGKUM ISI DOKUMEN CP. Pertahankan seluruh isi dokumen asli sebagaimana tertulis tanpa diringkas, disederhanakan, diparafrase, atau dipotong.
2. PERTAHANKAN STRUKTUR DOKUMEN (fase, kelas jika ada, elemen, subelemen, ruang lingkup, penomoran, judul, urutan penyajian).
3. PERTAHANKAN ISI KALIMAT. Setiap kalimat pada dokumen CP harus disimpan sebagaimana tertulis. Jangan mengganti kalimat dengan bentuk yang lebih singkat ataupun lebih panjang.
4. PERTAHANKAN ISTILAH RESMI.
5. JANGAN MEMPERBAIKI REDAKSI (kecuali kesalahan teknis OCR seperti karakter rusak, spasi ganda, kata terpotong).
6. Prioritaskan akurasi penuh dan keutuhan teks.

CATATAN RESILIENSI: Jika Anda kesulitan menemukan atau mengidentifikasi Elemen standar nasional resmi untuk Mata Pelajaran '${mapel}' Jenjang '${jenjang}' Fase '${fase}' ini (misalnya karena merupakan mata pelajaran muatan lokal, keagamaan khusus, atau baru), Anda DIWAJIBKAN untuk merumuskan secara mandiri 2-3 nama Elemen umum yang sangat relevan dan logis (contohnya: 'Pemahaman Konsep' dan 'Keterampilan Proses', atau aspek teoretis dan praktis yang sesuai).
`;

  const responseSchema = {
    type: "OBJECT",
    properties: {
      mismatchDetected: { type: "BOOLEAN" },
      mismatchDetails: { type: "STRING" },
      capaianPembelajaran: { type: "STRING" },
      elements: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            namaElemen: { type: "STRING" },
            deskripsiCpElemenAsli: { type: "STRING" }
          },
          required: ["namaElemen", "deskripsiCpElemenAsli"]
        }
      }
    },
    required: ["mismatchDetected", "mismatchDetails", "capaianPembelajaran", "elements"]
  };

  const jsonStr = await fetchGenerate(prompt, systemInstruction, responseSchema, config, file);
  return JSON.parse(jsonStr);
};

export const generateTpFromElements = async (
  jenjang: string,
  fase: string,
  mapel: string,
  elements: { namaElemen: string; deskripsiCpElemenAsli: string }[],
  config?: AICallConfig
): Promise<any> => {
  const systemInstruction = "Anda adalah ahli pengembang kurikulum Merdeka Kemendikbudristek Indonesia. Anda ahli merumuskan Tujuan Pembelajaran (TP) berdasarkan deskripsi CP Elemen asli secara mendalam dan terstruktur.";

  const prompt = `
Berdasarkan kurikulum Merdeka Kemendikbudristek Indonesia, formulasikan Tujuan Pembelajaran (TP) untuk:
- Jenjang: ${jenjang}
- Fase: ${fase}
- Mata Pelajaran: ${mapel}

Berikut adalah elemen dan deskripsi Capaian Pembelajaran (CP) ASLI dari dokumen kurikulum yang harus Anda gunakan sebagai referensi utama:
${elements.map((el, i) => `Elemen ${i + 1}: ${el.namaElemen}\nCapaian Pembelajaran (CP) Elemen Asli: ${el.deskripsiCpElemenAsli}`).join("\n\n")}

Tugas Anda:
1. Untuk setiap elemen di atas, Anda WAJIB memformulasikan MINIMAL 8 (delapan) butir Tujuan Pembelajaran (TP) yang padat, aplikatif, terstruktur, dan mendalam sesuai CP elemen tersebut.
2. Setiap butir TP wajib dihubungkan ke Elemen terkait dan deskripsi CP elemen tersebut.
3. CP Elemen pada hasil perumusan harus sama persis dengan 'deskripsiCpElemenAsli' yang telah disediakan di atas, dilarang merangkum, memotong, atau mengubah kalimat aslinya.

Berikan output dalam bentuk JSON yang memiliki properti:
- items: daftar objek yang masing-masing memiliki properti:
  - elemen: nama elemen yang sesuai (harus sama persis dengan nama elemen di atas)
  - cp: isi Capaian Pembelajaran (CP) elemen asli yang lengkap dan utuh (sama persis dengan deskripsiCpElemenAsli di atas, tanpa diringkas atau diubah!)
  - kompetensi: kompetensi yang disasar
  - konten: materi/konten yang diajarkan
  - tujuanPembelajaran: rumusan kalimat Tujuan Pembelajaran (TP) yang lengkap dan jelas.
`;

  const responseSchema = {
    type: "OBJECT",
    properties: {
      items: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            elemen: { type: "STRING" },
            cp: { type: "STRING" },
            kompetensi: { type: "STRING" },
            konten: { type: "STRING" },
            tujuanPembelajaran: { type: "STRING" },
          },
          required: ["elemen", "cp", "kompetensi", "konten", "tujuanPembelajaran"],
        },
      },
    },
    required: ["items"],
  };

  const jsonStr = await fetchGenerate(prompt, systemInstruction, responseSchema, config);
  return JSON.parse(jsonStr);
};

// 3. ATP Generator from TP list
export const generateATP = async (
  mapel: string,
  fase: string,
  kelas: string,
  selectedTps: { cp?: string; elemen?: string; tujuanPembelajaran: string }[],
  config?: AICallConfig
): Promise<any> => {
  const systemInstruction = "Anda adalah ahli perencana kurikulum dan penyusun Alur Tujuan Pembelajaran (ATP) Kurikulum Merdeka Kemendikbudristek Indonesia yang sangat andal dan presisi.";
  const prompt = `
Mata Pelajaran: ${mapel}
Fase: ${fase}
Kelas yang Sedang Aktif / Dipilih: ${kelas}

Daftar Tujuan Pembelajaran (TP) pilihan guru berserta Elemen dan Capaian Pembelajaran (CP) terkait yang akan disusun menjadi Alur Tujuan Pembelajaran (ATP):
${selectedTps.map((tp, idx) => `${idx + 1}. [Elemen: ${tp.elemen || "-"}][CP: ${tp.cp || "-"}] TP: ${tp.tujuanPembelajaran}`).join("\n")}

Tugas Anda adalah menyusun Alur Tujuan Pembelajaran (ATP) secara sistematis, proporsional, dan logis dengan ketentuan mutlak sebagai berikut:

KETENTUAN UTAMA PENYUSUNAN ATP:
1. 100% DATA TERGUNA & UTUH: Gunakan SELURUH Tujuan Pembelajaran (TP) yang dikirimkan di atas sebagai sumber penyusunan.
   - JANGAN menghapus atau melewatkan satu pun TP.
   - JANGAN membuat TP baru di luar daftar di atas.
   - JANGAN menggabungkan beberapa TP menjadi satu.
   - JANGAN mengubah redaksi, kata-kata, atau substansi TP yang telah disetujui pengguna.
   - Jumlah total item dalam array 'items' output JSON wajib SAMA PERSIS dengan jumlah TP input (yaitu ${selectedTps.length} item).

2. DISTRIBUSI KELAS YANG PROPORSIONAL DAN LOGIS:
   Masing-masing TP harus ditempatkan pada KELAS yang paling sesuai di dalam cakupan Fase ${fase}.
   Aturan cakupan kelas per Fase adalah:
   - Fase A: Harus didistribusikan ke Kelas "1" dan "2"
   - Fase B: Harus didistribusikan ke Kelas "3" dan "4"
   - Fase C: Harus didistribusikan ke Kelas "5" dan "6"
   - Fase D: Harus didistribusikan ke Kelas "7", "8", dan "9"
   - Fase E: Semua ditempatkan di Kelas "10"
   - Fase F: Harus didistribusikan ke Kelas "11" dan "12"

   ATURAN DISTRIBUSI KELAS:
   - Jika Fase terdiri dari 2 kelas (Fase A, B, C, F), seluruh TP harus dibagi ke dalam KEDUA KELAS tersebut secara berimbang dan proporsional (tidak boleh menumpuk semuanya di satu kelas saja, misalnya Kelas 1 dapat 10 TP sedangkan Kelas 2 dapat 0 TP. Bagi secara merata, misalnya 5-5 atau 6-4 berdasarkan kompleksitas materi).
   - Jika Fase terdiri dari 3 kelas (Fase D), seluruh TP harus dibagi ke dalam KETIGA KELAS (7, 8, dan 9) secara proporsional.
   - Setiap kelas harus memperoleh rangkaian TP yang utuh dan berkesinambungan agar pembelajaran berjalan efektif.

3. DUKUNG PERKEMBANGAN KOMPETENSI (SEKUENS LOGIS):
   Urutan TP dalam ATP harus disusun secara runtut mengikuti perkembangan kompetensi peserta didik, bergerak dari tingkat yang lebih sederhana/mudah menuju yang lebih kompleks/sulit (materi dasar ditempatkan pada kelas awal dalam fase tersebut, sedangkan materi lanjutan ditempatkan di kelas berikutnya).

4. DISTRIBUSI ELEMEN SECARA BERIMBANG:
   - Seluruh elemen CP yang terdapat dalam daftar TP di atas harus terwakili dalam ATP.
   - Usahakan agar SETIAP KELAS memuat TP yang berasal dari SETIAP ELEMEN CP yang relevan. Jangan sampai ada kelas yang hanya berisi TP dari satu elemen saja sementara elemen lain baru muncul semuanya di kelas berikutnya (kecuali jika struktur kurikulum/CP mata pelajaran tersebut memang mengharuskannya). Ini menjamin kesinambungan pembelajaran antarkelas.

5. DETAIL PENDUKUNG LAINNYA:
   - Perkiraan JP: Tentukan alokasi waktu yang realistis dan proporsional untuk masing-masing TP (angka saja, misal 2, 4, 6 JP).
   - Topik: Tentukan topik utama atau pokok bahasan materi secara ringkas dan komunikatif.
   - Glosarium: Sertakan istilah-istilah penting atau kata kunci beserta penjelasan ringkasnya untuk mendukung pemahaman TP tersebut.

PROSES VALIDASI INTERNAL (LAKUKAN SEBELUM MENGIRIMKAN HASIL):
- Apakah 100% TP telah digunakan tepat satu kali tanpa ada yang terlewat atau digandakan? (Panjang array wajib = ${selectedTps.length})
- Apakah redaksi seluruh TP sama persis dengan input?
- Apakah distribusi kelas di Fase ${fase} sudah proporsional untuk semua kelas yang tercakup?
- Apakah urutan TP sudah membentuk alur pembelajaran yang logis dari mudah ke sulit?
- Apakah seluruh elemen CP terwakili dengan seimbang di tiap kelas?

Kembalikan output JSON yang memiliki daftar 'items', di mana setiap item mengandung:
- elemen (string, nama Elemen yang sesuai dari TP asal)
- cp (string, isi Capaian Pembelajaran (CP) asli yang bersesuaian dengan TP ini)
- tujuanPembelajaran (string, isi Tujuan Pembelajaran asli yang SAMA PERSIS dengan input)
- kelas (string, nomor kelas berupa angka saja misal "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", atau "12" sesuai ketentuan Fase di atas)
- perkiraanJam (integer angka saja, misal 2, 4, 6, dst)
- topik (string, topik utama pembahasan)
- glosarium (string, istilah penting pendukung)
`;

  const responseSchema = {
    type: "OBJECT",
    properties: {
      items: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            elemen: { type: "STRING" },
            cp: { type: "STRING" },
            tujuanPembelajaran: { type: "STRING" },
            kelas: { type: "STRING" },
            perkiraanJam: { type: "INTEGER" },
            topik: { type: "STRING" },
            glosarium: { type: "STRING" },
          },
          required: ["elemen", "cp", "tujuanPembelajaran", "kelas", "perkiraanJam", "topik", "glosarium"],
        },
      },
    },
    required: ["items"],
  };

  const jsonStr = await fetchGenerate(prompt, systemInstruction, responseSchema, config);
  return JSON.parse(jsonStr);
};

// 4. PROTA Generator from ATP list
export const generatePROTA = async (
  fase: string,
  mapel: string,
  kelas: string,
  atpItems: any[],
  weeksEffective: number, // from calendar
  config?: AICallConfig
): Promise<any> => {
  const systemInstruction = "Anda adalah pakar kurikulum dan penyusun Program Tahunan (PROTA) Kurikulum Merdeka Kemendikbudristek Indonesia yang sangat andal dan presisi.";
  const prompt = `
Mata Pelajaran: ${mapel}
Fase: ${fase}
Kelas: ${kelas}
Jumlah Minggu Efektif dalam Setahun Ajaran: ${weeksEffective} minggu.

Berikut adalah daftar lengkap Alur Tujuan Pembelajaran (ATP) yang telah disusun untuk Kelas ${kelas}:
${atpItems.map((atp, idx) => `${idx + 1}. [Elemen: ${atp.elemen || "-"}][CP: ${atp.cp || "-"}] TP: ${atp.tujuanPembelajaran} (Estimasi: ${atp.perkiraanJam || atp.alokasiWaktu || 2} JP, Topik: ${atp.topik || "-"})`).join("\n")}

Tugas Anda adalah mendistribusikan daftar ATP di atas ke dalam Semester 1 (Ganjil) dan Semester 2 (Genap) dengan mematuhi ketentuan mutlak berikut:

KETENTUAN UTAMA PENYUSUNAN PROTA:
1. 100% DATA TERGUNA & UTUH (SANGAT KRITIS):
   - Gunakan SELURUH item ATP di atas sebagai sumber penyusunan PROTA.
   - JANGAN menghapus, melewatkan, meringkas, atau mengabaikan satu pun ATP/TP.
   - JANGAN membuat ATP/TP baru di luar daftar di atas.
   - JANGAN menggabungkan beberapa ATP/TP menjadi satu.
   - JANGAN mengubah redaksi, kata-kata, atau substansi dari 'tujuanPembelajaran' asli. Teks 'tujuanPembelajaran' di output harus sama persis dengan input.
   - Setiap ATP/TP hanya boleh diletakkan TEPAT SATU KALI pada satu semester (tidak boleh duplikasi atau diulang di kedua semester).
   - Jumlah total objek dalam array 'items' di output JSON hasil generate Anda harus SAMA PERSIS dengan jumlah ATP input (yaitu sebanyak ${atpItems.length} item).

2. DISTRIBUSI SEMESTER YANG PROPORSIONAL DAN PEDAGOGIS:
   - Distribusikan seluruh ATP ke dalam Semester 1 dan Semester 2 secara proporsional.
   - Urutan pembelajaran harus mengikuti perkembangan kompetensi secara logis: materi dasar atau yang lebih sederhana ditempatkan di Semester 1, sedangkan materi lanjutan, aplikasi, atau yang lebih kompleks didistribusikan ke Semester 2.
   - Beban belajar (alokasi waktu JP) antara Semester 1 dan Semester 2 harus seimbang secara realistis (misalnya, total JP semester 1 berkisar antara 45% - 55% dari total JP setahun, disesuaikan dengan proporsi jumlah minggu efektif).

3. WAJIB ADA SEMUA ELEMEN/CP DI SETIAP SEMESTER SECARA PROPORSIONAL:
   - SETIAP SEMESTER (Semester 1 DAN Semester 2) WAJIB memuat Capaian Pembelajaran (CP) / Elemen yang ada dalam daftar ATP di atas secara proporsional.
   - JANGAN biarkan ada Elemen/CP yang hanya muncul di salah satu semester saja (kecuali jika suatu Elemen/CP memang hanya memiliki total 1 TP di seluruh daftar ATP).
   - Jika suatu Elemen/CP memiliki 2 atau lebih TP, distribusikan TP tersebut ke Semester 1 dan Semester 2 secara berimbang dan proporsional (misalnya, jika memiliki 4 TP, letakkan 2 TP di Semester 1 dan 2 TP di Semester 2; jika memiliki 3 TP, letakkan 1 atau 2 TP di Semester 1, dan sisanya di Semester 2 sesuai urutan logis kompetensi).
   - Ini penting agar seluruh kompetensi dan elemen dapat diajarkan secara berkesinambungan dan seimbang sepanjang tahun, tanpa ada satu pun elemen yang kosong/absen di salah satu semester.
   - Ingat: Keberadaan elemen pada kedua semester dicapai melalui distribusi TP yang berbeda dari elemen tersebut, BUKAN dengan mengulang TP yang sama!

PROSES VALIDASI INTERNAL (WAJIB LAKUKAN SEBELUM KEMBALI):
- Apakah total jumlah item output (${atpItems.length}) tepat sama dengan total input?
- Apakah setiap tujuanPembelajaran memiliki nilai semester ("1" atau "2") yang tepat?
- Apakah urutan TP tetap logis dan tidak diacak secara tidak perlu?
- Apakah total JP antara Semester 1 dan Semester 2 berimbang?
- Apakah SETIAP SEMESTER (Semester 1 dan Semester 2) sudah memuat seluruh Elemen/CP secara proporsional sesuai ketentuan di atas?

Kembalikan output JSON dengan properti 'items' yang berisi daftar objek dengan bidang:
- elemen (string, Elemen terkait dari TP asal)
- cp (string, Capaian Pembelajaran terkait dari TP asal)
- tujuanPembelajaran (string, isi Tujuan Pembelajaran asli yang SAMA PERSIS dengan input)
- alokasiWaktu (integer angka saja, JP)
- semester (string, bernilai "1" atau "2")
- topik (string, topik bahasan materi)
`;

  const responseSchema = {
    type: "OBJECT",
    properties: {
      items: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            elemen: { type: "STRING" },
            cp: { type: "STRING" },
            tujuanPembelajaran: { type: "STRING" },
            alokasiWaktu: { type: "INTEGER" },
            semester: { type: "STRING" },
            topik: { type: "STRING" },
          },
          required: ["elemen", "cp", "tujuanPembelajaran", "alokasiWaktu", "semester", "topik"],
        },
      },
    },
    required: ["items"],
  };

  const jsonStr = await fetchGenerate(prompt, systemInstruction, responseSchema, config);
  return JSON.parse(jsonStr);
};

// 5. PROSEM Generator from PROTA
export const generatePROSEM = async (
  semester: "1" | "2",
  mapel: string,
  fase: string,
  kelas: string,
  protaItems: any[],
  months: string[],
  calendarInfo?: string,
  scheduleInfo?: string,
  jpPerMinggu?: number,
  config?: AICallConfig
): Promise<any> => {
  const systemInstruction = "Anda adalah perencana Program Semester (PROSEM) Kurikulum Merdeka yang sangat andal, efisien, dan presisi.";
  const prompt = `
Susun pemetaan minggu pelaksanaan untuk Program Semester (PROSEM) Semester ${semester}.
Mata Pelajaran: ${mapel}
Fase: ${fase}
Kelas: ${kelas}

INFORMASI KALENDER PENDIDIKAN:
${calendarInfo || "Tidak ada rincian kalender spesifik. Asumsikan minggu-minggu efektif penuh."}

INFORMASI JADWAL PELAJARAN / ALOKASI JP:
- Jumlah JP per minggu: ${jpPerMinggu || 4} JP
${scheduleInfo ? `Rincian Jadwal Mengajar:\n${scheduleInfo}` : ""}

Bulan-bulan dalam Semester ini yang WAJIB digunakan sebagai kunci minggu: ${months.join(", ")}
Daftar Program Tahunan (PROTA) yang harus dipetakan berurutan ke minggu-minggu efektif (Asumsi ada 4 minggu per bulan, contoh: "${months[0]}-1", "${months[0]}-2", dst):
${protaItems.map((p, i) => `${i + 1}. [TP] ${p.tujuanPembelajaran} | Alokasi: ${p.alokasiWaktu} JP`).join("\n")}

Tugas Anda:
1. Distribusikan materi (TP) ke dalam minggu-minggu efektif secara berurutan dan runtut (dari TP pertama ke terakhir) sepanjang bulan-bulan di semester ini.
2. Sesuaikan dengan "Jumlah JP per minggu" yang diampu. Berapa minggu yang dibutuhkan suatu TP setara dengan "Alokasi TP / Jumlah JP per minggu".
   - Contoh: Jika TP membutuhkan 8 JP, dan JP per minggu adalah 4 JP, maka ceklis (true) TP ini pada 2 minggu berurutan.
3. SANGAT PENTING: Perhatikan hari libur dan pekan tidak efektif dari KALENDER PENDIDIKAN (seperti libur semester, libur nasional, jeda semester, atau minggu tidak efektif yang disebutkan). JANGAN memberikan tanda ceklis (true) pada minggu-minggu libur atau tidak efektif tersebut! Lewati (skip) minggu tersebut dan lanjutkan pembagian pada minggu efektif berikutnya.
4. Nilai 'weeks' bertipe boolean true jika diajarkan di minggu tersebut, false jika tidak.

SANGAT PENTING:
1. Anda HARUS mengembalikan objek pemetaan untuk SETIAP DAN SEMUA Tujuan Pembelajaran (TP) yang tercantum dalam daftar Program Tahunan (PROTA) di atas tanpa terkecuali. Jika ada N butir TP dalam daftar di atas, maka 'items' dalam JSON respons wajib memiliki tepat N objek dengan properti 'index' bernilai 1 sampai N. Jangan kurangi, lewati, atau gabungkan butir TP!
2. Properti 'index' wajib berupa angka integer pencocokan indeks 1-based dari daftar program tahunan di atas (misal: 1, 2, 3, dst).
3. Untuk objek 'weeks', kunci objek HARUS ditulis dengan format exact "NamaBulan-Minggu" menggunakan nama bulan dari daftar di atas secara presisi (contoh: "${months[0]}-1", "${months[0]}-2", "${months[1]}-3"). Nilai bertipe boolean true jika diajarkan di minggu tersebut, false jika tidak.
`;

  const responseSchema = {
    type: "OBJECT",
    properties: {
      items: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            index: { type: "INTEGER" },
            weeks: {
              type: "OBJECT",
              additionalProperties: { type: "BOOLEAN" },
            },
          },
          required: ["index", "weeks"],
        },
      },
    },
    required: ["items"],
  };

  const jsonStr = await fetchGenerate(prompt, systemInstruction, responseSchema, config);
  const data = JSON.parse(jsonStr);

  // Reconstruct full items array using the indices and matching protaItems to maintain 100% compatibility with UI code
  const reconstructedItems = data.items.map((item: any, idx: number) => {
    // index is 1-based from prompt
    const targetIdx = (typeof item.index === "number") ? item.index - 1 : idx;
    const matchingProta = protaItems[targetIdx] || protaItems[idx] || protaItems[0];
    
    return {
      atpId: matchingProta?.atpId || `prosem-atp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
      cp: matchingProta?.cp || "",
      elemen: matchingProta?.elemen || "",
      tujuanPembelajaran: matchingProta?.tujuanPembelajaran || `Tujuan Pembelajaran ${targetIdx + 1}`,
      alokasiWaktu: matchingProta?.alokasiWaktu || 2,
      weeks: item.weeks || {}
    };
  });

  return { items: reconstructedItems };
};

// 6. Complete RPP Mendalam (Deep Lesson Plan) Generator
export const generateRPPMendalam = async (
  inputData: {
    namaSekolah: string;
    mapel: string;
    fase: string;
    kelas: string;
    semester: string;
    tahunPelajaran: string;
    alokasiWaktu: string;
    pertemuan: string;
    cp: string;
    materi: string;
    tujuanPembelajaran: string;
    profilLulusan: string[];
    kearifanLokal?: string;
    modelPembelajaran: string;
    metodePembelajaran: string;
  },
  config?: AICallConfig
): Promise<any> => {
  const systemInstruction = "Anda adalah pakar pendidik dan perumus RPP/Modul Ajar Pembelajaran Mendalam (Deep Learning: Berkesadaran, Bermakna, dan Menggembirakan) yang sangat rinci dan profesional.";
  
  const prompt = `
Susunlah Rencana Pelaksanaan Pembelajaran (RPP) Mendalam yang sangat lengkap berdasarkan data berikut:
- Satuan Pendidikan / Sekolah: ${inputData.namaSekolah}
- Mata Pelajaran: ${inputData.mapel}
- Fase / Kelas / Semester: ${inputData.fase} / Kelas ${inputData.kelas} / Semester ${inputData.semester}
- Tahun Pelajaran: ${inputData.tahunPelajaran}
- Alokasi Waktu: ${inputData.alokasiWaktu}
- Jumlah Pertemuan: ${inputData.pertemuan} Pertemuan
- Capaian Pembelajaran (CP): ${inputData.cp}
- Materi Pokok: ${inputData.materi}
- Tujuan Pembelajaran (TP): ${inputData.tujuanPembelajaran}
- 8 Profil Lulusan (Minimal 2): ${inputData.profilLulusan.join(", ")}
- Integrasi Kearifan Lokal: ${inputData.kearifanLokal || "Tidak ada khusus"}
- Model Pembelajaran: ${inputData.modelPembelajaran}
- Metode Pembelajaran: ${inputData.metodePembelajaran}

Persyaratan Khusus:
1. Deskripsi kegiatan pembelajaran harus PANJANG, RINCI, saling berkaitan erat, dan mengintegrasikan prinsip Pembelajaran Mendalam (berkesadaran/mindful, bermakna/meaningful, dan menggembirakan/joyful).
2. SANGAT PENTING: Jika kearifan lokal diisi ("${inputData.kearifanLokal || ""}"), integrasikan secara nyata dan aktif ke dalam pengalaman/langkah kegiatan pembelajaran di kelas dengan menghubungkannya secara logis dengan materi/topik yang diajarkan (sebagai contoh, guru menjelaskan makna pepatah/nilai tersebut sebagai sikap yang diterapkan selama proses belajar atau penugasan). Kearifan lokal ini CUKUP diintegrasikan secara kontekstual di dalam deskripsi langkah kegiatan pembelajaran, dan TIDAK PERLU ditulis ulang sebagai bagian terpisah/bagian independen di dalam output RPP.
3. Sesuaikan sintaks pembelajaran dengan model pembelajaran yang dipilih (contoh: PBL, PjBL, Discovery Learning, Inquiry, Cooperative Learning, dst).
4. Kolom "Sintaks" di tabel kegiatan pembelajaran harus secara otomatis sesuai dengan langkah-langkah formal dari Model yang dipilih.
5. Buatlah isi media pembelajaran, alat/bahan, sumber belajar, rencana pengayaan, rencana remedial, refleksi guru, refleksi siswa, serta isi lampiran secara komprehensif. Khusus untuk bagian 'evaluasi' (sebagai pengganti asesmen), buatlah evaluasi pembelajaran komprehensif yang berisi: (a) Kisi-kisi soal yang selaras dengan tujuan pembelajaran, (b) Soal minimal 5 butir berbentuk essay atau isian singkat mengenai materi yang telah dipelajari, dan (c) Kunci jawaban lengkap beserta pembahasannya. SANGAT PENTING: Pada bagian 'lampiran', WAJIB isi secara lengkap, terstruktur, dan sangat rinci dengan menyertakan 4 komponen berikut: (1) LKPD (Lembar Kerja Peserta Didik) yang selaras dengan soal evaluasi, (2) Instrumen Asesmen: mencakup kisi-kisi dan instrumen asesmen formatif awal (diagnostik) maupun sumatif beserta pedoman penskorannya, (3) Rubrik Penilaian: panduan terperinci untuk mengukur capaian siswa dalam kegiatan pemecahan masalah atau berbasis proyek, (4) Materi Ajar / Bahan Bacaan: rangkuman materi, artikel, atau media sumber yang relevan dengan topik kontekstual. Jangan meringkas atau mengosongkan bagian-bagian ini, buatlah sedetail mungkin agar siap digunakan guru di kelas.
6. SANGAT PENTING: Pada deskripsi kegiatan pembelajaran (di dalam 'sintaksTable.deskripsi'), setiap urutan langkah kegiatan guru dan siswa WAJIB ditulis dengan menggunakan format penomoran yang jelas (misalnya: 1., 2., 3., dst.) agar alur pengalaman belajar terlihat terstruktur, rapi, dan mudah dipahami. Jangan menulis seluruh deskripsi dalam satu paragraf panjang tanpa penomoran.
7. SANGAT PENTING: Sesuaikan jumlah kegiatan di dalam 'sintaksTable' dengan jumlah pertemuan yang diinputkan (yaitu ${inputData.pertemuan} Pertemuan).
   - Jika Jumlah Pertemuan adalah 1, buatlah 5 baris tahap pembelajaran standar ('Pendahuluan', 'Kegiatan Inti - Memahami', 'Kegiatan Inti - Mengaplikasi', 'Kegiatan Inti - Merefleksi', dan 'Penutup').
   - Jika Jumlah Pertemuan lebih dari 1 (misalnya N Pertemuan, dengan N maksimal 6), maka 'sintaksTable' WAJIB di-generate secara lengkap berurutan dari Pertemuan 1 sampai Pertemuan N. Setiap pertemuan memiliki rangkaian 5 tahap tersebut secara lengkap (total N x 5 baris). Untuk membedakannya, nilai field 'tahap' harus diawali dengan informasi pertemuan, contoh: 'Pertemuan 1 - Pendahuluan', 'Pertemuan 1 - Kegiatan Inti - Memahami', 'Pertemuan 1 - Kegiatan Inti - Mengaplikasi', 'Pertemuan 1 - Kegiatan Inti - Merefleksi', 'Pertemuan 1 - Penutup', kemudian lanjut ke 'Pertemuan 2 - Pendahuluan', dst sampai 'Pertemuan N - Penutup'.

Kembalikan output dalam bentuk JSON terstruktur yang berisi seluruh kolom RPP yang diperlukan.
Output JSON harus memiliki kunci-kunci berikut:
- cp (string)
- materi (string)
- tujuanPembelajaran (string)
- profilLulusan (array of string)
- kearifanLokal (string, samakan dengan input kearifan lokal yang diberikan atau dihaluskan)
- modelPembelajaran (string)
- metodePembelajaran (string)
- glosarium (string, berisi istilah-istilah penting berserta definisinya terkait materi yang diajarkan)
- kesiapanPesertaDidik (string, memetakan tingkat pemahaman kesiapan peserta didik serta strategi atau asesmen diagnostik singkat yang digunakan untuk menyesuaikan pembelajaran)
- mediaPembelajaran (string, jelaskan media yang seru)
- alatPembelajaran (string, rincian alat/bahan)
- sumberBelajar (string, daftar buku/link/ref)
- evaluasi (string, berisi evaluasi lengkap dengan kisi-kisi soal, minimal 5 butir soal berbentuk essay atau isian singkat, dan kunci jawaban lengkap beserta pembahasannya mengenai materi yang dipelajari)
- pengayaan (string, rencana pengayaan)
- remedial (string, rencana remedial)
- refleksiGuru (string, pertanyaan reflektif untuk guru)
- refleksiSiswa (string, pertanyaan reflektif untuk siswa)
- lampiran (string, berisi 4 komponen wajib secara rinci: (1) LKPD yang selaras dengan soal evaluasi, (2) Instrumen Asesmen formatif awal/diagnostik & sumatif beserta pedoman penskoran, (3) Rubrik Penilaian terperinci untuk pemecahan masalah atau proyek, (4) Materi Ajar / Bahan Bacaan pendukung yang kontekstual)
- sintaksTable: daftar objek, setiap objek mewakili tahapan RPP, memiliki bidang:
  * tahap (string, harus berupa nama tahapan yang diawali dengan informasi pertemuan jika Jumlah Pertemuan > 1, contoh: "Pertemuan 1 - Pendahuluan", atau jika hanya 1 pertemuan cukup "Pendahuluan", "Kegiatan Inti - Memahami", "Kegiatan Inti - Mengaplikasi", "Kegiatan Inti - Merefleksi", atau "Penutup")
  * sintaks (string, nama tahapan sintaks model pembelajaran, misal "Orientasi Siswa pada Masalah" untuk PBL)
  * deskripsi (string, deskripsi panjang, rinci, berkesadaran, bermakna, menggembirakan yang mengintegrasikan kearifan lokal secara eksplisit jika diberikan, dan WAJIB ditulis dengan menggunakan format penomoran berangka 1, 2, 3, dst untuk tiap langkah/tahapan aktivitas)
  * alokasi (string, misal "15 Menit")
`;

  const responseSchema = {
    type: "OBJECT",
    properties: {
      cp: { type: "STRING" },
      materi: { type: "STRING" },
      tujuanPembelajaran: { type: "STRING" },
      profilLulusan: {
        type: "ARRAY",
        items: { type: "STRING" },
      },
      kearifanLokal: { type: "STRING" },
      modelPembelajaran: { type: "STRING" },
      metodePembelajaran: { type: "STRING" },
      glosarium: { type: "STRING" },
      kesiapanPesertaDidik: { type: "STRING" },
      mediaPembelajaran: { type: "STRING" },
      alatPembelajaran: { type: "STRING" },
      sumberBelajar: { type: "STRING" },
      evaluasi: { type: "STRING" },
      pengayaan: { type: "STRING" },
      remedial: { type: "STRING" },
      refleksiGuru: { type: "STRING" },
      refleksiSiswa: { type: "STRING" },
      lampiran: { type: "STRING" },
      sintaksTable: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            tahap: { type: "STRING" },
            sintaks: { type: "STRING" },
            deskripsi: { type: "STRING" },
            alokasi: { type: "STRING" },
          },
          required: ["tahap", "sintaks", "deskripsi", "alokasi"],
        },
      },
    },
    required: [
      "cp",
      "materi",
      "tujuanPembelajaran",
      "profilLulusan",
      "modelPembelajaran",
      "metodePembelajaran",
      "glosarium",
      "kesiapanPesertaDidik",
      "mediaPembelajaran",
      "alatPembelajaran",
      "sumberBelajar",
      "evaluasi",
      "pengayaan",
      "remedial",
      "refleksiGuru",
      "refleksiSiswa",
      "lampiran",
      "sintaksTable",
    ],
  };

  const jsonStr = await fetchGenerate(prompt, systemInstruction, responseSchema, config);
  return JSON.parse(jsonStr);
};

// 7. Consistency Checker
export const checkCurriculumConsistency = async (
  tpList: string[],
  atpList: string[],
  protaList: string[],
  rppList: string[],
  config?: AICallConfig
): Promise<string> => {
  const systemInstruction = "Anda adalah auditor kurikulum sekolah nasional. Mengevaluasi tingkat keselarasan dan konsistensi antar seluruh dokumen perencanaan.";
  const prompt = `
Periksalah konsistensi dan keselarasan antar perangkat pembelajaran berikut ini:

1. Daftar Tujuan Pembelajaran (TP):
${tpList.map((tp, idx) => `- ${tp}`).join("\n")}

2. Alur Tujuan Pembelajaran (ATP):
${atpList.map((atp, idx) => `- ${atp}`).join("\n")}

3. Program Tahunan (PROTA):
${protaList.map((pro, idx) => `- ${pro}`).join("\n")}

4. Rencana Pelaksanaan Pembelajaran (RPP):
${rppList.map((r, idx) => `- ${r}`).join("\n")}

Tugas Anda:
Analisislah apakah ada TP, ATP, PROTA, dan RPP yang tidak sejalan, tidak konsisten, atau terputus alurnya. Berikan ringkasan kesimpulan dalam bahasa Indonesia yang profesional beserta persentase skor keselarasan (misal: "Konsistensi Alur: 95%") dan saran konstruktif yang spesifik agar guru dapat memperbaikinya.
`;

  return await fetchGenerate(prompt, systemInstruction, undefined, config);
};

// 8. Generate Specific Lampiran (LKPD, Rubrik, Asesmen, Bahan Bacaan) Separately
export const generateIndividualLampiran = async (
  rpp: {
    mapel: string;
    fase: string;
    kelas: string;
    semester: string;
    materi: string;
    tujuanPembelajaran: string;
    modelPembelajaran: string;
    kearifanLokal?: string;
  },
  lampiranType: "LKPD" | "Asesmen" | "Rubrik" | "Bahan Bacaan",
  config?: AICallConfig
): Promise<string> => {
  const systemInstruction = `Anda adalah asisten AI Kurikulum Merdeka yang ahli dalam merancang lampiran pembelajaran mendalam (Deep Learning). Tugas Anda adalah membuat dokumen lampiran tipe "${lampiranType}" secara MANDIRI, TERPISAH, LENGKAP, dan SIAP CETAK tanpa rangkuman atau teks placeholder.`;

  let promptFocus = "";
  if (lampiranType === "LKPD") {
    promptFocus = `
Buatlah Lembar Kerja Peserta Didik (LKPD) yang menarik dan menantang, terdiri dari:
1. Judul Kegiatan LKPD yang seru dan kontekstual.
2. Identitas LKPD (Mata Pelajaran, Fase/Kelas, Materi).
3. Petunjuk Belajar untuk Siswa.
4. Tujuan Aktivitas Pembelajaran.
5. Langkah Kegiatan (Berbasis Pembelajaran Mendalam, kaitkan dengan Kearifan Lokal jika ada).
6. Pertanyaan Pemantik / Eksplorasi yang menantang berpikir kritis siswa.
7. Tugas Mandiri atau Kelompok yang kreatif (misalnya mengamati, mendiskusikan, atau membuat sesuatu sederhana).
8. Kolom refleksi singkat bagi siswa.`;
  } else if (lampiranType === "Asesmen") {
    promptFocus = `
Buatlah Dokumen Instrumen Asesmen & Kisi-Kisi Evaluasi, yang terdiri dari:
1. Kisi-Kisi Soal Evaluasi (Tujuan Pembelajaran, Indikator Soal, Bentuk Soal).
2. Asesmen Diagnostik Awal (minimal 3 pertanyaan pemantik kesiapan belajar siswa).
3. Asesmen Formatif (aktivitas penilaian selama proses pembelajaran, misalnya observasi diskusi).
4. Asesmen Sumatif Akhir: minimal 5 butir soal esai atau isian singkat yang berkualitas tinggi (tidak sekadar hafalan, melainkan mengukur pemahaman mendalam).
5. Kunci Jawaban Lengkap dan Pembahasan mendalam untuk setiap soal.
6. Pedoman Penskoran yang jelas dan objektif.`;
  } else if (lampiranType === "Rubrik") {
    promptFocus = `
Buatlah Rubrik Penilaian Kinerja, terdiri dari:
1. Penjelasan aspek-aspek yang dinilai (misalnya: Pemahaman Konsep, Keterampilan Kolaborasi, Kreativitas, Integrasi Kearifan Lokal, Kemampuan Komunikasi).
2. Tabel kriteria skor terperinci (Skor 4: Sangat Baik, Skor 3: Baik, Skor 2: Cukup, Skor 1: Perlu Bimbingan). Setiap deskriptor dalam tabel wajib diuraikan secara konkret dan tidak abstrak.
3. Lembar Lembar Penilaian Kinerja Kelas (Format penilaian tabel sederhana).
4. Catatan masukan umpan balik konstruktif bagi siswa.`;
  } else {
    promptFocus = `
Buatlah Materi Ajar & Bahan Bacaan Guru dan Siswa, terdiri dari:
1. Rangkuman Materi Pokok yang komprehensif, disajikan dengan bahasa yang asyik, informatif, dan mendalam.
2. Artikel Pendukung atau studi kasus kontekstual (menghubungkan teori dengan kearifan lokal daerah jika ada).
3. Glosarium istilah-istilah penting beserta definisinya secara runtut.
4. Pertanyaan Reflektif untuk memperdalam pemahaman bacaan.
5. Referensi / Daftar Pustaka sederhana.`;
  }

  const prompt = `
Silakan buat dokumen "${lampiranType}" secara terperinci untuk mata pelajaran "${rpp.mapel}" dengan detail RPP sebagai berikut:
- Fase / Kelas: ${rpp.fase} / Kelas ${rpp.kelas}
- Semester: Semester ${rpp.semester}
- Materi Pokok: ${rpp.materi}
- Tujuan Pembelajaran (TP):
${rpp.tujuanPembelajaran}
- Model Pembelajaran: ${rpp.modelPembelajaran}
- Integrasi Kearifan Lokal: ${rpp.kearifanLokal || "Tidak ada khusus"}

Fokus Pembuatan:
${promptFocus}

Ketentuan Format Output:
1. Gunakan format Markdown yang rapi dengan heading (#, ##, ###), bullet points, dan penomoran.
2. Seluruh isi harus ditulis lengkap dalam bahasa Indonesia yang ramah, profesional, dan inspiratif.
3. Hindari memberikan placeholder seperti "[Isi di sini]" atau "[Lengkapi sendiri]". Tuliskan semua data, contoh soal, kriteria, dan penjelasan secara nyata dan siap pakai.
`;

  return await fetchGenerate(prompt, systemInstruction, undefined, config);
};


// // 9. Generate LKPD Pembelajaran based on RPP Mendalam Syntax & Activities
export const generateLkpdPembelajaran = async (
  rpp: {
    mapel: string;
    fase: string;
    kelas: string;
    semester: string;
    tahunPelajaran: string;
    materi: string;
    tujuanPembelajaran: string;
    modelPembelajaran: string;
    mediaPembelajaran?: string;
    alatPembelajaran?: string;
    sintaksTable: { tahap: string; sintaks: string; deskripsi: string; alokasi: string }[];
    kearifanLokal?: string;
  },
  config?: AICallConfig
): Promise<string> => {
  const systemInstruction = "Anda adalah asisten AI Kurikulum Merdeka dan desainer instruksional kelas dunia yang mahir menyusun LKPD Pembelajaran ramah anak, mudah dicetak, modern, dan interaktif. Tugas utama Anda adalah mengubah sintaks dan aktivitas RPP Mendalam menjadi LKPD siswa yang siap pakai tanpa mengurangi atau mengubah isi aktivitas RPP.";

  const prompt = `
Buatlah Dokumen Lembar Kerja Peserta Didik (LKPD) Pembelajaran Mandiri/Kelompok yang sangat menarik, rapi, dan mudah dicetak berdasarkan data RPP Mendalam berikut:
- Mata Pelajaran: \${rpp.mapel}
- Fase / Kelas: \${rpp.fase} / Kelas \${rpp.kelas}
- Semester / Tahun Pelajaran: Semester \${rpp.semester} / \${rpp.tahunPelajaran}
- Materi Pokok: \${rpp.materi}
- Tujuan Pembelajaran (TP):
\${rpp.tujuanPembelajaran}
- Model Pembelajaran: \${rpp.modelPembelajaran}
- Media & Alat Belajar: \${rpp.mediaPembelajaran || "Disesuaikan"}, \${rpp.alatPembelajaran || "Disesuaikan"}
- Integrasi Kearifan Lokal: \${rpp.kearifanLokal || "Tidak ada khusus"}

Sintaks / Langkah Kegiatan Pembelajaran pada RPP:
\${rpp.sintaksTable.map(s => \`[Tahap: \${s.tahap} | Sintaks: \${s.sintaks} | Waktu: \${s.alokasi}] - Deskripsi: \${s.deskripsi}\`).join("\\n")}

Ketentuan Utama LKPD Pembelajaran:
1. SINKRONISASI 100% AKTIVITAS: Tuliskan kembali aktivitas belajar yang ada pada Sintaks RPP di atas ke dalam LKPD. Tentukan secara otomatis jenis aktivitas (Individu, Berpasangan, atau Kelompok) berdasarkan deskripsi kegiatannya di RPP. Jangan kurangi, ubah, atau hapus tahapan kegiatan dari RPP.
2. STRUKTUR LKPD (Wajib mengikuti struktur desain berikut):
   - **Header Identitas LKPD**: Judul besar "LEMBAR KERJA PESERTA DIDIK (LKPD) PEMBELAJARAN", Logo/Simbol imajiner, Mata Pelajaran, Kelas, Semester, Topik/Materi, Alokasi Waktu.
   - **Section A: Identitas Peserta Didik**: Sediakan kolom menuliskan (Nama Anggota Kelompok / Nama Peserta, No. Absen, Kelas, Tanggal). Gunakan format rapi dengan titik-titik (.....................................) agar mudah ditulis tangan.
   - **Section B: Tujuan Pembelajaran**: Tuliskan TP yang dicapai pada aktivitas ini sesuai RPP.
   - **Section C: Petunjuk Penggunaan & Alat Bahan**: Tuliskan alat & bahan yang dibutuhkan serta langkah umum mengerjakan LKPD dengan bahasa yang lugas dan ramah anak.
   - **Bagian 1: Memahami!**:
     * Sajikan orientasi masalah / pemantik sesuai sintaks awal RPP.
     * Ayo Belajar / Ayo Kita Amati [Topik]: Deskripsikan aktivitas inti siswa (berdasarkan deskripsi sintaks RPP).
     * Pertanyaan Pemahaman / Eksplorasi: Sediakan pertanyaan eksploratif yang menantang berpikir kritis siswa (4C).
     * **Cozy Workspace (Ruang Kerja Kreatif)**: Sediakan ruang kerja yang luas dan menarik dalam bentuk boks persegi berbingkai abu-abu/biru muda yang lembut dengan judul "[Ruang Berkreasi & Coretan Solusi]" agar siswa dapat menggambar, mencoret, atau menuliskan jawaban dengan leluasa.
   - **Tahap 3: Merefleksi (Menganalisis & Mengevaluasi)**:
     * Berkesadaran & Bermakna: Wajib sediakan area refleksi dengan 3 pertanyaan berikut persis tanpa diubah:
       1. "Hal baru apa yang kamu pelajari hari ini?"
       2. "Apa bagian yang paling sulit dari aktivitas hari ini?"
       3. "Bagaimana konsep yang kamu pelajari hari ini dapat membantu di kehidupan sehari-hari?"
   - **Penutup & Penilaian**:
     * **Cek Pemahaman Diriku**: Berupa tabel checklist sederhana bagi siswa untuk menilai kesiapan pemahamannya (Contoh: "Saya sudah paham cara...", pilihan: [Ya] [Perlu Belajar Lagi]).
     * **Signature Block (Paraf)**: Berbingkai indah berisi ruang untuk Catatan Guru, Kolom Nilai, Paraf Guru, dan Paraf Orang Tua.

Ketentuan Teknis Output:
1. Keluarkan output dalam format HTML murni yang elegan, rapi, dan modern yang kompatibel dengan Tiptap editor. Gunakan tag HTML standar seperti <h1>, <h2>, <h3>, <table>, <ul>, <ol>, <li>, <div>, dan style inline (warna biru muda lembut, abu-abu, padding longgar, border rounded, border-collapse, font-family sans-serif) agar LKPD tampak sangat indah dan rapi saat dicetak (print-friendly).
2. Tuliskan teks secara lengkap tanpa placeholder seperti "[Isi di sini]" or "[Lengkapi sendiri]". Semua pertanyaan, instruksi, dan ruang coretan harus dirancang siap pakai oleh siswa.
`;

  return await fetchGenerate(prompt, systemInstruction, undefined, config);
};


// 10. Generate LKPD Evaluasi based on RPP Mendalam Assessments
export const generateLkpdEvaluasi = async (
  rpp: {
    mapel: string;
    fase: string;
    kelas: string;
    semester: string;
    tahunPelajaran: string;
    materi: string;
    tujuanPembelajaran: string;
    evaluasi: string; // Assessment text from RPP
  },
  config?: AICallConfig
): Promise<string> => {
  const systemInstruction = "Anda adalah asisten AI Kurikulum Merdeka yang teliti dan mahir menyajikan instrumen evaluasi pembelajaran ke dalam format LKPD Evaluasi yang rapi, sistematis, dan siap cetak. Tugas Anda adalah melakukan penataan ulang (reformatting) evaluasi RPP tanpa membuat pertanyaan baru.";

  const prompt = `
Buatlah Dokumen Lembar Kerja Peserta Didik (LKPD) Evaluasi yang sangat menarik, rapi, dan mudah dicetak berdasarkan data RPP Mendalam berikut:
- Mata Pelajaran: \${rpp.mapel}
- Fase / Kelas: \${rpp.fase} / Kelas \${rpp.kelas}
- Semester / Tahun Pelajaran: Semester \${rpp.semester} / \${rpp.tahunPelajaran}
- Materi Pokok: \${rpp.materi}
- Tujuan Pembelajaran (TP):
\${rpp.tujuanPembelajaran}

Isi Evaluasi / Asesmen pada RPP Mendalam (Gunakan ini sebagai sumber soal):
---
\${rpp.evaluasi}
---

Ketentuan Utama LKPD Evaluasi:
1. DILARANG KERAS MEMBUAT SOAL BARU: Gunakan 100% pertanyaan evaluasi/asesmen yang tertera pada RPP Mendalam di atas. Tugas Anda adalah merestrukturisasi, menata ulang, dan merapikan pertanyaan-pertanyaan tersebut ke dalam format LKPD Evaluasi siswa yang siap pakai. Jika pada bagian evaluasi RPP tidak ada pertanyaan konkret (hanya deskripsi), barulah Anda boleh memformulasikan 5 butir soal evaluasi yang paling relevan dengan materi RPP tersebut secara komprehensif.
2. STRUKTUR LKPD EVALUASI (Wajib mengikuti struktur desain berikut):
   - **Header Identitas LKPD**: Judul besar "LEMBAR KERJA PESERTA DIDIK (LKPD) EVALUASI", Logo/Simbol, Mata Pelajaran, Kelas, Semester, Topik/Materi, Alokasi Waktu Ujian.
   - **Section A: Identitas Peserta Didik**: Sediakan kolom menuliskan (Nama Lengkap, No. Absen, Kelas, Tanggal). Gunakan format rapi dengan titik-titik (.....................................) agar mudah ditulis tangan.
   - **Section B: Tujuan Pembelajaran**: Tuliskan TP yang dievaluasi sesuai RPP.
   - **Section C: Petunjuk Pengerjaan**: Berisi instruksi ujian yang jelas, jujur, teliti, dan mandiri.
   - **Bagian Utama (Soal Evaluasi)**:
     * Sajikan soal-soal evaluasi dari RPP secara runtut dan bernomor rapi.
     * Di bawah setiap butir soal, wajib sediakan boks **Cozy Workspace (Kotak Jawaban)** yang dibatasi border tipis abu-abu/biru muda yang lembut dengan tulisan "[Lembar Jawaban Siswa]" agar siswa dapat menuliskan penyelesaiannya dengan rapi.
   - **Penutup & Penilaian**:
     * Sediakan tabel signature block yang elegan berisi ruang untuk Catatan Guru, Kolom Nilai, Paraf Guru, dan Paraf Orang Tua.

Ketentuan Teknis Output:
1. Keluarkan output dalam format HTML murni yang elegan, rapi, dan modern yang kompatibel dengan Tiptap editor. Gunakan tag HTML standar seperti <h1>, <h2>, <h3>, <table>, <ul>, <ol>, <li>, <div>, dan style inline (warna pastel lembut, border rounded, padding longgar, border-collapse, font-family sans-serif) agar tampak sangat indah dan rapi saat dicetak (print-friendly).
2. Tuliskan teks secara lengkap tanpa placeholder seperti "[Isi di sini]" atau "[Lengkapi sendiri]". Semua soal dan ruang jawaban harus siap pakai.
`;

  return await fetchGenerate(prompt, systemInstruction, undefined, config);
};

