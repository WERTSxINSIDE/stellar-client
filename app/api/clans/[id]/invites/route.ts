import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { can } from "@/lib/clans";
import { getClanById, getMembership } from "@/lib/clan-service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const { id } = await params;
    const clanId = Number(id);
    const membership = await getMembership(user.id);
    if (!membership || membership.clan_id !== clanId || !can(membership.role, "invite")) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    const limited = await enforceRateLimit(
      req,
      [{ scope: "clans:invite", identifier: user.id, limit: 20, windowMs: 60 * 60 * 1000 }]
    );
    if (limited) return limited;

    const clan = await getClanById(clanId);
    if (!clan) return NextResponse.json({ error: "Клан не найден" }, { status: 404 });
    if (Number(clan.member_count) >= clan.max_members) {
      return NextResponse.json({ error: "В клане нет свободных мест" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const username = String(body?.username || "").trim().replace(/^@/, "").slice(0, 40);
    if (username.length < 2) {
      return NextResponse.json({ error: "Укажите ник игрока" }, { status: 400 });
    }

    const target = (await queryOne(
      "SELECT id, username FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1",
      [username]
    )) as { id: number; username: string } | null;
    if (!target) return NextResponse.json({ error: "Игрок не найден" }, { status: 404 });
    if (target.id === user.id) {
      return NextResponse.json({ error: "Нельзя пригласить самого себя" }, { status: 400 });
    }

    const targetMembership = await getMembership(target.id);
    if (targetMembership) {
      return NextResponse.json({ error: "Игрок уже состоит в клане" }, { status: 400 });
    }

    await queryOne(
      `INSERT INTO clan_invites (clan_id, inviter_id, invitee_id, status, expires_at)
       VALUES ($1, $2, $3, 'pending', NOW() + INTERVAL '7 days')
       ON CONFLICT (clan_id, invitee_id) DO UPDATE
         SET status = 'pending',
             inviter_id = EXCLUDED.inviter_id,
             created_at = NOW(),
             expires_at = EXCLUDED.expires_at
       RETURNING id`,
      [clanId, user.id, target.id]
    );

    await queryOne(
      `INSERT INTO notifications (user_id, type, title, body, link)
       VALUES ($1, 'clan', 'Приглашение в клан', $2, '/clans')`,
      [target.id, `${user.username} приглашает вас в клан ${clan.name}`]
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const { id } = await params;
    const clanId = Number(id);
    const membership = await getMembership(user.id);
    if (!membership || membership.clan_id !== clanId || !can(membership.role, "invite")) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const inviteId = Number(body?.inviteId);
    if (!Number.isInteger(inviteId) || inviteId <= 0) {
      return NextResponse.json({ error: "Приглашение не найдено" }, { status: 400 });
    }

    await queryOne(
      "UPDATE clan_invites SET status = 'cancelled' WHERE id = $1 AND clan_id = $2 RETURNING id",
      [inviteId, clanId]
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
