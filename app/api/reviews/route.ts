import { NextResponse } from "next/server";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { query, queryAll, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const all = url.searchParams.get("all") === "1";

    if (all) {
      const admin = await requireAdmin();
      if (!admin) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
      const rows = await queryAll(
        `SELECT r.id, r.rating, r.body, r.status, r.created_at, u.username
         FROM reviews r JOIN users u ON u.id = r.user_id
         ORDER BY r.created_at DESC LIMIT 300`
      );
      return NextResponse.json({ ok: true, reviews: rows });
    }

    const rows = await queryAll(
      `SELECT r.id, r.rating, r.body, r.created_at, u.username
       FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.status = 'approved'
       ORDER BY r.created_at DESC LIMIT 100`
    );

    const user = await getCurrentUser();
    let mine: any[] = [];
    if (user) {
      mine = await queryAll(
        `SELECT id, rating, body, status, created_at FROM reviews WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
        [user.id]
      );
    }
    return NextResponse.json({ ok: true, reviews: rows, mine });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });

    const { rating, body } = await req.json();
    const r = Number(rating);
    if (!r || r < 1 || r > 5) return NextResponse.json({ error: "Поставьте оценку от 1 до 5" }, { status: 400 });

    const text = String(body || "").trim();
    if (text.length < 10) return NextResponse.json({ error: "Отзыв слишком короткий (минимум 10 символов)" }, { status: 400 });
    if (text.length > 1000) return NextResponse.json({ error: "Отзыв слишком длинный (максимум 1000 символов)" }, { status: 400 });

    const recent = await queryOne(
      `SELECT id FROM reviews WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 day'`,
      [user.id]
    );
    if (recent) return NextResponse.json({ error: "Вы уже отправляли отзыв за последние 24 часа" }, { status: 429 });

    await query("INSERT INTO reviews (user_id, rating, body) VALUES ($1, $2, $3)", [user.id, r, text]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });

    const { action, id } = await req.json();
    if (!id || (action !== "approve" && action !== "reject")) return NextResponse.json({ error: "Неверные данные" }, { status: 400 });

    await query("UPDATE reviews SET status = $1 WHERE id = $2", [action === "approve" ? "approved" : "rejected", id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Неверные данные" }, { status: 400 });

    await query("DELETE FROM reviews WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
