// בדיקות לוגיקה מהירות לקבצי lib — בלי שרת ובלי דפדפן.
// הרצה: npx tsx scripts/test-logic.mts

import { findBatchDuplicate, parseAmount, reconcileAmounts, validateConfirm } from "../lib/validate";
import { normalizeName, matchSupplier } from "../lib/crossref";
import { buildRow } from "../lib/row";
import { dateToMonthYear } from "../lib/hebrew-dates";
import type { Extracted, ConfirmRequest, Lists } from "../lib/types";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    pass++;
    console.log("PASS " + name);
  } else {
    fail++;
    console.log("FAIL " + name + " -> " + JSON.stringify(extra));
  }
}

// 1. parseAmount: פסיק אירופי נדחה, מפריד אלפים מתקבל
check("parseAmount 12,50 -> null", parseAmount("12,50") === null);
check("parseAmount 1,250.75 -> 1250.75", parseAmount("1,250.75") === 1250.75);
check("parseAmount 128.02 -> 128.02", parseAmount("128.02") === 128.02);
check("parseAmount -1,250 -> -1250", parseAmount("-1,250") === -1250);
check("parseAmount 1,25,0 -> null", parseAmount("1,25,0") === null);
check("parseAmount with shekel+spaces", parseAmount("12,500 ₪") === 12500);

// 2. סכומים עם שתי ספרות עשרוניות עוברים ולידציה (באג העיגול הבינארי)
const lists: Lists = { projects: ["פרויקט א"], workTypes: ["חשמל"], suppliers: ["ספק א"] };
const baseReq: ConfirmRequest = {
  supplier: "ספק א",
  supplierOfficialName: null,
  supplierIsNew: false,
  invoiceNumber: "123",
  month: "יוני",
  year: 2026,
  amountBeforeVat: 128.02,
  project: "פרויקט א",
  workType: "חשמל",
  workTypeIsNew: false,
  classification: "",
  addressHints: [],
  force: false,
};
for (const amt of [128.02, 1.15, 0.07, 4.02, 19.99, 12500, -1170.55]) {
  const errs = validateConfirm({ ...baseReq, amountBeforeVat: amt }, lists);
  check("validateConfirm amount " + amt + " ok", !errs.amount, errs);
}
const threeDecimals = validateConfirm({ ...baseReq, amountBeforeVat: 19.994 }, lists);
check("validateConfirm 19.994 rejected", threeDecimals.amount !== undefined);

// 3. חשבונית זיכוי (הכול שלילי) עוברת את בדיקת המע"מ
const credit: Extracted = {
  is_invoice: true,
  document_type: "חשבונית זיכוי",
  supplier_name: "ספק",
  invoice_number: "1",
  invoice_date: "2026-06-01",
  amount_before_vat: -12500,
  vat_amount: -2250,
  amount_total: -14750,
  currency: "ILS",
  address_or_project_hints: [],
  purchase_description: null,
  project_guess: null,
  work_type_guess: null,
  confidence_notes: [],
};
const rc = reconcileAmounts(credit);
check("credit invoice trusted", rc.trusted, rc);
check("credit invoice has credit warning", rc.warnings.some((w) => w.code === "credit_invoice"));
check(
  "credit invoice no vat_mismatch",
  !rc.warnings.some((w) => w.code === "vat_mismatch"),
  rc.warnings,
);

// 3ב. חילוץ עם סימנים מעורבים (הזיה של המודל) עדיין נחסם
const mixed = { ...credit, vat_amount: 2250, amount_total: -10250 };
check("mixed-sign not trusted", !reconcileAmounts(mixed).trusted);

// 3ג. חשבונית רגילה תקינה
const normal = { ...credit, document_type: "חשבונית מס" as const, amount_before_vat: 12500, vat_amount: 2250, amount_total: 14750 };
check("normal invoice trusted", reconcileAmounts(normal).trusted);

// 4. הסרת בע"מ עברית ב-normalizeName
check(
  'normalizeName strips בע"מ',
  normalizeName('סרגיי אינסט בע"מ') === "סרגיי אינסט",
  normalizeName('סרגיי אינסט בע"מ'),
);
const m = matchSupplier('סרגיי אינסט בע"מ', ["סרגיי אינסט", "אוו פרש"], {});
check("matchSupplier exact after suffix strip", m.value === "סרגיי אינסט" && !m.isNew, m);
check("normalizeName keeps בעמק", normalizeName("בעמק הירדן") === "בעמק הירדן", normalizeName("בעמק הירדן"));

// 5. buildRow: בדיוק 17 תאים, Q עם גרש מוביל, עמודות ריקות במקום
const row = buildRow({ ...baseReq, invoiceNumber: "00123" });
check("row has 17 cells", row.length === 17, row.length);
check("Q keeps leading zeros as text", row[16] === "'00123", row[16]);
check("J is a number", typeof row[9] === "number");
check("empty columns are empty strings", row[1] === "" && row[10] === "" && row[11] === "");

// 6. תאריכים
check("dateToMonthYear valid", JSON.stringify(dateToMonthYear("2026-12-05")) === JSON.stringify({ month: "דצמבר", year: 2026 }));
check("dateToMonthYear garbage -> null", dateToMonthYear("15/06/2026") === null);

// 7. כפילות בתוך תור אחד (findBatchDuplicate) — אותו ספק בכתיב שונה + אותו מספר
const dupPair = findBatchDuplicate([
  { supplier: 'סרגיי אינסט בע"מ', invoiceNumber: "50852 ", force: false },
  { supplier: "אחר לגמרי", invoiceNumber: "50852", force: false },
  { supplier: "סרגיי אינסט", invoiceNumber: "50852", force: false },
]);
check(
  "batch duplicate found across spelling variants",
  JSON.stringify(dupPair) === JSON.stringify({ first: 0, second: 2 }),
  dupPair,
);
check(
  "batch duplicate skipped when second is forced",
  findBatchDuplicate([
    { supplier: "ספק א", invoiceNumber: "7", force: false },
    { supplier: "ספק א", invoiceNumber: "7", force: true },
  ]) === null,
);
check(
  "no batch duplicate for different numbers",
  findBatchDuplicate([
    { supplier: "ספק א", invoiceNumber: "7", force: false },
    { supplier: "ספק א", invoiceNumber: "8", force: false },
  ]) === null,
);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail > 0 ? 1 : 0);
