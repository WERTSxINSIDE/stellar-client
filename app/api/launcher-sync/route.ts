import { NextResponse } from "next/server";
import { queryAll, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { username } = await req.json();

    if (!username) {
      return NextResponse.json({ success: false, error: "Username required" }, { status: 400 });
    }

    const user = await queryOne(
      "SELECT id, username, email, role, subscription_end, is_admin, banned, equipped_game FROM users WHERE username = $1",
      [username]
    ) as any;

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Косметика для Minecraft: клиент рисует её на персонаже.
    const gameOwned = await queryAll(
      `SELECT ci.key, ci.title, ci.value AS preview, ci.rarity
       FROM user_cosmetics uc
       JOIN cosmetic_items ci ON ci.key = uc.cosmetic_key
       WHERE uc.user_id = $1 AND ci.type = 'game' AND ci.active = 1
       ORDER BY uc.acquired_at DESC`,
      [user.id]
    );

    const gameEquipped =
      user.equipped_game && gameOwned.some((item: any) => item.key === user.equipped_game)
        ? user.equipped_game
        : null;

    return NextResponse.json({
      success: true,
      uid: user.id,
      username: user.username,
      email: user.email,
      role: user.role || "user",
      banned: !!user.banned,
      beta_access: !!user.is_admin,
      game_cosmetics: {
        equipped: gameEquipped,
        owned: gameOwned,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
