"use client";

// מסך הסיכום בסוף התור: מה נקלט, מה דולג, ופירוט השורות.

import type { QueueItem } from "@/app/page";

type Props = { items: QueueItem[]; onReset: () => void };

export default function QueueSummary({ items, onReset }: Props) {
  const done = items.filter((it) => it.status === "done" && it.result);
  const skipped = items.filter((it) => it.status === "skipped");
  const anyDemo = done.some((it) => it.result?.demo);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#e0a339]">
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7 text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h2 className="text-4xl font-semibold tracking-tight text-[#1d1d1f] sm:text-5xl">
          {done.length === 0
            ? "לא נקלטו חשבוניות"
            : done.length === 1
              ? "החשבונית נקלטה."
              : done.length + " חשבוניות נקלטו."}
        </h2>
        {skipped.length > 0 && (
          <p className="mt-2 text-sm text-[#6e6e73]">{skipped.length + " דולגו"}</p>
        )}
        {anyDemo && (
          <p className="mx-auto mt-4 inline-block rounded-full bg-[#fdf3df] px-4 py-1.5 text-xs font-medium text-[#8a5a10]">
            מצב הדגמה — שום דבר לא נכתב לטבלה. כך היו נראות השורות
          </p>
        )}
      </div>

      <div className="space-y-3">
        {items.map((it, idx) => {
          if (it.status === "skipped") {
            return (
              <div
                key={it.id}
                className="rounded-2xl bg-[#f5f5f7] px-5 py-4 text-sm text-[#a1a1a6]"
              >
                {"חשבונית " + (idx + 1) + " — דולגה"}
              </div>
            );
          }
          if (it.status !== "done" || !it.result) return null;
          const s = it.result.summary;
          return (
            <details
              key={it.id}
              className="group rounded-2xl bg-[#f5f5f7] transition-colors duration-200 open:bg-[#f0f0f2]"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e0a339]/15 text-sm font-bold text-[#c77e1f]">
                  {idx + 1}
                </span>
                <span className="font-semibold text-[#1d1d1f]">{s.supplier}</span>
                <span className="text-sm text-zinc-500">{s.project}</span>
                <span className="ltr-field text-sm font-semibold text-[#1d1d1f]">
                  {s.amount.toLocaleString("he-IL", { maximumFractionDigits: 2 }) + " ₪"}
                </span>
                <span className="text-xs text-zinc-400">
                  {s.month + " " + s.year + " · חשבונית "}
                  <span className="ltr-field inline-block">{s.invoiceNumber}</span>
                  {it.result.row !== null && " · שורה " + it.result.row}
                </span>
                <span className="mr-auto text-zinc-300 transition-transform group-open:rotate-90">
                  ‹
                </span>
              </summary>
              <div className="overflow-x-auto border-t border-black/5 px-5 py-4">
                <table className="w-full text-sm">
                  <tbody>
                    {it.result.rowPreview.map((cell) => (
                      <tr
                        key={cell.col}
                        className={
                          "border-b border-zinc-50 last:border-0 " +
                          (cell.value ? "" : "text-zinc-300")
                        }
                      >
                        <td className="ltr-field w-8 py-1.5 pl-3 text-zinc-400">{cell.col}</td>
                        <td className="w-44 py-1.5 text-zinc-500">{cell.header}</td>
                        <td className="py-1.5 font-medium">
                          {cell.value ? (
                            ["D", "J", "Q"].includes(cell.col) ? (
                              <span className="ltr-field inline-block">{cell.value}</span>
                            ) : (
                              cell.value
                            )
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </div>

      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={onReset}
          className="rounded-full bg-[#1d1d1f] px-10 py-3.5 text-[17px] font-semibold text-white transition-all duration-200 hover:bg-black active:scale-[0.98]"
        >
          קליטת חשבוניות נוספות
        </button>
      </div>
    </div>
  );
}
