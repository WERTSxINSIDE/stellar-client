import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { getClanById, getMembership } from "@/lib/clan-service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const limited = await enforceRateLimit(
      req,
      [{ scope: "clans:apply", identifier: `${user.id}:${getClientIp(req)}`, limit: 10, windowMs: 10 * 60 * 1000 }],
      "Слишком много заявок. Попробуйте позже."
    );
    if (limited) return limited;

    const { id } = await params;
    const clanId = Number(id);
    const clan = await getClanById(clanId);
    if (!clan) return NextResponse.json({ error: "Клан не найден" }, { status: 404 });

    const membership = await getMembership(user.id);
    if (membership) {
      return NextResponse.json({ error: "Вы уже состоите в клане" }, { status: 400 });
    }
    if (!clan.recruiting) {
      return NextResponse.json({ error: "Набор в этот клан закрыт" }, { status: 400 });
    }
    if (Number(clan.member_count) >= clan.max_members) {
      return NextResponse.json({ error: "В клане нет свободных мест" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const message = String(body?.message || "").replace(/\s+/g, " ").trim().slice(0, 240);

    const application = await queryOne(
      `INSERT INTO clan_applications (clan_id, user_id, message, status)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (clan_id, user_id) DO UPDATE
         SET message = EXCLUDED.message,
             status = 'pending',
             reviewed_by = NULL,
             reviewed_at = NULL,
             created_at = NOW()
       RETURNING id, status`,
      [clanId, user.id, message || null]
    );

    await queryOne(
      `INSERT INTO notifications (user_id, type, title, body, link)
       VALUES ($1, 'clan', 'Новая заявка в клан', $2, $3)`,
      [clan.leader_id, `${user.username} хочет вступить в ${clan.name}`, `/clans/${clanId}`]
    );

    return NextResponse.json({ ok: true, application });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
