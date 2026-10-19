import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryAll, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

async function loadTickets(userId: number | null) {
  const tickets = await queryAll(
    `SELECT t.id, t.user_id, t.subject, t.status, t.created_at, t.updated_at, u.username
     FROM support_tickets t
     JOIN users u ON t.user_id = u.id
     ${userId ? "WHERE t.user_id = $1" : ""}
     ORDER BY t.updated_at DESC`,
    userId ? [userId] : []
  );
  if (!tickets.length) return [];
  const ids = tickets.map((t) => t.id);
  const messages = await queryAll(
    `SELECT id, ticket_id, user_id, is_admin, body, created_at
     FROM support_messages WHERE ticket_id = ANY($1::int[]) ORDER BY created_at ASC`,
    [ids]
  );
  return tickets.map((t) => ({
    ...t,
    messages: messages.filter((m) => m.ticket_id === t.id),
  }));
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    const isAdmin = !!(user.is_admin || user.role === "admin");
    const all = new URL(req.url).searchParams.get("all");
    const tickets = await loadTickets(all && isAdmin ? null : user.id);
    return NextResponse.json({ ok: true, tickets, isAdmin });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    const isAdmin = !!(user.is_admin || user.role === "admin");
    const { action, ticket_id, subject, body } = await req.json();

    if (action === "create") {
      if (!subject?.trim() || !body?.trim()) {
        return NextResponse.json({ error: "Заполните тему и сообщение" }, { status: 400 });
      }
      const t = await queryOne(
        "INSERT INTO support_tickets (user_id, subject) VALUES ($1, $2) RETURNING id",
        [user.id, subject.trim()]
      );
      await query(
        "INSERT INTO support_messages (ticket_id, user_id, is_admin, body) VALUES ($1, $2, $3, $4)",
        [t.id, user.id, isAdmin ? 1 : 0, body.trim()]
      );
      return NextResponse.json({ ok: true, id: t.id });
    }

    if (action === "reply") {
      if (!ticket_id || !body?.trim()) {
        return NextResponse.json({ error: "Введите сообщение" }, { status: 400 });
      }
      const t = await queryOne("SELECT user_id FROM support_tickets WHERE id = $1", [ticket_id]);
      if (!t) return NextResponse.json({ error: "Тикет не найден" }, { status: 404 });
      if (!isAdmin && t.user_id !== user.id) {
        return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
      }
      await query(
        "INSERT INTO support_messages (ticket_id, user_id, is_admin, body) VALUES ($1, $2, $3, $4)",
        [ticket_id, user.id, isAdmin ? 1 : 0, body.trim()]
      );
      await query("UPDATE support_tickets SET updated_at = NOW() WHERE id = $1", [ticket_id]);
      return NextResponse.json({ ok: true });
    }

    if (action === "close" || action === "reopen") {
      if (!ticket_id) return NextResponse.json({ error: "Укажите ticket_id" }, { status: 400 });
      const t = await queryOne("SELECT user_id FROM support_tickets WHERE id = $1", [ticket_id]);
      if (!t) return NextResponse.json({ error: "Тикет не найден" }, { status: 404 });
      if (!isAdmin && t.user_id !== user.id) {
        return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
      }
      const status = action === "close" ? "closed" : "open";
      await query("UPDATE support_tickets SET status = $1, updated_at = NOW() WHERE id = $2", [
        status,
        ticket_id,
      ]);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
