"use client";

// רשימה נפתחת עם חיפוש חופשי, ואופציה ליצירת ערך חדש (לספקים ולסוגי עבודה).
// value + isNew מנוהלים אצל ההורה; הרכיב רק מדווח על שינויים.

import { useRef, useState } from "react";

type Props = {
  id: string;
  value: string;
  options: string[];
  onChange: (value: string, isNew: boolean) => void;
  allowCreate?: boolean;
  createLabel?: string;
  placeholder?: string;
  error?: string;
  highlight?: boolean; // הדגשת אזהרה (שדה לא בטוח)
};

export default function SearchSelect({
  id,
  value,
  options,
  onChange,
  allowCreate = false,
  createLabel = "להשתמש בערך חדש",
  placeholder,
  error,
  highlight = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<number | null>(null);

  const query = value.trim();
  const filtered = query
    ? options.filter((o) => o.includes(query) || query.includes(o))
    : options;
  const exactMatch = options.includes(value);

  function pick(option: string) {
    onChange(option, false);
    setOpen(false);
  }

  const borderClass = error
    ? "border-red-400"
    : highlight
      ? "border-amber-400"
      : "border-zinc-300";

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        className={
          "w-full rounded-xl border bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e0a339]/60 " +
          borderClass
        }
        onChange={(e) => {
          const v = e.target.value;
          onChange(v, allowCreate && v.trim() !== "" && !options.includes(v));
          setOpen(true);
        }}
        onFocus={() => {
          if (blurTimer.current) window.clearTimeout(blurTimer.current);
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setOpen(false), 150);
        }}
      />
      {open && (filtered.length > 0 || (allowCreate && query && !exactMatch)) && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg">
          {filtered.map((o) => (
            <li key={o}>
              <button
                type="button"
                className={
                  "block w-full px-3 py-2 text-right hover:bg-[#faf3e3] " +
                  (o === value ? "bg-[#faf3e3] font-medium" : "")
                }
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
              >
                {o}
              </button>
            </li>
          ))}
          {allowCreate && query && !exactMatch && (
            <li className="border-t border-zinc-100">
              <button
                type="button"
                className="block w-full px-3 py-2 text-right text-[#c77e1f] hover:bg-[#faf3e3]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(query, true);
                  setOpen(false);
                }}
              >
                {"➕ " + createLabel + ': "' + query + '"'}
              </button>
            </li>
          )}
        </ul>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
