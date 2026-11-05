import { NextResponse } from "next/server";
import { query, queryAll, queryOne } from "@/lib/db";
import { getPartyUser } from "@/lib/party-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Позиция считается актуальной 10 секунд. */
export const POSITION_TTL_SECONDS = 10;
const COORD_LIMIT = 30_000_000;

async function getPartyId(userId: number): Promise<number | null> {
  const row = (await queryOne(
    "SELECT party_id FROM party_members WHERE user_id = $1",
    [userId]
  )) as { party_id: number } | null;
  return row ? row.party_id : null;
}

function cleanText(value: unknown, max: number): string | null {
  const text = String(value ?? "").trim().slice(0, max);
  return text || null;
}

function finiteIn(value: unknown, min: number, max: number): number | null {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return number;
}

export async function GET(req: Request) {
  try {
    const user = await getPartyUser(req);
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const partyId = await getPartyId(user.id);
    if (!partyId) {
      return NextResponse.json({ ok: true, positions: [], ttl_seconds: POSITION_TTL_SECONDS });
    }

    const positions = await queryAll(
      `SELECT pp.user_id, u.username, u.nickname_color,
              pp.server, pp.dimension, pp.x, pp.y, pp.z, pp.yaw, pp.health,
              pp.updated_at,
              (EXTRACT(EPOCH FROM (NOW() - pp.updated_at)) * 1000)::int AS age_ms
       FROM party_positions pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.party_id = $1
         AND pp.updated_at > NOW() - INTERVAL '10 seconds'
       ORDER BY pp.updated_at DESC`,
      [partyId]
    );

    return NextResponse.json({
      ok: true,
      positions,
      ttl_seconds: POSITION_TTL_SECONDS,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getPartyUser(req);
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      req,
      [{ scope: "party:position", identifier: user.id, limit: 120, windowMs: 60_000 }],
      "Слишком частая отправка позиции."
    );
    if (limited) return limited;

    const partyId = await getPartyId(user.id);
    if (!partyId) {
      return NextResponse.json({ error: "Вы не в пати" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const x = finiteIn(body.x, -COORD_LIMIT, COORD_LIMIT);
    const y = finiteIn(body.y, -COORD_LIMIT, COORD_LIMIT);
    const z = finiteIn(body.z, -COORD_LIMIT, COORD_LIMIT);
    if (x === null || y === null || z === null) {
      return NextResponse.json({ error: "Неверные координаты" }, { status: 400 });
    }

    const yaw = finiteIn(body.yaw, -720, 720);
    const health = finiteIn(body.health, 0, 20);
    const server = cleanText(body.server, 120);
    const dimension = cleanText(body.dimension, 120);

    await query(
      `INSERT INTO party_positions (user_id, party_id, server, dimension, x, y, z, yaw, health, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         party_id = EXCLUDED.party_id,
         server = EXCLUDED.server,
         dimension = EXCLUDED.dimension,
         x = EXCLUDED.x,
         y = EXCLUDED.y,
         z = EXCLUDED.z,
         yaw = EXCLUDED.yaw,
         health = EXCLUDED.health,
         updated_at = NOW()`,
      [user.id, partyId, server, dimension, x, y, z, yaw, health === null ? null : Math.round(health)]
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getPartyUser(req);
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    await query("DELETE FROM party_positions WHERE user_id = $1", [user.id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
