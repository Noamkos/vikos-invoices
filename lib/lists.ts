// חישוב הרשימות בפועל מתוך רשימות הבסיס (מהגיליון) + ההתאמות האישיות.
// פונקציות טהורות בלבד.

import type { ListKind, ListOverrides, Lists } from "./types";

export const LIST_KINDS: ListKind[] = ["projects", "workTypes", "suppliers"];

export function emptyOverrides(): ListOverrides {
  return {
    added: { projects: [], workTypes: [], suppliers: [] },
    hidden: { projects: [], workTypes: [], suppliers: [] },
  };
}

function dedupeSorted(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out.sort((a, b) => a.localeCompare(b, "he"));
}

// הרשימות שמוצגות בהשלמה האוטומטית ונשלחות למודל: (בסיס פחות מוסתרים) ועוד מה שנוסף ידנית.
export function suggestionLists(base: Lists, o: ListOverrides): Lists {
  const build = (kind: ListKind) => {
    const hidden = new Set(o.hidden[kind].map((v) => v.trim()));
    return dedupeSorted([
      ...base[kind].filter((v) => !hidden.has(v.trim())),
      ...o.added[kind],
    ]);
  };
  return {
    projects: build("projects"),
    workTypes: build("workTypes"),
    suppliers: build("suppliers"),
  };
}

// הרשימות לצורך אימות בעת האישור: בסיס ועוד מה שנוסף. ערך מוסתר עדיין תקין —
// ההסתרה משפיעה רק על ההצעות, לא על מה שמותר להכניס לטבלה.
export function validationLists(base: Lists, o: ListOverrides): Lists {
  return {
    projects: dedupeSorted([...base.projects, ...o.added.projects]),
    workTypes: dedupeSorted([...base.workTypes, ...o.added.workTypes]),
    suppliers: dedupeSorted([...base.suppliers, ...o.added.suppliers]),
  };
}

const MAX_VALUE_LEN = 60;
const MAX_ITEMS = 300;

// ניקוי קלט שמגיע מהדפדפן לפני שמירה — צורה תקינה, בלי כפילויות, בלי ערכים חריגים.
export function sanitizeOverrides(raw: unknown): ListOverrides {
  const out = emptyOverrides();
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Partial<Record<"added" | "hidden", Partial<Record<ListKind, unknown>>>>;
  for (const group of ["added", "hidden"] as const) {
    for (const kind of LIST_KINDS) {
      const arr = r[group]?.[kind];
      if (!Array.isArray(arr)) continue;
      out[group][kind] = arr
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter((v) => v.length > 0 && v.length <= MAX_VALUE_LEN)
        .slice(0, MAX_ITEMS);
    }
  }
  return out;
}
