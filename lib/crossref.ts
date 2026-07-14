// הצלבת נתוני החילוץ מול הרשימות הקיימות: נרמול שמות, התאמה מקורבת (fuzzy),
// ובניית ההצעות למסך האישור. פונקציות טהורות בלבד — בלי רשת ובלי סודות.

import { dateToMonthYear } from "./hebrew-dates";
import type { Extracted, Lists, Mappings, Suggestions } from "./types";

// מנקה שם לצורך השוואה: מסיר גרשיים לכל סוגיהם, סימני פיסוק, סיומות משפטיות (בע"מ / LTD) ורווחים כפולים.
export function normalizeName(s: string): string {
  let t = s.normalize("NFKC");
  // גרשיים ומרכאות בכל הצורות: רגילות, גרש/גרשיים עבריים (u05F3/u05F4) ומסולסלות (u2018-u201D)
  t = t.replace(/["'`׳״‘’“”]/g, "");
  t = t.replace(/[.,\-_/\\()]/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  // הערה: \b של JavaScript לא עובד עם אותיות עבריות, לכן העוגנים הם רווח/קצה מחרוזת
  t = t.replace(/(^|\s)(בעמ|בע מ|ltd|inc|llc)(?=\s|$)/gi, " ").trim();
  t = t.replace(/\s+/g, " ").trim();
  return t.toLowerCase();
}

function bigrams(s: string): Map<string, number> {
  const grams = new Map<string, number>();
  const t = s.replace(/\s+/g, "");
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    grams.set(g, (grams.get(g) ?? 0) + 1);
  }
  return grams;
}

// דמיון Dice על צמדי אותיות: 1 = זהים, 0 = שונים לגמרי.
export function diceSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ga = bigrams(a);
  const gb = bigrams(b);
  let overlap = 0;
  let sizeA = 0;
  let sizeB = 0;
  for (const n of ga.values()) sizeA += n;
  for (const n of gb.values()) sizeB += n;
  if (sizeA === 0 || sizeB === 0) return 0;
  for (const [g, n] of ga) overlap += Math.min(n, gb.get(g) ?? 0);
  return (2 * overlap) / (sizeA + sizeB);
}

export const FUZZY_THRESHOLD = 0.82;

export function matchSupplier(
  officialName: string,
  suppliers: string[],
  aliases: Record<string, string>,
): { value: string; source: "mapping" | "fuzzy" | null; isNew: boolean } {
  const norm = normalizeName(officialName);
  // 1. מילון הכינויים שנלמד (שלב ב')
  const alias = aliases[norm];
  if (alias) return { value: alias, source: "mapping", isNew: false };
  // 2. התאמה מדויקת אחרי נרמול
  for (const s of suppliers) {
    if (normalizeName(s) === norm) return { value: s, source: "fuzzy", isNew: false };
  }
  // 3. התאמה מקורבת עם סף גבוה
  let best: string | null = null;
  let bestScore = 0;
  for (const s of suppliers) {
    const score = diceSimilarity(norm, normalizeName(s));
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  if (best && bestScore >= FUZZY_THRESHOLD) {
    return { value: best, source: "fuzzy", isNew: false };
  }
  // ספק חדש — ברירת המחדל היא השם הרשמי, וויקי מחליטה איך לרשום אותו
  return { value: officialName.trim(), source: null, isNew: true };
}

function guessProject(
  extracted: Extracted,
  projects: string[],
  addresses: Record<string, string>,
): { value: string | null; source: "mapping" | "model" | null } {
  // 1. מילון הכתובות שנלמד (שלב ב')
  for (const hint of extracted.address_or_project_hints) {
    const normHint = normalizeName(hint);
    if (!normHint) continue;
    if (addresses[normHint]) return { value: addresses[normHint], source: "mapping" };
    for (const [key, project] of Object.entries(addresses)) {
      if (key && (normHint.includes(key) || key.includes(normHint))) {
        return { value: project, source: "mapping" };
      }
    }
  }
  // 2. הניחוש של המודל — רק אם הוא באמת ברשימה הסגורה
  if (extracted.project_guess) {
    const hit = projects.find(
      (p) => normalizeName(p) === normalizeName(extracted.project_guess as string),
    );
    if (hit) return { value: hit, source: "model" };
  }
  return { value: null, source: null };
}

function guessWorkType(
  extracted: Extracted,
  workTypes: string[],
): { value: string | null; source: "model" | null } {
  if (extracted.work_type_guess) {
    const hit = workTypes.find(
      (w) => normalizeName(w) === normalizeName(extracted.work_type_guess as string),
    );
    if (hit) return { value: hit, source: "model" };
  }
  return { value: null, source: null };
}

// בונה את כל ההצעות למסך האישור. סדר עדיפויות: מיפוי שנלמד > התאמה מקורבת > ניחוש מודל > ריק.
export function resolveSuggestions(
  extracted: Extracted,
  lists: Lists,
  mappings: Mappings,
): Suggestions {
  const supplier: { value: string | null; source: "mapping" | "fuzzy" | null; isNew: boolean } =
    extracted.supplier_name
      ? matchSupplier(extracted.supplier_name, lists.suppliers, mappings.aliases)
      : { value: null, source: null, isNew: false };

  const project = guessProject(extracted, lists.projects, mappings.addresses);
  const workType = guessWorkType(extracted, lists.workTypes);
  const monthYear = dateToMonthYear(extracted.invoice_date);

  return {
    supplier: {
      value: supplier.value,
      source: supplier.source,
      isNew: supplier.isNew,
      officialName: extracted.supplier_name,
    },
    project,
    workType,
    month: monthYear?.month ?? null,
    year: monthYear?.year ?? null,
  };
}
