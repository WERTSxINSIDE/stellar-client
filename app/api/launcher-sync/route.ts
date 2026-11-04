import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { getGameCosmetics } from "@/lib/game-cosmetics";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { username } = await req.json();

    if (!username) {
      return NextResponse.json({ success: false, error: "Username required" }, { status: 400 });
    }

    const user = await queryOne(
      "SELECT id, username, email, role, subscription_end, is_admin, banned FROM users WHERE username = $1",
      [username]
    ) as any;

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Косметика для Minecraft: клиент рисует её на персонаже.
    const { equipped: gameEquipped, owned: gameOwned } = await getGameCosmetics(user.id);

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
