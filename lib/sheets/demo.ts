// מימוש הדמו של שכבת הגיליון — שלב א' בלבד.
// שום דבר כאן לא נוגע בשום גיליון אמיתי: הרשימות קבועות, הוספת שורה היא "הדמיה" בלבד.
//
// !!! לפני ההדגמה לויקי: להחליף את הרשימות למטה בערכים האמיתיים מהטבלה שלה
// (עמודה A = פרויקטים, עמודה H = סוגי עבודה, עמודה I = ספקים) !!!

import "server-only";
import type { SheetProvider } from "./provider";

const DEMO_PROJECTS = [
  "מגדלי YOO",
  "בן ג'ויה",
  "גינדי רמת גן",
  "מגדל הים התיכון",
  "נווה צדק 12",
];

const DEMO_WORK_TYPES = [
  "אינסטלציה",
  "חשמל",
  "מיזוג אוויר",
  "מנופים",
  "עבודות גבס",
  "צבע",
  "ריצוף",
  "שכר עבודה",
  "חומרים",
  "הובלות",
];

const DEMO_SUPPLIERS = [
  "אוו פרש",
  "סרגיי אינסט",
  "י.ד חשמל",
  "א.א הובלות",
  "מנופי הצפון",
];

export const demoProvider: SheetProvider = {
  async getLists() {
    return {
      projects: DEMO_PROJECTS,
      workTypes: DEMO_WORK_TYPES,
      suppliers: DEMO_SUPPLIERS,
    };
  },

  async getMappings() {
    // בשלב א' אין עדיין מיפויים שנלמדו
    return { aliases: {}, addresses: {} };
  },

  async findDuplicate() {
    // בדמו אין נתונים קיימים להשוות מולם
    return null;
  },

  async appendRow() {
    // row: null מסמן למסך "מצב הדגמה — כך תיראה השורה"
    return { row: null };
  },

  async saveMappings() {
    // אין למידה בשלב א'
  },
};
