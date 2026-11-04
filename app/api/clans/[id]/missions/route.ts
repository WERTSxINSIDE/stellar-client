import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getClanById, getMembership } from "@/lib/clan-service";
import { buildClanMissions, claimClanMission } from "@/lib/clan-missions";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function resolve(params: Params["params"]) {
  const { id } = await params;
  const clanId = Number(id);
  if (!Number.isInteger(clanId) || clanId <= 0) return null;
  return clanId;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const clanId = await resolve(params);
    if (!clanId) return NextResponse.json({ error: "Клан не найден" }, { status: 404 });

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const clan = await getClanById(clanId);
    if (!clan) return NextResponse.json({ error: "Клан не найден" }, { status: 404 });

    const membership = await getMembership(user.id);
    if (!membership || membership.clan_id !== clanId) {
      return NextResponse.json({ error: "Вы не участник этого клана" }, { status: 403 });
    }

    const state = await buildClanMissions(clanId, membership.role);
    return NextResponse.json({ ok: true, ...state });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const clanId = await resolve(params);
    if (!clanId) return NextResponse.json({ error: "Клан не найден" }, { status: 404 });

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const membership = await getMembership(user.id);
    if (!membership || membership.clan_id !== clanId) {
      return NextResponse.json({ error: "Вы не участник этого клана" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const key = String(body?.key || "");
    if (!key) return NextResponse.json({ error: "Не выбрана миссия" }, { status: 400 });

    const result = await claimClanMission(clanId, user.id, membership.role, key);

    if (result.kind === "no_permission") {
      return NextResponse.json({ error: "Забрать награду может офицер и выше" }, { status: 403 });
    }
    if (result.kind === "too_few_members") {
      return NextResponse.json({ error: "Нужно минимум 3 участника клана" }, { status: 400 });
    }
    if (result.kind === "not_ready") {
      return NextResponse.json({ error: "Миссия ещё не выполнена" }, { status: 400 });
    }
    if (result.kind === "already") {
      return NextResponse.json({ error: "Награда уже получена на этой неделе" }, { status: 409 });
    }

    const state = await buildClanMissions(clanId, membership.role);
    return NextResponse.json({
      ok: true,
      reward: result.reward,
      distributed: result.distributed,
      balance: result.balance,
      ...state,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
