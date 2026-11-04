import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryAll, queryOne } from "@/lib/db";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { notifyUser } from "@/lib/notify";
import { logActivity } from "@/lib/activity";
import {
  SHOWCASE_MAX_FILE_BYTES,
  isAllowedFileName,
  normalizeVersion,
} from "@/lib/showcase";

export const dynamic = "force-dynamic";

type ItemRow = {
  id: number;
  user_id: number;
  title: string;
  type: string;
  status: string;
};

/** История версий конфига. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "Неверный материал" }, { status: 400 });
    }

    const user = await getCurrentUser();
    const item = (await queryOne(
      "SELECT id, user_id, title, type, status FROM showcase_items WHERE id = $1",
      [itemId]
    )) as ItemRow | null;

    if (!item) {
      return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
    }

    const isAdmin = !!user && (user.role === "admin" || Number(user.is_admin) === 1);
    if (item.status !== "approved" && item.user_id !== user?.id && !isAdmin) {
      return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
    }

    const versions = await queryAll(
      `SELECT id, version, changelog, file_name, created_at
       FROM showcase_versions
       WHERE item_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [itemId]
    );

    return NextResponse.json(
      { ok: true, versions },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

/** Публикация новой версии конфига (только автор или админ). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const limited = await enforceRateLimit(req, [
      { scope: "showcase-version:account", identifier: user.id, limit: 20, windowMs: 60 * 60_000 },
      { scope: "showcase-version:ip", identifier: getClientIp(req), limit: 40, windowMs: 60 * 60_000 },
    ]);
    if (limited) return limited;

    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "Неверный материал" }, { status: 400 });
    }

    const item = (await queryOne(
      "SELECT id, user_id, title, type, status FROM showcase_items WHERE id = $1",
      [itemId]
    )) as ItemRow | null;
    if (!item) {
      return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
    }

    const isAdmin = user.role === "admin" || Number(user.is_admin) === 1;
    if (item.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }
    if (item.type !== "config") {
      return NextResponse.json({ error: "Версии доступны только для конфигов" }, { status: 400 });
    }

    const body = await req.json();
    const version = normalizeVersion(body?.version);
    const changelog = String(body?.changelog || "").trim().slice(0, 1000);
    const fileName = String(body?.file_name || "").trim();

    if (!version || version === "1.0" && !String(body?.version || "").trim()) {
      return NextResponse.json({ error: "Укажите версию" }, { status: 400 });
    }
    if (changelog.length > 1000) {
      return NextResponse.json({ error: "Changelog не больше 1000 символов" }, { status: 400 });
    }
    if (!fileName || !isAllowedFileName(fileName)) {
      return NextResponse.json(
        { error: "Недопустимый файл. Разрешены cfg, txt, json, ini, toml, yml, zip." },
        { status: 400 }
      );
    }

    const rawData = typeof body?.file_data === "string" ? body.file_data : "";
    const base64 = rawData.includes(",") ? rawData.split(",").pop() || "" : rawData;
    if (!base64 || !/^[A-Za-z0-9+/=\s]+$/.test(base64)) {
      return NextResponse.json({ error: "Файл повреждён или пустой" }, { status: 400 });
    }

    const size = Math.floor((base64.replace(/\s/g, "").length * 3) / 4);
    if (size <= 0 || size > SHOWCASE_MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Файл должен быть не больше 1,5 МБ" }, { status: 400 });
    }

    const inserted = (await queryOne(
      `INSERT INTO showcase_versions (item_id, version, changelog, file_name, file_data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, version, changelog, file_name, created_at`,
      [itemId, version, changelog || null, fileName, base64.replace(/\s/g, "")]
    )) as { id: number; version: string } | null;

    await query(
      "UPDATE showcase_items SET version = $2 WHERE id = $1",
      [itemId, version]
    );

    // Уведомляем покупателей и подписчиков автора.
    const [buyers, followers] = await Promise.all([
      queryAll(
        "SELECT DISTINCT buyer_id AS id FROM showcase_purchases WHERE item_id = $1",
        [itemId]
      ) as Promise<{ id: number }[]>,
      queryAll(
        "SELECT follower_id AS id FROM showcase_follows WHERE author_id = $1",
        [item.user_id]
      ) as Promise<{ id: number }[]>,
    ]);

    const recipients = new Set<number>();
    for (const row of buyers) if (row.id !== user.id) recipients.add(row.id);
    for (const row of followers) if (row.id !== user.id) recipients.add(row.id);

    await Promise.allSettled(
      Array.from(recipients).map((recipient) =>
        notifyUser(recipient, {
          type: "showcase",
          title: "Новая версия конфига",
          body: `«${item.title}» обновился до версии ${version}.`,
          link: `/community/config/${itemId}`,
        })
      )
    );

    await logActivity(
      user.id,
      "showcase",
      `Новая версия: ${item.title}`,
      version
    ).catch(() => {});

    return NextResponse.json({ ok: true, version: inserted });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
