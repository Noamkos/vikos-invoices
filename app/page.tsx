"use client";

// המסך הראשי — תור חשבוניות: מעלים אחת או כמה, המערכת מחלצת אותן ברקע בזו אחר זו,
// וויקי מאשרת אחת-אחת. בסוף — מסך סיכום של כל מה שנקלט.

import { useState } from "react";
import UploadDropzone from "@/components/UploadDropzone";
import InvoicePreview from "@/components/InvoicePreview";
import ConfirmForm from "@/components/ConfirmForm";
import QueueSummary from "@/components/QueueSummary";
import VikosLogo from "@/components/VikosLogo";
import type {
  ConfirmRequest,
  ConfirmResponse,
  ConfirmSuccess,
  DuplicateInfo,
  ExtractResponse,
  ExtractSuccess,
  Lists,
} from "@/lib/types";

export type QueueItem = {
  id: number;
  files: File[];
  status: "pending" | "extracting" | "ready" | "failed" | "done" | "skipped";
  data: ExtractSuccess | null;
  extractError?: string;
  result?: ConfirmSuccess;
};

type Phase =
  | { name: "idle"; error?: string }
  | {
      name: "queue";
      items: QueueItem[];
      activeIndex: number;
      fallbackLists: Lists | null;
      submitting: boolean;
      duplicate?: DuplicateInfo;
      submitError?: string;
      serverFieldErrors?: Record<string, string>;
    }
  | { name: "summary"; items: QueueItem[] };

export default function Home() {
  const [phase, setPhase] = useState<Phase>({ name: "idle" });

  function patchItem(id: number, patch: Partial<QueueItem>) {
    setPhase((p) =>
      p.name === "queue"
        ? { ...p, items: p.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }
        : p,
    );
  }

  async function handleInvoices(invoices: File[][]) {
    const items: QueueItem[] = invoices.map((files, i) => ({
      id: i,
      files,
      status: "pending",
      data: null,
    }));
    setPhase({
      name: "queue",
      items,
      activeIndex: 0,
      fallbackLists: null,
      submitting: false,
    });

    // רשימות למקרה של מילוי ידני (כשהחילוץ נכשל)
    fetch("/api/extract")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setPhase((p) => (p.name === "queue" ? { ...p, fallbackLists: data.lists } : p));
        }
      })
      .catch(() => {});

    // חילוץ ברקע, אחת אחרי השנייה — בזמן שוויקי מאשרת את הקודמות
    for (const [i, files] of invoices.entries()) {
      patchItem(i, { status: "extracting" });
      try {
        const fd = new FormData();
        for (const f of files) fd.append("files", f);
        const res = await fetch("/api/extract", { method: "POST", body: fd });
        const data = (await res.json()) as ExtractResponse;
        if (data.ok) {
          patchItem(i, { status: "ready", data });
        } else {
          patchItem(i, { status: "failed", extractError: data.message });
        }
      } catch {
        patchItem(i, { status: "failed", extractError: "תקלה בתקשורת — אפשר למלא ידנית" });
      }
    }
  }

  // מעבר לחשבונית הבאה שעוד לא טופלה; אם אין — מסך סיכום
  function advance(items: QueueItem[], fromIndex: number) {
    const next = items.findIndex(
      (it, idx) => idx > fromIndex && it.status !== "done" && it.status !== "skipped",
    );
    setPhase((p) => {
      if (p.name !== "queue") return p;
      const updated = { ...p, items };
      if (next === -1) return { name: "summary", items };
      return {
        ...updated,
        activeIndex: next,
        submitting: false,
        duplicate: undefined,
        submitError: undefined,
        serverFieldErrors: undefined,
      };
    });
  }

  async function submit(reqBody: ConfirmRequest) {
    if (phase.name !== "queue") return;
    const active = phase.items[phase.activeIndex];
    setPhase((p) =>
      p.name === "queue"
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
        setPhase((p) => {
          if (p.name !== "queue") return p;
          const items = p.items.map((it) =>
            it.id === active.id ? { ...it, status: "done" as const, result: data } : it,
          );
          const next = items.findIndex(
            (it, idx) =>
              idx > p.activeIndex && it.status !== "done" && it.status !== "skipped",
          );
          if (next === -1) return { name: "summary", items };
          return {
            ...p,
            items,
            activeIndex: next,
            submitting: false,
            duplicate: undefined,
            submitError: undefined,
            serverFieldErrors: undefined,
          };
        });
        return;
      }
      setPhase((p) => {
        if (p.name !== "queue") return p;
        if (data.error === "duplicate" && data.duplicate) {
          return { ...p, submitting: false, duplicate: data.duplicate };
        }
        if (data.error === "validation") {
          return {
            ...p,
            submitting: false,
            serverFieldErrors: data.fields,
            submitError: data.message,
          };
        }
        return { ...p, submitting: false, submitError: data.message };
      });
    } catch {
      setPhase((p) =>
        p.name === "queue"
          ? { ...p, submitting: false, submitError: "תקלה בתקשורת — השורה לא נכנסה. נסו שוב" }
          : p,
      );
    }
  }

  function skipActive() {
    if (phase.name !== "queue") return;
    const items = phase.items.map((it, idx) =>
      idx === phase.activeIndex ? { ...it, status: "skipped" as const } : it,
    );
    advance(items, phase.activeIndex);
  }

  function reset() {
    setPhase({ name: "idle" });
  }

  const isMock =
    phase.name === "queue" && phase.items.some((it) => it.data?.mock === true);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <VikosLogo className="h-14 w-auto" />
          <div className="hidden h-10 w-px bg-zinc-300/70 sm:block" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#1d1d1f]">
              מערכת החשבוניות של ויקי
            </h1>
            <p className="text-xs text-zinc-500">קליטת חשבוניות ספקים · ויקוס הנדסה</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isMock && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              מצב הדגמה
            </span>
          )}
          <a
            href="/settings"
            className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm text-zinc-600 transition-colors hover:border-zinc-400"
            title="ניהול רשימות ההשלמה"
          >
            ⚙️ רשימות
          </a>
        </div>
      </header>

      {phase.name === "idle" && (
        <div className="mx-auto max-w-xl">
          <div className="mb-8 text-center">
            <p className="text-4xl font-light tracking-tight text-[#1d1d1f]">
              {"שלום ויקי "}
              <span aria-hidden>👋</span>
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              מעלים חשבונית — ואני כבר קוראת, בודקת וממלאת הכול
            </p>
          </div>
          {phase.error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
              {phase.error}
            </div>
          )}
          <UploadDropzone onInvoices={handleInvoices} />
        </div>
      )}

      {phase.name === "queue" && (
        <QueueView
          phase={phase}
          onSubmit={submit}
          onSkip={skipActive}
          onCancelDuplicate={() =>
            setPhase((p) => (p.name === "queue" ? { ...p, duplicate: undefined } : p))
          }
        />
      )}

      {phase.name === "summary" && <QueueSummary items={phase.items} onReset={reset} />}

      <footer className="mt-20 flex flex-col items-center gap-2.5 pb-8 text-center">
        <VikosLogo className="h-7 w-auto opacity-70" withTagline={false} />
        <p className="text-xs text-zinc-400">נבנה במיוחד עבור ויקי · ויקוס הנדסה</p>
        <a
          href="https://www.instagram.com/noam.k"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-400 transition-colors hover:text-[#c77e1f]"
        >
          {"פותח על ידי "}
          <span className="font-semibold">noam.k</span>
          {" ↗"}
        </a>
      </footer>
    </div>
  );
}

