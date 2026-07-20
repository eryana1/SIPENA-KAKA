import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Grid, 
  Download, 
  Save, 
  Loader2, 
  Check, 
  FolderSync, 
  AlertCircle,
  Sparkles,
  Printer,
  Zap,
  CheckCircle2
} from "lucide-react";
import { generatePROSEM } from "../lib/ai";
import { generatePROSEMDocx } from "../lib/docxGenerator";
import { uploadFileToDrive } from "../lib/drive";
import { PROSEMItem, PROSEMData, PROTAItem, ATPItem, Jenjang, Fase, CalendarData, JadwalItem } from "../types";

interface ProsemPanelProps {
  profile: any;
  savedProtas: PROTAItem[];
  savedAtps?: ATPItem[];
  prosemData: PROSEMData | null;
  calendarData?: CalendarData | null;
  schedule?: JadwalItem[];
  onSaveProsem: (data: PROSEMData) => Promise<void>;
  onLoadProta?: (ctx: { mapel: string; kelas: string; fase: Fase }) => Promise<void>;
  onLoadAtp?: (ctx: { mapel: string; kelas: string; fase: Fase }) => Promise<void>;
  onLoadProsem?: (ctx: { mapel: string; kelas: string; fase: Fase }) => Promise<void>;
  apiKey?: string;
  driveFolderId?: string;
  accessToken?: string | null;
}

const isSameKelas = (k1: string, k2: string): boolean => {
  if (!k1 || !k2) return false;
  const norm = (k: string) => {
    const val = k.trim().toUpperCase();
    const ROMAN_TO_ARABIC: { [key: string]: string } = {
      "I": "1", "II": "2", "III": "3", "IV": "4", "V": "5", "VI": "6",
      "VII": "7", "VIII": "8", "IX": "9", "X": "10", "XI": "11", "XII": "12"
    };
    return ROMAN_TO_ARABIC[val] || val;
  };
  return norm(String(k1)) === norm(String(k2));
};

