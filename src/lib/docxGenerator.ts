import { 
  Document, 
  Packer, 
  Paragraph, 
  Table, 
  TableRow, 
  TableCell, 
  TextRun, 
  AlignmentType, 
  WidthType, 
  HeadingLevel, 
  BorderStyle,
  VerticalAlign,
  PageOrientation,
  PageBreak,
  ImageRun
} from "docx";
import { saveAs } from "file-saver";
import { getTeacherForKelas } from "./profileHelper";

// Helper to convert dataUrl base64 to Uint8Array for docx ImageRun
const convertDataUrlToUint8Array = (dataUrl: string): Uint8Array => {
  const base64 = dataUrl.split(",")[1];
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Helper for standard borders
const standardBorders = {
  top: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
};

// Helper for table cells with text
const createCell = (
  text: string, 
  bold = false, 
  align: any = AlignmentType.LEFT, 
  widthPercent = 10, 
  bg?: string, 
  columnSpan?: number, 
  fontSize = 22
) => {
  const normalizedText = (text || "").replace(/<br\s*\/?>/gi, "\n");
  const lines = normalizedText.split("\n");
  const childrenRuns: TextRun[] = [];
  
  lines.forEach((line, idx) => {
    const parts = line.split(/\*\*([\s\S]*?)\*\*/g);
    let isFirstOfLine = true;
    parts.forEach((part, partIdx) => {
      if (part === "" && parts.length > 1) {
        return;
      }
      const isBold = partIdx % 2 === 1 ? !bold : bold;
      const runBreak = (idx > 0 && isFirstOfLine) ? 1 : undefined;
      if (isFirstOfLine) {
        isFirstOfLine = false;
      }
      childrenRuns.push(
        new TextRun({
          text: part,
          bold: isBold,
          font: "Inter",
          size: fontSize,
          break: runBreak,
        })
      );
    });
  });

  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    borders: standardBorders,
    verticalAlign: VerticalAlign.CENTER,
    shading: bg ? { fill: bg } : undefined,
    columnSpan: columnSpan,
    children: [
      new Paragraph({
        alignment: align,
        spacing: { before: 60, after: 60 },
        children: childrenRuns,
      }),
    ],
  });
};

// Helper for cells with Elemen on top of CP
const createCPCell = (
  elemen: string,
  cp: string,
  widthPercent = 25,
  fontSize = 22
) => {
  const children: Paragraph[] = [];
  if (elemen) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 60, after: 20 },
        children: [
          new TextRun({
            text: `Elemen: ${elemen}`,
            bold: true,
            font: "Inter",
            size: fontSize - 2,
            color: "2563EB", // Elegant royal blue
          }),
        ],
      })
    );
  }
  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 20, after: 60 },
      children: [
        new TextRun({
          text: cp,
          font: "Inter",
          size: fontSize,
        }),
      ],
    })
  );

  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    borders: standardBorders,
    verticalAlign: VerticalAlign.CENTER,
    children,
  });
};

// Helper for document header
const createHeaderInfo = (profile: any, title: string, mapel: string) => {
  const infoRows = [
    new TableRow({
      children: [
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
          },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "SATUAN PENDIDIKAN: ", bold: true, size: 20, font: "Inter" }),
                new TextRun({ text: (profile.sekolah || "-").toUpperCase(), size: 20, font: "Inter" }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "MATA PELAJARAN: ", bold: true, size: 20, font: "Inter" }),
                new TextRun({ text: mapel.toUpperCase(), size: 20, font: "Inter" }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "FASE / KELAS: ", bold: true, size: 20, font: "Inter" }),
                new TextRun({ text: `${profile.fase || "-"} / Kelas ${profile.kelas || "-"}`, size: 20, font: "Inter" }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
          },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "TAHUN PELAJARAN: ", bold: true, size: 20, font: "Inter" }),
                new TextRun({ text: profile.tahunPelajaran || "2026/2027", size: 20, font: "Inter" }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "SEMESTER: ", bold: true, size: 20, font: "Inter" }),
                new TextRun({ text: profile.semester || "1", size: 20, font: "Inter" }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: infoRows,
  });
};

