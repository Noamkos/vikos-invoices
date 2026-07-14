// שמות החודשים בעברית — הרשימה הסגורה היחידה שמותר לכתוב לעמודה E.
// בשלב ב': לפני החיבור לגיליון האמיתי, לוודא שהאיות כאן זהה לאיות הקיים בעמודה E (למשל "מרץ" מול "מרס").

export const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
] as const;

export type HebrewMonth = (typeof HEBREW_MONTHS)[number];

// ממיר תאריך ISO (למשל "2026-06-15") לחודש עברי ושנה. תאריך לא תקין -> null (לעולם לא מנחשים).
export function dateToMonthYear(
  isoDate: string | null,
): { month: HebrewMonth; year: number } | null {
  if (!isoDate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const monthNum = Number(m[2]);
  const day = Number(m[3]);
  if (monthNum < 1 || monthNum > 12 || day < 1 || day > 31) return null;
  if (year < 2000 || year > 2100) return null;
  return { month: HEBREW_MONTHS[monthNum - 1], year };
}
