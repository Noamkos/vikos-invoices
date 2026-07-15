"use client";

// העלאת קבצים — תומך בכמה חשבוניות בבת אחת:
// - קובץ אחד = חשבונית אחת
// - כמה קובצי PDF = חשבונית לכל קובץ (PDF הוא מסמך שלם)
// - כמה תמונות = שואלים: עמודים של אותה חשבונית, או חשבוניות נפרדות?
// תמונות מוקטנות ל-2000 פיקסלים ונדחסות ל-JPEG לפני השליחה (מגבלת שרת + חיסכון).

import { useRef, useState } from "react";

const MAX_EDGE_PX = 2000;
const JPEG_QUALITY = 0.8;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_PAGES_PER_INVOICE = 8;
const MAX_FILES_AT_ONCE = 15;

type Props = { onInvoices: (invoices: File[][]) => void };

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

export default function UploadDropzone({ onInvoices }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // כמה תמונות נבחרו ומחכות לתשובה: עמודים או חשבוניות נפרדות?
  const [pendingImages, setPendingImages] = useState<File[] | null>(null);

  async function prepareImages(files: File[]): Promise<File[] | null> {
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
        return null;
      }
    }
    const tooBig = prepared.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      setError("גם אחרי דחיסה יש תמונה גדולה מדי — נסו לצלם שוב מקרוב");
      return null;
    }
    return prepared;
  }

  async function handleFiles(list: FileList | File[]) {
    setError(null);
    const files = Array.from(list);
    if (files.length === 0) return;
    if (files.length > MAX_FILES_AT_ONCE) {
      setError("אפשר עד " + MAX_FILES_AT_ONCE + " קבצים בכל פעם");
      return;
    }

    const bad = files.find(
      (f) =>
        !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(f.type),
    );
    if (bad) {
      setError("הקובץ " + bad.name + " אינו בפורמט נתמך (PDF, JPG, PNG או WebP)");
      return;
    }

    const oversizedPdf = files.find(
      (f) => f.type === "application/pdf" && f.size > MAX_FILE_BYTES,
    );
    if (oversizedPdf) {
      setError("קובץ ה-PDF " + oversizedPdf.name + " גדול מדי (מעל 4MB) — צלמו את העמודים במקום");
      return;
    }

    const images = files.filter((f) => f.type !== "application/pdf");
    const pdfs = files.filter((f) => f.type === "application/pdf");

    setBusy(true);
    try {
      // קובץ יחיד — חשבונית אחת
      if (files.length === 1) {
        if (images.length === 1) {
          const prepared = await prepareImages(images);
          if (prepared) onInvoices([prepared]);
        } else {
          onInvoices([[pdfs[0]]]);
        }
        return;
      }

      // כולן תמונות — צריך לשאול מה הן
      if (images.length === files.length) {
        setPendingImages(files);
        return;
      }

      // כמה PDF-ים (או תערובת) — כל קובץ הוא חשבונית נפרדת
      const invoices: File[][] = [];
      for (const f of files) {
        if (f.type === "application/pdf") {
          invoices.push([f]);
        } else {
          const prepared = await prepareImages([f]);
          if (!prepared) return;
          invoices.push(prepared);
        }
      }
      onInvoices(invoices);
    } finally {
      setBusy(false);
    }
  }

  async function resolvePendingImages(asPages: boolean) {
    const files = pendingImages;
    setPendingImages(null);
    if (!files) return;
    if (asPages && files.length > MAX_PAGES_PER_INVOICE) {
      setError("לחשבונית אחת אפשר עד " + MAX_PAGES_PER_INVOICE + " עמודים");
      return;
    }
    setBusy(true);
    try {
      const prepared = await prepareImages(files);
      if (!prepared) return;
      if (asPages) {
        const total = prepared.reduce((sum, f) => sum + f.size, 0);
        if (total > MAX_FILE_BYTES) {
          setError("סך כל העמודים גדול מדי גם אחרי דחיסה — צמצמו את מספר העמודים");
          return;
        }
        onInvoices([prepared]);
      } else {
        onInvoices(prepared.map((f) => [f]));
      }
    } finally {
      setBusy(false);
    }
  }

  // מסך השאלה: עמודים או חשבוניות נפרדות?
  if (pendingImages) {
    return (
      <div className="rounded-[28px] bg-[#f5f5f7] p-10 text-center">
        <h2 className="mb-1 text-2xl font-semibold tracking-tight text-[#1d1d1f]">
          {"בחרת " + pendingImages.length + " תמונות"}
        </h2>
        <p className="mb-8 text-sm text-[#6e6e73]">מה הן?</p>
        <div className="mx-auto flex max-w-md flex-col gap-3">
          <button
            type="button"
            onClick={() => void resolvePendingImages(false)}
            className="rounded-full bg-[#1d1d1f] px-8 py-3.5 text-base font-semibold text-white transition-all duration-200 hover:bg-black active:scale-[0.98]"
          >
            {pendingImages.length + " חשבוניות נפרדות"}
          </button>
          <button
            type="button"
            onClick={() => void resolvePendingImages(true)}
            className="rounded-full bg-white px-8 py-3.5 text-base font-semibold text-[#1d1d1f] transition-all duration-200 hover:bg-[#fbfbfd] active:scale-[0.98]"
          >
            עמודים של חשבונית אחת
          </button>
          <button
            type="button"
            onClick={() => setPendingImages(null)}
            className="mt-1 text-sm text-[#6e6e73] transition-colors duration-200 hover:text-[#1d1d1f]"
          >
            ביטול
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        className={
          "rounded-[28px] p-12 text-center transition-all duration-300 " +
          (dragOver ? "bg-[#f8efdd] ring-2 ring-[#e0a339]" : "bg-[#f5f5f7]")
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
        <svg
          viewBox="0 0 24 24"
          className="mx-auto mb-6 h-12 w-12 text-[#e0a339]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
          <path d="M14 2v5h5" />
          <path d="M12 17v-6" />
          <path d="m9.5 13.5 2.5-2.5 2.5 2.5" />
        </svg>
        <h2 className="mb-2 text-2xl font-semibold tracking-tight text-[#1d1d1f]">
          העלאת חשבוניות
        </h2>
        <p className="mx-auto mb-8 max-w-sm text-sm leading-relaxed text-[#6e6e73]">
          אפשר לבחור כמה חשבוניות בבת אחת — הן ייקלטו אחת אחרי השנייה.
          <br />
          PDF, JPG או PNG · גם צילום מהנייד
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="rounded-full bg-[#1d1d1f] px-10 py-3.5 text-[17px] font-semibold text-white transition-all duration-200 hover:bg-black active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "מעבדת את הקבצים..." : "בחירת קבצים או צילום"}
        </button>
        <p className="mt-5 text-xs text-[#86868b]">או פשוט לגרור קבצים לכאן</p>
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
        <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}
    </div>
  );
}
