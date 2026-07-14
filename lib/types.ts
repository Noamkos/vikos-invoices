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

export type ConfirmSuccess = {
  ok: true;
  demo: boolean; // true = מצב הדגמה, שום דבר לא נכתב לגיליון
  row: number | null;
  rowPreview: RowPreviewCell[];
  summary: ConfirmSummary;
};

export type DuplicateInfo = { row: number; month: string; year: number };

export type ConfirmResponse = ConfirmSuccess | (ApiError & { duplicate?: DuplicateInfo });
