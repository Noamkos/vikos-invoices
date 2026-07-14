"use client";

// המסך הראשי — מכונת מצבים אחת שמנהלת את כל הזרימה:
// idle (העלאה) -> extracting (Claude קורא) -> confirm (מסך האישור) -> success (הצלחה)

import { useEffect, useState } from "react";
import UploadDropzone from "@/components/UploadDropzone";
import InvoicePreview from "@/components/InvoicePreview";
import ConfirmForm from "@/components/ConfirmForm";
import SuccessBanner from "@/components/SuccessBanner";
import type {
  ConfirmRequest,
  ConfirmResponse,
  ConfirmSuccess,
  DuplicateInfo,
  ExtractResponse,
  ExtractSuccess,
  Lists,
} from "@/lib/types";

type Phase =
  | { name: "idle"; error?: string }
  | { name: "extracting" }
  | {
      name: "confirm";
      files: File[];
      data: ExtractSuccess | null; // null = מילוי ידני אחרי כשל חילוץ
      lists: Lists;
      extractError?: string;
      submitting: boolean;
      duplicate?: DuplicateInfo;
      submitError?: string;
      serverFieldErrors?: Record<string, string>;
    }
  | { name: "success"; result: ConfirmSuccess };

const EXTRACTING_MESSAGES = [
  "מעלה את הקובץ...",
  "קורא את החשבונית...",
  "מזהה סכומים ותאריכים...",
  "עוד רגע, כמעט מוכן...",
];

function ExtractingScreen() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setI((prev) => Math.min(prev + 1, EXTRACTING_MESSAGES.length - 1)),
      4000,
    );
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      <p className="text-lg text-zinc-700">{EXTRACTING_MESSAGES[i]}</p>
    </div>
  );
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>({ name: "idle" });

  async function handleFiles(files: File[]) {
    setPhase({ name: "extracting" });
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      const res = await fetch("/api/extract", { method: "POST", body: fd });
      const data = (await res.json()) as ExtractResponse;

      if (data.ok) {
        setPhase({ name: "confirm", files, data, lists: data.lists, submitting: false });
        return;
      }
      if (data.error === "not_an_invoice") {
        setPhase({ name: "idle", error: data.message });
        return;
      }
      if (
        data.error === "file_too_large" ||
        data.error === "unsupported_type" ||
        data.error === "mixed_files" ||
        data.error === "too_many_files" ||
        data.error === "no_file"
      ) {
        setPhase({ name: "idle", error: data.message });
        return;
      }
      // כשל חילוץ — נופלים למילוי ידני: מביאים רק את הרשימות
      await enterManualMode(files, data.message);
    } catch {
      await enterManualMode(files, "תקלה בתקשורת — אפשר למלא את הפרטים ידנית");
    }
  }

  async function enterManualMode(files: File[], reason: string) {
    try {
      const res = await fetch("/api/extract");
      const data = (await res.json()) as { ok: boolean; lists: Lists };
      if (data.ok) {
        setPhase({
          name: "confirm",
          files,
          data: null,
          lists: data.lists,
          extractError: reason,
          submitting: false,
        });
        return;
      }
    } catch {
      // גם הרשימות לא זמינות — אין טעם בטופס
    }
    setPhase({ name: "idle", error: reason + ". נסו שוב בעוד רגע" });
  }

  async function submit(reqBody: ConfirmRequest) {
    setPhase((p) =>
      p.name === "confirm"
        ? {
            ...p,
            submitting: true,
            duplicate: undefined,
            submitError: undefined,
            serverFieldErrors: undefined,
          }
        : p,
    );
    try {
      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });
      const data = (await res.json()) as ConfirmResponse;
      if (data.ok) {
        setPhase({ name: "success", result: data });
        return;
      }
      setPhase((p) => {
        if (p.name !== "confirm") return p;
        if (data.error === "duplicate" && data.duplicate) {
          return { ...p, submitting: false, duplicate: data.duplicate };
        }
        if (data.error === "validation") {
          return { ...p, submitting: false, serverFieldErrors: data.fields, submitError: data.message };
        }
        return { ...p, submitting: false, submitError: data.message };
      });
    } catch {
      setPhase((p) =>
        p.name === "confirm"
          ? { ...p, submitting: false, submitError: "תקלה בתקשורת — השורה לא נכנסה. נסו שוב" }
          : p,
      );
    }
  }

  function reset() {
    setPhase({ name: "idle" });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">קליטת חשבוניות</h1>
          <p className="text-sm text-zinc-500">ויקוס הנדסה</p>
        </div>
        {phase.name === "confirm" && phase.data?.mock && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
            מצב הדגמה — אין מפתח API
          </span>
        )}
      </header>

      {phase.name === "idle" && (
        <div className="mx-auto max-w-xl">
          {phase.error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
              {phase.error}
            </div>
          )}
          <UploadDropzone onFiles={handleFiles} />
        </div>
      )}

      {phase.name === "extracting" && <ExtractingScreen />}

      {phase.name === "confirm" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <ConfirmForm
              data={phase.data}
              lists={phase.lists}
              extractError={phase.extractError}
              submitting={phase.submitting}
              duplicate={phase.duplicate}
              submitError={phase.submitError}
              serverFieldErrors={phase.serverFieldErrors}
              onSubmit={submit}
              onCancelDuplicate={() =>
                setPhase((p) => (p.name === "confirm" ? { ...p, duplicate: undefined } : p))
              }
              onCancel={reset}
            />
          </div>
          <div className="order-1 lg:order-2">
            <InvoicePreview files={phase.files} />
          </div>
        </div>
      )}

      {phase.name === "success" && <SuccessBanner result={phase.result} onReset={reset} />}

      <footer className="mt-16 text-center text-xs text-zinc-400">
        מערכת פנימית של ויקוס הנדסה · שלב א׳ — הדגמה
      </footer>
    </div>
  );
}
