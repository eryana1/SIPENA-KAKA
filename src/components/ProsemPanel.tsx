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
import { downloadBlob } from "../lib/downloadHelper";
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
  onLoadProsem?: (ctx: { mapel: string; kelas: string; fase: Fase; semester?: string }) => Promise<void>;
  apiKey?: string;
  driveFolderId?: string;
  accessToken?: string | null;
}

import { 
  isSameKelas, 
  getDefaultKelasForFase, 
  getKelasForFase, 
  getValidClassesForFase, 
  isClassInSameFase, 
  normKelas 
} from "../lib/profileHelper";

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
  const [kelas, setKelas] = useState(() => getKelasForFase(profile.fase || Fase.A, profile.kelas));
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
      onLoadProsem({ mapel, kelas, fase, semester });
    }
  }, [mapel, kelas, fase, semester, profile.tahunPelajaran, profile.semester]);

  useEffect(() => {
    if (prosemData) {
      const isStale = (
        prosemData.mapel?.toLowerCase() !== mapel.toLowerCase() ||
        !isSameKelas(prosemData.kelas, kelas) ||
        prosemData.fase !== fase ||
        String(prosemData.semester) !== String(semester)
      );

      if (!isStale && prosemData.items && prosemData.items.length > 0) {
        const loadedItems = (prosemData.items || []).map(item => {
          const matchingProta = savedProtas.find(p => p.tujuanPembelajaran === item.tujuanPembelajaran);
          const matchingAtp = savedAtps.find(atp => atp.tujuanPembelajaran === item.tujuanPembelajaran);
          return {
            ...item,
            mapel: item.mapel || prosemData.mapel || mapel,
            semester: item.semester || prosemData.semester || semester,
            cp: item.cp || matchingProta?.cp || matchingAtp?.cp || "",
            elemen: item.elemen || matchingProta?.elemen || matchingAtp?.elemen || "",
            weeks: item.weeks || {}
          };
        });
        setItems(loadedItems);
      }
    }
  }, [prosemData, mapel, kelas, fase, semester]);

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

        // Preserved source: check both current state items AND prosemData items so checkmarks (weeks) are NEVER lost
        const preservedSource = [...currentItems, ...(prosemData?.items || [])];

        const seenAtpIds = new Set<string>();

        const reconciledItems: PROSEMItem[] = semesterProtas.map((prota, idx) => {
          const existing = preservedSource.find(it => 
            (prota.atpId && it.atpId === prota.atpId) ||
            (prota.tujuanPembelajaran && it.tujuanPembelajaran === prota.tujuanPembelajaran) ||
            (prota.tujuanPembelajaran && it.tujuanPembelajaran?.trim().toLowerCase() === prota.tujuanPembelajaran?.trim().toLowerCase())
          );
          
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
      setItems(prev => {
        const currentItems = prev.filter(item => item.mapel?.toLowerCase().trim() === targetMapel && String(item.semester) === String(semester));
        if (currentItems.length > 0) {
          return prev;
        }

        if (prosemData?.items && prosemData.items.length > 0 && prosemData.mapel?.toLowerCase().trim() === targetMapel) {
          return prev;
        }

        const activeAtps = savedAtps.filter(atp => {
          if (atp.mapel?.toLowerCase().trim() !== targetMapel) return false;
          const atpKelas = atp.kelas || getDefaultKelasForFase(fase);
          return isClassInSameFase(atpKelas, kelas, fase);
        });

        if (activeAtps.length > 0) {
          const preservedSource = prosemData?.items || [];
          const fallbackItems: PROSEMItem[] = activeAtps.map((atp, idx) => {
            const existing = preservedSource.find(it =>
              (atp.tpId && it.atpId === atp.tpId) ||
              (atp.tujuanPembelajaran && it.tujuanPembelajaran === atp.tujuanPembelajaran) ||
              (atp.tujuanPembelajaran && it.tujuanPembelajaran?.trim().toLowerCase() === atp.tujuanPembelajaran?.trim().toLowerCase())
            );
            return {
              atpId: atp.tpId || existing?.atpId || `prosem-atp-fallback-${idx}-${Math.random().toString(36).substring(2, 5)}`,
              mapel: mapel,
              semester: semester,
              cp: atp.cp || "",
              elemen: atp.elemen || "",
              tujuanPembelajaran: atp.tujuanPembelajaran,
              alokasiWaktu: atp.perkiraanJam || 2,
              weeks: existing?.weeks || {}
            };
          });
          const otherItems = prev.filter(item => !(item.mapel?.toLowerCase().trim() === targetMapel && String(item.semester) === String(semester)));
          return [...otherItems, ...fallbackItems];
        }

        return prev;
      });
    }
  }, [mapel, semester, savedProtas, savedAtps, prosemData]);

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
        return isClassInSameFase(atpKelas, kelas, fase);
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
          return isClassInSameFase(atpKelas, kelas, fase);
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

    const n = currentItems.length;
    if (n === 0) return;

    // Target active months: Semester 1 programs learning up to November Week 4 (reserving Desember for exams/holidays)
    // Semester 2 programs learning up to Mei Week 4 (reserving Juni for exams/holidays)
    const targetMonths = String(semester) === "1"
      ? ["Juli", "Agustus", "September", "Oktober", "November"]
      : ["Januari", "Februari", "Maret", "April", "Mei"];

    const targetWeeks = targetMonths.flatMap(m => [1, 2, 3, 4].map(w => ({ month: m, week: w, key: `${m}-${w}` })));

    const totalJp = currentItems.reduce((sum, item) => sum + (item.alokasiWaktu || 2), 0);

    let assignedWeeksCount: number[] = [];

    if (n <= targetWeeks.length) {
      let rawCounts = currentItems.map(item => {
        const weight = (item.alokasiWaktu || 2) / (totalJp || 1);
        return Math.max(1, Math.round(weight * targetWeeks.length));
      });

      let currentSum = rawCounts.reduce((a, b) => a + b, 0);

      while (currentSum !== targetWeeks.length) {
        if (currentSum < targetWeeks.length) {
          let minIdx = 0;
          for (let i = 1; i < n; i++) {
            if (rawCounts[i] < rawCounts[minIdx]) minIdx = i;
          }
          rawCounts[minIdx]++;
          currentSum++;
        } else {
          let maxIdx = -1;
          for (let i = 0; i < n; i++) {
            if (rawCounts[i] > 1 && (maxIdx === -1 || rawCounts[i] > rawCounts[maxIdx])) {
              maxIdx = i;
            }
          }
          if (maxIdx !== -1) {
            rawCounts[maxIdx]--;
            currentSum--;
          } else {
            break;
          }
        }
      }
      assignedWeeksCount = rawCounts;
    } else {
      assignedWeeksCount = currentItems.map(() => 1);
    }

    let weekPointer = 0;
    const updatedItems = currentItems.map((item, idx) => {
      const weeks: { [key: string]: boolean } = {};
      const numWeeks = assignedWeeksCount[idx] || 1;

      for (let w = 0; w < numWeeks; w++) {
        if (weekPointer < targetWeeks.length) {
          weeks[targetWeeks[weekPointer].key] = true;
          weekPointer++;
        } else {
          weeks[targetWeeks[targetWeeks.length - 1].key] = true;
        }
      }
      return { ...item, weeks };
    });

    const remaining = items.filter(item => !(item.mapel?.toLowerCase().trim() === targetMapel && String(item.semester) === String(semester)));
    const mergedProsem = [...remaining, ...updatedItems];

    setItems(mergedProsem);
    autoPersistProsem(mergedProsem);

    setMsg(
      String(semester) === "1"
        ? `⚡ Sukses! Seluruh ${n} Tujuan Pembelajaran (TP) berhasil dipetakan secara instan dari Juli sampai November Minggu ke-4!`
        : `⚡ Sukses! Seluruh ${n} Tujuan Pembelajaran (TP) berhasil dipetakan secara instan dari Januari sampai Mei Minggu ke-4!`
    );
    setTimeout(() => setMsg(""), 5000);
  };

  const autoPersistProsem = (updatedItems: PROSEMItem[]) => {
    const payload: PROSEMData = {
      semester,
      mapel,
      fase,
      kelas,
      items: updatedItems,
      months: currentMonths,
      weeksPerMonth: 4,
      createdAt: new Date().toISOString(),
      tahunPelajaran: profile.tahunPelajaran
    } as any;
    onSaveProsem(payload).catch(err => console.warn("Auto-save PROSEM failed:", err));
  };

  const handleToggleWeek = (indexInDisplayed: number, month: string, weekNum: number) => {
    const targetItem = displayedItems[indexInDisplayed];
    if (!targetItem) return;

    setItems(prev => {
      const copy = [...prev];
      const absoluteIndex = copy.findIndex(it => 
        it === targetItem ||
        (it.atpId && targetItem.atpId && it.atpId === targetItem.atpId) ||
        (it.tujuanPembelajaran && targetItem.tujuanPembelajaran && it.tujuanPembelajaran.trim().toLowerCase() === targetItem.tujuanPembelajaran.trim().toLowerCase())
      );
      if (absoluteIndex !== -1) {
        const weekKey = `${month}-${weekNum}`;
        const currentWeeks = { ...(copy[absoluteIndex].weeks || {}) };
        currentWeeks[weekKey] = !currentWeeks[weekKey];
        copy[absoluteIndex] = { ...copy[absoluteIndex], weeks: currentWeeks };
        autoPersistProsem(copy);
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
      
      downloadBlob(blob, filename);
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
                  setKelas(getKelasForFase(newFase, kelas));
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
                value={normKelas(kelas)}
                onChange={(e) => setKelas(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(() => {
                  const options = [...getValidClassesForFase(fase)];
                  const currentNorm = normKelas(kelas);
                  if (currentNorm && !options.includes(currentNorm)) {
                    options.push(currentNorm);
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
