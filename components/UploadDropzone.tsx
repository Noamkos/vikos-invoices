"use client";

// העלאת הקובץ + העיבוד בדפדפן שחובה לעשות לפני השליחה:
// תמונות מוקטנות ל-2000 פיקסלים ונדחסות ל-JPEG (פותר גם את מגבלת 4.5MB של השרת,
// גם את זה שצילומי אייפון כבדים מדי, וגם מוזיל את קריאת ה-AI).
// PDF עובר כמו שהוא (עד 4MB). אפשר לבחור כמה תמונות של אותה חשבונית (עמודים).

import { useRef, useState } from "react";

const MAX_EDGE_PX = 2000;
const JPEG_QUALITY = 0.8;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_IMAGES = 8;

type Props = { onFiles: (files: File[]) => void };

async function downscaleImage(file: File): Promise<File> {
  // imageOrientation מיישם את סיבוב ה-EXIF של צילומי טלפון, שלא תישלח תמונה שוכבת
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new Error("encode");
  const name = file.name.replace(/\.\w+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

export default function UploadDropzone({ onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(list: FileList | File[]) {
    setError(null);
    const files = Array.from(list);
    if (files.length === 0) return;

    const pdfs = files.filter((f) => f.type === "application/pdf");
    if (pdfs.length > 0) {
      if (files.length > 1) {
        setError("קובץ PDF יש להעלות לבד, בלי קבצים נוספים");
        return;
      }
      const pdf = pdfs[0];
      if (pdf.size > MAX_FILE_BYTES) {
        setError("קובץ ה-PDF גדול מדי (מעל 4MB) — צלמו את העמודים במקום");
        return;
      }
      onFiles([pdf]);
      return;
    }

    if (files.length > MAX_IMAGES) {
      setError("אפשר עד " + MAX_IMAGES + " עמודים לחשבונית אחת");
      return;
    }

    const notImage = files.find((f) => !f.type.startsWith("image/"));
    if (notImage) {
      setError("הקובץ " + notImage.name + " אינו תמונה או PDF");
      return;
    }

    setBusy(true);
    try {
      const prepared: File[] = [];
      for (const f of files) {
        try {
          prepared.push(await downscaleImage(f));
        } catch {
          setError(
            "לא הצלחנו לקרוא את התמונה " +
              f.name +
              " — ייתכן שהיא בפורמט HEIC. באייפון: לבחור מהגלריה (ההמרה אוטומטית) או לשנות בהגדרות המצלמה לפורמט תואם",
          );
          return;
        }
      }
      const tooBig = prepared.find((f) => f.size > MAX_FILE_BYTES);
      if (tooBig) {
        setError("גם אחרי דחיסה התמונה גדולה מדי — נסו לצלם שוב מקרוב");
        return;
      }
      // מגבלת השרת היא על כל הבקשה יחד — בודקים גם את הסכום הכולל
      const totalBytes = prepared.reduce((sum, f) => sum + f.size, 0);
      if (totalBytes > MAX_FILE_BYTES) {
        setError("סך כל התמונות גדול מדי גם אחרי דחיסה — העלו פחות עמודים בכל פעם");
        return;
      }
      onFiles(prepared);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        className={
          "rounded-2xl border-2 border-dashed p-10 text-center transition-colors " +
          (dragOver ? "border-emerald-500 bg-emerald-50" : "border-zinc-300 bg-white")
        }
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="mb-4 text-5xl" aria-hidden>
          🧾
        </div>
        <h2 className="mb-2 text-lg font-semibold text-zinc-800">העלאת חשבונית</h2>
        <p className="mb-6 text-sm text-zinc-500">
          PDF, JPG או PNG · אפשר לבחור כמה תמונות של אותה חשבונית (עמוד לכל תמונה)
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="rounded-xl bg-emerald-600 px-8 py-3 text-lg font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "מעבד את התמונות..." : "בחירת קובץ או צילום"}
        </button>
        <p className="mt-4 text-xs text-zinc-400">אפשר גם לגרור קובץ לכאן</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}
    </div>
  );
}
