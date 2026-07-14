<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# מדריך תפעול — מערכת קליטת חשבוניות ויקוס

הקובץ נטען אוטומטית לכל שיחת Claude Code בפרויקט. מסמכי היסוד:
- אפיון: `../אפיון-מערכת-חשבוניות-ויקוס.md`
- תוכנית בנייה מלאה (כולל החלטות שאושרו): `../תוכנית-בנייה-מערכת-חשבוניות.md`

**נועם (המשתמש) ללא רקע תכנותי** — להסביר כל מונח בעברית פשוטה.

## סטטוס

- **שלב א' (הדגמה) — נבנה 13.07.2026.** אין כתיבה לשום גיליון, אין התחברות.
- שלב ב' (חיבור ל-Google Sheets + כניסת Google + טלגרם) — טרם התחיל.
- החלטות שאושרו ע"י נועם: חינמי לגמרי (Vercel Hobby) · שמירת קובץ ב-Drive תיכנס בשלב ב' · אין לשונית "יומן מערכת" · אין טבלת "ברירות מחדל לספק" (מחושב מהגיליון) · חודש/שנה תמיד מתאריך החשבונית.

## שני מצבי עבודה (לפי משתני סביבה)

| משתנה | ריק | מלא |
|---|---|---|
| `ANTHROPIC_API_KEY` | חילוץ מדומה (mock) — מחזיר דוגמה קבועה של "אוו פרש", והמסך מציג תג "מצב הדגמה" | חילוץ אמיתי עם `claude-sonnet-5` |
| `SPREADSHEET_ID` | מצב דמו — רשימות קבועות מ-`lib/sheets/demo.ts`, "הוספת שורה" רק מדמה | שלב ב' (עדיין זורק שגיאה מכוונת) |

## מבנה הקוד — איפה מה

- `lib/types.ts` — כל הטיפוסים המשותפים. בטוח לדפדפן. אסור להוסיף לו ייבוא שרת.
- `lib/extraction.ts` — הקריאה ל-Claude: פרומפט + סכימת JSON כפויה (Structured Outputs). המודל: `EXTRACTION_MODEL`.
- `lib/validate.ts` — בדיקת החשבון (מע"מ) `reconcileAmounts`, בדיקת הטופס `validateConfirm`, הגנת תאים `escapeCellText`. טהור — מיובא גם מהדפדפן.
- `lib/crossref.ts` — נרמול שמות + התאמה מקורבת + בניית הצעות.
- `lib/row.ts` — מקור האמת היחיד לסדר עמודות A-Q.
- `lib/sheets/provider.ts` — ה"חוזה" של שכבת הגיליון; `demo.ts` המימוש הנוכחי; `google.ts` ייכתב בשלב ב'.
- `app/api/extract/route.ts` — POST חילוץ, GET רשימות (למילוי ידני). `app/api/confirm/route.ts` — אישור והוספה.
- `app/settings/page.tsx` + `app/api/settings/route.ts` — מסך "⚙️ רשימות": הוספה/הסתרה של ערכים בהשלמה האוטומטית. משפיע רק על ההצעות (כולל הרשימות שנשלחות למודל), לא על אימות ולא על הטבלה. הלוגיקה הטהורה ב-`lib/lists.ts`; האחסון במצב דמו: `data/list-overrides.json` (מחוץ ל-git; ב-Vercel הקובץ זמני — בשלב ב' עובר ללשונית המיפויים).
- זיהוי "נגמרו הטוקנים": `lib/extraction.ts` מזהה שגיאת credit balance ומחזיר קוד `no_credits` ← המסך מציג "נגמרו הטוקנים של Claude!" ונופל למילוי ידני. אין דרך לדעת מראש שהקרדיט עומד להיגמר (Anthropic לא חושפת יתרה ב-API) — לכן מומלץ להגדיר התראת מייל ב-Console.
- `app/page.tsx` — מכונת המצבים של המסך. `components/` — הרכיבים.
- `scripts/test-extract.mjs` — בדיקת חילוץ מהטרמינל (דורש `npm run dev` רץ).
- `scripts/test-logic.mts` — בדיקות רגרסיה ללוגיקה הטהורה (`npx tsx scripts/test-logic.mts`) — להריץ אחרי כל שינוי ב-lib/. 28 בדיקות, כולן חייבות לעבור.

## כללים קשיחים (אין לשבור)

1. **append בלבד**: הכתיבה היחידה המותרת לגיליון היא הוספת שורה חדשה + מילוי נוסחת L בשורה שהמערכת עצמה יצרה. שום update/delete על נתונים קיימים, לעולם.
2. **לא מנחשים**: שדה שהמודל לא בטוח בו נשאר ריק. אין ברירת מחדל "היום" לתאריך.
3. **סכום שלא עבר את בדיקת המע"מ לא מוצג** — `reconcileAmounts` מרוקן אותו.
4. עמודת Q נכתבת תמיד עם גרש מוביל (טקסט). נוסח הודעות למשתמשת — בעברית, ידידותי.
5. אחרי כל עריכת קוד: לסרוק גרשיים מסולסלים (U+2018/2019/201C/201D). חריג מכוון: התבניות ב-`lib/crossref.ts` ו-`lib/validate.ts` מכילות אותם בכוונה כדי לנקות אותם מקלט.

## דברים שנלמדו בדרך הקשה (ירושה מ-abba-tasks + חדשים)

- Next 16: `proxy.ts` ולא `middleware.ts` (קובץ ישן פשוט לא רץ). `next lint` הוסר — מריצים `npx eslint .`.
- מחקת עמודים מ-`app/`? למחוק את `.next` לפני build.
- Vercel: שינוי משתני סביבה לא נטען בלי Redeploy. מגבלת גוף בקשה ~4.5MB — לכן הדפדפן מקטין תמונות לפני שליחה (`UploadDropzone`).
- אין `gh` CLI במחשב — GitHub דרך git או הדפדפן.
- בדיקה מקומית: `npm run dev` ← http://localhost:3000

## שלב ב' — מה נשאר לבנות (לפי התוכנית)

`lib/sheets/google.ts` (קריאה, append עם INSERT_ROWS + נוסחת L מ-updatedRange, בדיקת כותרות, כפילויות), `lib/mappings.ts`, `lib/auth.ts` + `proxy.ts` + דף login (Auth.js v5, מסך הסכמה External), `lib/telegram.ts`, שמירת קובץ ל-Drive, החלפת הרשימות ב-demo.ts לערכים אמיתיים. פירוט מלא בתוכנית הבנייה.
