import { NextResponse } from "next/server";
import { queryAll, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const SEVERITIES = ["minor", "major", "critical", "maintenance"] as const;
const STATUSES = ["investigating", "identified", "monitoring", "resolved"] as const;

type Severity = (typeof SEVERITIES)[number];
type IncidentStatus = (typeof STATUSES)[number];

function asSeverity(value: unknown): Severity {
  return SEVERITIES.includes(value as Severity) ? (value as Severity) : "minor";
}

function asStatus(value: unknown): IncidentStatus {
  return STATUSES.includes(value as IncidentStatus)
    ? (value as IncidentStatus)
    : "investigating";
}

/** Список всех инцидентов для админки. */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  try {
    const incidents = await queryAll(
      `SELECT * FROM status_incidents ORDER BY started_at DESC LIMIT 100`
    );
    return NextResponse.json(
      { ok: true, incidents },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

/** Создание инцидента. */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const title = String(body?.title || "").trim();
    const description = String(body?.body || "").trim();
    const severity = asSeverity(body?.severity);
    const status = asStatus(body?.status);

    if (title.length < 3 || title.length > 120) {
      return NextResponse.json(
        { error: "Заголовок должен быть от 3 до 120 символов" },
        { status: 400 }
      );
    }

    const resolved = status === "resolved";
    const inserted = await queryOne(
      `INSERT INTO status_incidents (title, body, severity, status, resolved_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title, description || null, severity, status, resolved ? new Date() : null]
    );

    await logAdminAction(
      admin as { id: number; username: string },
      "status_incident_create",
      null,
      title
    );

    return NextResponse.json({ ok: true, incident: inserted });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

/** Обновление статуса/текста инцидента. */
export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Неверный инцидент" }, { status: 400 });
    }

    const existing = (await queryOne(
      "SELECT id, title, status FROM status_incidents WHERE id = $1",
      [id]
    )) as { id: number; title: string; status: string } | null;
    if (!existing) {
      return NextResponse.json({ error: "Инцидент не найден" }, { status: 404 });
    }

    const nextStatus =
      body?.status === undefined ? asStatus(existing.status) : asStatus(body.status);
    const title =
      body?.title === undefined
        ? existing.title
        : String(body.title).trim().slice(0, 120);
    const description =
      body?.body === undefined ? undefined : String(body.body).trim().slice(0, 2000);
    const severity =
      body?.severity === undefined ? undefined : asSeverity(body.severity);

    const updated = await queryOne(
      `UPDATE status_incidents
       SET title = $2,
           body = COALESCE($3, body),
           severity = COALESCE($4, severity),
           status = $5,
           resolved_at = CASE WHEN $5 = 'resolved' THEN COALESCE(resolved_at, NOW()) ELSE NULL END
       WHERE id = $1
       RETURNING *`,
      [id, title, description ?? null, severity ?? null, nextStatus]
    );

    await logAdminAction(
      admin as { id: number; username: string },
      "status_incident_update",
      null,
      `${title}: ${nextStatus}`
    );

    return NextResponse.json({ ok: true, incident: updated });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

/** Удаление инцидента. */
export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Неверный инцидент" }, { status: 400 });
    }

    const removed = await queryOne(
      "DELETE FROM status_incidents WHERE id = $1 RETURNING id, title",
      [id]
    );
    if (!removed) {
      return NextResponse.json({ error: "Инцидент не найден" }, { status: 404 });
    }

    await logAdminAction(
      admin as { id: number; username: string },
      "status_incident_delete",
      null,
      String((removed as { title?: string }).title || id)
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
