import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryAll } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const history = await queryAll(
      "SELECT id, amount, type, note, created_at FROM balance_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
      [user.id]
    );

    return NextResponse.json({ ok: true, history });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
