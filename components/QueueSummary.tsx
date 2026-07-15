"use client";

// מסך הסיכום בשני מצבים:
// review — "רגע לפני הטבלה": כל השורות שאושרו, כל אחת נפתחת לבדיקה וניתנת לעריכה.
//          שום דבר עוד לא נכתב; כפתור השליחה הוא הרגע היחיד שכותב לטבלה.
// done   — אחרי הכתיבה: מה נכנס בפועל (כולל מספרי שורות בגיליון).

import type { QueueItem } from "@/app/page";

type Props = {
  mode: "review" | "done";
  items: QueueItem[];
  demo?: boolean; // done: האם הייתה זו שליחת דמו (שום דבר לא נכתב באמת)
  sending?: boolean; // review: שליחה בעיצומה
  error?: string; // review: תקלה בשליחה האחרונה
  onSend?: () => void; // review
  onEdit?: (index: number) => void; // review: חזרה לטופס של חשבונית
  onReset: () => void;
};

export default function QueueSummary({
  mode,
  items,
  demo = false,
  sending = false,
  error,
  onSend,
  onEdit,
  onReset,
}: Props) {
  const approved = items.filter((it) => it.status === "approved" && it.approved);
  const toSend = approved.filter((it) => !it.committed);
  const skipped = items.filter((it) => it.status === "skipped");

  const doneTitle =
    approved.length === 0
      ? "לא נקלטו חשבוניות"
      : approved.length === 1
        ? "החשבונית נקלטה."
        : approved.length + " חשבוניות נקלטו.";

  const sendLabel = sending
    ? "שולחת לטבלה..."
    : toSend.length === 1
      ? "שליחת החשבונית לטבלה"
      : "שליחת " + toSend.length + " החשבוניות לטבלה";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-10 text-center">
        {mode === "done" && (
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
        )}
        <h2 className="text-4xl font-semibold tracking-tight text-[#1d1d1f] sm:text-5xl">
          {mode === "review" ? "רגע לפני הטבלה." : doneTitle}
        </h2>
        {mode === "review" && (
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#6e6e73]">
            {toSend.length === 0
              ? "לא נשארו חשבוניות לשליחה."
              : "שום דבר עוד לא נכנס לטבלה. אפשר לפתוח כל שורה ולבדוק אותה — ואם משהו לא מדויק, עריכה מחזירה לטופס."}
          </p>
        )}
        {skipped.length > 0 && (
          <p className="mt-2 text-sm text-[#6e6e73]">{skipped.length + " דולגו"}</p>
        )}
        {mode === "done" && demo && (
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
                className="flex items-center justify-between rounded-2xl bg-[#f5f5f7] px-5 py-4 text-sm text-[#a1a1a6]"
              >
                <span>{"חשבונית " + (idx + 1) + " — דולגה"}</span>
                {mode === "review" && onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(idx)}
                    className="rounded-full px-3 py-1 text-xs font-semibold text-[#c77e1f] transition-colors hover:bg-[#faf3e3]"
                  >
                    בכל זאת לקלוט
                  </button>
                )}
              </div>
            );
          }
          if (it.status !== "approved" || !it.approved) return null;
          const s = it.approved.summary;
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
                  {mode === "done" &&
                    it.committed &&
                    it.committed.row !== null &&
                    " · שורה " + it.committed.row}
                </span>
                <span className="mr-auto flex items-center gap-2">
                  {mode === "review" &&
                    (it.committed ? (
                      <span className="rounded-full bg-[#e0a339]/15 px-3 py-1 text-xs font-semibold text-[#8a5a10]">
                        כבר בטבלה
                      </span>
                    ) : (
                      onEdit && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault(); // שלא ייפתח/ייסגר הפירוט מהלחיצה
                            onEdit(idx);
                          }}
                          className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-[#1d1d1f] shadow-sm transition-all hover:shadow active:scale-95"
                        >
                          עריכה
                        </button>
                      )
                    ))}
                  <span className="text-zinc-300 transition-transform group-open:rotate-90">
                    ‹
                  </span>
                </span>
              </summary>
              <div className="overflow-x-auto border-t border-black/5 px-5 py-4">
                <table className="w-full text-sm">
                  <tbody>
                    {it.approved.rowPreview.map((cell) => (
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

      {mode === "review" && error && (
        <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      {mode === "review" ? (
        <div className="mt-8 flex flex-col items-center gap-3">
          {toSend.length > 0 ? (
            <button
              type="button"
              onClick={onSend}
              disabled={sending}
              className="rounded-full bg-[#1d1d1f] px-10 py-3.5 text-[17px] font-semibold text-white transition-all duration-200 hover:bg-black active:scale-[0.98] disabled:opacity-50"
            >
              {sendLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={onReset}
              className="rounded-full bg-[#1d1d1f] px-10 py-3.5 text-[17px] font-semibold text-white transition-all duration-200 hover:bg-black active:scale-[0.98]"
            >
              חזרה להתחלה
            </button>
          )}
          {toSend.length > 0 && (
            <button
              type="button"
              disabled={sending}
              onClick={() => {
                if (window.confirm("לבטל את הכול? שום שורה לא תיכנס לטבלה.")) onReset();
              }}
              className="text-xs text-[#86868b] transition-colors hover:text-[#1d1d1f] disabled:opacity-50"
            >
              ביטול הכול בלי לשלוח
            </button>
          )}
        </div>
      ) : (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={onReset}
            className="rounded-full bg-[#1d1d1f] px-10 py-3.5 text-[17px] font-semibold text-white transition-all duration-200 hover:bg-black active:scale-[0.98]"
          >
            קליטת חשבוניות נוספות
          </button>
        </div>
      )}
    </div>
  );
}
