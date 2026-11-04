import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Определяет источник перехода: utm/ref из ссылки, referrer или direct. */
function resolveSource(req: Request, bodySource: unknown): string {
  const raw = String(bodySource || "").trim().toLowerCase();
  if (raw) return raw.replace(/[^a-z0-9_\-]/g, "").slice(0, 40) || "other";

  try {
    const url = new URL(req.url);
    const fromQuery =
      url.searchParams.get("ref") || url.searchParams.get("utm_source") || "";
    if (fromQuery) {
      return fromQuery.toLowerCase().replace(/[^a-z0-9_\-]/g, "").slice(0, 40) || "other";
    }
  } catch {
    // ignore
  }

  const referrer = req.headers.get("referer") || "";
  if (!referrer) return "direct";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (!host) return "direct";
    if (host.includes("stellar")) return "internal";
    return host.slice(0, 40);
  } catch {
    return "direct";
  }
}

/** Учитывает открытие карточки материала и источник перехода. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "Неверный материал" }, { status: 400 });
    }

    const limited = await enforceRateLimit(
      req,
      [{ scope: "showcase-view:ip", identifier: getClientIp(req), limit: 240, windowMs: 60 * 60_000 }],
      "Слишком много запросов"
    );
    if (limited) return limited;

    const found = await queryOne(
      "SELECT id FROM showcase_items WHERE id = $1 AND status = 'approved'",
      [itemId]
    );
    if (!found) {
      return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as { source?: unknown };
    const source = resolveSource(req, body.source);
    const referrer = (req.headers.get("referer") || "").slice(0, 300) || null;
    const user = await getCurrentUser();

    await query(
      "UPDATE showcase_items SET views = COALESCE(views, 0) + 1 WHERE id = $1 AND status = 'approved'",
      [itemId]
    );
    await query(
      `INSERT INTO showcase_views (item_id, user_id, source, referrer)
       VALUES ($1, $2, $3, $4)`,
      [itemId, user?.id ?? null, source, referrer]
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
