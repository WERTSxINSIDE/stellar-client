import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { signToken } from "@/lib/launch-token";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { username } = await req.json();
    if (!username) {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }

    const user = await queryOne("SELECT id, username, subscription_end FROM users WHERE username = $1", [username]) as any;
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const hasSub = user.subscription_end && new Date(user.subscription_end.replace(" ", "T")) > new Date();
    if (!hasSub) {
      return NextResponse.json({ ok: true, token: "" });
    }

    const token = signToken(user.id, user.username);
    return NextResponse.json({ ok: true, token, userId: user.id, username: user.username });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}