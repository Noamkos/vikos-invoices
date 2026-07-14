// כלי בדיקת חילוץ מהטרמינל — הדרך לבדוק דיוק על חשבוניות אמיתיות בלי מסך.
//
// שימוש (כשהשרת המקומי רץ — npm run dev בטרמינל אחר):
//   node scripts/test-extract.mjs path/to/invoice.pdf
//   node scripts/test-extract.mjs page1.jpg page2.jpg      (כמה עמודים של אותה חשבונית)
//
// אפשר לכוון לשרת אחר: EXTRACT_URL=https://.../api/extract node scripts/test-extract.mjs ...

import fs from "node:fs";
import path from "node:path";

const MIME_BY_EXT = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("שימוש: node scripts/test-extract.mjs <קובץ חשבונית> [עמודים נוספים...]");
  process.exit(1);
}

const url = process.env.EXTRACT_URL || "http://localhost:3000/api/extract";
const form = new FormData();

for (const p of args) {
  if (!fs.existsSync(p)) {
    console.error("הקובץ לא נמצא: " + p);
    process.exit(1);
  }
  const ext = path.extname(p).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) {
    console.error("סיומת לא נתמכת: " + ext + " (נתמכות: pdf, jpg, png, webp)");
    process.exit(1);
  }
  const buf = fs.readFileSync(p);
  form.append("files", new Blob([buf], { type: mime }), path.basename(p));
}

console.log("שולח " + args.length + " קבצים אל " + url + " ...\n");
const started = Date.now();

try {
  const res = await fetch(url, { method: "POST", body: form });
  const data = await res.json();
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(JSON.stringify(data, null, 2));
  console.log("\n--- " + res.status + " בתוך " + seconds + " שניות ---");
  if (data.ok && data.mock) {
    console.log("שימו לב: זהו חילוץ מדומה (mock) — אין ANTHROPIC_API_KEY ב-.env.local");
  }
} catch (err) {
  console.error("השרת לא זמין? להריץ קודם: npm run dev\n", err.message);
  process.exit(1);
}
