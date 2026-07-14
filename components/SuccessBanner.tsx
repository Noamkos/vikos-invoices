"use client";

// מסך ההצלחה: סיכום השורה שנכנסה (או שהייתה נכנסת, במצב הדגמה) + "חשבונית נוספת".

import type { ConfirmSuccess } from "@/lib/types";

type Props = { result: ConfirmSuccess; onReset: () => void };

// עמודות שערכן מספרי/לועזי — מוצגות משמאל לימין שמינוס ומקפים לא יתהפכו בתצוגה
const LTR_COLS = new Set(["D", "J", "Q"]);

export default function SuccessBanner({ result, onReset }: Props) {
  const s = result.summary;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <div className="mb-2 flex items-center gap-2 text-emerald-800">
          <span className="text-2xl" aria-hidden>
            ✅
          </span>
          <h2 className="text-xl font-bold">
            {result.demo ? "מצב הדגמה — כך תיראה השורה" : "השורה נקלטה בהצלחה"}
          </h2>
        </div>
        {result.demo ? (
          <p className="mb-4 text-sm text-emerald-900">
            שום דבר לא נכתב לטבלה. בשלב ב׳, אחרי החיבור לגיליון, השורה הזו הייתה נכנסת
            בסוף הטבלה.
          </p>
        ) : (
          <p className="mb-4 text-sm text-emerald-900">
            {"השורה נוספה בשורה מספר " + result.row + " בטבלה."}
          </p>
        )}
        <p className="mb-6 rounded-lg bg-white p-3 text-sm text-zinc-700">
          <span className="font-semibold">{s.supplier}</span>
          {" · " + s.project + " · " + s.workType + " · " + s.month + " " + s.year + " · "}
          <span className="ltr-field inline-block font-semibold">
            {s.amount.toLocaleString("he-IL", { maximumFractionDigits: 2 }) + " ₪"}
          </span>
          {" · חשבונית "}
          <span className="ltr-field inline-block">{s.invoiceNumber}</span>
        </p>

        <div className="mb-6 overflow-x-auto rounded-lg border border-emerald-100 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 text-right text-zinc-500">
                <th className="px-3 py-2 font-medium">עמודה</th>
                <th className="px-3 py-2 font-medium">כותרת</th>
                <th className="px-3 py-2 font-medium">ערך</th>
              </tr>
            </thead>
            <tbody>
              {result.rowPreview.map((cell) => (
                <tr
                  key={cell.col}
                  className={
                    "border-t border-zinc-100 " + (cell.value ? "" : "text-zinc-300")
                  }
                >
                  <td className="ltr-field px-3 py-1.5">{cell.col}</td>
                  <td className="px-3 py-1.5">{cell.header}</td>
                  <td className="px-3 py-1.5">
                    {cell.value ? (
                      LTR_COLS.has(cell.col) ? (
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

        <button
          type="button"
          onClick={onReset}
          className="rounded-xl bg-emerald-600 px-8 py-3 text-lg font-semibold text-white shadow hover:bg-emerald-700"
        >
          חשבונית נוספת
        </button>
      </div>
    </div>
  );
}
