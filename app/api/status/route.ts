import { NextResponse } from "next/server";
import { queryAll, queryOne } from "@/lib/db";
import { LAUNCHER_VERSION } from "@/lib/launcher";

export const dynamic = "force-dynamic";

type Incident = {
  id: number;
  title: string;
  body: string | null;
  severity: string;
  status: string;
  started_at: string;
  resolved_at: string | null;
};

type CountRow = { count?: number };

/** Сколько процентов времени сервис был доступен за последние N дней. */
function uptimePercent(days: number, incidents: Incident[]): number {
  const now = Date.now();
  const from = now - days * 24 * 60 * 60 * 1000;
  let downtime = 0;

  for (const incident of incidents) {
    const started = new Date(incident.started_at).getTime();
    const ended = incident.resolved_at
      ? new Date(incident.resolved_at).getTime()
      : now;

    const fromMs = Math.max(started, from);
    const toMs = Math.min(ended, now);
    if (toMs > fromMs) downtime += toMs - fromMs;
  }

  const total = now - from;
  if (total <= 0) return 100;
  return Math.max(0, Math.min(100, ((total - downtime) / total) * 100));
}

/**
 * Публичный статус сервиса: онлайн, запуски, аптайм и история инцидентов.
 * Специально не отдаёт имена игроков — только агрегаты.
 */
export async function GET() {
  try {
    const online = (await queryOne(
      `SELECT COUNT(*)::int AS count
       FROM play_sessions
       WHERE started_at > NOW() - INTERVAL '5 minutes' AND ended_at IS NULL`
    )) as CountRow | null;

    const today = (await queryOne(
      `SELECT COUNT(*)::int AS count
       FROM play_sessions
       WHERE started_at > NOW() - INTERVAL '1 day'`
    )) as CountRow | null;

    const users = (await queryOne(
      "SELECT COUNT(*)::int AS count FROM users"
    )) as CountRow | null;

    const incidents = (await queryAll(
      `SELECT id, title, body, severity, status,
              started_at, resolved_at
       FROM status_incidents
       WHERE started_at > NOW() - INTERVAL '90 days'
       ORDER BY started_at DESC
       LIMIT 40`
    )) as Incident[];

    const active = incidents.filter((incident) => !incident.resolved_at);
    const status = active.some((incident) => incident.severity === "critical")
      ? "down"
      : active.length > 0
        ? "degraded"
        : "operational";

    return NextResponse.json(
      {
        ok: true,
        status,
        online: Number(online?.count || 0),
        launches_today: Number(today?.count || 0),
        users: Number(users?.count || 0),
        launcher_version: LAUNCHER_VERSION,
        uptime: {
          day: Number(uptimePercent(1, incidents).toFixed(2)),
          week: Number(uptimePercent(7, incidents).toFixed(2)),
          month: Number(uptimePercent(30, incidents).toFixed(2)),
        },
        incidents,
        updated_at: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
