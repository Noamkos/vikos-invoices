// POST /api/extract — מקבל את קובצי החשבונית, מחלץ עם Claude, מצליב מול הרשימות,
// ומחזיר לדפדפן את כל מה שמסך האישור צריך.
// שלב ב': להוסיף כאן בדיקת התחברות (requireUser) בשורה הראשונה.

import { NextRequest, NextResponse } from "next/server";
import { ExtractionError, extractInvoice, type InputFile } from "@/lib/extraction";
import { resolveSuggestions } from "@/lib/crossref";
import { reconcileAmounts } from "@/lib/validate";
import { getProvider } from "@/lib/sheets/provider";
import type { ExtractResponse } from "@/lib/types";

export const maxDuration = 60; // הקריאה ל-Claude יכולה לקחת עשרות שניות

const MAX_FILE_BYTES = 4 * 1024 * 1024; // מגבלת Vercel היא 4.5MB לכל הבקשה
const MAX_IMAGES = 8;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function fail(status: number, error: string, message: string) {
  return NextResponse.json({ ok: false, error, message } satisfies ExtractResponse, {
    status,
  });
}

// GET — מחזיר רק את הרשימות, למצב מילוי ידני (כשהחילוץ נכשל והטופס נפתח ריק)
export async function GET() {
  try {
    const lists = await getProvider().getLists();
    return NextResponse.json({ ok: true, lists });
  } catch (err) {
    console.error("[VIKOS] lists error:", err);
    return NextResponse.json(
      { ok: false, error: "lists_failed", message: "לא הצלחנו לטעון את הרשימות" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  let files: File[];
  try {
    const form = await req.formData();
    files = form.getAll("files").filter((f): f is File => f instanceof File);
  } catch {
    return fail(400, "bad_request", "הבקשה לא הגיעה בפורמט הצפוי");
  }

  if (files.length === 0) return fail(400, "no_file", "לא הועלה קובץ");

  const pdfs = files.filter((f) => f.type === "application/pdf");
  if (pdfs.length > 0 && files.length > 1) {
    return fail(400, "mixed_files", "קובץ PDF יש להעלות לבד, בלי קבצים נוספים");
  }
  if (files.length > MAX_IMAGES) {
    return fail(400, "too_many_files", "אפשר להעלות עד " + MAX_IMAGES + " עמודים לחשבונית אחת");
  }

  for (const f of files) {
    if (!ALLOWED_TYPES.has(f.type)) {
      return fail(
        415,
        "unsupported_type",
        "פורמט הקובץ אינו נתמך (" + (f.type || "לא ידוע") + "). נתמכים: PDF, JPG, PNG, WebP",
      );
    }
    if (f.size > MAX_FILE_BYTES) {
      return fail(
        413,
        "file_too_large",
        "הקובץ גדול מדי (מעל 4MB). אם זה PDF כבד — צלמו את העמוד במקום",
      );
    }
  }

  // גם הסכום הכולל מוגבל — מגבלת Vercel היא על כל הבקשה יחד, לא על כל קובץ בנפרד
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  if (totalBytes > MAX_FILE_BYTES) {
    return fail(
      413,
      "payload_too_large",
      "סך כל הקבצים גדול מדי — העלו פחות עמודים בכל פעם",
    );
  }

  try {
    const inputs: InputFile[] = await Promise.all(
      files.map(async (f) => ({
        data: Buffer.from(await f.arrayBuffer()),
        mediaType: f.type,
      })),
    );

    const provider = getProvider();
    const [lists, mappings] = await Promise.all([
      provider.getLists(),
      provider.getMappings(),
    ]);

    const { extracted, mock } = await extractInvoice(inputs, lists);

    if (!extracted.is_invoice) {
      return fail(
        422,
        "not_an_invoice",
        "הקובץ לא נראה כמו חשבונית — כדאי לבדוק שהועלה הקובץ הנכון",
      );
    }

    // בדיקת החשבון: אם הסכום לא עבר אימות צולב — לא מציגים אותו בכלל
    const { trusted, warnings } = reconcileAmounts(extracted);
    const safeExtracted = trusted
      ? extracted
      : { ...extracted, amount_before_vat: null };

    const suggestions = resolveSuggestions(safeExtracted, lists, mappings);

    const body: ExtractResponse = {
      ok: true,
      mock,
      extracted: safeExtracted,
      suggestions,
      lists,
      warnings,
    };
    return NextResponse.json(body);
  } catch (err) {
    if (err instanceof ExtractionError) {
      if (err.code === "refusal") {
        return fail(422, "refusal", "לא ניתן היה לעבד את הקובץ — אפשר למלא את הפרטים ידנית");
      }
      if (err.code === "truncated") {
        return fail(502, "truncated", "הקריאה נקטעה באמצע — נסו שוב");
      }
      console.error("[VIKOS] extraction api_error:", err.message);
      return fail(502, "extraction_failed", "לא הצלחנו לקרוא את החשבונית אוטומטית — אפשר למלא את הפרטים ידנית");
    }
    console.error("[VIKOS] extract unexpected:", err);
    return fail(500, "extraction_failed", "תקלה לא צפויה — אפשר למלא את הפרטים ידנית");
  }
}
