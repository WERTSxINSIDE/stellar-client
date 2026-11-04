import { NextResponse } from "next/server";
import { queryAll, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Косметика для Minecraft, купленная игроком.
 * Клиент/лаунчер запрашивает её по нику и рисует на персонаже.
 *
 * GET /api/game-cosmetics?username=WERTS
 * → { ok, username, equipped, owned: [{ key, title, preview, rarity }] }
 */
export async function GET(req: Request) {
  try {
    const username = (new URL(req.url).searchParams.get("username") || "").trim();
    if (!username) {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }

    const user = (await queryOne(
      "SELECT id, username, equipped_game FROM users WHERE LOWER(username) = LOWER($1)",
      [username]
    )) as { id: number; username: string; equipped_game: string | null } | null;

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const owned = (await queryAll(
      `SELECT ci.key, ci.title, ci.value AS preview, ci.rarity
       FROM user_cosmetics uc
       JOIN cosmetic_items ci ON ci.key = uc.cosmetic_key
       WHERE uc.user_id = $1 AND ci.type = 'game' AND ci.active = 1
       ORDER BY uc.acquired_at DESC`,
      [user.id]
    )) as { key: string; title: string; preview: string | null; rarity: string }[];

    const equipped = user.equipped_game && owned.some((item) => item.key === user.equipped_game)
      ? user.equipped_game
      : null;

    return NextResponse.json({
      ok: true,
      username: user.username,
      equipped,
      owned,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