// Helper for standard signatures at the bottom
const createSignatureBlock = (profile: any, kelas?: string, mapel?: string) => {
  const today = new Date();
  const formatIndonesianDate = `${today.getDate()} Juli ${today.getFullYear()}`; // Simulating the local date nicely in Indonesian format
  
  const teacher = getTeacherForKelas(profile, kelas || "", mapel);
  
  let signatureImageRun: any = null;
  if (teacher.tandaTangan && teacher.tandaTangan.startsWith("data:image")) {
    try {
      const uint8Array = convertDataUrlToUint8Array(teacher.tandaTangan);
      signatureImageRun = new ImageRun({
        data: uint8Array,
        transformation: {
          width: 120,
          height: 60,
        },
      } as any);
    } catch (err) {
      console.error("Failed to parse signature image:", err);
    }
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      // Gap row
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [new Paragraph({ text: "" })],
          }),
        ],
      }),
      // City & Date
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [new Paragraph({ text: "" })],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `Mengetahui, ${formatIndonesianDate}`, size: 22, font: "Inter" }),
                ],
              }),
            ],
          }),
        ],
      }),
      // Role Title
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Mengetahui,", size: 22, font: "Inter" }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: profile.jabatanKepalaSekolah || "Kepala Sekolah", bold: true, size: 22, font: "Inter" }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: teacher.jabatan || "Guru Kelas/Mata Pelajaran", bold: true, size: 22, font: "Inter" }),
                ],
              }),
            ],
          }),
        ],
      }),
      // Spacer for signature / Actual digital signature image
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [new Paragraph({ spacing: { before: 800 } })],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              signatureImageRun 
                ? new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 100, after: 100 },
                    children: [signatureImageRun]
                  })
                : new Paragraph({ spacing: { before: 800 } })
            ],
          }),
        ],
      }),
      // Names & NIP
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: profile.kepalaSekolah || "___________________", bold: true, underline: {}, size: 22, font: "Inter" }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `NIP: ${profile.nipKepalaSekolah || "-"}`, size: 20, font: "Inter" }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: teacher.nama || "___________________", bold: true, underline: {}, size: 22, font: "Inter" }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `NIP: ${teacher.nip || "-"}`, size: 20, font: "Inter" }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
};

