"use client";

// מסך הגדרות הרשימות: הוספה והסתרה של ערכים בהשלמה האוטומטית.
// חשוב: שום דבר כאן לא משנה את הטבלה — רק את מה שהאתר מציע.

import { useEffect, useState } from "react";
import type { ListKind, ListOverrides, Lists } from "@/lib/types";
import { emptyOverrides } from "@/lib/lists";

const KINDS: { key: ListKind; label: string; addHint: string }[] = [
  { key: "projects", label: "פרויקטים", addHint: "למשל: מש.בר תל אביב" },
  { key: "workTypes", label: "סוגי עבודה", addHint: "למשל: עבודות ניסור" },
  { key: "suppliers", label: "ספקים", addHint: "שם הספק כפי שיירשם בטבלה" },
];

export default function SettingsPage() {
  const [base, setBase] = useState<Lists | null>(null);
  const [overrides, setOverrides] = useState<ListOverrides>(emptyOverrides());
  const [newValues, setNewValues] = useState<Record<ListKind, string>>({
    projects: "",
    workTypes: "",
    suppliers: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setBase(data.base);
          setOverrides(data.overrides);
        } else {
          setError(data.message ?? "שגיאה בטעינה");
        }
      })
      .catch(() => setError("לא הצלחנו לטעון את ההגדרות"));
  }, []);

  async function save(next: ListOverrides) {
    setOverrides(next); // עדכון מיידי במסך
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides: next }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.message ?? "השמירה נכשלה");
    } catch {
      setError("השמירה נכשלה — לבדוק שהשרת רץ");
    } finally {
      setSaving(false);
    }
  }

  function hide(kind: ListKind, value: string) {
    save({
      ...overrides,
      hidden: { ...overrides.hidden, [kind]: [...overrides.hidden[kind], value] },
    });
  }

  function unhide(kind: ListKind, value: string) {
    save({
      ...overrides,
      hidden: {
        ...overrides.hidden,
        [kind]: overrides.hidden[kind].filter((v) => v !== value),
      },
    });
  }

  function addValue(kind: ListKind) {
    const value = newValues[kind].trim();
    if (!value) return;
    if (overrides.added[kind].includes(value) || base?.[kind].includes(value)) {
      setNewValues((n) => ({ ...n, [kind]: "" }));
      return;
    }
    setNewValues((n) => ({ ...n, [kind]: "" }));
    save({
      ...overrides,
      added: { ...overrides.added, [kind]: [...overrides.added[kind], value] },
    });
  }

  function removeAdded(kind: ListKind, value: string) {
    save({
      ...overrides,
      added: {
        ...overrides.added,
        [kind]: overrides.added[kind].filter((v) => v !== value),
      },
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">הגדרות רשימות</h1>
          <p className="mt-1 text-sm text-zinc-500">
            מה שמוסתר או נוסף כאן משפיע רק על ההשלמה האוטומטית באתר — הטבלה עצמה לא משתנה.
          </p>
        </div>
        <a
          href="/"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          → חזרה לקליטה
        </a>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {saving && <p className="mb-2 text-xs text-zinc-400">שומרת...</p>}

      {!base ? (
        <p className="py-12 text-center text-zinc-500">טוענת...</p>
      ) : (
        <div className="space-y-8">
          {KINDS.map(({ key, label, addHint }) => {
            const hiddenSet = new Set(overrides.hidden[key]);
            return (
              <section key={key} className="rounded-3xl border border-black/5 bg-white p-5 shadow-[0_2px_24px_rgba(0,0,0,0.06)]">
                <h2 className="mb-3 text-lg font-bold text-zinc-800">{label}</h2>

                <div className="mb-4 flex flex-wrap gap-2">
                  {base[key].map((v) => {
                    const isHidden = hiddenSet.has(v);
                    return (
                      <span
                        key={v}
                        className={
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm " +
                          (isHidden
                            ? "border-zinc-200 bg-zinc-100 text-zinc-400 line-through"
                            : "border-zinc-300 bg-white text-zinc-800")
                        }
                      >
                        {v}
                        {isHidden ? (
                          <button
                            type="button"
                            title="להחזיר להצעות"
                            onClick={() => unhide(key, v)}
                            className="font-bold text-[#c77e1f] hover:text-[#8a5a10]"
                          >
                            +
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="להסתיר מההצעות"
                            onClick={() => hide(key, v)}
                            className="font-bold text-zinc-400 hover:text-red-600"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    );
                  })}
                  {overrides.added[key].map((v) => (
                    <span
                      key={v}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#e8c07a] bg-[#faf3e3] px-3 py-1 text-sm text-[#7a5210]"
                    >
                      {v}
                      <span className="text-[10px] text-[#c77e1f]">נוסף</span>
                      <button
                        type="button"
                        title="למחוק את הערך שנוסף"
                        onClick={() => removeAdded(key, v)}
                        className="font-bold text-[#d29a3f] hover:text-red-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newValues[key]}
                    placeholder={addHint}
                    onChange={(e) => setNewValues((n) => ({ ...n, [key]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addValue(key);
                    }}
                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e0a339]/60"
                  />
                  <button
                    type="button"
                    onClick={() => addValue(key)}
                    className="rounded-full bg-[#1d1d1f] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-black"
                  >
                    ➕ הוספה
                  </button>
                </div>
              </section>
            );
          })}

          <p className="text-xs text-zinc-400">
            הסתרה מסמנת ערך בקו חוצה והוא מפסיק להופיע בהצעות; לחיצה על + מחזירה אותו.
            ערכים שנוספו ידנית מסומנים בירוק. בשלב ב׳ ההגדרות יישמרו בגיליון עצמו.
          </p>
        </div>
      )}
    </div>
  );
}
