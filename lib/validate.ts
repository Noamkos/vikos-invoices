// שכבת הבטיחות בין ה-AI לבין הטבלה:
// 1. reconcileAmounts — בדיקת החשבון (לפני מע"מ + מע"מ = סה"כ) שמונעת סכום שגוי שנראה אמין.
// 2. validateConfirm — בדיקת כל שדה לפני כתיבה, עם הודעות שגיאה בעברית.
// 3. escapeCellText — הגנה מפני ערכים שגיליון היה "מתקן" או מפרש כנוסחה.

import { HEBREW_MONTHS } from "./hebrew-dates";
import { normalizeName } from "./crossref";
import type { ConfirmRequest, Extracted, Lists, Warning } from "./types";

const ILS_CODES = new Set(["ILS", "NIS", "SHEKEL"]);

export function isForeignCurrency(currency: string | null): boolean {
  if (!currency) return false;
  return !ILS_CODES.has(currency.trim().toUpperCase());
}

// טווח מע"מ סביר בישראל (17%-18% בתוספת שולי עיגול)
const VAT_RATIO_MIN = 0.16;
const VAT_RATIO_MAX = 0.19;
const VAT_TOLERANCE_ILS = 1; // סטייה מותרת בשקלים בבדיקת הסכום

export type Reconciliation = { trusted: boolean; warnings: Warning[] };

// הבדיקה הקריטית ביותר במערכת: אם אי אפשר לאמת שהסכום שחולץ הוא באמת "לפני מע"מ" —
// לא מציגים אותו בכלל (trusted=false), וויקי מקלידה ידנית מול החשבונית.
export function reconcileAmounts(e: Extracted): Reconciliation {
  const warnings: Warning[] = [];
  const before = e.amount_before_vat;
  const vat = e.vat_amount;
  const total = e.amount_total;

  if (isForeignCurrency(e.currency)) {
    warnings.push({
      code: "foreign_currency",
      field: "amount",
      message:
        "החשבונית אינה בשקלים (" +
        (e.currency ?? "") +
        ") — יש להזין ידנית את הסכום בשקלים, ולרשום את המטבע והסכום המקוריים בשדה הסיווג",
    });
    return { trusted: false, warnings };
  }

  if (e.document_type === "חשבונית זיכוי" || (before !== null && before < 0)) {
    warnings.push({
      code: "credit_invoice",
      field: "amount",
      message: "זוהתה חשבונית זיכוי — הסכום נכנס כשלילי. לוודא מול המסמך",
    });
  }

  if (
    e.document_type &&
    e.document_type !== "חשבונית מס" &&
    e.document_type !== "חשבונית מס-קבלה" &&
    e.document_type !== "חשבונית זיכוי"
  ) {
    warnings.push({
      code: "non_tax_invoice",
      message:
        e.document_type === "אחר"
          ? "שימו לב: המסמך לא זוהה כחשבונית מס. אם חשבונית המס תגיע בהמשך — עלול להיווצר רישום כפול"
          : "שימו לב: זו " +
            e.document_type +
            ", לא חשבונית מס. אם חשבונית המס תגיע בהמשך — עלול להיווצר רישום כפול",
    });
  }

  if (before === null) {
    // אין סכום — השדה יישאר ריק וחובה. אין מה לאמת.
    return { trusted: false, warnings };
  }

  const absBefore = Math.abs(before);

  if (vat !== null && total !== null) {
    const sumOk = Math.abs(before + vat - total) <= VAT_TOLERANCE_ILS;
    // בחשבונית זיכוי כל הסכומים שליליים — לכן היחס נבדק על ערכים מוחלטים, עם דרישת סימן אחיד
    const absVat = Math.abs(vat);
    const sameSign = vat === 0 || Math.sign(vat) === Math.sign(before);
    const ratioOk =
      vat === 0 ||
      (sameSign &&
        absBefore > 0 &&
        absVat / absBefore >= VAT_RATIO_MIN &&
        absVat / absBefore <= VAT_RATIO_MAX);
    if (sumOk && ratioOk) {
      if (vat === 0) {
        warnings.push({
          code: "zero_vat",
          field: "amount",
          message: "בחשבונית אין מע\"מ (עוסק פטור?) — הסכום לתשלום שווה לסכום לפני מע\"מ. לוודא",
        });
      }
      return { trusted: true, warnings };
    }
    warnings.push({
      code: "vat_mismatch",
      field: "amount",
      message:
        "הסכומים בחשבונית לא מסתדרים חשבונאית (לפני מע\"מ + מע\"מ לא שווה לסה\"כ) — יש להזין את הסכום לפני מע\"מ ידנית מול החשבונית",
    });
    return { trusted: false, warnings };
  }

  if (total !== null) {
    const ratio = absBefore > 0 ? Math.abs(total) / absBefore : 0;
    const sameSign = Math.sign(total) === Math.sign(before);
    if (sameSign && ratio >= 1 + VAT_RATIO_MIN && ratio <= 1 + VAT_RATIO_MAX) {
      return { trusted: true, warnings };
    }
    warnings.push({
      code: "vat_mismatch",
      field: "amount",
      message:
        "היחס בין הסכום לפני מע\"מ לסה\"כ בחשבונית לא תואם מע\"מ רגיל — יש לוודא את הסכום ידנית מול החשבונית",
    });
    return { trusted: false, warnings };
  }

  // אין סה"כ ואין מע"מ — אין בדיקה צולבת. משאירים את הסכום אבל מדגישים.
  warnings.push({
    code: "no_cross_check",
    field: "amount",
    message: "לא נמצא בחשבונית סה\"כ לבדיקה צולבת — לוודא את הסכום מול המסמך",
  });
  return { trusted: true, warnings };
}