// 1. Generate TP DOCX
export const generateTPDocx = async (profile: any, mapel: string, items: any[], kelas?: string): Promise<Blob> => {
  const tableRows = [
    new TableRow({
      children: [
        createCell("NO", true, AlignmentType.CENTER, 5, "F0F4F8"),
        createCell("ELEMEN", true, AlignmentType.CENTER, 15, "F0F4F8"),
        createCell("CAPAIAN PEMBELAJARAN (CP)", true, AlignmentType.CENTER, 25, "F0F4F8"),
        createCell("KOMPETENSI", true, AlignmentType.CENTER, 15, "F0F4F8"),
        createCell("KONTEN / MATERI", true, AlignmentType.CENTER, 15, "F0F4F8"),
        createCell("RUMUSAN TUJUAN PEMBELAJARAN (TP)", true, AlignmentType.CENTER, 25, "F0F4F8"),
      ],
    }),
  ];

  // Group items by Elemen and CP
  const groupedItems: { [key: string]: { elemen: string; cp: string; items: any[] } } = {};
  
  items.forEach(item => {
    const key = item.elemen || "Umum";
    if (!groupedItems[key]) {
      groupedItems[key] = {
        elemen: item.elemen || "Umum",
        cp: item.cp || "",
        items: []
      };
    }
    groupedItems[key].items.push(item);
  });

  const groupedList = Object.values(groupedItems);

  groupedList.forEach((group, index) => {
    group.items.forEach((tpItem, tpIdx) => {
      const isFirst = tpIdx === 0;
      tableRows.push(
        new TableRow({
          children: [
            createCell(isFirst ? (index + 1).toString() : "", false, AlignmentType.CENTER, 5),
            createCell(isFirst ? group.elemen : "", true, AlignmentType.LEFT, 15),
            createCell(isFirst ? group.cp : "", false, AlignmentType.LEFT, 25),
            createCell(tpItem.kompetensi || "-", false, AlignmentType.LEFT, 15),
            createCell(tpItem.konten || "-", false, AlignmentType.LEFT, 15),
            createCell(`${tpIdx + 1}. ${tpItem.tujuanPembelajaran || "-"}`, false, AlignmentType.LEFT, 25),
          ],
        })
      );
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: "DOKUMEN TUJUAN PEMBELAJARAN (TP)",
                bold: true,
                size: 28,
                font: "Inter",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: "KURIKULUM MERDEKA",
                bold: true,
                size: 24,
                font: "Inter",
              }),
            ],
          }),
          createHeaderInfo(profile, "TUJUAN PEMBELAJARAN (TP)", mapel),
          new Paragraph({ spacing: { before: 200, after: 200 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),
          new Paragraph({ spacing: { before: 400, after: 400 } }),
          createSignatureBlock(profile, kelas, mapel),
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
};

// 2. Generate ATP DOCX
export const generateATPDocx = async (profile: any, mapel: string, items: any[], kelas?: string): Promise<Blob> => {
  const tableRows = [
    new TableRow({
      children: [
        createCell("NO", true, AlignmentType.CENTER, 5, "F0F4F8"),
        createCell("KELAS", true, AlignmentType.CENTER, 10, "F0F4F8"),
        createCell("ELEMEN", true, AlignmentType.CENTER, 15, "F0F4F8"),
        createCell("CAPAIAN PEMBELAJARAN (CP)", true, AlignmentType.CENTER, 20, "F0F4F8"),
        createCell("TUJUAN PEMBELAJARAN (TP)", true, AlignmentType.CENTER, 25, "F0F4F8"),
        createCell("ALOKASI (JP)", true, AlignmentType.CENTER, 8, "F0F4F8"),
        createCell("TOPIK", true, AlignmentType.CENTER, 8.5, "F0F4F8"),
        createCell("GLOSARIUM", true, AlignmentType.CENTER, 8.5, "F0F4F8"),
      ],
    }),
  ];

  items.forEach((item, index) => {
    tableRows.push(
      new TableRow({
        children: [
          createCell((index + 1).toString(), false, AlignmentType.CENTER, 5),
          createCell(item.kelas ? `Kelas ${item.kelas}` : "-", false, AlignmentType.CENTER, 10),
          createCell(item.elemen || "-", false, AlignmentType.LEFT, 15),
          createCell(item.cp || "", false, AlignmentType.LEFT, 20),
          createCell(item.tujuanPembelajaran || "", false, AlignmentType.LEFT, 25),
          createCell(`${item.perkiraanJam || 2} JP`, false, AlignmentType.CENTER, 8),
          createCell(item.topik || "", false, AlignmentType.LEFT, 8.5),
          createCell(item.glosarium || "", false, AlignmentType.LEFT, 8.5),
        ],
      })
    );
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: "ALUR TUJUAN PEMBELAJARAN (ATP)",
                bold: true,
                size: 28,
                font: "Inter",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: "KURIKULUM MERDEKA",
                bold: true,
                size: 24,
                font: "Inter",
              }),
            ],
          }),
          createHeaderInfo(profile, "ALUR TUJUAN PEMBELAJARAN (ATP)", mapel),
          new Paragraph({ spacing: { before: 200, after: 200 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),
          new Paragraph({ spacing: { before: 400, after: 400 } }),
          createSignatureBlock(profile, kelas, mapel),
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
};

// 3. Generate PROTA DOCX
export const generatePROTADocx = async (profile: any, mapel: string, items: any[], kelas?: string): Promise<Blob> => {
  const tableRows = [
    new TableRow({
      children: [
        createCell("NO", true, AlignmentType.CENTER, 5, "F0F4F8"),
        createCell("CAPAIAN PEMBELAJARAN (CP)", true, AlignmentType.CENTER, 25, "F0F4F8"),
        createCell("TUJUAN PEMBELAJARAN (TP)", true, AlignmentType.CENTER, 35, "F0F4F8"),
        createCell("ALOKASI (JP)", true, AlignmentType.CENTER, 15, "F0F4F8"),
        createCell("SEMESTER", true, AlignmentType.CENTER, 20, "F0F4F8"),
      ],
    }),
  ];

  items.forEach((item, index) => {
    tableRows.push(
      new TableRow({
        children: [
          createCell((index + 1).toString(), false, AlignmentType.CENTER, 5),
          createCPCell(item.elemen || "", item.cp || "-", 25),
          createCell(item.tujuanPembelajaran || "", false, AlignmentType.LEFT, 35),
          createCell(`${item.alokasiWaktu || 2} JP`, false, AlignmentType.CENTER, 15),
          createCell(`Semester ${item.semester || "1"}`, false, AlignmentType.CENTER, 20),
        ],
      })
    );
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: "PROGRAM TAHUNAN (PROTA)",
                bold: true,
                size: 28,
                font: "Inter",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: "KURIKULUM MERDEKA",
                bold: true,
                size: 24,
                font: "Inter",
              }),
            ],
          }),
          createHeaderInfo(profile, "PROGRAM TAHUNAN (PROTA)", mapel),
          new Paragraph({ spacing: { before: 200, after: 200 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),
          new Paragraph({ spacing: { before: 400, after: 400 } }),
          createSignatureBlock(profile, kelas, mapel),
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
};

// 4. Generate PROSEM DOCX
export const generatePROSEMDocx = async (profile: any, mapel: string, months: string[], items: any[], kelas?: string): Promise<Blob> => {
  // Let's build a clean matrix representation matching the preview layout
  const numMonths = months.length;
  const monthWidth = 46 / (numMonths || 1);
  const weekWidth = monthWidth / 4;

  // Row 1: NO, CP, TP, JP, then months spanning 4 columns each
  const headerRow1 = [
    createCell("NO", true, AlignmentType.CENTER, 4, "F0F4F8", 1, 18),
    createCell("ELEMEN & CAPAIAN PEMBELAJARAN (CP)", true, AlignmentType.CENTER, 20, "F0F4F8", 1, 18),
    createCell("TUJUAN PEMBELAJARAN (TP)", true, AlignmentType.CENTER, 24, "F0F4F8", 1, 18),
    createCell("JP", true, AlignmentType.CENTER, 6, "F0F4F8", 1, 18),
  ];

  months.forEach(month => {
    headerRow1.push(createCell(month.toUpperCase(), true, AlignmentType.CENTER, monthWidth, "E2E8F0", 4, 18));
  });

  // Row 2: 4 spacer cells, then week numbers 1, 2, 3, 4 for each month
  const headerRow2 = [
    createCell("", true, AlignmentType.CENTER, 4, "F0F4F8", 1, 16),
    createCell("", true, AlignmentType.CENTER, 20, "F0F4F8", 1, 16),
    createCell("", true, AlignmentType.CENTER, 24, "F0F4F8", 1, 16),
    createCell("", true, AlignmentType.CENTER, 6, "F0F4F8", 1, 16),
  ];

  months.forEach(() => {
    for (let w = 1; w <= 4; w++) {
      headerRow2.push(createCell(w.toString(), true, AlignmentType.CENTER, weekWidth, "F1F5F9", 1, 16));
    }
  });

  const tableRows = [
    new TableRow({ children: headerRow1 }),
    new TableRow({ children: headerRow2 })
  ];

  items.forEach((item, index) => {
    const rowCells = [
      createCell((index + 1).toString(), false, AlignmentType.CENTER, 4, undefined, 1, 18),
      createCPCell(item.elemen || "", item.cp || "-", 20, 18),
      createCell(item.tujuanPembelajaran || "", false, AlignmentType.LEFT, 24, undefined, 1, 18),
      createCell(`${item.alokasiWaktu || 2} JP`, false, AlignmentType.CENTER, 6, undefined, 1, 18),
    ];

    months.forEach((month) => {
      for (let w = 1; w <= 4; w++) {
        const weekKey = `${month}-${w}`;
        const isChecked = item.weeks && !!item.weeks[weekKey];
        rowCells.push(createCell(isChecked ? "√" : "", false, AlignmentType.CENTER, weekWidth, undefined, 1, 18));
      }
    });

    tableRows.push(new TableRow({ children: rowCells }));
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
              width: 16838,
              height: 11906,
            },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: "PROGRAM SEMESTER (PROSEM)",
                bold: true,
                size: 28,
                font: "Inter",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: "KURIKULUM MERDEKA",
                bold: true,
                size: 24,
                font: "Inter",
              }),
            ],
          }),
          createHeaderInfo(profile, "PROGRAM SEMESTER (PROSEM)", mapel),
          new Paragraph({ spacing: { before: 200, after: 200 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),
          new Paragraph({ spacing: { before: 400, after: 400 } }),
          createSignatureBlock(profile, kelas, mapel),
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
};

// 5. Generate RPP DOCX (Converts HTML sections or rich details to elegant layout)
export const generateRPPDocx = async (profile: any, rpp: any): Promise<Blob> => {
  const sintaksRows = [
    new TableRow({
      children: [
        createCell("TAHAP PEMBELAJARAN", true, AlignmentType.CENTER, 20, "F0F4F8"),
        createCell("SINTAKS MODEL", true, AlignmentType.CENTER, 20, "F0F4F8"),
        createCell("DESKRIPSI KEGIATAN", true, AlignmentType.CENTER, 45, "F0F4F8"),
        createCell("ALOKASI WAKTU", true, AlignmentType.CENTER, 15, "F0F4F8"),
      ],
    }),
  ];

  (rpp.sintaksTable || []).forEach((row: any) => {
    sintaksRows.push(
      new TableRow({
        children: [
          createCell(row.tahap || "", true, AlignmentType.LEFT, 20),
          createCell(row.sintaks || "", false, AlignmentType.LEFT, 20),
          createCell(row.deskripsi || "", false, AlignmentType.LEFT, 45),
          createCell(row.alokasi || "", false, AlignmentType.CENTER, 15),
        ],
      })
    );
  });

  // Profil lulusan string
  const p5Text = (rpp.profilLulusan || []).join(", ");

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: "RENCANA PELAKSANAAN PEMBELAJARAN (RPP) MENDALAM",
                bold: true,
                size: 24,
                font: "Inter",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: "PEMBELAJARAN MENDALAM (DEEP LEARNING)",
                bold: true,
                size: 18,
                font: "Inter",
              }),
            ],
          }),
          
          // Identity details table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createCell("Satuan Pendidikan", true, AlignmentType.LEFT, 30),
                  createCell(rpp.namaSekolah || profile.sekolah || "-", false, AlignmentType.LEFT, 70),
                ]
              }),
              new TableRow({
                children: [
                  createCell("Mata Pelajaran", true, AlignmentType.LEFT, 30),
                  createCell(rpp.mapel || "-", false, AlignmentType.LEFT, 70),
                ]
              }),
              new TableRow({
                children: [
                  createCell("Kelas / Semester", true, AlignmentType.LEFT, 30),
                  createCell(`Kelas ${rpp.kelas || profile.kelas || "-"} / Semester ${rpp.semester || profile.semester || "1"}`, false, AlignmentType.LEFT, 70),
                ]
              }),
              new TableRow({
                children: [
                  createCell("Fase / Alokasi Waktu", true, AlignmentType.LEFT, 30),
                  createCell(`${rpp.fase || profile.fase || "-"} / ${rpp.alokasiWaktu || "-"}`, false, AlignmentType.LEFT, 70),
                ]
              }),
              new TableRow({
                children: [
                  createCell("Jumlah Pertemuan", true, AlignmentType.LEFT, 30),
                  createCell(`${rpp.pertemuan || "1"} Pertemuan`, false, AlignmentType.LEFT, 70),
                ]
              }),
            ]
          }),

          new Paragraph({ spacing: { before: 200 } }),
          
          new Paragraph({
            children: [
              new TextRun({ text: "A. CAPAIAN PEMBELAJARAN (CP)", bold: true, size: 22, font: "Inter" }),
            ]
          }),
          new Paragraph({
            spacing: { before: 60, after: 120 },
            children: [
              new TextRun({ text: rpp.cp || "-", size: 20, font: "Inter" }),
            ]
          }),

          new Paragraph({
            children: [
              new TextRun({ text: "B. TUJUAN PEMBELAJARAN (TP)", bold: true, size: 22, font: "Inter" }),
            ]
          }),
          new Paragraph({
            spacing: { before: 60, after: 120 },
            children: [
              new TextRun({ text: rpp.tujuanPembelajaran || "-", size: 20, font: "Inter" }),
            ]
          }),

          new Paragraph({
            children: [
              new TextRun({ text: "C. 8 PROFIL LULUSAN YANG RELEVAN", bold: true, size: 22, font: "Inter" }),
            ]
          }),
          new Paragraph({
            spacing: { before: 60, after: 120 },
            children: [
              new TextRun({ text: p5Text || "-", size: 20, font: "Inter" }),
            ]
          }),

          new Paragraph({
            children: [
              new TextRun({ text: "D. MEDIA, ALAT, DAN SUMBER BELAJAR", bold: true, size: 22, font: "Inter" }),
            ]
          }),
          new Paragraph({
            spacing: { before: 60, after: 120 },
            children: [
              new TextRun({ text: `Media: ${rpp.mediaPembelajaran || "-"}`, size: 20, font: "Inter" }),
            ]
          }),
          new Paragraph({
            spacing: { before: 60, after: 120 },
            children: [
              new TextRun({ text: `Alat/Bahan: ${rpp.alatPembelajaran || "-"}`, size: 20, font: "Inter" }),
            ]
          }),
          new Paragraph({
            spacing: { before: 60, after: 120 },
            children: [
              new TextRun({ text: `Sumber Belajar: ${rpp.sumberBelajar || "-"}`, size: 20, font: "Inter" }),
            ]
          }),

          new Paragraph({
            children: [
              new TextRun({ text: "E. MODEL & METODE PEMBELAJARAN", bold: true, size: 22, font: "Inter" }),
            ]
          }),
          new Paragraph({
            spacing: { before: 60, after: 120 },
            children: [
              new TextRun({ text: `Model: ${rpp.modelPembelajaran || "-"} | Metode: ${rpp.metodePembelajaran || "-"}`, size: 20, font: "Inter" }),
            ]
          }),

          new Paragraph({
            children: [
              new TextRun({ text: "F. GLOSARIUM", bold: true, size: 22, font: "Inter" }),
            ]
          }),
          new Paragraph({
            spacing: { before: 60, after: 120 },
            children: [
              new TextRun({ text: rpp.glosarium || "-", size: 20, font: "Inter" }),
            ]
          }),

          new Paragraph({
            children: [
              new TextRun({ text: "G. KESIAPAN PESERTA DIDIK", bold: true, size: 22, font: "Inter" }),
            ]
          }),
          new Paragraph({
            spacing: { before: 60, after: 120 },
            children: [
              new TextRun({ text: rpp.kesiapanPesertaDidik || "-", size: 20, font: "Inter" }),
            ]
          }),

          new Paragraph({
            children: [
              new TextRun({ text: "H. SINTAKS KEGIATAN PEMBELAJARAN (DEEP LEARNING)", bold: true, size: 22, font: "Inter" }),
            ]
          }),
          new Paragraph({ spacing: { before: 100, after: 100 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: sintaksRows,
          }),
          new Paragraph({ spacing: { before: 200 } }),

          new Paragraph({
            children: [
              new TextRun({ text: "I. EVALUASI, PENGAYAAN, DAN REMEDIAL", bold: true, size: 22, font: "Inter" }),
            ]
          }),
          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({ text: "1. Asesmen / Evaluasi Pembelajaran", bold: true, size: 20, font: "Inter", color: "1E293B" }),
            ]
          }),
          ...(rpp.evaluasi ? rpp.evaluasi.split("\n").map(line => 
            new Paragraph({
              spacing: { before: 20, after: 20 },
              indent: { left: 240 },
              children: [
                new TextRun({ text: line, size: 20, font: "Inter" }),
              ]
            })
          ) : [
            new Paragraph({
              indent: { left: 240 },
              children: [
                new TextRun({ text: "-", size: 20, font: "Inter" }),
              ]
            })
          ]),
          new Paragraph({ spacing: { before: 80 } }),
          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({ text: "2. Program Pembelajaran Pengayaan (Enrichment)", bold: true, size: 20, font: "Inter", color: "1E293B" }),
            ]
          }),
          ...(rpp.pengayaan ? rpp.pengayaan.split("\n").map(line => 
            new Paragraph({
              spacing: { before: 20, after: 20 },
              indent: { left: 240 },
              children: [
                new TextRun({ text: line, size: 20, font: "Inter" }),
              ]
            })
          ) : [
            new Paragraph({
              indent: { left: 240 },
              children: [
                new TextRun({ text: "-", size: 20, font: "Inter" }),
              ]
            })
          ]),
          new Paragraph({ spacing: { before: 80 } }),
          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({ text: "3. Program Pembelajaran Remedial", bold: true, size: 20, font: "Inter", color: "1E293B" }),
            ]
          }),
          ...(rpp.remedial ? rpp.remedial.split("\n").map(line => 
            new Paragraph({
              spacing: { before: 20, after: 20 },
              indent: { left: 240 },
              children: [
                new TextRun({ text: line, size: 20, font: "Inter" }),
              ]
            })
          ) : [
            new Paragraph({
              indent: { left: 240 },
              children: [
                new TextRun({ text: "-", size: 20, font: "Inter" }),
              ]
            })
          ]),
          new Paragraph({ spacing: { before: 120 } }),

          new Paragraph({
            children: [
              new TextRun({ text: "J. REFLEKSI GURU & PESERTA DIDIK", bold: true, size: 22, font: "Inter" }),
            ]
          }),
          new Paragraph({
            spacing: { before: 60, after: 60 },
            children: [
              new TextRun({ text: `Refleksi Guru: ${rpp.refleksiGuru || "-"}`, size: 20, font: "Inter" }),
            ]
          }),
          new Paragraph({
            spacing: { before: 60, after: 120 },
            children: [
              new TextRun({ text: `Refleksi Peserta Didik: ${rpp.refleksiSiswa || "-"}`, size: 20, font: "Inter" }),
            ]
          }),

          new Paragraph({ spacing: { before: 400, after: 400 } }),
          createSignatureBlock(profile, rpp.kelas, rpp.mapel),

          new Paragraph({
            children: [new PageBreak()]
          }),

          new Paragraph({
            children: [
              new TextRun({ text: "K. LAMPIRAN", bold: true, size: 22, font: "Inter" }),
            ]
          }),
          ...(rpp.lampiran ? rpp.lampiran.split("\n").map(line => 
            new Paragraph({
              spacing: { before: 20, after: 20 },
              children: [
                new TextRun({ text: line, size: 20, font: "Inter" }),
              ]
            })
          ) : [
            new Paragraph({
              children: [
                new TextRun({ text: "Tidak ada lampiran.", size: 20, font: "Inter" }),
              ]
            })
          ]),
          new Paragraph({ spacing: { before: 240 } }),
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
};

