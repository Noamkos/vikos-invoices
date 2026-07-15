<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# מדריך תפעול — מערכת החשבוניות של ויקי (ויקוס הנדסה)

נטען אוטומטית לכל שיחת Claude Code בפרויקט. מסמכי היסוד: אפיון ב-`../אפיון-מערכת-חשבוניות-ויקוס.md`, תוכנית בנייה מלאה (עם כל ההחלטות שאושרו) ב-`../תוכנית-בנייה-מערכת-חשבוניות.md`.

**נועם (המשתמש) ללא רקע תכנותי** — להסביר כל מונח בעברית פשוטה. **נוסחי ההודעות למשתמשת (ויקי) — עברית ידידותית, בלי סימני קריאה.**

## פקודות

```
npm run dev                                    # שרת פיתוח — http://localhost:3000
npm run build                                  # בנייה + בדיקת טיפוסים (חובה לפני commit)
npx eslint .                                   # לינט (next lint הוסר ב-Next 16)
npx tsx scripts/test-logic.mts                 # 28 בדיקות רגרסיה על lib/ — חובה אחרי כל שינוי ב-lib
node scripts/test-extract.mjs <קובץ> [עוד...]  # חילוץ אמיתי מהטרמינל (דורש dev רץ; כמה קבצים = עמודים של חשבונית אחת)
```

git: commit אחרי כל שלב שהושלם ונבדק, ואז push ל-`github.com/Noamkos/vikos-invoices` (פרטי). לפני push: לוודא ששום סוד לא staged (`git diff --cached | Select-String "sk-ant|PRIVATE KEY"` חייב ריק).

## סטטוס ומצבי עבודה

- **שלב א' (הדגמה) הושלם ואומת** על 6 מסמכים אמיתיים. אין עדיין כתיבה לגיליון/קובץ אמיתי ואין התחברות.
- **הכרעת אחסון פתוחה:** ויקי דורשת אקסל (לא Google Sheets). האופציות: OneDrive + Microsoft Graph API (אם יש מנוי 365 — נועם בודק) או תוכנה מקומית שכותבת דרך Excel. חשבון שירות Google מוכן ליתר ביטחון (`vikos-invoices-bot@viki-invoices.iam.gserviceaccount.com`). **לא לבנות את שכבת הכתיבה עד שנועם מכריע.**
- מתגי סביבה (.env.local, לא ב-git): בלי `ANTHROPIC_API_KEY` — חילוץ mock; `FORCE_MOCK_EXTRACTION=1` — mock גם עם מפתח (לבדיקות דפדפן חינם; להסיר אחרי!); בלי `SPREADSHEET_ID` — ספק דמו.

## ארכיטקטורה — התמונה הגדולה

