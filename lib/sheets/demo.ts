// מימוש הדמו של שכבת הגיליון — שלב א' בלבד.
// שום דבר כאן לא נוגע בשום גיליון אמיתי: הרשימות קבועות, הוספת שורה היא "הדמיה" בלבד.
//
// הרשימות למטה הן צילום-מצב חלקי מהגיליון האמיתי (נקרא 14.07.2026, בעיקר שנים 2021-2024).
// זו לא רשימה מלאה! בשלב ב' הרשימות ייקראו חיות מהגיליון וכל ערך חדש יופיע אוטומטית.

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { emptyOverrides, sanitizeOverrides } from "../lists";
import type { ListOverrides } from "../types";
import type { SheetProvider } from "./provider";

// במצב דמו ההתאמות האישיות נשמרות בקובץ מקומי (לא נכנס ל-git).
// הערה: בפריסה ל-Vercel הקובץ זמני ונמחק בכל פריסה — בשלב ב' האחסון עובר ללשונית המיפויים בגיליון.
const OVERRIDES_PATH = path.join(process.cwd(), "data", "list-overrides.json");

const DEMO_PROJECTS = [
  "אדרי ירושלים",
  "ארסוף",
  "בלום",
  "דורי סגל",
  "ויקס אברמוביץ",
  "ונסה",
  "כנרת",
  "ליבר",
  "מנדלסון",
  "מנדלשטם 10",
  "מש' שקד בתים",
  "נרדיני",
  "קוטלר",
];

const DEMO_WORK_TYPES = [
  "ביטוח",
  "בניה",
  "גביה מלקוח",
  "דמי ניהול פרויקט",
  "הובלות",
  "הריסה",
  "חומרים",
  "עבודות איטום",
  "עבודות אינסטלציה",
  "עבודות בטון",
  "עבודות גבס",
  "עבודות גז",
  "עבודות חשמל",
  "עבודות טיח",
  "עבודות ליטוש",
  "עבודות מנוף",
  "עבודות צבע",
  "עבודות ריצוף",
  "עבודות שלד",
  "עמלת שיווק",
  "פיגום",
  "פינוי פסולת",
  "פועלים",
  "קבלן משנה",
  "שפכטל וצבע",
];

const DEMO_SUPPLIERS = [
  "א.צ.שיווק",
  "אופן ארט",
  "אחים חמארשה",
  "איירלדום",
  "אלאמיר",
  "אלום בר-אל",
  "אלי ליטוש",
  "אלכס פרנקל",
  "אלן אינסטלציה",
  "אשל פינוי פסולת",
  "בוריס וולקוביץ",
  "בוריס צבעי",
  "בן ישי צבעים",
  "דרורן פרקטים",
  "המספק הראשי לבנין",
  "ולדימיר סיסטם",
  "חלפן פיגומים",
  "חנן הובלות",
  "יחזקאל ובניו",
  "יקי חשמל",
  "כנען",
  "מוחמד רצף",
  "מיכאל בורובסקי",
  "נטור טיח",
  "נטור קבלנות",
  "סבן יעקב",
  "סול עיצוב",
  "סרגיי אינסט",
  "ע.ג.לידן",
  "עולם הניסור",
  "פלור אנד קאר",
  "פלור איסט",
  "פלמר אינסטלציה",
  "פניקס חברה לביטוח",
  "קוסטה גבס",
  "קוסטה רצף",
  "רביד",
  "רומן",
  "רוטנברג",
  "רן מנשה",
  "שחר אינסט",
  "שניר מנופים",
  "שרן טל גז",
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

  async getListOverrides(): Promise<ListOverrides> {
    try {
      const raw = await fs.readFile(OVERRIDES_PATH, "utf8");
      return sanitizeOverrides(JSON.parse(raw));
    } catch {
      return emptyOverrides();
    }
  },

  async saveListOverrides(overrides: ListOverrides): Promise<void> {
    await fs.mkdir(path.dirname(OVERRIDES_PATH), { recursive: true });
    await fs.writeFile(OVERRIDES_PATH, JSON.stringify(overrides, null, 2), "utf8");
  },
};
