// בניית שורת הגיליון — מקור האמת היחיד לסדר העמודות A עד Q.
// אם ויקי אי פעם תשנה את מבנה העמודות — זה הקובץ היחיד שצריך לעדכן.

import { escapeCellText } from "./validate";
import type { ConfirmRequest, RowPreviewCell } from "./types";

export const SHEET_HEADERS = [
  "פרויקט", // A
  "מחיר חוזה ויקוס", // B — נשאר ריק
  "עלות ספק", // C — נשאר ריק
  "שנה", // D
  "חודש", // E
  "הוצאות כלליות", // F — נשאר ריק
  "שולם בפועל הוצאות כלליות", // G — נשאר ריק
  "סוג עבודה", // H
  "ספק", // I
  "סכום לתשלום", // J
  "שולם בפועל", // K — ויקי ממלאת ידנית
  "יתרה לתשלום", // L — נוסחה, נכתבת אחרי ה-append (שלב ב')
  "סיווג", // M
  "לקוח", // N — נשאר ריק
  "התקבל בפועל", // O — נשאר ריק
  "צפי לקבל", // P — נשאר ריק
  "מספר חשבונית", // Q
] as const;

export const COL_LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q",
] as const;

// מערך של בדיוק 17 תאים. עמודות ריקות נשלחות כמחרוזת ריקה (לא מדלגים) כדי לשמור יישור מלא A-Q.
export function buildRow(c: ConfirmRequest): (string | number)[] {
  return [
    escapeCellText(c.project), // A
    "", // B
    "", // C
    c.year, // D — מספר
    c.month, // E — שם חודש בעברית מהרשימה הסגורה
    "", // F
    "", // G
    escapeCellText(c.workType), // H
    escapeCellText(c.supplier), // I
    c.amountBeforeVat, // J — מספר
    "", // K
    "", // L — הנוסחה נכתבת בנפרד אחרי שיודעים לאיזו שורה נחתנו
    escapeCellText(c.classification), // M
    "", // N
    "", // O
    "", // P
    "'" + c.invoiceNumber.trim(), // Q — גרש מוביל: נשמר תמיד כטקסט (00123 לא הופך ל-123)
  ];
}

// תצוגה ידידותית של השורה למסך ההצלחה (בלי גרש-הבריחה של Q).
export function buildRowPreview(c: ConfirmRequest): RowPreviewCell[] {
  const display: string[] = [
    c.project,
    "",
    "",
    String(c.year),
    c.month,
    "",
    "",
    c.workType,
    c.supplier,
    c.amountBeforeVat.toLocaleString("he-IL", { maximumFractionDigits: 2 }),
    "",
    "=J{שורה}-K{שורה} (נוסחה)",
    c.classification,
    "",
    "",
    "",
    c.invoiceNumber.trim(),
  ];
  return display.map((value, i) => ({
    col: COL_LETTERS[i],
    header: SHEET_HEADERS[i],
    value,
  }));
}
