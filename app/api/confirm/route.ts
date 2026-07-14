// POST /api/confirm — מקבל את הטופס שוויקי אישרה, בודק תקינות וכפילות,
// ומוסיף שורה (במצב דמו: רק מדמה ומחזיר איך השורה הייתה נראית).
// שלב ב': להוסיף כאן בדיקת התחברות (requireUser) בשורה הראשונה.

import { NextRequest, NextResponse } from "next/server";
import { validateConfirm } from "@/lib/validate";
import { buildRow, buildRowPreview } from "@/lib/row";
import { validationLists } from "@/lib/lists";
import { getProvider } from "@/lib/sheets/provider";
import type { ConfirmRequest, ConfirmResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  let body: ConfirmRequest;
  try {
    body = (await req.json()) as ConfirmRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "הבקשה לא הגיעה בפורמט הצפוי" } satisfies ConfirmResponse,
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

    // ספק חדש מותר גם אם אינו ברשימה — מוסיפים אותו זמנית לרשימת האימות
    const listsForValidation = body.supplierIsNew
      ? { ...lists, suppliers: [...lists.suppliers, body.supplier] }
      : lists;

    const errors = validateConfirm(body, listsForValidation);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "validation",
          message: "יש לתקן את השדות המסומנים",
          fields: errors,
        } satisfies ConfirmResponse,
        { status: 400 },
      );
    }

    // בדיקת כפילות טרייה, צמוד לרגע הכתיבה
    if (!body.force) {
      const dup = await provider.findDuplicate(body.invoiceNumber, body.supplier);
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
          } satisfies ConfirmResponse,
          { status: 409 },
        );
      }
    }

    const row = buildRow(body);
    const result = await provider.appendRow(row);

    // למידת מיפויים (במצב דמו: לא עושה כלום)
    await provider.saveMappings({
      officialName: body.supplierOfficialName,
      supplier: body.supplier,
      addressHints: body.addressHints,
      project: body.project,
    });

    const response: ConfirmResponse = {
      ok: true,
      demo: result.row === null,
      row: result.row,
      rowPreview: buildRowPreview(body),
      summary: {
        supplier: body.supplier,
        project: body.project,
        workType: body.workType,
        month: body.month,
        year: body.year,
        amount: body.amountBeforeVat,
        invoiceNumber: body.invoiceNumber.trim(),
      },
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[VIKOS] confirm unexpected:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "confirm_failed",
        message: "לא הצלחנו להכניס את השורה — לא בוצע שום שינוי. אפשר לנסות שוב",
      } satisfies ConfirmResponse,
      { status: 500 },
    );
  }
}
