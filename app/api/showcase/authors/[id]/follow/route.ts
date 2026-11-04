import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryAll, queryOne } from "@/lib/db";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Подписка на автора витрины. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Войдите, чтобы подписаться" }, { status: 401 });
    }

    const limited = await enforceRateLimit(req, [
      { scope: "showcase-follow:account", identifier: user.id, limit: 120, windowMs: 60 * 60_000 },
      { scope: "showcase-follow:ip", identifier: getClientIp(req), limit: 240, windowMs: 60 * 60_000 },
    ]);
    if (limited) return limited;

    const { id } = await params;
    const authorId = Number(id);
    if (!Number.isInteger(authorId) || authorId <= 0) {
      return NextResponse.json({ error: "Неверный автор" }, { status: 400 });
    }
    if (authorId === user.id) {
      return NextResponse.json({ error: "Нельзя подписаться на себя" }, { status: 400 });
    }

    const author = (await queryOne(
      "SELECT id FROM users WHERE id = $1 AND COALESCE(banned, 0) = 0",
      [authorId]
    )) as { id: number } | null;
    if (!author) {
      return NextResponse.json({ error: "Автор не найден" }, { status: 404 });
    }

    const existing = (await queryOne(
      "SELECT 1 AS found FROM showcase_follows WHERE follower_id = $1 AND author_id = $2",
      [user.id, authorId]
    )) as { found?: number } | null;

    let following = false;
    if (existing) {
      await queryAll(
        "DELETE FROM showcase_follows WHERE follower_id = $1 AND author_id = $2 RETURNING follower_id",
        [user.id, authorId]
      );
    } else {
      await queryAll(
        `INSERT INTO showcase_follows (follower_id, author_id)
         VALUES ($1, $2)
         ON CONFLICT (follower_id, author_id) DO NOTHING
         RETURNING follower_id`,
        [user.id, authorId]
      );
      following = true;
    }

    const countRow = (await queryOne(
      "SELECT COUNT(*)::int AS count FROM showcase_follows WHERE author_id = $1",
      [authorId]
    )) as { count?: number } | null;

    return NextResponse.json({
      ok: true,
      following,
      followers: Number(countRow?.count || 0),
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
