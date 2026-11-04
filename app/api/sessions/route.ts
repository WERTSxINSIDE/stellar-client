import { NextResponse } from "next/server";
import { getCurrentUser, getSessionToken } from "@/lib/auth";
import { query, queryAll } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const current = await getSessionToken();
    const rows = await queryAll(
      `SELECT token, created_at, user_agent, ip
       FROM sessions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [user.id]
    );

    return NextResponse.json({
      ok: true,
      sessions: rows.map((r) => ({
        id: String(r.token).slice(0, 12),
        created_at: r.created_at,
        user_agent: r.user_agent,
        ip: r.ip,
        current: String(r.token) === current,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

async function revoke(body: { all?: boolean; prefix?: string }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const current = await getSessionToken();

  if (body.all) {
    await query("DELETE FROM sessions WHERE user_id = $1 AND token <> $2", [
      user.id,
      current || "",
    ]);
    return NextResponse.json({ ok: true });
  }

  const prefix = String(body.prefix || "").trim();
  if (!/^[a-f0-9]{8,64}$/i.test(prefix)) {
    return NextResponse.json({ error: "Некорректная сессия" }, { status: 400 });
  }
  if (current && prefix && current.startsWith(prefix)) {
    return NextResponse.json({ error: "Нельзя завершить текущую сессию" }, { status: 400 });
  }

  await query("DELETE FROM sessions WHERE user_id = $1 AND token LIKE $2", [
    user.id,
    `${prefix}%`,
  ]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    return await revoke(body);
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    return await revoke(body);
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