// ---- בדיקת הטופס לפני כתיבה ----

export const AMOUNT_MIN = 0.01;
export const AMOUNT_MAX = 5_000_000;
export const YEAR_MIN = 2018;

// ממיר קלט סכום (עם פסיקים / שקל) למספר. לא תקין -> null.
// פסיק מתקבל רק כמפריד אלפים במקום הנכון (1,250,000.75) — "12,50" בסגנון אירופי נדחה, לא מתפרש כ-1250.
export function parseAmount(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[₪\s]/g, "");
  let body: string;
  if (cleaned.includes(",")) {
    if (!/^-?\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(cleaned)) return null;
    body = cleaned.replace(/,/g, "");
  } else {
    body = cleaned;
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(body)) return null;
  const n = Number(body);
  return Number.isFinite(n) ? n : null;
}

const INVOICE_NUMBER_RE = /^[0-9A-Za-z֐-׿\-/. ]+$/;

export function validateConfirm(
  req: ConfirmRequest,
  lists: Lists,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const currentYear = new Date().getFullYear();

  if (!req.supplier?.trim()) errors.supplier = "שדה חובה";
  else if (req.supplier.trim().length > 100) errors.supplier = "שם ארוך מדי (עד 100 תווים)";

  if (!req.invoiceNumber?.trim()) errors.invoiceNumber = "שדה חובה";
  else if (req.invoiceNumber.trim().length > 40) errors.invoiceNumber = "ארוך מדי (עד 40 תווים)";
  else if (!INVOICE_NUMBER_RE.test(req.invoiceNumber.trim()))
    errors.invoiceNumber = "מכיל תווים לא צפויים";

  if (!(HEBREW_MONTHS as readonly string[]).includes(req.month)) errors.month = "יש לבחור חודש";

  if (!Number.isInteger(req.year)) errors.year = "שנה לא תקינה";
  else if (req.year < YEAR_MIN || req.year > currentYear + 1)
    errors.year = "השנה מחוץ לטווח הסביר (" + YEAR_MIN + " עד " + (currentYear + 1) + ")";

  if (typeof req.amountBeforeVat !== "number" || !Number.isFinite(req.amountBeforeVat)) {
    errors.amount = "שדה חובה — מספר בלבד";
  } else {
    const abs = Math.abs(req.amountBeforeVat);
    if (abs < AMOUNT_MIN) errors.amount = "הסכום לא יכול להיות אפס";
    else if (abs > AMOUNT_MAX) errors.amount = "הסכום חריג — לבדוק שוב";
    // השוואה עם סובלנות זעירה: במספרים עשרוניים בינאריים 128.02*100 אינו בדיוק 12802,
    // והשוואה מדויקת הייתה דוחה בטעות סכומים תקינים לגמרי
    else if (Math.abs(req.amountBeforeVat * 100 - Math.round(req.amountBeforeVat * 100)) > 1e-6)
      errors.amount = "עד שתי ספרות אחרי הנקודה";
  }

  if (!req.project?.trim()) errors.project = "שדה חובה";
  else if (!lists.projects.includes(req.project)) errors.project = "הפרויקט אינו ברשימה";

  if (!req.workType?.trim()) errors.workType = "שדה חובה";
  else if (req.workType.trim().length > 50) errors.workType = "ארוך מדי (עד 50 תווים)";
  else if (!req.workTypeIsNew && !lists.workTypes.includes(req.workType))
    errors.workType = "סוג העבודה אינו ברשימה";

  if (req.classification && req.classification.length > 120)
    errors.classification = "ארוך מדי (עד 120 תווים)";

  return errors;
}

// ---- כפילות בתוך התור עצמו ----

export type BatchDuplicate = { first: number; second: number };

// שתי חשבוניות זהות (אותו ספק אחרי נרמול + אותו מספר חשבונית) בתוך אותה שליחה —
// כנראה אותו קובץ הועלה פעמיים. בדיקת הכפילות מול הטבלה לא תופסת את זה,
// כי אף אחת מהן עוד לא בטבלה. force על הפריט המאוחר = "ידוע לי, להכניס בכל זאת".
// המדדים שמוחזרים הם מיקומים במערך שהתקבל — המתקשר אחראי למפות אותם חזרה לתור.
export function findBatchDuplicate(
  items: Pick<ConfirmRequest, "invoiceNumber" | "supplier" | "force">[],
): BatchDuplicate | null {
  const seen = new Map<string, number>();
  for (const [i, it] of items.entries()) {
    const key = normalizeName(it.supplier) + "|" + it.invoiceNumber.trim();
    const first = seen.get(key);
    if (first !== undefined && !it.force) return { first, second: i };
    if (first === undefined) seen.set(key, i);
  }
  return null;
}

// הגנה על תאי טקסט: מרכאות מסולסלות מוחלפות בישרות, וערך שמתחיל בתו נוסחה
// (= + - @) מקבל גרש מוביל כדי ש-Google Sheets ישמור אותו כטקסט ולא יריץ אותו.
export function escapeCellText(s: string): string {
  let t = s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .trim();
  if (/^[=+\-@]/.test(t)) t = "'" + t;
  return t;
}
