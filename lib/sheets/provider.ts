// "החוזה" של שכבת הגיליון: כל שאר הקוד מדבר רק עם הממשק הזה,
// ולא יודע אם מאחוריו עומד מצב דמו (שלב א') או Google Sheets אמיתי (שלב ב').

import "server-only";
import type { ListOverrides, Lists, Mappings } from "../types";
import { demoProvider } from "./demo";

export type DuplicateHit = { row: number; month: string; year: number };

export type LearnedMapping = {
  officialName: string | null;
  supplier: string;
  addressHints: string[];
  project: string;
};

export interface SheetProvider {
  getLists(): Promise<Lists>;
  getMappings(): Promise<Mappings>;
  findDuplicate(invoiceNumber: string, supplier: string): Promise<DuplicateHit | null>;
  // הכתיבה היחידה שקיימת במערכת: הוספת שורה חדשה בסוף. אין עדכון ואין מחיקה.
  appendRow(row: (string | number)[]): Promise<{ row: number | null }>;
  saveMappings(learned: LearnedMapping): Promise<void>;
  // התאמות אישיות לרשימות ההשלמה (הוספה/הסתרה) — משפיעות רק על ההצעות באתר
  getListOverrides(): Promise<ListOverrides>;
  saveListOverrides(overrides: ListOverrides): Promise<void>;
}

export function getProvider(): SheetProvider {
  if (process.env.SPREADSHEET_ID) {
    // שלב ב': כאן ייכנס המימוש האמיתי מול Google Sheets (lib/sheets/google.ts)
    throw new Error(
      "חיבור Google Sheets יגיע בשלב ב'. כרגע יש להשאיר את SPREADSHEET_ID ריק כדי לעבוד במצב דמו.",
    );
  }
  return demoProvider;
}
