"use client";

// טופס האישור — הלב של המערכת. שלוש קבוצות שדות כמו באפיון:
// א. מה שחולץ מהחשבונית (ניתן לעריכה)  ב. בחירה ממאגר  ג. אופציונלי.
// שדות שהמודל לא בטוח בהם מודגשים בכתום; שדות חובה חסרים נצבעים באדום אחרי ניסיון שליחה.

import { useEffect, useState } from "react";
import SearchSelect from "./SearchSelect";
import { HEBREW_MONTHS } from "@/lib/hebrew-dates";
import { parseAmount } from "@/lib/validate";
import type {
  ConfirmRequest,
  DuplicateInfo,
  ExtractSuccess,
  Lists,
} from "@/lib/types";

type Props = {
  data: ExtractSuccess | null;
  lists: Lists;
  extractError?: string;
  submitting: boolean;
  duplicate?: DuplicateInfo;
  submitError?: string;
  serverFieldErrors?: Record<string, string>;
  onSubmit: (req: ConfirmRequest) => void;
  onCancelDuplicate: () => void;
  onCancel: () => void;
};

type FormState = {
  supplier: string;
  supplierIsNew: boolean;
  invoiceNumber: string;
  month: string;
  year: string;
  amount: string;
  project: string;
  workType: string;
  workTypeIsNew: boolean;
  classification: string;
};

function initForm(data: ExtractSuccess | null): FormState {
  if (!data) {
    return {
      supplier: "",
      supplierIsNew: false,
      invoiceNumber: "",
      month: "",
      year: "",
      amount: "",
      project: "",
      workType: "",
      workTypeIsNew: false,
      classification: "",
    };
  }
  const s = data.suggestions;
  return {
    supplier: s.supplier.value ?? "",
    supplierIsNew: s.supplier.isNew,
    invoiceNumber: data.extracted.invoice_number ?? "",
    month: s.month ?? "",
    year: s.year !== null ? String(s.year) : "",
    amount:
      data.extracted.amount_before_vat !== null
        ? // עיגול לשתי ספרות — שסכום שחולץ עם שברי אגורות לא ייתקע בבדיקת התקינות
          String(Math.round(data.extracted.amount_before_vat * 100) / 100)
        : "",
    project: s.project.value ?? "",
    workType: s.workType.value ?? "",
    workTypeIsNew: false,
    classification: "",
  };
}

// שם שדה מהחילוץ -> שדות הטופס שצריך להדגיש באזהרה
const CONFIDENCE_FIELD_MAP: Record<string, string[]> = {
  supplier_name: ["supplier"],
  invoice_number: ["invoiceNumber"],
  invoice_date: ["month", "year"],
  amount_before_vat: ["amount"],
  amount_total: ["amount"],
  vat_amount: ["amount"],
  project_guess: ["project"],
  work_type_guess: ["workType"],
};