const getDefaultKelasForFase = (currentFase: Fase) => {
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

export default function ProsemPanel({ 
  profile, 
  savedProtas, 
  savedAtps = [],
  prosemData, 
  calendarData,
  schedule,
  onSaveProsem, 
  onLoadProta,
  onLoadAtp,
  onLoadProsem,
  apiKey, 
  driveFolderId, 
  accessToken 
}: ProsemPanelProps) {
  const [semester, setSemester] = useState<"1" | "2">((profile.semester as any) || "1");
  const [mapel, setMapel] = useState("Bahasa Indonesia");
  const [fase, setFase] = useState<Fase>(profile.fase || Fase.A);
  const [kelas, setKelas] = useState(profile.kelas || "1");
  const [items, setItems] = useState<PROSEMItem[]>([]);
  const [jpPerMinggu, setJpPerMinggu] = useState<number>(4);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [msg, setMsg] = useState("");

  // Auto-detect JP per minggu from schedule matching subject and grade
  useEffect(() => {
    if (schedule && schedule.length > 0 && mapel && kelas) {
      const matching = schedule.filter(s => 
        s.mapel.toLowerCase().trim() === mapel.toLowerCase().trim() && 
        (s.kelas.toLowerCase().trim() === kelas.toLowerCase().trim() || 
         kelas.toLowerCase().includes(s.kelas.toLowerCase()) || 
         s.kelas.toLowerCase().includes(kelas.toLowerCase()))
      );
      if (matching.length > 0) {
        // Assume 2 JP per schedule slot by default, or fallback to length * 2
        setJpPerMinggu(matching.length * 2);
      } else {
        setJpPerMinggu(4);
      }
    }
  }, [schedule, mapel, kelas]);

  const semesterMonths = {
    "1": ["Juli", "Agustus", "September", "Oktober", "November", "Desember"],
    "2": ["Januari", "Februari", "Maret", "April", "Mei", "Juni"]
  };

  const currentMonths = semesterMonths[semester];

  const mapelPresets: { [key in Jenjang]: string[] } = {
    [Jenjang.SD]: [
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
    ],
    [Jenjang.SMP]: ["Bahasa Indonesia", "Matematika", "IPA", "IPS", "Bahasa Inggris", "Informatika", "Pendidikan Pancasila"],
    [Jenjang.SMA]: ["Bahasa Indonesia", "Matematika", "Fisika", "Kimia", "Biologi", "Sejarah", "Geografi", "Sosiologi", "Ekonomi", "Bahasa Inggris"]
  };

  const currentJenjang = profile.jenjang || Jenjang.SD;

  useEffect(() => {
    if (onLoadProta) {
      onLoadProta({ mapel, kelas, fase });
    }
    if (onLoadAtp) {
      onLoadAtp({ mapel, kelas, fase });
    }
    if (onLoadProsem) {
      onLoadProsem({ mapel, kelas, fase });
    }
  }, [mapel, kelas, fase, profile.tahunPelajaran, profile.semester]);

  useEffect(() => {
    if (prosemData) {
      const isStale = (
        prosemData.mapel?.toLowerCase() !== mapel.toLowerCase() ||
        !isSameKelas(prosemData.kelas, kelas) ||
        prosemData.fase !== fase ||
        String(prosemData.semester) !== String(semester)
      );

      if (!isStale) {
        const loadedItems = (prosemData.items || []).map(item => {
          const matchingProta = savedProtas.find(p => p.tujuanPembelajaran === item.tujuanPembelajaran);
          const matchingAtp = savedAtps.find(atp => atp.tujuanPembelajaran === item.tujuanPembelajaran);
          return {
            ...item,
            mapel: item.mapel || prosemData.mapel || "Bahasa Indonesia",
            semester: item.semester || prosemData.semester || "1",
            cp: item.cp || matchingProta?.cp || matchingAtp?.cp || "",
            elemen: item.elemen || matchingProta?.elemen || matchingAtp?.elemen || ""
          };
        });
        setItems(loadedItems);
      } else {
        setItems([]);
      }
    } else {
      setItems([]);
    }
  }, [prosemData, savedProtas, savedAtps, mapel, kelas, fase, semester]);

  // Reconcile and auto-initialize PROSEM items from PROTA dynamically, fallback to ATP if empty
  useEffect(() => {
    const targetMapel = mapel.toLowerCase().trim();
    const semesterProtas = savedProtas.filter(p => 
      p.mapel?.toLowerCase().trim() === targetMapel && 
      String(p.semester) === String(semester)
    );

    if (semesterProtas.length > 0) {
      setItems(prev => {
        const otherItems = prev.filter(item => !(item.mapel?.toLowerCase().trim() === targetMapel && String(item.semester) === String(semester)));
        const currentItems = prev.filter(item => item.mapel?.toLowerCase().trim() === targetMapel && String(item.semester) === String(semester));

        const seenAtpIds = new Set<string>();

        const reconciledItems: PROSEMItem[] = semesterProtas.map((prota, idx) => {
          const existing = currentItems.find(it => it.atpId === prota.atpId) || 
                           currentItems.find(it => it.tujuanPembelajaran === prota.tujuanPembelajaran);
          
          let candidateId = prota.atpId || existing?.atpId || `prosem-atp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
          
          if (seenAtpIds.has(candidateId)) {
            candidateId = `${candidateId}-dup-${idx}-${Math.random().toString(36).substring(2, 5)}`;
          }
          seenAtpIds.add(candidateId);

          const matchingAtp = savedAtps.find(atp => atp.tujuanPembelajaran === prota.tujuanPembelajaran);

          return {
            atpId: candidateId,
            mapel: mapel,
            semester: semester,
            cp: prota.cp || matchingAtp?.cp || existing?.cp || "",
            elemen: prota.elemen || matchingAtp?.elemen || existing?.elemen || "",
            tujuanPembelajaran: prota.tujuanPembelajaran,
            alokasiWaktu: prota.alokasiWaktu || 2,
            weeks: existing?.weeks || {}
          };
        });

        return [...otherItems, ...reconciledItems];
      });
    } else {
      // If there are no PROTA items, do NOT automatically wipe out existing items!
      // This preserves any previously loaded or AI-generated PROSEM items.
      setItems(prev => {
        const currentItems = prev.filter(item => item.mapel?.toLowerCase().trim() === targetMapel && String(item.semester) === String(semester));
        if (currentItems.length > 0) {
          return prev;
        }

        // Fallback to active ATP items if we have them, so the user sees their learning objectives
        const activeAtps = savedAtps.filter(atp => {
          if (atp.mapel?.toLowerCase().trim() !== targetMapel) return false;
          const atpKelas = atp.kelas || getDefaultKelasForFase(fase);
          return isSameKelas(atpKelas, kelas);
        });
        if (activeAtps.length > 0) {
          const fallbackItems: PROSEMItem[] = activeAtps.map((atp, idx) => ({
            atpId: atp.tpId || `prosem-atp-fallback-${idx}-${Math.random().toString(36).substring(2, 5)}`,
            mapel: mapel,
            semester: semester,
            cp: atp.cp || "",
            elemen: atp.elemen || "",
            tujuanPembelajaran: atp.tujuanPembelajaran,
            alokasiWaktu: atp.perkiraanJam || 2,
            weeks: {}
          }));
          const otherItems = prev.filter(item => !(item.mapel?.toLowerCase().trim() === targetMapel && String(item.semester) === String(semester)));
          return [...otherItems, ...fallbackItems];
        }

        return prev;
      });
    }
  }, [mapel, semester, savedProtas, savedAtps]);

  useEffect(() => {
    if (mapelPresets[currentJenjang] && !mapelPresets[currentJenjang].includes(mapel) && mapel !== "") {
      setMapel(mapelPresets[currentJenjang][0]);
    }
  }, [currentJenjang]);

  const displayedItems = items.filter(item => item.mapel?.toLowerCase().trim() === mapel.toLowerCase().trim() && String(item.semester) === String(semester));

  // Validation
  const targetMapelVal = mapel.toLowerCase().trim();
  const semesterProtasVal = savedProtas.filter(p => 
    p.mapel?.toLowerCase().trim() === targetMapelVal && 
    String(p.semester) === String(semester)
  );
  const hasProta = semesterProtasVal.length > 0;
  const countMismatch = displayedItems.length > 0 && semesterProtasVal.length !== displayedItems.length;
  const missingProtaFromProsem = semesterProtasVal.filter(p => 
    !displayedItems.some(item => 
      (item.tujuanPembelajaran || "").toLowerCase().trim() === (p.tujuanPembelajaran || "").toLowerCase().trim()
    )
  );
  const isProsemValid = hasProta && displayedItems.length > 0 && !countMismatch && missingProtaFromProsem.length === 0;

  const handleLoadProtaManual = () => {
    const targetMapel = mapel.toLowerCase().trim();
    let semesterProtas = savedProtas.filter(p => 
      p.mapel?.toLowerCase().trim() === targetMapel && 
      String(p.semester) === String(semester)
    );

    if (semesterProtas.length === 0) {
      // Fallback to active ATP items if PROTA is empty
      const activeAtps = savedAtps.filter(atp => {
        if (atp.mapel?.toLowerCase().trim() !== targetMapel) return false;
        const atpKelas = atp.kelas || getDefaultKelasForFase(fase);
        return isSameKelas(atpKelas, kelas);
      });
      if (activeAtps.length === 0) {
        alert(`Belum ada data PROTA atau ATP Kelas ${kelas} untuk mata pelajaran ${mapel}. Silakan selesaikan penyusunan ATP terlebih dahulu.`);
        return;
      }
      
      if (window.confirm(`Belum ada pembagian PROTA Semester ${semester} untuk ${mapel}. Apakah Anda ingin memuat semua ${activeAtps.length} TP dari ATP sebagai default Semester ${semester}?`)) {
        semesterProtas = activeAtps.map((atp, idx) => ({
          atpId: atp.tpId || `prosem-atp-manual-${idx}-${Math.random().toString(36).substring(2, 5)}`,
          tujuanPembelajaran: atp.tujuanPembelajaran,
          alokasiWaktu: atp.perkiraanJam || 2,
          semester: semester,
          mapel: mapel,
          cp: atp.cp || "",
          elemen: atp.elemen || "",
          topik: atp.topik || ""
        }));
      } else {
        return;
      }
    }

    const formatted: PROSEMItem[] = semesterProtas.map((prota, idx) => ({
      atpId: prota.atpId || `prosem-atp-manual-${idx}-${Math.random().toString(36).substring(2, 5)}`,
      mapel: mapel,
      semester: semester,
      cp: prota.cp || "",
      elemen: prota.elemen || "",
      tujuanPembelajaran: prota.tujuanPembelajaran,
      alokasiWaktu: prota.alokasiWaktu || 2,
      weeks: {}
    }));

    setItems(prev => {
      const remaining = prev.filter(item => !(item.mapel?.toLowerCase().trim() === targetMapel && String(item.semester) === String(semester)));
      return [...remaining, ...formatted];
    });
    setMsg("📋 Berhasil menyinkronkan daftar Tujuan Pembelajaran (TP) ke PROSEM! Silakan tentukan minggu mengajar.");
    setTimeout(() => setMsg(""), 5000);
  };

  const handleGeneratePROSEM = async () => {
    const targetMapel = mapel.toLowerCase().trim();
    // Filter Protas matching the current subject and semester selection
    let semesterProtas = savedProtas.filter(p => 
      p.mapel?.toLowerCase().trim() === targetMapel && 
      String(p.semester) === String(semester)
    );
    
    if (semesterProtas.length === 0) {
      if (displayedItems.length > 0) {
        semesterProtas = displayedItems.map(item => ({
          atpId: item.atpId,
          tujuanPembelajaran: item.tujuanPembelajaran,
          alokasiWaktu: item.alokasiWaktu,
          semester: item.semester,
          mapel: item.mapel,
          cp: item.cp,
          elemen: item.elemen,
          topik: ""
        }));
      } else {
        alert(`Belum ada data Tujuan Pembelajaran untuk mata pelajaran ${mapel} Semester ${semester}. Silakan selesaikan ATP terlebih dahulu atau klik tombol "Muat Ulang / Sinkronisasi Manual dari PROTA & ATP" di bawah.`);
        return;
      }
    }

    setLoading(true);
    setMsg("");
    try {
      const calendarInfoText = calendarData 
        ? `- Total Minggu Efektif: ${calendarData.jumlahMinggu} minggu
- Hari Efektif: ${calendarData.hariEfektif} hari
- Hari Tidak Efektif: ${calendarData.hariTidakEfektif} hari
- Hari Libur Nasional: ${calendarData.liburNasional || "-"}
- Hari Libur Semester: ${calendarData.liburSemester || "-"}
- Hari Libur Khusus/Lainnya: ${calendarData.liburKhusus || "-"}
- Catatan Kalender Tambahan: ${calendarData.rawExtractedText || "-"}`
        : "Tidak ada data kalender pendidikan terperinci. Asumsikan semua minggu adalah minggu efektif mengajar (4 minggu per bulan penuh) kecuali minggu ke-4 di bulan Desember atau Juni yang biasanya merupakan libur semester.";

      const matchingSchedule = schedule ? schedule.filter(s => 
        s.mapel.toLowerCase().trim() === mapel.toLowerCase().trim() && 
        (s.kelas.toLowerCase().trim() === kelas.toLowerCase().trim() || 
         kelas.toLowerCase().includes(s.kelas.toLowerCase()) || 
         s.kelas.toLowerCase().includes(kelas.toLowerCase()))
      ) : [];

      const scheduleInfoText = matchingSchedule.length > 0
        ? matchingSchedule.map(s => `- Hari ${s.hari}, Jam/Waktu: ${s.jam} (Mata Pelajaran: ${s.mapel}, Kelas: ${s.kelas})`).join("\n")
        : "Tidak ada rincian slot jadwal pelajaran spesifik yang terdaftar.";

      const data = await generatePROSEM(
        semester, 
        mapel, 
        fase, 
        kelas, 
        semesterProtas, 
        currentMonths, 
        calendarInfoText, 
        scheduleInfoText, 
        jpPerMinggu,
        { apiKey }
      );
      const formatted: PROSEMItem[] = data.items.map((item: any, idx: number) => {
        // Try strict matching first
        let matchingProta = semesterProtas.find(p => p.tujuanPembelajaran === item.tujuanPembelajaran);
        
        // Fallback 1: Fuzzy alphanumeric matching
        if (!matchingProta) {
          matchingProta = semesterProtas.find(p => {
            const pTp = p.tujuanPembelajaran.toLowerCase().replace(/[^a-z0-9]/g, "");
            const iTp = item.tujuanPembelajaran.toLowerCase().replace(/[^a-z0-9]/g, "");
            return pTp.includes(iTp) || iTp.includes(pTp);
          });
        }
        
        // Fallback 2: Index-based matching
        if (!matchingProta && semesterProtas[idx]) {
          matchingProta = semesterProtas[idx];
        }

        const tpText = matchingProta ? matchingProta.tujuanPembelajaran : item.tujuanPembelajaran;
        const matchingAtp = savedAtps.find(a => a.tujuanPembelajaran === tpText);
        const cpText = item.cp || matchingProta?.cp || matchingAtp?.cp || "";
        const elemenText = item.elemen || matchingProta?.elemen || matchingAtp?.elemen || "";
        const finalAtpId = matchingProta?.atpId || item.atpId || `prosem-atp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`;

        // Normalize weeks keys to match currentMonths exactly (e.g., "Jul-1" or "July-1" -> "Juli-1")
        const normalizedWeeks: { [key: string]: boolean } = {};
        if (item.weeks) {
          Object.entries(item.weeks).forEach(([key, val]) => {
            const parts = key.split(/[-_\s]+/);
            if (parts.length >= 2) {
              const rawMonth = parts[0].trim().toLowerCase();
              const weekNum = parts[1].trim();
              
              const matchedMonth = currentMonths.find(m => {
                const mLower = m.toLowerCase();
                const mSub = mLower.substring(0, 3);
                const rawSub = rawMonth.substring(0, 3);
                return mSub === rawSub || mLower.startsWith(rawMonth) || rawMonth.startsWith(mLower);
              });
              
              if (matchedMonth) {
                normalizedWeeks[`${matchedMonth}-${weekNum}`] = !!val;
              } else {
                normalizedWeeks[key] = !!val;
              }
            } else {
              normalizedWeeks[key] = !!val;
            }
          });
        }

        return {
          atpId: finalAtpId,
          mapel: mapel,
          semester: semester,
          cp: cpText,
          elemen: elemenText,
          tujuanPembelajaran: tpText,
          alokasiWaktu: item.alokasiWaktu || matchingProta?.alokasiWaktu || 2,
          weeks: normalizedWeeks
        };
      });
      
      setItems(prev => {
        const remaining = prev.filter(item => !(item.mapel === mapel && item.semester === semester));
        return [...remaining, ...formatted];
      });
      setMsg("✅ Program Semester (PROSEM) berhasil dipetakan otomatis oleh Gemini AI!");
    } catch (error: any) {
      setMsg(`🔴 Gagal menyusun PROSEM: ${error.message || "Kesalahan server"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePROSEMInstant = () => {
    const targetMapel = mapel.toLowerCase().trim();
    let currentItems = items.filter(item => item.mapel?.toLowerCase().trim() === targetMapel && String(item.semester) === String(semester));
    
    if (currentItems.length === 0) {
      // Load from Prota / ATP first if empty
      let semesterProtas = savedProtas.filter(p => 
        p.mapel?.toLowerCase().trim() === targetMapel && 
        String(p.semester) === String(semester)
      );

      if (semesterProtas.length === 0) {
        const activeAtps = savedAtps.filter(atp => {
          if (atp.mapel?.toLowerCase().trim() !== targetMapel) return false;
          const atpKelas = atp.kelas || getDefaultKelasForFase(fase);
          return isSameKelas(atpKelas, kelas);
        });
        if (activeAtps.length === 0) {
          alert(`Belum ada data Tujuan Pembelajaran (TP) Kelas ${kelas} untuk mata pelajaran ${mapel}. Silakan kunjungi menu Tujuan Pembelajaran atau Alur Tujuan Pembelajaran terlebih dahulu.`);
          return;
        }
        semesterProtas = activeAtps.map((atp, idx) => ({
          atpId: atp.tpId || `prosem-atp-manual-${idx}-${Math.random().toString(36).substring(2, 5)}`,
          tujuanPembelajaran: atp.tujuanPembelajaran,
          alokasiWaktu: atp.perkiraanJam || 2,
          semester: semester,
          mapel: mapel,
          cp: atp.cp || "",
          elemen: atp.elemen || "",
          topik: atp.topik || ""
        }));
      }

      currentItems = semesterProtas.map((prota, idx) => ({
        atpId: prota.atpId || `prosem-atp-manual-${idx}-${Math.random().toString(36).substring(2, 5)}`,
        mapel: mapel,
        semester: semester,
        cp: prota.cp || "",
        elemen: prota.elemen || "",
        tujuanPembelajaran: prota.tujuanPembelajaran,
        alokasiWaktu: prota.alokasiWaktu || 2,
        weeks: {}
      }));
    }

    // List of weeks across current months
    const allWeeks = currentMonths.flatMap(m => [1, 2, 3, 4].map(w => ({ month: m, week: w, key: `${m}-${w}` })));
    let weekPointer = 0;

    const updatedItems = currentItems.map(item => {
      const weeks: { [key: string]: boolean } = {};
      const weeksNeeded = Math.ceil(item.alokasiWaktu / jpPerMinggu) || 1;
      for (let i = 0; i < weeksNeeded; i++) {
        if (weekPointer < allWeeks.length) {
          const currentWeek = allWeeks[weekPointer];
          // Skip standard semester-end holiday week (usually week 4 of December/June)
          if ((currentWeek.month === "Desember" && currentWeek.week === 4) || (currentWeek.month === "Juni" && currentWeek.week === 4)) {
            weekPointer++;
          }
          if (weekPointer < allWeeks.length) {
            weeks[allWeeks[weekPointer].key] = true;
            weekPointer++;
          }
        }
      }
      return { ...item, weeks };
    });

    setItems(prev => {
      const remaining = prev.filter(item => !(item.mapel?.toLowerCase().trim() === targetMapel && String(item.semester) === String(semester)));
      return [...remaining, ...updatedItems];
    });

    setMsg("⚡ Sukses! Pemetaan minggu belajar instan berhasil diselesaikan secara sistematis. Anda sekarang dapat menyesuaikannya sesuka hati.");
    setTimeout(() => setMsg(""), 5000);
  };

  const handleToggleWeek = (indexInDisplayed: number, month: string, weekNum: number) => {
    const targetItem = displayedItems[indexInDisplayed];
    setItems(prev => {
      const copy = [...prev];
      const absoluteIndex = copy.findIndex(it => it.atpId === targetItem.atpId && it.mapel === mapel && it.semester === semester);
      if (absoluteIndex !== -1) {
        const weekKey = `${month}-${weekNum}`;
        const currentWeeks = { ...copy[absoluteIndex].weeks };
        currentWeeks[weekKey] = !currentWeeks[weekKey];
        copy[absoluteIndex] = { ...copy[absoluteIndex], weeks: currentWeeks };
      }
      return copy;
    });
  };

  const handleSaveToDb = async () => {
    setSaving(true);
    try {
      const payload: PROSEMData = {
        semester,
        mapel,
        fase,
        kelas,
        items, // Save all items!
        months: currentMonths,
        weeksPerMonth: 4,
        createdAt: new Date().toISOString(),
        tahunPelajaran: profile.tahunPelajaran
      } as any;
      await onSaveProsem(payload);
      setMsg("✅ Seluruh data Program Semester berhasil disimpan ke Firestore!");
      setTimeout(() => setMsg(""), 4000);
    } catch (error: any) {
      setMsg(`🔴 Gagal menyimpan ke Firestore: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadWord = async () => {
    try {
      if (displayedItems.length === 0) {
        alert("Selesaikan penyusunan PROSEM terlebih dahulu sebelum diunduh.");
        return;
      }
      const blob = await generatePROSEMDocx(profile, mapel, currentMonths, displayedItems, kelas);
      const filename = `Program Semester_${mapel}_Sm${semester}.docx`;
      
      const fileSaver = await import("file-saver");
      fileSaver.saveAs(blob, filename);
      setMsg("✅ File Program Semester (.docx) berhasil dibuat dan diunduh!");
    } catch (error: any) {
      setMsg(`🔴 Gagal mengunduh berkas Word: ${error.message}`);
    }
  };

  const handleSyncToDrive = async () => {
    if (!accessToken || !driveFolderId) {
      alert("Silakan hubungkan Google Drive terlebih dahulu di tab Pengaturan.");
      return;
    }
    
    setSyncingDrive(true);
    setMsg("Mengunggah dokumen ke Google Drive...");
    try {
      const blob = await generatePROSEMDocx(profile, mapel, currentMonths, displayedItems, kelas);
      const filename = `Program Semester_${mapel}_Sm${semester}.docx`;
      
      await uploadFileToDrive(accessToken, blob, filename, driveFolderId);
      setMsg("✅ Dokumen Program Semester berhasil diunggah langsung ke folder Google Drive Anda!");
    } catch (error: any) {
      setMsg(`🔴 Gagal mengunggah ke Google Drive: ${error.message}`);
    } finally {
      setSyncingDrive(false);
    }
  };

  return (
    <div className="space-y-6" id="prosem_panel">
      {/* Configuration Selection */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:hidden">
        <div className="border-b border-slate-200 bg-slate-50 p-4">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Grid className="w-5 h-5 text-blue-600" />
            Program Semester (PROSEM)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Petakan Tujuan Pembelajaran secara mingguan pada semester aktif. Klik pada kotak mingguan untuk menandai pelaksanaan mengajar.</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Mata Pelajaran</label>
              <select
                value={mapel}
                onChange={(e) => setMapel(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-sm"
              >
                {mapelPresets[currentJenjang]?.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Fase</label>
              <select
                value={fase}
                onChange={(e) => {
                  const newFase = e.target.value as Fase;
                  setFase(newFase);
                  // Auto-set default kelas appropriate for the chosen Fase
                  if (newFase === Fase.A) setKelas("1");
                  else if (newFase === Fase.B) setKelas("3");
                  else if (newFase === Fase.C) setKelas("5");
                  else if (newFase === Fase.D) setKelas("7");
                  else if (newFase === Fase.E) setKelas("10");
                  else if (newFase === Fase.F) setKelas("11");
                }}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.values(Fase).map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Kelas</label>
              <select
                value={kelas}
                onChange={(e) => setKelas(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(() => {
                  const getKelasOptionsForFase = (currentFase: Fase) => {
                    switch (currentFase) {
                      case Fase.A: return ["1", "2", "I", "II"];
                      case Fase.B: return ["3", "4", "III", "IV"];
                      case Fase.C: return ["5", "6", "V", "VI"];
                      case Fase.D: return ["7", "8", "9", "VII", "VIII", "IX"];
                      case Fase.E: return ["10", "X"];
                      case Fase.F: return ["11", "12", "XI", "XII"];
                      default: return ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
                    }
                  };
                  const options = [...getKelasOptionsForFase(fase)];
                  if (kelas && !options.includes(kelas)) {
                    options.push(kelas);
                  }
                  return options.map((k) => (
                    <option key={k} value={k}>Kelas {k}</option>
                  ));
                })()}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Pilih Semester Aktif</label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value as "1" | "2")}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-sm"
              >
                <option value="1">Semester Ganjil (1)</option>
                <option value="2">Semester Genap (2)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Alokasi JP / Minggu</label>
              <input
                type="number"
                min={1}
                max={24}
                value={jpPerMinggu}
                onChange={(e) => setJpPerMinggu(parseInt(e.target.value) || 4)}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {savedProtas.filter(p => p.mapel?.toLowerCase().trim() === mapel.toLowerCase().trim() && String(p.semester) === String(semester)).length === 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold">Belum ada rincian pembagian PROTA Semester {semester} untuk mata pelajaran ini.</p>
                <p className="text-slate-600 mt-0.5">Anda tetap dapat memetakan PROSEM langsung dengan AI atau memuat seluruh Tujuan Pembelajaran dari ATP secara manual dengan klik tombol sinkronisasi di bawah.</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 justify-start">
            <button
              onClick={handleGeneratePROSEMInstant}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold py-2.5 px-5 rounded-lg transition shadow-md text-sm"
            >
              <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
              ⚡ Pemetaan Mingguan Instan (Sangat Cepat & Otomatis)
            </button>

            <button
              onClick={handleGeneratePROSEM}
              disabled={loading}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold py-2.5 px-5 rounded-lg transition shadow-sm disabled:opacity-50 text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memetakan Minggu Belajar via AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  Petakan Detail dengan AI (Butuh Waktu)
                </>
              )}
            </button>

            <button
              onClick={handleLoadProtaManual}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 border border-dashed border-slate-300 font-semibold py-2.5 px-5 rounded-lg transition text-sm"
            >
              <FolderSync className="w-4 h-4 text-slate-400" />
              Reset &amp; Muat Ulang TP dari PROTA &amp; ATP
            </button>
          </div>

          {msg && (
            <div className={`p-3 rounded-lg text-sm font-semibold ${msg.includes("🔴") ? "bg-red-50 text-red-700 border border-red-100" : "bg-emerald-50 text-emerald-800 border border-emerald-100"}`}>
              {msg}
            </div>
          )}
        </div>
      </div>

      {/* Grid Display */}
      {displayedItems.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
          {/* Validation Banner */}
          <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
            isProsemValid 
              ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}>
            <div className="flex items-start gap-3">
              {isProsemValid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                  Status Validasi Alur Data (Integritas SIPENA: PROTA &rarr; PROSEM)
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {isProsemValid 
                    ? `Seluruh rincian PROTA Semester ${semester} telah diwarisi 100% sempurna ke dalam program mingguan PROSEM (${displayedItems.length} Tujuan Pembelajaran terpetakan).` 
                    : `Terdapat catatan kelayakan data PROSEM: ${!hasProta ? `Data PROTA untuk Semester ${semester} belum dimuat atau kosong. ` : ""}${countMismatch ? `Jumlah item PROSEM (${displayedItems.length}) tidak sama dengan jumlah rujukan PROTA (${semesterProtasVal.length}). ` : ""}${missingProtaFromProsem.length > 0 ? `Terdapat ${missingProtaFromProsem.length} item PROTA yang belum terpetakan dalam PROSEM mingguan Anda. ` : ""}`}
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isProsemValid 
                  ? "bg-emerald-200 text-emerald-900" 
                  : "bg-amber-200 text-amber-900"
              }`}>
                {isProsemValid ? "100% Sesuai & Valid" : "Butuh Pemetaan Ulang"}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="min-w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold text-center">
                  <th className="p-3 w-10 text-center" rowSpan={2}>No</th>
                  <th className="p-3 text-left w-64" rowSpan={2}>Elemen &amp; Capaian Pembelajaran (CP)</th>
                  <th className="p-3 text-left w-64" rowSpan={2}>Tujuan Pembelajaran (TP)</th>
                  <th className="p-3 w-16 text-center" rowSpan={2}>JP</th>
                  {currentMonths.map((month) => (
                    <th key={month} className="p-1 border-l border-slate-200 text-center text-[10px] uppercase font-bold" colSpan={4}>
                      {month}
                    </th>
                  ))}
                </tr>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold text-center text-[9px]">
                  {currentMonths.map((month) => (
                    <React.Fragment key={`${month}-weeks`}>
                      <th className="p-1 border-l border-slate-200 w-6">1</th>
                      <th className="p-1 border-slate-200 w-6">2</th>
                      <th className="p-1 border-slate-200 w-6">3</th>
                      <th className="p-1 border-slate-200 w-6">4</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayedItems.map((item, itemIdx) => (
                  <tr key={`prosem-item-${item.atpId || "empty"}-${itemIdx}`} className="hover:bg-slate-50/50 transition">
                    <td className="p-3 text-center text-slate-500 font-medium">{itemIdx + 1}</td>
                    <td className="p-3 text-left whitespace-normal leading-normal max-w-xs">
                      <div className="space-y-2">
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Elemen</span>
                          <span className="text-blue-700 font-bold text-xs leading-snug block bg-blue-50 border border-blue-100 px-2 py-1 rounded-md w-fit">
                            {item.elemen || "-"}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Capaian Pembelajaran (CP)</span>
                          <span className="text-slate-600 font-medium text-xs leading-relaxed block">
                            {item.cp || "-"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 font-medium text-slate-800 text-left whitespace-normal leading-normal">{item.tujuanPembelajaran}</td>
                    <td className="p-3 text-center font-bold text-slate-600">{item.alokasiWaktu} JP</td>
                    
                    {currentMonths.map((month) => (
                      <React.Fragment key={`${month}-weeks-checks`}>
                        {[1, 2, 3, 4].map((w) => {
                          const weekKey = `${month}-${w}`;
                          const isChecked = !!item.weeks[weekKey];
                          return (
                            <td 
                              key={w} 
                              onClick={() => handleToggleWeek(itemIdx, month, w)}
                              className={`p-1 border-l border-slate-100 text-center cursor-pointer transition select-none ${isChecked ? "bg-blue-50 text-blue-600 font-bold" : "hover:bg-slate-100"}`}
                            >
                              {isChecked ? "√" : ""}
                            </td>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sync actions */}
          <div className="flex flex-wrap gap-3 justify-between items-center pt-4 border-t border-slate-100 print:hidden">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              onClick={handleSaveToDb}
              disabled={saving}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg text-xs transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saving ? "Menyimpan..." : "Simpan Data PROSEM ke Firestore"}
            </motion.button>

            <div className="flex gap-2">
              {accessToken && driveFolderId && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  onClick={handleSyncToDrive}
                  disabled={syncingDrive}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2 px-4 rounded-lg text-xs transition shadow-sm cursor-pointer"
                >
                  <FolderSync className="w-4 h-4" />
                  {syncingDrive ? "Mengunggah..." : "Simpan ke Google Drive"}
                </motion.button>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2 px-4 rounded-lg text-xs transition shadow-sm cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Cetak / Simpan PDF (Landscape)
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                onClick={handleDownloadWord}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-semibold py-2 px-4 rounded-lg text-xs transition shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Unduh Microsoft Word (.docx)
              </motion.button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
