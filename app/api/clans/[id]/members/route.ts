import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryOne, withTransaction } from "@/lib/db";
import { can, canManageRole, isClanRole, roleWeight, type ClanRole } from "@/lib/clans";
import { getClanById, getMembership, logClanActivity } from "@/lib/clan-service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const { id } = await params;
    const clanId = Number(id);
    const membership = await getMembership(user.id);
    if (!membership || membership.clan_id !== clanId) {
      return NextResponse.json({ error: "Вы не состоите в этом клане" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const targetId = Number(body?.userId);
    const targetRole = String(body?.role || "");

    if (action === "leave") {
      const clan = await getClanById(clanId);
      if (!clan) return NextResponse.json({ error: "Клан не найден" }, { status: 404 });

      if (membership.role === "leader" && Number(clan.member_count) > 1) {
        return NextResponse.json(
          { error: "Сначала передайте лидерство другому участнику" },
          { status: 400 }
        );
      }

      if (Number(clan.member_count) <= 1) {
        await queryOne("DELETE FROM clans WHERE id = $1 RETURNING id", [clanId]);
        return NextResponse.json({ ok: true, disbanded: true });
      }

      await withTransaction(async (client) => {
        await client.query("DELETE FROM clan_members WHERE user_id = $1 AND clan_id = $2", [
          user.id,
          clanId,
        ]);
        await client.query(
          "INSERT INTO clan_activity (clan_id, user_id, type, points, note) VALUES ($1, $2, 'leave', 0, $3)",
          [clanId, user.id, `${user.username} покинул клан`]
        );
      });

      return NextResponse.json({ ok: true });
    }

    if (!Number.isInteger(targetId) || targetId <= 0) {
      return NextResponse.json({ error: "Участник не найден" }, { status: 400 });
    }

    const target = (await queryOne(
      "SELECT user_id, role FROM clan_members WHERE user_id = $1 AND clan_id = $2",
      [targetId, clanId]
    )) as { user_id: number; role: string } | null;

    if (!target) {
      return NextResponse.json({ error: "Участник не найден" }, { status: 404 });
    }

    if (action === "role") {
      if (!can(membership.role, "manage_roles")) {
        return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
      }
      if (!isClanRole(targetRole) || targetRole === "leader") {
        return NextResponse.json({ error: "Нельзя назначить эту роль" }, { status: 400 });
      }
      if (targetId === user.id) {
        return NextResponse.json({ error: "Нельзя изменить собственную роль" }, { status: 400 });
      }
      if (!canManageRole(membership.role, target.role)) {
        return NextResponse.json({ error: "Недостаточно прав для этого участника" }, { status: 403 });
      }
      if (roleWeight(targetRole) >= roleWeight(membership.role)) {
        return NextResponse.json({ error: "Нельзя выдать роль выше своей" }, { status: 400 });
      }

      await queryOne("UPDATE clan_members SET role = $2 WHERE user_id = $1 AND clan_id = $3 RETURNING user_id", [
        targetId,
        targetRole as ClanRole,
        clanId,
      ]);
      await logClanActivity(clanId, user.id, "role_change", 0, `Роль участника изменена на ${targetRole}`);
      return NextResponse.json({ ok: true });
    }

    if (action === "kick") {
      if (!can(membership.role, "kick")) {
        return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
      }
      if (targetId === user.id) {
        return NextResponse.json({ error: "Используйте выход из клана" }, { status: 400 });
      }
      if (!canManageRole(membership.role, target.role)) {
        return NextResponse.json({ error: "Недостаточно прав для этого участника" }, { status: 403 });
      }

      await withTransaction(async (client) => {
        await client.query("DELETE FROM clan_members WHERE user_id = $1 AND clan_id = $2", [targetId, clanId]);
        await client.query(
          "INSERT INTO clan_activity (clan_id, user_id, type, points, note) VALUES ($1, $2, 'kick', 0, $3)",
          [clanId, user.id, "Участник исключён из клана"]
        );
        await client.query(
          `INSERT INTO notifications (user_id, type, title, body, link)
           VALUES ($1, 'clan', 'Вы исключены из клана', $2, '/clans')`,
          [targetId, "Клан исключил вас из состава"]
        );
      });

      return NextResponse.json({ ok: true });
    }

    if (action === "transfer") {
      if (!can(membership.role, "transfer")) {
        return NextResponse.json({ error: "Передать лидерство может только лидер" }, { status: 403 });
      }
      if (targetId === user.id) {
        return NextResponse.json({ error: "Вы уже лидер" }, { status: 400 });
      }

      await withTransaction(async (client) => {
        await client.query("UPDATE clan_members SET role = 'co_leader' WHERE user_id = $1 AND clan_id = $2", [
          user.id,
          clanId,
        ]);
        await client.query("UPDATE clan_members SET role = 'leader' WHERE user_id = $1 AND clan_id = $2", [
          targetId,
          clanId,
        ]);
        await client.query("UPDATE clans SET leader_id = $2 WHERE id = $1", [clanId, targetId]);
        await client.query(
          "INSERT INTO clan_activity (clan_id, user_id, type, points, note) VALUES ($1, $2, 'transfer', 0, $3)",
          [clanId, user.id, "Лидерство передано новому участнику"]
        );
        await client.query(
          `INSERT INTO notifications (user_id, type, title, body, link)
           VALUES ($1, 'clan', 'Вы стали лидером клана', 'Вам передали управление кланом.', $2)`,
          [targetId, `/clans/${clanId}`]
        );
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
