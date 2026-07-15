"use client";

// תצוגת החשבונית לצד הטופס — הקובץ חי רק בזיכרון הדפדפן (לא נשמר בשום שרת).
//
// PDF לא מוצג דרך הצופה המובנה של הדפדפן (iframe): הצופה המובנה מוסיף סרגל כלים
// וחלונית תמונות ממוזערות שגוזלת חצי מהשטח, ונראה אחרת בכל דפדפן. במקום זה
// pdf.js (ספריית הרינדור של Firefox) מצייר כל עמוד לתמונה, ואנחנו מציגים את
// התמונות בצופה משלנו: זום בכפתורים / Ctrl+גלגלת / לחיצה כפולה, וגרירה להזזה.
// ה-worker (הקובץ שמפענח את ה-PDF ברקע) מועתק ל-public/ ב-postinstall.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";

type Props = { files: File[] };

type FailedFile = { name: string; url: string };

// רוחב הרינדור בפיקסלים: מספיק חד כדי לקרוא מספרי חשבונית גם בזום גדול
const RENDER_WIDTH = 1600;
const MAX_RENDER_HEIGHT = 6000;
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.25;

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.92,
    );
  });
}

export default function InvoicePreview({ files }: Props) {
  const [pages, setPages] = useState<string[]>([]);
  const [failed, setFailed] = useState<FailedFile[]>([]);
  const [loading, setLoading] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const pendingScroll = useRef<{ left: number; top: number } | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // איפוס בהחלפת חשבונית — בזמן הרינדור (הדפוס המומלץ), לא בתוך effect
  const [prevFiles, setPrevFiles] = useState<File[]>(files);
  if (prevFiles !== files) {
    setPrevFiles(files);
    setPages([]);
    setFailed([]);
    setLoading(true);
    setZoom(1);
    // zoomRef מסונכרן בתוך ה-effect שלמטה — אסור לגעת ב-ref בזמן רינדור
  }

  // המרת הקבצים לעמודי תצוגה. בדיקת cancelled אחרי כל await — כדי שהחלפת
  // חשבונית באמצע רינדור (או ההרצה הכפולה של StrictMode) לא תדליף זיכרון.
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    const tasks: PDFDocumentLoadingTask[] = [];
    const revokeAll = () => {
      for (const u of urls) URL.revokeObjectURL(u);
    };

    // איפוס הזום גם ב-ref (בזמן הטעינה הצופה לא מוצג, אז אין מרוץ מול אירועי זום)
    zoomRef.current = 1;

    async function load() {
      const outPages: string[] = [];
      const outFailed: FailedFile[] = [];
      for (const f of files) {
        if (f.type === "application/pdf") {
          try {
            const pdfjs = await import("pdfjs-dist");
            pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
            const data = new Uint8Array(await f.arrayBuffer());
            if (cancelled) return revokeAll();
            const task = pdfjs.getDocument({ data });
            tasks.push(task);
            const doc = await task.promise;
            if (cancelled) return revokeAll();
            for (let p = 1; p <= doc.numPages; p++) {
              const page = await doc.getPage(p);
              const base = page.getViewport({ scale: 1 });
              let scale = RENDER_WIDTH / base.width;
              if (base.height * scale > MAX_RENDER_HEIGHT) {
                scale = MAX_RENDER_HEIGHT / base.height;
              }
              const viewport = page.getViewport({ scale });
              const canvas = document.createElement("canvas");
              canvas.width = Math.floor(viewport.width);
              canvas.height = Math.floor(viewport.height);
              // intent: "print" — ציור בבת אחת בלי requestAnimationFrame. חיוני:
              // בטאב מוסתר rAF לא יורה, וציור "display" היה נתקע לנצח אם ויקי
              // עוברת טאב בזמן הטעינה (וגם בדפדפנים מוטמעים). לתמונה חד-פעמית זה גם מדויק יותר.
              await page.render({ canvas, viewport, intent: "print" }).promise;
              const blob = await canvasToBlob(canvas);
              page.cleanup();
              if (cancelled) return revokeAll();
              const url = URL.createObjectURL(blob);
              urls.push(url);
              outPages.push(url);
            }
          } catch (err) {
            console.error("[VIKOS] pdf render failed:", err);
            if (cancelled) return revokeAll();
            const url = URL.createObjectURL(f);
            urls.push(url);
            outFailed.push({ name: f.name, url });
          }
        } else {
          const url = URL.createObjectURL(f);
          urls.push(url);
          outPages.push(url);
        }
      }
      if (cancelled) return revokeAll();
      setPages(outPages);
      setFailed(outFailed);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
      revokeAll();
      // destroy על משימת הטעינה סוגר גם את המסמך וגם את ה-worker (ה-API של v6)
      for (const t of tasks) t.destroy().catch(() => {});
    };
  }, [files]);

  // שינוי זום סביב נקודת עוגן: הנקודה שמתחת לסמן נשארת במקום.
  // הגלילה החדשה מוחלת ב-useLayoutEffect — רק אחרי שהרוחב החדש כבר בעמוד.
  function applyZoom(next: number, anchor?: { x: number; y: number }) {
    const el = scrollRef.current;
    if (!el) return;
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    const prev = zoomRef.current;
    if (clamped === prev) return;
    const rect = el.getBoundingClientRect();
    const ax = anchor ? anchor.x - rect.left : rect.width / 2;
    const ay = anchor ? anchor.y - rect.top : rect.height / 2;
    const ratio = clamped / prev;
    pendingScroll.current = {
      left: (el.scrollLeft + ax) * ratio - ax,
      top: (el.scrollTop + ay) * ratio - ay,
    };
    zoomRef.current = clamped;
    setZoom(clamped);
  }

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const target = pendingScroll.current;
    if (el && target) {
      el.scrollLeft = target.left;
      el.scrollTop = target.top;
      pendingScroll.current = null;
    }
  }, [zoom]);

  // זום ב-Ctrl+גלגלת (וגם צביטה במשטח מגע — הדפדפן שולח אותה כגלגלת עם ctrlKey).
  // מאזין ידני ולא onWheel של React, כי חובה preventDefault וייתכן שהמאזין פסיבי.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      applyZoom(zoomRef.current * factor, { x: e.clientX, y: e.clientY });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // אין תלות בזום — הקריאה דרך zoomRef כדי לא לחבר/לנתק מאזין בכל שינוי זום
  }, [pages.length]);

  const pageCount = pages.length;

  return (
    <div className="rounded-[28px] bg-[#f5f5f7] p-3">
      <p className="mb-2 px-2 pt-1 text-sm font-medium text-[#6e6e73]">
        {"החשבונית שהועלתה" + (pageCount > 1 ? " · " + pageCount + " עמודים" : "")}
      </p>

      {loading && <div className="h-[72vh] animate-pulse rounded-2xl bg-[#e8e8ed]" />}

      {!loading && pageCount > 0 && (
        <div className="relative">
          <div
            ref={scrollRef}
            dir="ltr"
            className={
              "max-h-[72vh] select-none overflow-auto rounded-2xl bg-[#e8e8ed] " +
              (dragging ? "cursor-grabbing" : "cursor-grab")
            }
            onPointerDown={(e) => {
              // גרירה להזזה — בעכבר בלבד; במסך מגע הגלילה הטבעית עובדת ממילא
              if (e.pointerType !== "mouse" || e.button !== 0) return;
              const el = scrollRef.current;
              if (!el) return;
              drag.current = {
                x: e.clientX,
                y: e.clientY,
                left: el.scrollLeft,
                top: el.scrollTop,
              };
              setDragging(true);
              el.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              const el = scrollRef.current;
              if (!d || !el) return;
              el.scrollLeft = d.left - (e.clientX - d.x);
              el.scrollTop = d.top - (e.clientY - d.y);
            }}
            onPointerUp={() => {
              drag.current = null;
              setDragging(false);
            }}
            onPointerCancel={() => {
              drag.current = null;
              setDragging(false);
            }}
            onDoubleClick={(e) =>
              applyZoom(zoomRef.current > 1 ? 1 : 2, { x: e.clientX, y: e.clientY })
            }
          >
            <div style={{ width: zoom * 100 + "%" }} className="space-y-3 p-2">
              {pages.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt={"עמוד " + (i + 1)}
                  draggable={false}
                  className="w-full rounded-lg shadow-sm ring-1 ring-black/5"
                />
              ))}
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <div
              dir="ltr"
              className="pointer-events-auto flex items-center gap-0.5 rounded-full bg-[#161617]/80 px-1.5 py-1 text-white shadow-lg backdrop-blur-xl"
            >
              <button
                type="button"
                aria-label="הקטנה"
                onClick={() => applyZoom(zoomRef.current / ZOOM_STEP)}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/15 active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                  <path d="M5 12h14" />
                </svg>
              </button>
              <span className="ltr-field w-12 text-center text-xs font-semibold tabular-nums">
                {Math.round(zoom * 100) + "%"}
              </span>
              <button
                type="button"
                aria-label="הגדלה"
                onClick={() => applyZoom(zoomRef.current * ZOOM_STEP)}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/15 active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
              <span className="mx-1 h-4 w-px bg-white/25" aria-hidden />
              <button
                type="button"
                aria-label="התאמה לרוחב"
                onClick={() => applyZoom(1)}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/15 active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading &&
        failed.map((f) => (
          <div
            key={f.url}
            className="mt-3 rounded-2xl bg-white p-4 text-sm text-[#6e6e73]"
          >
            {"לא הצלחנו להציג את הקובץ כאן ("}
            <span className="ltr-field inline-block">{f.name}</span>
            {") — הטופס עדיין עובד, ואפשר "}
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#c77e1f] underline-offset-2 hover:underline"
            >
              לפתוח אותו בחלון נפרד
            </a>
            .
          </div>
        ))}
    </div>
  );
}
