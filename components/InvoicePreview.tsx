"use client";

// תצוגת החשבונית לצד הטופס — הקובץ חי רק בזיכרון הדפדפן (לא נשמר בשום שרת).
// כתובות ה-blob נוצרות ומשוחררות באותו effect, כדי שגם ב-StrictMode (הרצה כפולה
// של אפקטים בפיתוח) התצוגה לא תישבר ולא תודלף כתובת.

import { useEffect, useState } from "react";

type Props = { files: File[] };

type Item = { url: string; isPdf: boolean; name: string };

export default function InvoicePreview({ files }: Props) {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const created = files.map((f) => ({
      url: URL.createObjectURL(f),
      isPdf: f.type === "application/pdf",
      name: f.name,
    }));
    setItems(created);
    return () => {
      for (const item of created) URL.revokeObjectURL(item.url);
    };
  }, [files]);

  return (
    <div className="rounded-3xl border border-black/5 bg-white p-3 shadow-[0_2px_24px_rgba(0,0,0,0.06)]">
      <p className="mb-2 px-1 text-sm font-medium text-zinc-500">החשבונית שהועלתה</p>
      <div className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto">
        {items.map((item, i) =>
          item.isPdf ? (
            <iframe
              key={item.url}
              src={item.url}
              title={item.name}
              className="h-[70vh] w-full rounded-lg border border-zinc-100"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={item.url}
              src={item.url}
              alt={"עמוד " + (i + 1)}
              className="w-full rounded-lg border border-zinc-100"
            />
          ),
        )}
      </div>
    </div>
  );
}