function Field({
  label,
  required,
  error,
  note,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {note && <p className="mt-1 text-xs text-amber-700">{note}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function ConfirmForm({
  data,
  lists,
  extractError,
  submitting,
  duplicate,
  submitError,
  serverFieldErrors,
  onSubmit,
  onCancelDuplicate,
  onCancel,
}: Props) {
  const [form, setForm] = useState<FormState>(() => initForm(data));
  const [showErrors, setShowErrors] = useState(false);
  // שגיאות מהשרת נשמרות מקומית ונמחקות לשדה ברגע שעורכים אותו
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setServerErrors(serverFieldErrors ?? {});
  }, [serverFieldErrors]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setServerErrors((e) => {
      if (!(key in e)) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  // אזהרות אמינות מהמודל -> הדגשות והערות לפי שדה
  const confidenceNotes: Record<string, string> = {};
  if (data) {
    for (const n of data.extracted.confidence_notes) {
      for (const formField of CONFIDENCE_FIELD_MAP[n.field] ?? []) {
        confidenceNotes[formField] = n.note;
      }
    }
  }

  const parsedAmount = parseAmount(form.amount);
  const isCredit = parsedAmount !== null && parsedAmount < 0;

  function clientErrors(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!form.supplier.trim()) e.supplier = "שדה חובה";
    if (!form.invoiceNumber.trim()) e.invoiceNumber = "שדה חובה";
    if (!form.month) e.month = "יש לבחור חודש";
    if (!/^\d{4}$/.test(form.year.trim())) e.year = "יש להזין שנה (4 ספרות)";
    if (parsedAmount === null) e.amount = "יש להזין סכום (מספר בלבד)";
    if (!form.project) e.project = "שדה חובה";
    if (!form.workType.trim()) e.workType = "שדה חובה";
    return e;
  }

  // שגיאות מהלקוח גוברות על שגיאות ישנות מהשרת (השדה כבר נערך מאז)
  const errors: Record<string, string> = {
    ...serverErrors,
    ...(showErrors ? clientErrors() : {}),
  };

  function handleSubmit(force: boolean) {
    const e = clientErrors();
    if (Object.keys(e).length > 0) {
      setShowErrors(true);
      return;
    }
    onSubmit({
      supplier: form.supplier.trim(),
      supplierOfficialName: data?.extracted.supplier_name ?? null,
      supplierIsNew: form.supplierIsNew,
      invoiceNumber: form.invoiceNumber.trim(),
      month: form.month,
      year: Number(form.year),
      amountBeforeVat: parsedAmount as number,
      project: form.project,
      workType: form.workType.trim(),
      workTypeIsNew: form.workTypeIsNew,
      classification: form.classification.trim(),
      addressHints: data?.extracted.address_or_project_hints ?? [],
      force,
    });
  }

  const officialName = data?.extracted.supplier_name ?? null;
  const total = data?.extracted.amount_total ?? null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      {extractError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {extractError + " — אפשר למלא את השדות ידנית מול החשבונית שמוצגת לצד הטופס"}
        </div>
      )}

      {data && data.warnings.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <ul className="list-inside list-disc space-y-1 text-sm text-amber-900">
            {data.warnings.map((w) => (
              <li key={w.code}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-6">
        <section>
          <h3 className="mb-3 border-b border-zinc-100 pb-1 text-sm font-bold text-zinc-500">
            חולץ מהחשבונית — לבדוק ולתקן
          </h3>
          <div className="space-y-4">
            <Field
              label="ספק"
              required
              error={errors.supplier}
              note={
                form.supplierIsNew
                  ? "ספק חדש — איך לרשום אותו בטבלה?"
                  : confidenceNotes.supplier
              }
            >
              <SearchSelect
                id="supplier"
                value={form.supplier}
                options={lists.suppliers}
                allowCreate
                createLabel="ספק חדש בשם"
                onChange={(v, isNew) => {
                  set("supplier", v);
                  set("supplierIsNew", isNew);
                }}
                highlight={form.supplierIsNew || !!confidenceNotes.supplier}
                error={undefined}
              />
              {officialName && officialName !== form.supplier && (
                <p className="mt-1 text-xs text-zinc-400">{"בחשבונית: " + officialName}</p>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="חודש" required error={errors.month} note={confidenceNotes.month}>
                <select
                  value={form.month}
                  onChange={(e) => set("month", e.target.value)}
                  className={
                    "w-full rounded-lg border bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 " +
                    (errors.month
                      ? "border-red-400"
                      : confidenceNotes.month
                        ? "border-amber-400"
                        : "border-zinc-300")
                  }
                >
                  <option value="">בחרי חודש</option>
                  {HEBREW_MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="שנה" required error={errors.year} note={confidenceNotes.year}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.year}
                  onChange={(e) => set("year", e.target.value)}
                  className={
                    "ltr-field w-full rounded-lg border bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 " +
                    (errors.year
                      ? "border-red-400"
                      : confidenceNotes.year
                        ? "border-amber-400"
                        : "border-zinc-300")
                  }
                  placeholder="2026"
                />
              </Field>
            </div>

            <Field
              label={'סכום לפני מע"מ (₪)'}
              required
              error={errors.amount}
              note={confidenceNotes.amount}
            >
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => set("amount", e.target.value)}
                  className={
                    "ltr-field w-full rounded-lg border bg-white px-3 py-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 " +
                    (errors.amount
                      ? "border-red-400"
                      : confidenceNotes.amount
                        ? "border-amber-400"
                        : "border-zinc-300")
                  }
                  placeholder="0.00"
                />
                {isCredit && (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                    זיכוי
                  </span>
                )}
              </div>
              {total !== null && (
                <p className="mt-1 text-xs text-zinc-500">
                  {'סה"כ כולל מע"מ בחשבונית: '}
                  <span className="ltr-field inline-block">
                    {total.toLocaleString("he-IL", { maximumFractionDigits: 2 }) + " ₪"}
                  </span>
                  {" (לבדיקה בלבד — לא נכנס לטבלה)"}
                </p>
              )}
            </Field>

            <Field
              label="מספר חשבונית"
              required
              error={errors.invoiceNumber}
              note={confidenceNotes.invoiceNumber}
            >
              <input
                type="text"
                value={form.invoiceNumber}
                onChange={(e) => set("invoiceNumber", e.target.value)}
                className={
                  "ltr-field w-full rounded-lg border bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 " +
                  (errors.invoiceNumber
                    ? "border-red-400"
                    : confidenceNotes.invoiceNumber
                      ? "border-amber-400"
                      : "border-zinc-300")
                }
              />
            </Field>
          </div>
        </section>

        <section>
          <h3 className="mb-3 border-b border-zinc-100 pb-1 text-sm font-bold text-zinc-500">
            שיוך
          </h3>
          <div className="space-y-4">
            <Field label="פרויקט" required error={errors.project} note={confidenceNotes.project}>
              <SearchSelect
                id="project"
                value={form.project}
                options={lists.projects}
                onChange={(v) => set("project", v)}
                highlight={!!confidenceNotes.project}
                placeholder="בחרי פרויקט מהרשימה"
              />
            </Field>
            <Field
              label="סוג עבודה"
              required
              error={errors.workType}
              note={
                form.workTypeIsNew
                  ? "סוג עבודה חדש — ייכנס לרשימה מעכשיו"
                  : confidenceNotes.workType
              }
            >
              <SearchSelect
                id="workType"
                value={form.workType}
                options={lists.workTypes}
                allowCreate
                createLabel="צור סוג עבודה חדש"
                onChange={(v, isNew) => {
                  set("workType", v);
                  set("workTypeIsNew", isNew);
                }}
                highlight={!!confidenceNotes.workType}
              />
            </Field>
          </div>
        </section>

        <section>
          <h3 className="mb-3 border-b border-zinc-100 pb-1 text-sm font-bold text-zinc-500">
            אופציונלי
          </h3>
          <Field label="סיווג / הערה" error={errors.classification}>
            <input
              type="text"
              value={form.classification}
              onChange={(e) => set("classification", e.target.value)}
              placeholder="עכבון, מקדמה, גמר חשבון..."
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </Field>
        </section>

        {duplicate && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
            <p className="mb-3 font-semibold text-amber-900">
              {"חשבונית זו כבר קיימת בטבלה (שורה " +
                duplicate.row +
                ", הוזנה בחודש " +
                duplicate.month +
                " " +
                duplicate.year +
                ")"}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={submitting}
                className="rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
              >
                הכנס בכל זאת
              </button>
              <button
                type="button"
                onClick={onCancelDuplicate}
                className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
              >
                ביטול
              </button>
            </div>
          </div>
        )}

        {submitError && !duplicate && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {submitError}
          </div>
        )}

        <div className="flex items-center gap-4 pt-2">
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={submitting || !!duplicate}
            className="flex-1 rounded-xl bg-emerald-600 px-6 py-3 text-lg font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? "מכניסה לטבלה..." : "אישור והכנסה לטבלה"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-xl px-5 py-3 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
