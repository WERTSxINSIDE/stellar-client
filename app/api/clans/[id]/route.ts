import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryAll, queryOne } from "@/lib/db";
import {
  can,
  normalizeClanColor,
  normalizeClanDescription,
  normalizeClanEmblem,
  permissionsFor,
} from "@/lib/clans";
import { enrichClan, getClanById, getMembership } from "@/lib/clan-service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const clanId = Number(id);
    if (!Number.isInteger(clanId) || clanId <= 0) {
      return NextResponse.json({ error: "Клан не найден" }, { status: 404 });
    }

    const user = await getCurrentUser();
    const viewerId = user?.id ?? null;

    const clan = await getClanById(clanId);
    if (!clan) {
      return NextResponse.json({ error: "Клан не найден" }, { status: 404 });
    }

    const membership = viewerId ? await getMembership(viewerId) : null;
    const myRole = membership && membership.clan_id === clanId ? membership.role : null;
    const isMember = !!myRole;

    const members = await queryAll(
      `SELECT cm.user_id, cm.role, cm.contribution, cm.weekly_points, cm.joined_at,
              cm.last_active_at, u.username, u.avatar_url, u.nickname_color,
              u.equipped_badge, u.subscription_end
       FROM clan_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.clan_id = $1
       ORDER BY CASE cm.role
         WHEN 'leader' THEN 0 WHEN 'co_leader' THEN 1 WHEN 'officer' THEN 2
         WHEN 'treasurer' THEN 3 WHEN 'recruiter' THEN 4 WHEN 'veteran' THEN 5
         WHEN 'member' THEN 6 ELSE 7 END,
         cm.joined_at ASC`,
      [clanId]
    );

    const activity = await queryAll(
      `SELECT ca.id, ca.type, ca.points, ca.note, ca.created_at, u.username
       FROM clan_activity ca
       LEFT JOIN users u ON u.id = ca.user_id
       WHERE ca.clan_id = $1
       ORDER BY ca.created_at DESC
       LIMIT 20`,
      [clanId]
    );

    const messages = isMember
      ? await queryAll(
          `SELECT * FROM (
             SELECT cm.id, cm.body, cm.created_at, cm.user_id, u.username, u.avatar_url, u.nickname_color
             FROM clan_messages cm
             LEFT JOIN users u ON u.id = cm.user_id
             WHERE cm.clan_id = $1
             ORDER BY cm.id DESC
             LIMIT 100
           ) sub
           ORDER BY sub.id ASC`,
          [clanId]
        )
      : [];

    const transactions = isMember
      ? await queryAll(
          `SELECT ct.id, ct.amount, ct.type, ct.note, ct.created_at, u.username
           FROM clan_transactions ct
           LEFT JOIN users u ON u.id = ct.user_id
           WHERE ct.clan_id = $1
           ORDER BY ct.created_at DESC
           LIMIT 20`,
          [clanId]
        )
      : [];

    const applications = can(myRole, "review_applications")
      ? await queryAll(
          `SELECT ca.id, ca.user_id, ca.message, ca.status, ca.created_at,
                  u.username, u.avatar_url, u.subscription_end
           FROM clan_applications ca
           JOIN users u ON u.id = ca.user_id
           WHERE ca.clan_id = $1 AND ca.status = 'pending'
           ORDER BY ca.created_at ASC
           LIMIT 50`,
          [clanId]
        )
      : [];

    const invites = can(myRole, "invite")
      ? await queryAll(
          `SELECT ci.id, ci.invitee_id, ci.status, ci.created_at, ci.expires_at,
                  u.username
           FROM clan_invites ci
           JOIN users u ON u.id = ci.invitee_id
           WHERE ci.clan_id = $1 AND ci.status = 'pending'
           ORDER BY ci.created_at DESC
           LIMIT 50`,
          [clanId]
        )
      : [];

    const myApplication = viewerId
      ? await queryOne(
          `SELECT id, status, created_at FROM clan_applications
           WHERE clan_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1`,
          [clanId, viewerId]
        )
      : null;

    return NextResponse.json({
      ok: true,
      clan,
      members,
      activity,
      messages,
      transactions,
      applications,
      invites,
      my_role: myRole,
      is_member: isMember,
      my_application: myApplication,
      permissions: permissionsFor(myRole),
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const { id } = await params;
    const clanId = Number(id);
    const membership = await getMembership(user.id);
    if (!membership || membership.clan_id !== clanId || !can(membership.role, "manage_settings")) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const description = normalizeClanDescription(body?.description);
    const emblem = normalizeClanEmblem(body?.emblem);
    const color = normalizeClanColor(body?.color);
    const recruiting = body?.recruiting === undefined ? undefined : body.recruiting ? 1 : 0;

    await queryOne(
      `UPDATE clans
       SET description = $2,
           emblem = $3,
           color = $4,
           recruiting = COALESCE($5, recruiting)
       WHERE id = $1
       RETURNING id`,
      [clanId, description || null, emblem, color, recruiting ?? null]
    );

    const clan = await getClanById(clanId);
    return NextResponse.json({ ok: true, clan });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const { id } = await params;
    const clanId = Number(id);
    const membership = await getMembership(user.id);
    if (!membership || membership.clan_id !== clanId || !can(membership.role, "disband")) {
      return NextResponse.json({ error: "Распустить клан может только лидер" }, { status: 403 });
    }

    const clan = await getClanById(clanId);
    if (!clan) return NextResponse.json({ error: "Клан не найден" }, { status: 404 });

    await queryOne("DELETE FROM clans WHERE id = $1 RETURNING id", [clanId]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
