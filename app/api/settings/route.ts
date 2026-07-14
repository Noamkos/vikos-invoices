// GET/POST /api/settings — ניהול ההתאמות האישיות לרשימות ההשלמה.
// ההתאמות משפיעות רק על ההצעות באתר — לא נכתב מהן שום דבר לטבלה.

import { NextRequest, NextResponse } from "next/server";
import { sanitizeOverrides } from "@/lib/lists";
import { getProvider } from "@/lib/sheets/provider";

export async function GET() {
  try {
    const provider = getProvider();
    const [base, overrides] = await Promise.all([
      provider.getLists(),
      provider.getListOverrides(),
    ]);
    return NextResponse.json({ ok: true, base, overrides });
  } catch (err) {
    console.error("[VIKOS] settings GET:", err);
    return NextResponse.json(
      { ok: false, error: "settings_failed", message: "לא הצלחנו לטעון את ההגדרות" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const overrides = sanitizeOverrides(body?.overrides);
    const provider = getProvider();
    await provider.saveListOverrides(overrides);
    return NextResponse.json({ ok: true, overrides });
  } catch (err) {
    console.error("[VIKOS] settings POST:", err);
    return NextResponse.json(
      { ok: false, error: "settings_failed", message: "השמירה נכשלה — נסו שוב" },
      { status: 500 },
    );
  }
}
