import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

export interface ParsedExcelRow {
  date: string;
  description: string;
  amount: number;
  members: string;
  imageBase64?: string;
  imageMimeType?: string;
  rowIndex: number;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const arrayBuf = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuf);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(uint8 as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) return NextResponse.json({ error: "No worksheet found" }, { status: 400 });

    // Map images to their row index (0-based nativeRow from ExcelJS)
    const imageByRow = new Map<number, { base64: string; mimeType: string }>();
    try {
      const images = worksheet.getImages();
      for (const img of images) {
        const imageData = workbook.getImage(img.imageId as unknown as number);
        if (imageData?.buffer) {
          const ext = (imageData.extension ?? "png").toLowerCase().replace("jpeg", "jpg");
          const mimeType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
          // range.tl.nativeRow is 0-based; row 0 = header, row 1+ = data
          const rowIdx = typeof img.range?.tl?.nativeRow === "number" ? img.range.tl.nativeRow : -1;
          if (rowIdx >= 1) {
            imageByRow.set(rowIdx, {
              base64: Buffer.from(imageData.buffer as ArrayBuffer).toString("base64"),
              mimeType,
            });
          }
        }
      }
    } catch (imgErr) {
      console.warn("[ParseExcel] Image extraction failed (non-fatal):", imgErr);
    }

    // Find header row to detect column positions
    let headerRow = 1;
    let colDate = 0, colDesc = 1, colAmount = 2, colMembers = 3;

    const firstRow = worksheet.getRow(1);
    firstRow.eachCell((cell, colNum) => {
      const val = (cell.value?.toString() ?? "").toLowerCase().trim();
      if (val.includes("date")) colDate = colNum - 1;
      else if (val.includes("desc") || val.includes("expense") && !val.includes("amount")) colDesc = colNum - 1;
      else if (val.includes("amount")) colAmount = colNum - 1;
      else if (val.includes("member") || val.includes("paid") || val.includes("name")) colMembers = colNum - 1;
    });

    const rows: ParsedExcelRow[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRow) return; // skip header

      const cells = row.values as any[]; // ExcelJS row.values is 1-indexed (index 0 is empty)
      const getCell = (idx: number) => {
        const v = cells[idx + 1]; // +1 because ExcelJS is 1-indexed
        if (v === null || v === undefined) return "";
        if (typeof v === "object" && "text" in v) return v.text;
        if (v instanceof Date) return v.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
        return String(v).trim();
      };

      const date    = getCell(colDate);
      const desc    = getCell(colDesc);
      const amtStr  = getCell(colAmount);
      const members = getCell(colMembers);

      if (!date && !desc && !amtStr) return; // skip truly empty rows

      const amount = parseFloat(amtStr.replace(/[^0-9.]/g, "")) || 0;

      const imgData = imageByRow.get(rowNumber - 1); // ExcelJS nativeRow is 0-based, rowNumber is 1-based
      rows.push({
        date,
        description: desc,
        amount,
        members: members || "Self",
        imageBase64: imgData?.base64,
        imageMimeType: imgData?.mimeType,
        rowIndex: rowNumber - headerRow,
      });
    });

    return NextResponse.json({ rows, total: rows.length });
  } catch (err) {
    console.error("[ParseExcel] Error:", err);
    return NextResponse.json({ error: "Failed to parse Excel file" }, { status: 500 });
  }
}
