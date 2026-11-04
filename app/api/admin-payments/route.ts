import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryAll } from "@/lib/db";
import { logAdminAction } from "@/lib/audit";
import {
  TOPUP_AMOUNTS,
  getTopupLinks,
  isSafePaymentUrl,
  topupSettingKey,
} from "@/lib/payments";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Не авторизован" }, { status: 401 }) };
  if (!(user.is_admin || user.role === "admin")) {
    return { error: NextResponse.json({ error: "Доступ запрещён" }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const links = await getTopupLinks();
    return NextResponse.json({ ok: true, amounts: TOPUP_AMOUNTS, links });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

/** Сохранение ссылок FunPay для сумм пополнения. */
export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const updates: { key: string; value: string | null }[] = [];

    for (const amount of TOPUP_AMOUNTS) {
      const key = topupSettingKey(amount);
      const raw = body?.links?.[key];
      if (raw === undefined) continue;

      const value = String(raw || "").trim();
      if (value && !isSafePaymentUrl(value)) {
        return NextResponse.json(
          { error: `Ссылка для ${amount} ₽ должна начинаться с http:// или https://` },
          { status: 400 }
        );
      }
      if (value.length > 500) {
        return NextResponse.json({ error: "Слишком длинная ссылка" }, { status: 400 });
      }
      updates.push({ key, value: value || null });
    }

    if (!updates.length) {
      return NextResponse.json({ error: "Нет данных для сохранения" }, { status: 400 });
    }

    for (const entry of updates) {
      await query(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [entry.key, entry.value]
      );
    }

    await logAdminAction(auth.user, "payments.links.update", null, updates.map((u) => u.key).join(", "));

    const rows = (await queryAll(
      "SELECT key, value FROM app_settings WHERE key = ANY($1::text[])",
      [TOPUP_AMOUNTS.map((amount) => topupSettingKey(amount))]
    )) as { key: string; value: string | null }[];

    return NextResponse.json({ ok: true, links: Object.fromEntries(rows.map((r) => [r.key, r.value || ""])) });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