// פס ההתקדמות: עיגול לכל חשבונית עם מצבה
function QueueBar({ items, activeIndex }: { items: QueueItem[]; activeIndex: number }) {
  if (items.length <= 1) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
      {items.map((it, idx) => {
        let cls = "border border-zinc-300 bg-white text-zinc-400"; // pending
        if (it.status === "done") cls = "bg-[#e0a339] text-white";
        else if (it.status === "skipped") cls = "bg-zinc-200 text-zinc-400 line-through";
        else if (idx === activeIndex) cls = "bg-[#1d1d1f] text-white";
        else if (it.status === "extracting") cls = "border border-[#e0a339] bg-white text-[#c77e1f] animate-pulse";
        return (
          <span
            key={it.id}
            title={"חשבונית " + (idx + 1)}
            className={
              "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all " + cls
            }
          >
            {it.status === "done" ? "✓" : idx + 1}
          </span>
        );
      })}
    </div>
  );
}

function QueueView({
  phase,
  onSubmit,
  onSkip,
  onCancelDuplicate,
}: {
  phase: Extract<Phase, { name: "queue" }>;
  onSubmit: (req: ConfirmRequest) => void;
  onSkip: () => void;
  onCancelDuplicate: () => void;
}) {
  const active = phase.items[phase.activeIndex];
  const position = "חשבונית " + (phase.activeIndex + 1) + " מתוך " + phase.items.length;

  return (
    <div>
      <QueueBar items={phase.items} activeIndex={phase.activeIndex} />

      {(active.status === "pending" || active.status === "extracting") && (
        <div className="mx-auto max-w-xl rounded-3xl border border-black/5 bg-white p-14 text-center shadow-[0_2px_24px_rgba(0,0,0,0.06)]">
          <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-4 border-[#e0a339] border-t-transparent" />
          <p className="text-lg font-medium text-[#1d1d1f]">
            {phase.items.length > 1 ? "קוראת את " + position + "..." : "קוראת את החשבונית..."}
          </p>
          <p className="mt-2 text-sm text-zinc-500">מזהה ספק, סכומים ותאריכים</p>
        </div>
      )}

      {(active.status === "ready" || active.status === "failed") && (
        <div>
          {phase.items.length > 1 && (
            <p className="mb-4 text-center text-sm font-medium text-zinc-500">{position}</p>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              {active.status === "failed" && !phase.fallbackLists ? (
                <div className="rounded-3xl border border-black/5 bg-white p-10 text-center text-zinc-500 shadow-sm">
                  טוענת את הרשימות למילוי ידני...
                </div>
              ) : (
                <ConfirmForm
                  key={active.id}
                  data={active.data}
                  lists={active.data?.lists ?? (phase.fallbackLists as Lists)}
                  extractError={active.extractError}
                  submitting={phase.submitting}
                  duplicate={phase.duplicate}
                  submitError={phase.submitError}
                  serverFieldErrors={phase.serverFieldErrors}
                  onSubmit={onSubmit}
                  onCancelDuplicate={onCancelDuplicate}
                  onCancel={onSkip}
                  cancelLabel={phase.items.length > 1 ? "דילוג על החשבונית" : "ביטול"}
                />
              )}
            </div>
            <div className="order-1 lg:order-2">
              <InvoicePreview files={active.files} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
