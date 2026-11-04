import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryAll, queryOne, withTransaction } from "@/lib/db";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  CLAN_CREATE_COST,
  isValidClanName,
  isValidClanTag,
  normalizeClanColor,
  normalizeClanDescription,
  normalizeClanEmblem,
  normalizeClanName,
  normalizeClanTag,
} from "@/lib/clans";
import { enrichClan, getMembership, type ClanRow } from "@/lib/clan-service";

export const dynamic = "force-dynamic";

const ORDER_BY: Record<string, string> = {
  xp: "c.xp DESC, member_count DESC, c.created_at DESC",
  members: "member_count DESC, c.xp DESC, c.created_at DESC",
  treasury: "c.treasury DESC, c.xp DESC, c.created_at DESC",
  new: "c.created_at DESC",
};

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    const userId = user?.id ?? null;
    const url = new URL(req.url);
    const q = String(url.searchParams.get("q") || "").trim().slice(0, 40);
    const sortParam = String(url.searchParams.get("sort") || "xp");
    const sort = ORDER_BY[sortParam] ? sortParam : "xp";
    const search = q ? `%${q}%` : null;

    const rows = (await queryAll(
      `SELECT c.*, u.username AS leader_name, u.avatar_url AS leader_avatar,
              (SELECT COUNT(*)::int FROM clan_members cm WHERE cm.clan_id = c.id) AS member_count,
              (SELECT COUNT(DISTINCT cm.role)::int FROM clan_members cm WHERE cm.clan_id = c.id) AS role_count,
              (SELECT COUNT(*)::int FROM clan_applications ca
                WHERE ca.clan_id = c.id AND ca.status = 'pending') AS pending_count,
              EXISTS(
                SELECT 1 FROM clan_applications ca
                WHERE ca.clan_id = c.id AND ca.user_id = $1 AND ca.status = 'pending'
              ) AS applied
       FROM clans c
       JOIN users u ON u.id = c.leader_id
       WHERE ($2::text IS NULL OR c.name ILIKE $2 OR c.tag ILIKE $2)
       ORDER BY ${ORDER_BY[sort]}
       LIMIT 60`,
      [userId, search]
    )) as (ClanRow & { applied: boolean })[];

    const myMembership = userId ? await getMembership(userId) : null;
    const myClan = myMembership
      ? (await queryOne(
          `SELECT c.*, u.username AS leader_name, u.avatar_url AS leader_avatar,
                  (SELECT COUNT(*)::int FROM clan_members cm WHERE cm.clan_id = c.id) AS member_count,
                  (SELECT COUNT(DISTINCT cm.role)::int FROM clan_members cm WHERE cm.clan_id = c.id) AS role_count,
                  (SELECT COUNT(*)::int FROM clan_applications ca
                    WHERE ca.clan_id = c.id AND ca.status = 'pending') AS pending_count
           FROM clans c JOIN users u ON u.id = c.leader_id
           WHERE c.id = $1`,
          [myMembership.clan_id]
        ) as ClanRow | null)
      : null;

    const invites = userId
      ? await queryAll(
          `SELECT ci.id, ci.clan_id, ci.created_at, c.name, c.tag, c.emblem, c.color,
                  u.username AS inviter_name
           FROM clan_invites ci
           JOIN clans c ON c.id = ci.clan_id
           LEFT JOIN users u ON u.id = ci.inviter_id
           WHERE ci.invitee_id = $1 AND ci.status = 'pending'
             AND (ci.expires_at IS NULL OR ci.expires_at > NOW())
           ORDER BY ci.created_at DESC
           LIMIT 20`,
          [userId]
        )
      : [];

    return NextResponse.json({
      ok: true,
      clans: rows.map((row) => ({ ...enrichClan(row), applied: !!row.applied })),
      my_clan: myClan ? { ...enrichClan(myClan), role: myMembership?.role || "member" } : null,
      invites,
      create_cost: CLAN_CREATE_COST,
      my_coins: Number(user?.sc_coins || 0),
      logged_in: !!user,
    });
  } catch (error) {
    console.error("clans GET error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      req,
      [{ scope: "clans:create", identifier: user.id, limit: 3, windowMs: 60 * 60 * 1000 }],
      "Слишком много попыток создания клана. Попробуйте позже."
    );
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));
    const name = normalizeClanName(body?.name);
    const tag = normalizeClanTag(body?.tag);
    const description = normalizeClanDescription(body?.description);
    const emblem = normalizeClanEmblem(body?.emblem);
    const color = normalizeClanColor(body?.color);

    if (!isValidClanName(name)) {
      return NextResponse.json(
        { error: "Название: 3–32 символа, буквы, цифры, пробел, дефис, точка или подчёркивание." },
        { status: 400 }
      );
    }
    if (!isValidClanTag(tag)) {
      return NextResponse.json(
        { error: "Тег: 2–6 латинских букв или цифр, например STLR." },
        { status: 400 }
      );
    }

    const result = await withTransaction(async (client) => {
      const member = await client.query("SELECT clan_id FROM clan_members WHERE user_id = $1", [user.id]);
      if (member.rows.length) {
        return { error: "Вы уже состоите в клане" } as const;
      }

      const taken = await client.query(
        "SELECT name, tag FROM clans WHERE LOWER(name) = LOWER($1) OR LOWER(tag) = LOWER($2) LIMIT 1",
        [name, tag]
      );
      if (taken.rows.length) {
        return { error: "Клан с таким названием или тегом уже существует" } as const;
      }

      const paid = await client.query(
        `UPDATE users SET sc_coins = COALESCE(sc_coins, 0) - $2
         WHERE id = $1 AND COALESCE(sc_coins, 0) >= $2
         RETURNING COALESCE(sc_coins, 0)::int AS coins`,
        [user.id, CLAN_CREATE_COST]
      );
      if (!paid.rows.length) {
        return { error: `Для создания нужно ${CLAN_CREATE_COST} SC` } as const;
      }

      await client.query(
        "INSERT INTO coin_transactions (user_id, amount, type, note) VALUES ($1, $2, $3, $4)",
        [user.id, -CLAN_CREATE_COST, "clan_create", `Создание клана ${name}`]
      );

      const created = await client.query(
        `INSERT INTO clans (name, tag, description, emblem, color, leader_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [name, tag, description || null, emblem, color, user.id]
      );

      const clanId = Number(created.rows[0]?.id);
      await client.query(
        "INSERT INTO clan_members (user_id, clan_id, role) VALUES ($1, $2, 'leader')",
        [user.id, clanId]
      );
      await client.query(
        "INSERT INTO clan_activity (clan_id, user_id, type, points, note) VALUES ($1, $2, 'create', 10, $3)",
        [clanId, user.id, `Клан ${name} основан`]
      );
      await client.query("UPDATE clans SET xp = 10 WHERE id = $1", [clanId]);

      return { clanId, coins: Number(paid.rows[0].coins) } as const;
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const clan = await queryOne(
      `SELECT c.*, u.username AS leader_name, u.avatar_url AS leader_avatar
       FROM clans c JOIN users u ON u.id = c.leader_id WHERE c.id = $1`,
      [result.clanId]
    );

    return NextResponse.json({
      ok: true,
      clan: clan ? enrichClan({ ...(clan as ClanRow), member_count: 1, role_count: 1 }) : null,
      coins: result.coins,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
