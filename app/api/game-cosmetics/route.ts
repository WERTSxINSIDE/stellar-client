import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { getGameCosmetics } from "@/lib/game-cosmetics";

export const dynamic = "force-dynamic";

/**
 * Косметика для Minecraft, купленная игроком.
 * Клиент/лаунчер запрашивает её по нику и рисует на персонаже.
 *
 * GET /api/game-cosmetics?username=WERTS
 * → { ok, username, equipped: { pet, wings, backpack, model, cape, hat, aura }, owned: [...] }
 */
export async function GET(req: Request) {
  try {
    const username = (new URL(req.url).searchParams.get("username") || "").trim();
    if (!username) {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }

    const user = (await queryOne(
      "SELECT id, username FROM users WHERE LOWER(username) = LOWER($1)",
      [username]
    )) as { id: number; username: string } | null;

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { equipped, owned } = await getGameCosmetics(user.id);

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
