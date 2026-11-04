import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

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

    return NextResponse.json({
      success: true,
      uid: user.id,
      username: user.username,
      email: user.email,
      role: user.role || "user",
      banned: !!user.banned,
      beta_access: !!user.is_admin,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