// 6. Generate Individual Lampiran (LKPD, Rubrik, Asesmen, Bahan Bacaan) DOCX
export const generateIndividualLampiranDocx = async (
  profile: any,
  mapel: string,
  topic: string,
  lampiranType: string,
  contentHtmlOrText: string
): Promise<Blob> => {
  const cleanText = (htmlStr: string) => {
    let text = (htmlStr || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, "");
    // Unescape common HTML entities
    text = text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    text = text.replace(/\n{3,}/g, "\n\n");
    return text.trim();
  };

  const plainContent = cleanText(contentHtmlOrText);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: lampiranType.toUpperCase(),
                bold: true,
                size: 24,
                font: "Inter"
              }),
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: "DOKUMEN PENDUKUNG PEMBELAJARAN MENDALAM",
                size: 14,
                color: "555555",
                font: "Inter"
              }),
            ]
          }),

          // Metadata Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createCell("Satuan Pendidikan", true, AlignmentType.LEFT, 30),
                  createCell(profile.sekolah || "-", false, AlignmentType.LEFT, 70),
                ]
              }),
              new TableRow({
                children: [
                  createCell("Mata Pelajaran", true, AlignmentType.LEFT, 30),
                  createCell(mapel || "-", false, AlignmentType.LEFT, 70),
                ]
              }),
              new TableRow({
                children: [
                  createCell("Fase / Kelas / Semester", true, AlignmentType.LEFT, 30),
                  createCell(`${profile.fase || "-"} / Kelas ${profile.kelas || "-"} / Semester ${profile.semester || "-"}`, false, AlignmentType.LEFT, 70),
                ]
              }),
              new TableRow({
                children: [
                  createCell("Materi Pokok", true, AlignmentType.LEFT, 30),
                  createCell(topic || "-", false, AlignmentType.LEFT, 70),
                ]
              }),
              new TableRow({
                children: [
                  createCell("Pendidik / Guru", true, AlignmentType.LEFT, 30),
                  createCell(getTeacherForKelas(profile, profile.kelas, mapel).nama || "-", false, AlignmentType.LEFT, 70),
                ]
              }),
            ]
          }),

          new Paragraph({ spacing: { before: 240 } }),

          // Divider Line
          new Paragraph({
            children: [
              new TextRun({
                text: "────────────────────────────────────────────────────────────────────────",
                color: "cccccc",
                font: "Inter"
              })
            ]
          }),

          new Paragraph({ spacing: { before: 120 } }),

          // Actual Content
          ...(plainContent ? plainContent.split("\n").map(line => {
            const isHeading = line.startsWith("###") || line.startsWith("##") || line.startsWith("#");
            const cleanLine = line.replace(/^[#\s]+/, "");
            return new Paragraph({
              spacing: { before: isHeading ? 140 : 60, after: 60 },
              children: [
                new TextRun({
                  text: cleanLine,
                  bold: isHeading || line.startsWith("LKPD:") || line.startsWith("RUBRIK:"),
                  size: isHeading ? 22 : 20,
                  font: "Inter"
                }),
              ]
            });
          }) : [
            new Paragraph({
              children: [
                new TextRun({ text: "Belum ada materi lampiran yang dibuat. Silakan gunakan tombol AI atau edit di panel.", italics: true, size: 20, font: "Inter" }),
              ]
            })
          ]),

          new Paragraph({ spacing: { before: 240 } }),
          createSignatureBlock(profile, profile.kelas, mapel),
        ]
      }
    ]
  });

  return await Packer.toBlob(doc);
};

