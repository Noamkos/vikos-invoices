"use client";

// המסך הראשי — תור חשבוניות: מעלים אחת או כמה, המערכת מחלצת אותן ברקע בזו אחר זו,
// וויקי מאשרת אחת-אחת. "אישור" הוא רק בדיקה ושמירה מקומית — אפשר לחזור אחורה
// (בעיגולי הפס העליון או ממסך הסיכום) ולתקן כל חשבונית. הכתיבה לטבלה מתבצעת
// פעם אחת בלבד, בסוף, אחרי מסך "רגע לפני הטבלה" — כך אין לעולם צורך לערוך
// שורה שכבר נכתבה (כלל הברזל: append בלבד).

import { useState } from "react";
import UploadDropzone from "@/components/UploadDropzone";
import InvoicePreview from "@/components/InvoicePreview";
import ConfirmForm from "@/components/ConfirmForm";
import QueueSummary from "@/components/QueueSummary";
import TopNav from "@/components/TopNav";
import VikosLogo from "@/components/VikosLogo";
import { findBatchDuplicate } from "@/lib/validate";
import type {
  CheckResponse,
  CommitItem,
  CommitResponse,
  ConfirmRequest,
  ConfirmSummary,
  DuplicateInfo,
  ExtractResponse,
  ExtractSuccess,
  Lists,
  RowPreviewCell,
} from "@/lib/types";

// חשבונית שאושרה — שמורה בדפדפן בלבד עד השליחה
export type ApprovedInfo = {
  req: ConfirmRequest;
  rowPreview: RowPreviewCell[];
  summary: ConfirmSummary;
};

export type QueueItem = {
  id: number;
  files: File[];
  status: "pending" | "extracting" | "ready" | "failed" | "approved" | "skipped";
  data: ExtractSuccess | null;
  extractError?: string;
  approved?: ApprovedInfo;
  // קיים רק אחרי שהשורה באמת נכתבה לטבלה — מרגע זה החשבונית נעולה לעריכה
  committed?: { row: number | null };
};

type Phase =
  | { name: "idle"; error?: string }
  | {
      name: "queue";
      items: QueueItem[];
      activeIndex: number;
      fallbackLists: Lists | null;
      checking: boolean;
      duplicate?: DuplicateInfo;
      submitError?: string;
      serverFieldErrors?: Record<string, string>;
    }
  | {
      name: "review"; // "רגע לפני הטבלה" — הכול מאושר, שום דבר עוד לא נכתב
      items: QueueItem[];
      fallbackLists: Lists | null;
      sending: boolean;
      error?: string;
    }
  | { name: "summary"; items: QueueItem[]; demo: boolean };

const isUnhandled = (it: QueueItem) =>
  it.status !== "approved" && it.status !== "skipped";

// החשבונית הבאה שדורשת טיפול — קדימה מהמיקום הנוכחי, ואם אין, מתחילת התור
// (כדי שחזרה אחורה באמצע לא "תשכח" חשבוניות שלפני המיקום הנוכחי)
function findNextUnhandled(items: QueueItem[], from: number): number {
  for (let i = from + 1; i < items.length; i++) if (isUnhandled(items[i])) return i;
  for (let i = 0; i < items.length; i++) if (isUnhandled(items[i])) return i;
  return -1;
}

