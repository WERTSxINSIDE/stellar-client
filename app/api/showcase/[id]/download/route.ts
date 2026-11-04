import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { contentTypeForFile, sanitizeFileName } from "@/lib/showcase";

export const dynamic = "force-dynamic";

/** Скачивание конфига или переход к видео. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "Неверный материал" }, { status: 400 });
    }

    const user = await getCurrentUser();
    const isAdmin = !!user && (user.role === "admin" || Number(user.is_admin) === 1);

    const item = (await queryOne(
      `SELECT id, user_id, type, status, price, url, file_name, file_data
       FROM showcase_items
       WHERE id = $1`,
      [itemId]
    )) as
      | {
          id: number;
          user_id: number;
          type: string;
          status: string;
          price: number | null;
          url: string | null;
          file_name: string | null;
          file_data: string | null;
        }
      | null;

    if (!item) {
      return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
    }

    // Скрытые и непринятые материалы доступны только администраторам.
    if (item.status !== "approved" && !isAdmin) {
      return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
    }

    // Платный конфиг доступен автору, админу и тем, кто уже купил.
    const price = Number(item.price || 0);
    if (item.type === "config" && price > 0 && !isAdmin) {
      if (!user) {
        return NextResponse.json(
          { error: "Войдите, чтобы скачать платный конфиг" },
          { status: 401 }
        );
      }
      if (user.id !== item.user_id) {
        const purchase = await queryOne(
          "SELECT id FROM showcase_purchases WHERE item_id = $1 AND buyer_id = $2",
          [itemId, user.id]
        );
        if (!purchase) {
          return NextResponse.json(
            { error: "Конфиг платный. Сначала купите его в витрине." },
            { status: 402 }
          );
        }
      }
    }

    if (item.type === "video") {
      if (!item.url) {
        return NextResponse.json({ error: "Ссылка недоступна" }, { status: 404 });
      }
      return NextResponse.redirect(item.url, 302);
    }

    const url = new URL(req.url);
    const versionId = Number(url.searchParams.get("version"));

    let fileName = item.file_name;
    let fileData = item.file_data;

    // Актуальная версия важнее исходного файла: автор мог выпустить обновление.
    const version = (await queryOne(
      `SELECT file_name, file_data FROM showcase_versions
       WHERE item_id = $1 AND file_data IS NOT NULL
         AND ($2::int IS NULL OR id = $2)
       ORDER BY created_at DESC
       LIMIT 1`,
      [itemId, Number.isInteger(versionId) && versionId > 0 ? versionId : null]
    )) as { file_name: string | null; file_data: string | null } | null;

    if (version?.file_data) {
      fileName = version.file_name || fileName;
      fileData = version.file_data;
    }

    if (!fileData) {
      return NextResponse.json({ error: "Файл недоступен" }, { status: 404 });
    }

    const name = sanitizeFileName(fileName || "config.txt");
    const buffer = Buffer.from(fileData, "base64");

    return new Response(buffer, {
      headers: {
        "Content-Type": contentTypeForFile(name),
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
