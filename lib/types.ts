// הטיפוסים המשותפים של המערכת. הקובץ הזה בטוח לייבוא גם מהדפדפן — אסור להוסיף לו סודות או ייבוא של ספריות שרת.

export type DocumentType =
  | "חשבונית מס"
  | "חשבונית מס-קבלה"
  | "חשבונית עסקה"
  | "קבלה"
  | "חשבונית זיכוי"
  | "אחר";

export type ConfidenceNote = { field: string; note: string };

// מה ש-Claude מחזיר מהחשבונית (אחרי אכיפת סכימה)
export type Extracted = {
  is_invoice: boolean;
  document_type: DocumentType | null;
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null; // YYYY-MM-DD
  amount_before_vat: number | null;
  vat_amount: number | null;
  amount_total: number | null;
  currency: string | null; // ISO 4217, למשל ILS / USD
  address_or_project_hints: string[];
  purchase_description: string | null;
  project_guess: string | null;
  work_type_guess: string | null;
  confidence_notes: ConfidenceNote[];
};

export type Lists = { projects: string[]; workTypes: string[]; suppliers: string[] };

export type ListKind = "projects" | "workTypes" | "suppliers";

// התאמות אישיות לרשימות ההשלמה: ערכים שנוספו ידנית וערכים שהוסתרו.
// משפיעות אך ורק על מה שהאתר מציע — לא נוגעות בנתוני הטבלה עצמה.
export type ListOverrides = {
  added: Record<ListKind, string[]>;
  hidden: Record<ListKind, string[]>;
};

export type Mappings = {
  aliases: Record<string, string>; // שם רשמי מנורמל -> שם מוכר בטבלה
  addresses: Record<string, string>; // רמז כתובת מנורמל -> פרויקט
};

export type SuggestionSource = "mapping" | "fuzzy" | "model" | null;

export type Suggestions = {
  supplier: {
    value: string | null;
    source: SuggestionSource;
    isNew: boolean;
    officialName: string | null;
  };
  project: { value: string | null; source: SuggestionSource };
  workType: { value: string | null; source: SuggestionSource };
  month: string | null;
  year: number | null;
};

export type Warning = { code: string; message: string; field?: string };

export type ExtractSuccess = {
  ok: true;
  mock: boolean; // true = אין מפתח API והחילוץ הוא דוגמה מדומה
  extracted: Extracted;
  suggestions: Suggestions;
  lists: Lists;
  warnings: Warning[];
};

export type ApiError = {
  ok: false;
  error: string;
  message: string;
  fields?: Record<string, string>;
};

export type ExtractResponse = ExtractSuccess | ApiError;

// מה שהדפדפן שולח אחרי אישור של ויקי
export type ConfirmRequest = {
  supplier: string;
  supplierOfficialName: string | null; // השם כפי שהופיע על החשבונית — ללמידת כינויים
  supplierIsNew: boolean;
  invoiceNumber: string;
  month: string;
  year: number;
  amountBeforeVat: number;
  project: string;
  workType: string;
  workTypeIsNew: boolean;
  classification: string;
  addressHints: string[]; // ללמידת כתובת->פרויקט בשלב ב'
  force: boolean; // "הכנס בכל זאת" אחרי אזהרת כפילות
};

export type RowPreviewCell = { col: string; header: string; value: string };

export type ConfirmSummary = {
  supplier: string;
  project: string;
  workType: string;
  month: string;
  year: number;
  amount: number;
  invoiceNumber: string;
};

export type DuplicateInfo = { row: number; month: string; year: number };

// --- זרימת שני השלבים של /api/confirm ---
// "check": בדיקת חשבונית אחת (תקינות + כפילות מול הטבלה) — לא כותב כלום.
// "commit": שליחת כל התור בבת אחת — הרגע היחיד שבו נכתב לטבלה.
// ההפרדה מאפשרת לחזור אחורה ולערוך חשבוניות שאושרו, בלי שום סיכון לטבלה.

export type CheckSuccess = {
  ok: true;
  rowPreview: RowPreviewCell[];
  summary: ConfirmSummary;
};

export type CheckResponse = CheckSuccess | (ApiError & { duplicate?: DuplicateInfo });

// index = מיקום החשבונית בתור בדפדפן — כדי שכשמשהו נכשל, נדע לאיזו חשבונית לקפוץ
export type CommitItem = { index: number; req: ConfirmRequest };

export type CommitResult = { index: number; row: number | null };

export type CommitSuccess = {
  ok: true;
  demo: boolean; // true = מצב הדגמה, שום דבר לא נכתב לגיליון
  results: CommitResult[];
};

export type CommitError = ApiError & {
  itemIndex?: number; // החשבונית שבגללה נעצרה השליחה
  duplicate?: DuplicateInfo;
  written?: CommitResult[]; // בתקלה באמצע הכתיבה: השורות שכבר נכנסו לפני העצירה
};

export type CommitResponse = CommitSuccess | CommitError;