export const generateCalendarDocx = async (profile: any, stats: any): Promise<Blob> => {
  const tableRows = [
    new TableRow({
      children: [
        createCell("STATISTIK KALENDER PENDIDIKAN", true, AlignmentType.CENTER, 100, "F0F4F8", 2, 22),
      ],
    }),
    new TableRow({
      children: [
        createCell("Hari Efektif Belajar (HEB)", true, AlignmentType.LEFT, 40, undefined, undefined, 22),
        createCell(`${stats.hariEfektif || 0} Hari`, false, AlignmentType.LEFT, 60, undefined, undefined, 22),
      ],
    }),
    new TableRow({
      children: [
        createCell("Hari Tidak Efektif", true, AlignmentType.LEFT, 40, undefined, undefined, 22),
        createCell(`${stats.hariTidakEfektif || 0} Hari`, false, AlignmentType.LEFT, 60, undefined, undefined, 22),
      ],
    }),
    new TableRow({
      children: [
        createCell("Jumlah Minggu Efektif", true, AlignmentType.LEFT, 40, undefined, undefined, 22),
        createCell(`${stats.jumlahMinggu || 0} Minggu`, false, AlignmentType.LEFT, 60, undefined, undefined, 22),
      ],
    }),
  ];

  const dayRows = [
    new TableRow({
      children: [
        createCell("HARI", true, AlignmentType.CENTER, 50, "F0F4F8", undefined, 22),
        createCell("JUMLAH HARI EFEKTIF", true, AlignmentType.CENTER, 50, "F0F4F8", undefined, 22),
      ],
    }),
    new TableRow({
      children: [
        createCell("Senin", false, AlignmentType.LEFT, 50, undefined, undefined, 22),
        createCell(`${stats.seninCount || 0} Hari`, false, AlignmentType.CENTER, 50, undefined, undefined, 22),
      ],
    }),
    new TableRow({
      children: [
        createCell("Selasa", false, AlignmentType.LEFT, 50, undefined, undefined, 22),
        createCell(`${stats.selasaCount || 0} Hari`, false, AlignmentType.CENTER, 50, undefined, undefined, 22),
      ],
    }),
    new TableRow({
      children: [
        createCell("Rabu", false, AlignmentType.LEFT, 50, undefined, undefined, 22),
        createCell(`${stats.rabuCount || 0} Hari`, false, AlignmentType.CENTER, 50, undefined, undefined, 22),
      ],
    }),
    new TableRow({
      children: [
        createCell("Kamis", false, AlignmentType.LEFT, 50, undefined, undefined, 22),
        createCell(`${stats.kamisCount || 0} Hari`, false, AlignmentType.CENTER, 50, undefined, undefined, 22),
      ],
    }),
    new TableRow({
      children: [
        createCell("Jumat", false, AlignmentType.LEFT, 50, undefined, undefined, 22),
        createCell(`${stats.jumatCount || 0} Hari`, false, AlignmentType.CENTER, 50, undefined, undefined, 22),
      ],
    }),
    new TableRow({
      children: [
        createCell("Sabtu", false, AlignmentType.LEFT, 50, undefined, undefined, 22),
        createCell(`${stats.sabtuCount || 0} Hari`, false, AlignmentType.CENTER, 50, undefined, undefined, 22),
      ],
    }),
  ];

  const holidayRows = [
    new TableRow({
      children: [
        createCell("KATEGORI LIBUR", true, AlignmentType.CENTER, 40, "F0F4F8", undefined, 22),
        createCell("RINCIAN / TANGGAL", true, AlignmentType.CENTER, 60, "F0F4F8", undefined, 22),
      ],
    }),
    new TableRow({
      children: [
        createCell("Hari Libur Nasional", true, AlignmentType.LEFT, 40, undefined, undefined, 22),
        createCell(stats.liburNasional || "-", false, AlignmentType.LEFT, 60, undefined, undefined, 22),
      ],
    }),
    new TableRow({
      children: [
        createCell("Libur Semester", true, AlignmentType.LEFT, 40, undefined, undefined, 22),
        createCell(stats.liburSemester || "-", false, AlignmentType.LEFT, 60, undefined, undefined, 22),
      ],
    }),
    new TableRow({
      children: [
        createCell("Libur Khusus / Keagamaan", true, AlignmentType.LEFT, 40, undefined, undefined, 22),
        createCell(stats.liburKhusus || "-", false, AlignmentType.LEFT, 60, undefined, undefined, 22),
      ],
    }),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: "ANALISIS KALENDER PENDIDIKAN",
                bold: true,
                size: 28,
                font: "Inter",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: "RINCIAN MINGGU EFEKTIF DAN HARI EFEKTIF BELAJAR",
                bold: true,
                size: 24,
                font: "Inter",
              }),
            ],
          }),
          createHeaderInfo(profile, "KALENDER PENDIDIKAN", "Semua Mata Pelajaran"),
          new Paragraph({ spacing: { before: 200, after: 200 } }),
          
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "1. Ringkasan Hari dan Minggu Efektif", bold: true, size: 24, font: "Inter" })
            ]
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),
          new Paragraph({ spacing: { before: 200, after: 200 } }),

          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "2. Distribusi Hari Efektif", bold: true, size: 24, font: "Inter" })
            ]
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: dayRows,
          }),
          new Paragraph({ spacing: { before: 200, after: 200 } }),

          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "3. Rincian Libur Sekolah", bold: true, size: 24, font: "Inter" })
            ]
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: holidayRows,
          }),
          new Paragraph({ spacing: { before: 400, after: 400 } }),
          createSignatureBlock(profile),
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
};
