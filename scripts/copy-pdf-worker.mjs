// מעתיק את ה-worker של pdf.js (הקובץ שמפענח PDF ברקע בדפדפן) לתיקייה הציבורית.
// רץ אוטומטית אחרי כל npm install (postinstall) — כך גרסת ה-worker תמיד זהה
// לגרסת pdfjs-dist שמותקנת, אחרת pdf.js מסרב לעבוד (בדיקת התאמת גרסאות).
// הקובץ המועתק לא נכנס ל-git (ראו .gitignore) — הוא נוצר מחדש בכל התקנה, גם ב-Vercel.

import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const destDir = path.join(root, "public");
const dest = path.join(destDir, "pdf.worker.min.mjs");

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("[VIKOS] pdf.js worker copied to public/pdf.worker.min.mjs");