// דילוג הופך לחזרה: מחזיר את הסטטוס שמאפשר לפתוח את הטופס מחדש
function unskip(items: QueueItem[], index: number): QueueItem[] {
  return items.map((it, i) =>
    i === index && it.status === "skipped"
      ? { ...it, status: (it.data ? "ready" : "failed") as QueueItem["status"] }
      : it,
  );
}

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
      checking: false,
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

  // מעבר הלאה אחרי טיפול בחשבונית; כשאין יותר מה לטפל — מסך "רגע לפני הטבלה"
  function advance(items: QueueItem[], fromIndex: number) {
    setPhase((p) => {
      if (p.name !== "queue") return p;
      const next = findNextUnhandled(items, fromIndex);
      if (next === -1) {
        return { name: "review", items, fallbackLists: p.fallbackLists, sending: false };
      }
      return {
        ...p,
        items,
        activeIndex: next,
        checking: false,
        duplicate: undefined,
        submitError: undefined,
        serverFieldErrors: undefined,
      };
    });
  }

  // "אישור" של חשבונית: בדיקה בשרת ושמירה מקומית בלבד — עדיין שום כתיבה לטבלה
  async function approve(reqBody: ConfirmRequest) {
    if (phase.name !== "queue") return;
    const active = phase.items[phase.activeIndex];

    // בדיקה מקומית מיידית: אותה חשבונית כבר אושרה בתור הזה? (העלאה כפולה בטעות)
    const otherApproved = phase.items
      .map((it, idx) => ({ idx, it }))
      .filter(({ it }) => it.id !== active.id && it.status === "approved" && it.approved);
    const batchDup = findBatchDuplicate([
      ...otherApproved.map(({ it }) => it.approved!.req),
      reqBody,
    ]);
    if (batchDup && batchDup.second === otherApproved.length) {
      const other = otherApproved[batchDup.first].idx + 1;
      setPhase((p) =>
        p.name === "queue"
          ? {
              ...p,
              submitError:
                "חשבונית " +
                other +
                " שכבר אושרה בתור זהה לזו (אותו ספק ואותו מספר חשבונית) — אם אלה באמת שתי חשבוניות שונות, לתקן את המספר",
            }
          : p,
      );
      return;
    }

    setPhase((p) =>
      p.name === "queue"
        ? {
            ...p,
            checking: true,
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
        body: JSON.stringify({ mode: "check", item: reqBody }),
      });
      const data = (await res.json()) as CheckResponse;
      if (data.ok) {
        setPhase((p) => {
          if (p.name !== "queue") return p;
          const items = p.items.map((it) =>
            it.id === active.id
              ? {
                  ...it,
                  status: "approved" as const,
                  approved: { req: reqBody, rowPreview: data.rowPreview, summary: data.summary },
                }
              : it,
          );
          const next = findNextUnhandled(items, p.activeIndex);
          if (next === -1) {
            return { name: "review", items, fallbackLists: p.fallbackLists, sending: false };
          }
          return {
            ...p,
            items,
            activeIndex: next,
            checking: false,
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
          return { ...p, checking: false, duplicate: data.duplicate };
        }
        if (data.error === "validation") {
          return {
            ...p,
            checking: false,
            serverFieldErrors: data.fields,
            submitError: data.message,
          };
        }
        return { ...p, checking: false, submitError: data.message };
      });
    } catch {
      setPhase((p) =>
        p.name === "queue"
          ? { ...p, checking: false, submitError: "תקלה בתקשורת — אפשר לנסות שוב" }
          : p,
      );
    }
  }

  // ניווט חופשי בין חשבוניות דרך עיגולי הפס העליון
  function goTo(index: number) {
    setPhase((p) => {
      if (p.name !== "queue" || index === p.activeIndex) return p;
      const target = p.items[index];
      if (!target || target.committed) return p;
      if (target.status === "pending" || target.status === "extracting") return p;
      return {
        ...p,
        items: unskip(p.items, index),
        activeIndex: index,
        checking: false,
        duplicate: undefined,
        submitError: undefined,
        serverFieldErrors: undefined,
      };
    });
  }

  // "עריכה" ממסך רגע-לפני-הטבלה — חזרה לטופס של אותה חשבונית
  function editFromReview(index: number) {
    setPhase((p) => {
      if (p.name !== "review") return p;
      const target = p.items[index];
      if (!target || target.committed) return p;
      return {
        name: "queue",
        items: unskip(p.items, index),
        activeIndex: index,
        fallbackLists: p.fallbackLists,
        checking: false,
      };
    });
  }

  function skipActive() {
    if (phase.name !== "queue") return;
    const items = phase.items.map((it, idx) =>
      idx === phase.activeIndex
        ? { ...it, status: "skipped" as const, approved: undefined }
        : it,
    );
    advance(items, phase.activeIndex);
  }

  // יציאה מעריכת חשבונית שכבר אושרה, בלי לגעת בה
  function backFromEdit() {
    if (phase.name !== "queue") return;
    advance(phase.items, phase.activeIndex);
  }

  // השליחה האמיתית — הרגע היחיד שבו נכתב לטבלה
  async function commit() {
    if (phase.name !== "review" || phase.sending) return;
    const toSend: CommitItem[] = phase.items
      .map((it, idx) => ({ idx, it }))
      .filter(({ it }) => it.status === "approved" && it.approved && !it.committed)
      .map(({ idx, it }) => ({ index: idx, req: it.approved!.req }));
    if (toSend.length === 0) return;

    setPhase((p) => (p.name === "review" ? { ...p, sending: true, error: undefined } : p));
    try {
      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "commit", items: toSend }),
      });
      const data = (await res.json()) as CommitResponse;
      if (data.ok) {
        setPhase((p) => {
          if (p.name !== "review") return p;
          const rows = new Map(data.results.map((r) => [r.index, r.row]));
          const items = p.items.map((it, idx) =>
            rows.has(idx) ? { ...it, committed: { row: rows.get(idx) ?? null } } : it,
          );
          return { name: "summary", items, demo: data.demo };
        });
        return;
      }
      setPhase((p) => {
        if (p.name !== "review") return p;
        // אם חלק מהשורות כן נכנסו לפני התקלה — לסמן אותן, שלא יישלחו שוב
        let items = p.items;
        if (data.written && data.written.length > 0) {
          const rows = new Map(data.written.map((r) => [r.index, r.row]));
          items = items.map((it, idx) =>
            rows.has(idx) ? { ...it, committed: { row: rows.get(idx) ?? null } } : it,
          );
        }
        // תקלה בנתונים של חשבונית מסוימת — קופצים אליה לתיקון
        if (
          typeof data.itemIndex === "number" &&
          (data.error === "validation" ||
            data.error === "duplicate" ||
            data.error === "batch_duplicate")
        ) {
          return {
            name: "queue",
            items,
            activeIndex: data.itemIndex,
            fallbackLists: p.fallbackLists,
            checking: false,
            duplicate: data.error === "duplicate" ? data.duplicate : undefined,
            submitError: data.error === "duplicate" ? undefined : data.message,
            serverFieldErrors: data.error === "validation" ? data.fields : undefined,
          };
        }
        return { ...p, items, sending: false, error: data.message };
      });
    } catch {
      setPhase((p) =>
        p.name === "review"
          ? {
              ...p,
              sending: false,
              error:
                "תקלה בתקשורת בזמן השליחה — ייתכן שחלק מהשורות כן נכנסו. לבדוק בטבלה לפני שליחה חוזרת",
            }
          : p,
      );
    }
  }

  function reset() {
    setPhase({ name: "idle" });
  }

  const isMock =
    phase.name !== "idle" && phase.items.some((it) => it.data?.mock === true);

  return (
    <div className="min-h-dvh bg-white">
      <TopNav badge={isMock ? "מצב הדגמה" : null} active="home" />

      <main className="mx-auto max-w-6xl px-4">
        {phase.name === "idle" && (
          <div className="mx-auto max-w-2xl pt-16 sm:pt-24">
            <div className="mb-12 text-center">
              <h1 className="text-5xl font-semibold tracking-tight text-[#1d1d1f] sm:text-6xl">
                שלום, ויקי.
              </h1>
              <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-[#6e6e73]">
                מעלים חשבונית — והמערכת קוראת, בודקת וממלאת הכול.
              </p>
            </div>
            {phase.error && (
              <div className="mb-4 rounded-2xl bg-red-50 p-4 text-sm text-red-800">
                {phase.error}
              </div>
            )}
            <UploadDropzone onInvoices={handleInvoices} />
          </div>
        )}

        {phase.name === "queue" && (
          <div className="pt-10">
            <QueueView
              phase={phase}
              onSubmit={approve}
              onSkip={skipActive}
              onSelect={goTo}
              onBackFromEdit={backFromEdit}
              onCancelDuplicate={() =>
                setPhase((p) => (p.name === "queue" ? { ...p, duplicate: undefined } : p))
              }
            />
          </div>
        )}

        {phase.name === "review" && (
          <div className="pt-16">
            <QueueSummary
              mode="review"
              items={phase.items}
              sending={phase.sending}
              error={phase.error}
              onSend={commit}
              onEdit={editFromReview}
              onReset={reset}
            />
          </div>
        )}

        {phase.name === "summary" && (
          <div className="pt-16">
            <QueueSummary mode="done" items={phase.items} demo={phase.demo} onReset={reset} />
          </div>
        )}

        <footer className="mt-28 border-t border-zinc-200 py-10 text-center">
          <div className="flex flex-col items-center gap-2.5">
            <VikosLogo className="text-[22px] opacity-80" withTagline={false} />
            <p className="text-xs text-[#6e6e73]">נבנה במיוחד עבור ויקי · ויקוס הנדסה</p>
            <a
              href="https://www.instagram.com/noam.k"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#6e6e73] transition-colors duration-200 hover:text-[#c77e1f]"
            >
              {"פותח על ידי "}
              <span className="font-semibold">noam.k</span>
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}

// פס ההתקדמות: עיגול לכל חשבונית. עיגול של חשבונית שכבר טופלה לחיץ — חזרה אליה לעריכה.
function QueueBar({
  items,
  activeIndex,
  onSelect,
}: {
  items: QueueItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  if (items.length <= 1) return null;
  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {items.map((it, idx) => {
          const isActive = idx === activeIndex;
          const clickable =
            !isActive &&
            !it.committed &&
            (it.status === "ready" ||
              it.status === "failed" ||
              it.status === "approved" ||
              it.status === "skipped");
          let cls = "bg-[#e8e8ed] text-[#86868b]"; // pending
          if (isActive) cls = "bg-[#1d1d1f] text-white";
          else if (it.status === "approved" || it.committed) cls = "bg-[#e0a339] text-white";
          else if (it.status === "skipped")
            cls = "bg-[#e8e8ed] text-[#c7c7cc] line-through";
          else if (it.status === "extracting")
            cls = "bg-white text-[#c77e1f] ring-1 ring-[#e0a339] animate-pulse";
          else if (it.status === "ready" || it.status === "failed")
            cls = "bg-white text-[#1d1d1f] ring-1 ring-[#d2d2d7]";
          const title = it.committed
            ? "חשבונית " + (idx + 1) + " — כבר בטבלה"
            : it.status === "approved"
              ? "חשבונית " + (idx + 1) + " — אושרה. לחיצה פותחת לעריכה"
              : it.status === "skipped"
                ? "חשבונית " + (idx + 1) + " — דולגה. לחיצה מחזירה אותה"
                : "חשבונית " + (idx + 1);
          return (
            <button
              key={it.id}
              type="button"
              disabled={!clickable}
              onClick={() => onSelect(idx)}
              title={title}
              className={
                "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 " +
                cls +
                (clickable ? " cursor-pointer hover:scale-110" : " cursor-default")
              }
            >
              {!isActive && (it.status === "approved" || it.committed) ? "✓" : idx + 1}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs text-[#86868b]">
        לחיצה על עיגול חוזרת לחשבונית לעריכה — עד השליחה במסך הסיכום שום דבר לא נכנס לטבלה.
      </p>
    </div>
  );
}

// טעינת שלד — במקום ספינר גנרי, צורת הטופס שעומד להופיע
function ExtractSkeleton({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-xl rounded-[28px] bg-[#f5f5f7] p-8">
      <p className="mb-1 text-center text-lg font-semibold text-[#1d1d1f]">{label}</p>
      <p className="mb-8 text-center text-sm text-[#6e6e73]">מזהה ספק, סכומים ותאריכים</p>
      <div className="animate-pulse space-y-4">
        <div className="h-11 rounded-xl bg-white" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-11 rounded-xl bg-white" />
          <div className="h-11 rounded-xl bg-white" />
        </div>
        <div className="h-14 rounded-xl bg-white" />
        <div className="h-11 rounded-xl bg-white" />
        <div className="h-11 w-2/3 rounded-xl bg-white" />
      </div>
    </div>
  );
}

function QueueView({
  phase,
  onSubmit,
  onSkip,
  onSelect,
  onBackFromEdit,
  onCancelDuplicate,
}: {
  phase: Extract<Phase, { name: "queue" }>;
  onSubmit: (req: ConfirmRequest) => void;
  onSkip: () => void;
  onSelect: (index: number) => void;
  onBackFromEdit: () => void;
  onCancelDuplicate: () => void;
}) {
  const active = phase.items[phase.activeIndex];
  const position = "חשבונית " + (phase.activeIndex + 1) + " מתוך " + phase.items.length;
  const isApproved = active.status === "approved";
  const showForm =
    active.status === "ready" || active.status === "failed" || isApproved;

  return (
    <div>
      <QueueBar items={phase.items} activeIndex={phase.activeIndex} onSelect={onSelect} />

      {(active.status === "pending" || active.status === "extracting") && (
        <ExtractSkeleton
          label={phase.items.length > 1 ? "קוראת את " + position : "קוראת את החשבונית"}
        />
      )}

      {showForm && (
        <div>
          {phase.items.length > 1 && (
            <p className="mb-4 text-center text-sm font-medium text-[#6e6e73]">
              {position + (isApproved ? " · אושרה, פתוחה לעריכה" : "")}
            </p>
          )}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              {active.status === "failed" && !phase.fallbackLists ? (
                <div className="rounded-[28px] bg-[#f5f5f7] p-10 text-center text-[#6e6e73]">
                  טוענת את הרשימות למילוי ידני...
                </div>
              ) : (
                <ConfirmForm
                  key={active.id}
                  data={active.data}
                  initial={isApproved ? (active.approved?.req ?? null) : null}
                  lists={active.data?.lists ?? (phase.fallbackLists as Lists)}
                  extractError={active.extractError}
                  submitting={phase.checking}
                  submitLabel={isApproved ? "עדכון החשבונית" : "אישור החשבונית"}
                  duplicate={phase.duplicate}
                  submitError={phase.submitError}
                  serverFieldErrors={phase.serverFieldErrors}
                  onSubmit={onSubmit}
                  onCancelDuplicate={onCancelDuplicate}
                  onCancel={isApproved ? onBackFromEdit : onSkip}
                  cancelLabel={
                    isApproved
                      ? "חזרה בלי שינוי"
                      : phase.items.length > 1
                        ? "דילוג על החשבונית"
                        : "ביטול"
                  }
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