**זרימת הנתונים:** דפדפן (הקטנת תמונות ל-JPEG ‏2000px — חובה בגלל מגבלת 4.5MB של Vercel ו-HEIC של אייפון) ← `POST /api/extract` (מרובה קבצים = עמודי חשבונית אחת) ← Claude `claude-sonnet-5` עם Structured Outputs (סכימת JSON כפויה ב-`lib/extraction.ts`) ← `reconcileAmounts` ב-`lib/validate.ts` (בדיקת לפני-מע"מ+מע"מ=סה"כ; נכשל ← הסכום מתרוקן) ← `resolveSuggestions` ב-`lib/crossref.ts` (מיפוי שנלמד > התאמה מקורבת > ניחוש מודל > ריק) ← טופס אישור ← `POST /api/confirm` (`validateConfirm` ← בדיקת כפילות ← `buildRow`) ← Provider.

**שלוש נקודות התפר החשובות:**

1. **`lib/sheets/provider.ts` — החוזה של האחסון.** כל גישה לנתונים עוברת דרך ממשק `SheetProvider` יחיד. כרגע מימוש יחיד: `demo.ts` (רשימות-צילום מהגיליון האמיתי, append מדומה). כשתוכרע שאלת האחסון — כותבים מימוש חדש (google.ts / excel.ts) בלי לגעת בשום קובץ אחר. הרשימות (פרויקטים/ספקים/סוגי עבודה) נגזרות תמיד מעמודות הנתונים עצמן.
2. **גבול שרת/דפדפן.** קבצים שנוגעים בסודות פותחים ב-`import "server-only"` (הפרה = שגיאת build). את `lib/types.ts`, `lib/validate.ts`, `lib/hebrew-dates.ts`, `lib/lists.ts` מותר לייבא מהדפדפן — הם טהורים, ואסור להוסיף להם סודות או I/O.
3. **`app/page.tsx` — מכונת מצבים של תור.** `idle ← queue ← summary`. ה-queue מחזיק `QueueItem[]`; החילוץ רץ ברקע פריט-אחרי-פריט בזמן שהמשתמשת מאשרת את הנוכחי; `ConfirmForm` מקבל `key={item.id}` כדי להתאפס בין חשבוניות. כשל חילוץ ← מילוי ידני עם `fallbackLists` (מ-`GET /api/extract`). ה-AI הוא מאיץ, לא תנאי.

**רשימות ההשלמה** ניתנות להתאמה במסך `/settings`: הוספה/הסתרה נשמרות דרך ה-Provider (בדמו: `data/list-overrides.json`, מחוץ ל-git). הסתרה משפיעה רק על הצעות (`suggestionLists`); באימות (`validationLists`) ערך מוסתר עדיין חוקי.

## כללים קשיחים (אין לשבור)

1. **append בלבד:** הכתיבה היחידה המותרת היא הוספת שורה חדשה + מילוי נוסחת עמודה L בשורה שהמערכת עצמה יצרה. שום update/delete על נתונים קיימים, לעולם.
2. **לא מנחשים:** שדה לא ודאי נשאר ריק ומודגש. אין ברירת מחדל "היום" לתאריך — חודש/שנה תמיד מתאריך החשבונית.
3. **סכום שלא עבר את בדיקת המע"מ לא מוצג** — `reconcileAmounts` מרוקן אותו והמשתמשת מקלידה מול המסמך.
4. עמודת Q (מספר חשבונית) נכתבת תמיד עם גרש מוביל (טקסט — שומר אפסים מובילים); כל תא טקסט עובר `escapeCellText` (הגנת הזרקת-נוסחה).
5. `lib/row.ts` הוא מקור האמת היחיד לסדר העמודות A–Q.

## שפת העיצוב (סקיל redesign-existing-projects + הפניית נועם ל-apple.com/il)

רקע לבן; אריחים `#f5f5f7` מעוגלים `rounded-[28px]` בלי מסגרות ובלי צללים; `TopNav` כהה-שקוף עם blur; כותרות ענק semibold עם נקודה בסוף ("שלום, ויקי."); כפתורים ראשיים pill שחורים `#1d1d1f` עם `active:scale-[0.98]`; אקסנט יחיד — כתום המותג `#e0a339`; טעינת שלד ולא ספינר; **אפס אימוג'ים בממשק** — SVG בלבד; מספרים עם `.ltr-field` (כיוון LTR + ספרות ברוחב אחיד). הלוגו: `components/VikosLogo.tsx` — HTML/CSS בלבד, **לא SVG עם `<text>`** (נשבר בדף RTL); הגודל דרך font-size של ההורה.

## דברים שנלמדו בדרך הקשה

- Next 16: `proxy.ts` ולא `middleware.ts` (קובץ ישן פשוט לא רץ). `next lint` הוסר.
- מחקת עמודים מ-`app/`? למחוק `.next` לפני build.
- Vercel: env חדש דורש Redeploy; גוף בקשה עד ~4.5MB (לכן ההקטנה בדפדפן + בדיקת סך-הכול בשרת).
- אין `gh` CLI במחשב — GitHub דרך git או הדפדפן. תוסף Chrome MCP לא אמין כאן; קריאת Google Drive/Sheets אפשרית דרך חיבור ה-Drive MCP של השיחה.
- השוואת float לסכומים — רק עם סובלנות (‎1e-6‎); `\b` של JavaScript לא עובד עם עברית (עוגני רווח/קצה במקום).
- אחרי כל עריכת קוד: לסרוק גרשיים מסולסלים (U+2018/2019/201C/201D). חריג מכוון: תבניות הניקוי ב-`lib/crossref.ts` ו-`lib/validate.ts` מכילות אותם בכוונה.
- מודל החילוץ מוגדר ב-`EXTRACTION_MODEL` (`lib/extraction.ts`), עם `timeout: 50_000, maxRetries: 0` כדי להישאר מתחת ל-`maxDuration = 60` של ה-route.

## מה נשאר לבנות (שלב ב' — אחרי הכרעת האחסון)

מימוש Provider אמיתי (append עם נוסחת L, בדיקת כותרות לפני כתיבה, כפילויות מנורמלות) · לשונית מיפויים + למידה (`saveMappings`) · התחברות + רשימת מורשים (viki + noam בלבד) · התראות טלגרם · שמירת קובץ החשבונית ב-Drive/OneDrive · פריסה ל-Vercel. פירוט מלא בתוכנית הבנייה.
