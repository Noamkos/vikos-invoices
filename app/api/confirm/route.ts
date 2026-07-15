// POST /api/confirm — שני מצבים:
//   { mode: "check",  item }  — בדיקת חשבונית אחת: תקינות, כפילות מול הטבלה ותצוגת שורה. לא כותב כלום.
//   { mode: "commit", items } — שליחת כל התור: קודם מאמת את כולן, ורק אם הכול תקין — מוסיף את השורות.
// ההפרדה הזו היא שמאפשרת לוויקי לחזור אחורה ולערוך חשבונית שכבר אושרה:
// עד ה-commit שום דבר לא נכתב לטבלה, אז אין שום עריכה של שורה קיימת (append בלבד).
// שלב ב': להוסיף כאן בדיקת התחברות (requireUser) בשורה הראשונה.

import { NextRequest, NextResponse } from "next/server";
import { findBatchDuplicate, validateConfirm } from "@/lib/validate";
import { buildRow, buildRowPreview } from "@/lib/row";
import { validationLists } from "@/lib/lists";
import { getProvider } from "@/lib/sheets/provider";
import type {
  CheckResponse,
  CommitItem,
  CommitResponse,
  CommitResult,
  ConfirmRequest,
  ConfirmSummary,
  Lists,
} from "@/lib/types";

type Body =
  | { mode: "check"; item: ConfirmRequest }
  | { mode: "commit"; items: CommitItem[] };

// ספק חדש מותר גם אם אינו ברשימה — מוסיפים אותו זמנית לרשימת האימות
function listsFor(req: ConfirmRequest, lists: Lists): Lists {
  return req.supplierIsNew
    ? { ...lists, suppliers: [...lists.suppliers, req.supplier] }
    : lists;
}

function summaryOf(req: ConfirmRequest): ConfirmSummary {
  return {
    supplier: req.supplier,
    project: req.project,
    workType: req.workType,
    month: req.month,
    year: req.year,
    amount: req.amountBeforeVat,
    invoiceNumber: req.invoiceNumber.trim(),
  };
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
    if (body.mode !== "check" && body.mode !== "commit") throw new Error("bad mode");
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "הבקשה לא הגיעה בפורמט הצפוי" },
      { status: 400 },
    );
  }

  try {
    const provider = getProvider();
    const [base, overrides] = await Promise.all([
      provider.getLists(),
      provider.getListOverrides(),
    ]);
    // באימות: בסיס + מה שנוסף ידנית. ערך שהוסתר עדיין תקין (ההסתרה משפיעה רק על ההצעות)
    const lists = validationLists(base, overrides);

    if (body.mode === "check") {
      const item = body.item;
      const errors = validateConfirm(item, listsFor(item, lists));
      if (Object.keys(errors).length > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "validation",
            message: "יש לתקן את השדות המסומנים",
            fields: errors,
          } satisfies CheckResponse,
          { status: 400 },
        );
      }
      if (!item.force) {
        const dup = await provider.findDuplicate(item.invoiceNumber, item.supplier);
        if (dup) {
          return NextResponse.json(
            {
              ok: false,
              error: "duplicate",
              message:
                "חשבונית זו כבר קיימת בטבלה (שורה " +
                dup.row +
                ", הוזנה בחודש " +
                dup.month +
                " " +
                dup.year +
                ")",
              duplicate: dup,
            } satisfies CheckResponse,
            { status: 409 },
          );
        }
      }
      return NextResponse.json({
        ok: true,
        rowPreview: buildRowPreview(item),
        summary: summaryOf(item),
      } satisfies CheckResponse);
    }

    // --- mode: "commit" ---
    const items = body.items;
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "אין חשבוניות לשליחה" } satisfies CommitResponse,
        { status: 400 },
      );
    }

    // שלב 1: אימות של כולן. כל תקלה עוצרת את השליחה כולה — שום שורה לא נכתבת.
    for (const it of items) {
      const errors = validateConfirm(it.req, listsFor(it.req, lists));
      if (Object.keys(errors).length > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "validation",
            message: "בחשבונית " + (it.index + 1) + " יש שדות לתיקון",
            fields: errors,
            itemIndex: it.index,
          } satisfies CommitResponse,
          { status: 400 },
        );
      }
    }

    // שלב 2: כפילות בתוך התור עצמו (אותו קובץ הועלה פעמיים?)
    const pair = findBatchDuplicate(items.map((it) => it.req));
    if (pair) {
      return NextResponse.json(
        {
          ok: false,
          error: "batch_duplicate",
          message:
            "חשבונית " +
            (items[pair.second].index + 1) +
            " זהה לחשבונית " +
            (items[pair.first].index + 1) +
            " שבאותה שליחה (אותו ספק ואותו מספר חשבונית) — אם אלה באמת שתי חשבוניות שונות, לתקן את מספר החשבונית",
          itemIndex: items[pair.second].index,
        } satisfies CommitResponse,
        { status: 409 },
      );
    }

    // שלב 3: כפילות מול הטבלה — בדיקה טרייה, צמוד לרגע הכתיבה
    for (const it of items) {
      if (it.req.force) continue;
      const dup = await provider.findDuplicate(it.req.invoiceNumber, it.req.supplier);
      if (dup) {
        return NextResponse.json(
          {
            ok: false,
            error: "duplicate",
            message:
              "חשבונית " +
              (it.index + 1) +
              " כבר קיימת בטבלה (שורה " +
              dup.row +
              ", הוזנה בחודש " +
              dup.month +
              " " +
              dup.year +
              ")",
            duplicate: dup,
            itemIndex: it.index,
          } satisfies CommitResponse,
          { status: 409 },
        );
      }
    }

    // שלב 4: הכול תקין — כותבים. אם נופלת תקלה באמצע, מדווחים בדיוק מה כבר נכנס
    // כדי שהדפדפן יסמן את השורות שנכתבו ולא ישלח אותן שוב.
    const written: CommitResult[] = [];
    for (const it of items) {
      try {
        const result = await provider.appendRow(buildRow(it.req));
        written.push({ index: it.index, row: result.row });
      } catch (err) {
        console.error("[VIKOS] commit append failed:", err);
        return NextResponse.json(
          {
            ok: false,
            error: "partial",
            message:
              written.length === 0
                ? "תקלה בכתיבה לטבלה — שום שורה לא נכנסה. אפשר לנסות לשלוח שוב"
                : "נכנסו " +
                  written.length +
                  " שורות ואז הייתה תקלה בחשבונית " +
                  (it.index + 1) +
                  " — השורות שנכנסו מסומנות, ואפשר לשלוח שוב את הנותרות",
            itemIndex: it.index,
            written,
          } satisfies CommitResponse,
          { status: 500 },
        );
      }
    }

    // למידת מיפויים (במצב דמו: לא עושה כלום). תקלה כאן לא מפילה שליחה שכבר הצליחה.
    for (const it of items) {
      try {
        await provider.saveMappings({
          officialName: it.req.supplierOfficialName,
          supplier: it.req.supplier,
          addressHints: it.req.addressHints,
          project: it.req.project,
        });
      } catch (err) {
        console.error("[VIKOS] saveMappings failed:", err);
      }
    }

    return NextResponse.json({
      ok: true,
      demo: written.length > 0 && written[0].row === null,
      results: written,
    } satisfies CommitResponse);
  } catch (err) {
    console.error("[VIKOS] confirm unexpected:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "confirm_failed",
        message: "משהו השתבש — שום שורה לא נכתבה. אפשר לנסות שוב",
      },
      { status: 500 },
    );
  }
}
