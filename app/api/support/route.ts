import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryAll, queryOne } from "@/lib/db";
import { notifyUser } from "@/lib/notify";
import { logAdminAction, findUserForLog } from "@/lib/audit";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  SUPPORT_ATTACHMENT_DATA_MAX,
  SUPPORT_ATTACHMENT_MIME,
  isAllowedAttachmentName,
  normalizeSupportCategory,
} from "@/lib/support";

export const dynamic = "force-dynamic";

const ATTACHMENT_URL_MAX = 800;

type Attachment = { url: string; name: string };

/** Вложение — data URL (картинка или файл) либо http(s)-ссылка. */
function validateAttachment(value: unknown): { error?: string; value?: Attachment } {
  if (value === undefined || value === null || value === "") return {};
  if (typeof value !== "object") return { error: "Некорректное вложение" };

  const raw = value as { url?: unknown; name?: unknown };
  if (typeof raw.url !== "string") return { error: "Некорректное вложение" };

  const url = raw.url.trim();
  if (!url) return {};

  const name = (typeof raw.name === "string" ? raw.name : "вложение").trim().slice(0, 120);

  const dataMatch = /^data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(url);
  if (dataMatch) {
    const mime = dataMatch[1].toLowerCase();
    if (!SUPPORT_ATTACHMENT_MIME.includes(mime)) {
      return { error: "Такой тип файла не поддерживается" };
    }
    if (!isAllowedAttachmentName(name)) {
      return { error: "Недопустимое расширение файла" };
    }
    if (url.length > SUPPORT_ATTACHMENT_DATA_MAX) {
      return { error: "Вложение больше 1,8 МБ — уменьшите файл" };
    }
    return { value: { url, name } };
  }

  if (url.length > ATTACHMENT_URL_MAX) return { error: "Ссылка на вложение слишком длинная" };

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { error: "Ссылка на вложение должна начинаться с http:// или https://" };
    }
  } catch {
    return { error: "Некорректная ссылка на вложение" };
  }

  return { value: { url, name } };
}

async function loadTickets(userId: number | null) {
  const tickets = await queryAll(
    `SELECT t.id, t.user_id, t.subject, t.category, t.status, t.created_at, t.updated_at,
            t.user_unread, t.admin_unread, t.last_message_by,
            t.csat_rating, t.csat_comment, t.csat_at, u.username
     FROM support_tickets t
     JOIN users u ON t.user_id = u.id
     ${userId ? "WHERE t.user_id = $1" : ""}
     ORDER BY t.updated_at DESC`,
    userId ? [userId] : []
  );
  if (!tickets.length) return [];
  const ids = tickets.map((t) => t.id);
  const messages = await queryAll(
    `SELECT id, ticket_id, user_id, is_admin, body, attachment_url, attachment_name, created_at
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
    const showAll = all && isAdmin;

    const tickets = await loadTickets(showAll ? null : user.id);

    // Открытие списка помечает сообщения прочитанными.
    if (showAll) {
      await query("UPDATE support_tickets SET admin_unread = 0 WHERE admin_unread > 0");
    } else {
      await query(
        "UPDATE support_tickets SET user_unread = 0 WHERE user_id = $1 AND user_unread > 0",
        [user.id]
      );
    }

    const unread = showAll
      ? 0
      : tickets.reduce((sum, t) => sum + (Number(t.user_unread) || 0), 0);

    let csat: { avg: number; count: number } | null = null;
    if (showAll) {
      const row = (await queryOne(
        `SELECT COUNT(*)::int AS count, COALESCE(AVG(csat_rating), 0)::float AS avg
         FROM support_tickets WHERE csat_rating IS NOT NULL`
      )) as { count: number; avg: number } | null;
      csat = { avg: Number(row?.avg || 0), count: Number(row?.count || 0) };
    }

    return NextResponse.json({
      ok: true,
      tickets: tickets.map((t) =>
        showAll ? { ...t, admin_unread: 0 } : { ...t, user_unread: 0 }
      ),
      isAdmin,
      unread,
      csat,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    const isAdmin = !!(user.is_admin || user.role === "admin");
    const { action, ticket_id, subject, body, attachment, category, rating, comment } =
      await req.json();

    const limited = await enforceRateLimit(req, [
      { scope: "support:ip", identifier: getClientIp(req), limit: 40, windowMs: 10 * 60_000 },
      action === "create"
        ? { scope: "support:create", identifier: user.id, limit: 5, windowMs: 60 * 60_000 }
        : { scope: "support:action", identifier: user.id, limit: 30, windowMs: 10 * 60_000 },
    ]);
    if (limited) return limited;

    const text = typeof body === "string" ? body.trim() : "";
    const file = validateAttachment(attachment);
    if (file.error) {
      return NextResponse.json({ error: file.error }, { status: 400 });
    }

    if (action === "create") {
      const subj = typeof subject === "string" ? subject.trim() : "";
      if (!subj || (!text && !file.value)) {
        return NextResponse.json(
          { error: "Заполните тему и сообщение (или прикрепите скриншот)" },
          { status: 400 }
        );
      }
      const t = await queryOne(
        `INSERT INTO support_tickets (user_id, subject, category, status, admin_unread, last_message_by)
         VALUES ($1, $2, $3, 'open', 1, 'user')
         RETURNING id`,
        [user.id, subj.slice(0, 200), normalizeSupportCategory(category)]
      );
      await query(
        `INSERT INTO support_messages
           (ticket_id, user_id, is_admin, body, attachment_url, attachment_name)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          t.id,
          user.id,
          isAdmin ? 1 : 0,
          text,
          file.value?.url ?? null,
          file.value?.name ?? null,
        ]
      );
      return NextResponse.json({ ok: true, id: t.id });
    }

    if (action === "reply") {
      if (!ticket_id || (!text && !file.value)) {
        return NextResponse.json(
          { error: "Введите сообщение или прикрепите скриншот" },
          { status: 400 }
        );
      }
      const t = await queryOne(
        "SELECT user_id, status FROM support_tickets WHERE id = $1",
        [ticket_id]
      );
      if (!t) return NextResponse.json({ error: "Тикет не найден" }, { status: 404 });
      if (!isAdmin && t.user_id !== user.id) {
        return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
      }

      await query(
        `INSERT INTO support_messages
           (ticket_id, user_id, is_admin, body, attachment_url, attachment_name)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          ticket_id,
          user.id,
          isAdmin ? 1 : 0,
          text,
          file.value?.url ?? null,
          file.value?.name ?? null,
        ]
      );

      // Ответ поддержки ждёт реакции пользователя, ответ пользователя — поддержки.
      const nextStatus = isAdmin ? "pending" : "open";
      await query(
        `UPDATE support_tickets
         SET updated_at = NOW(),
             status = CASE WHEN status = 'closed' THEN 'open' ELSE $1 END,
             user_unread = user_unread + $2,
             admin_unread = admin_unread + $3,
             last_message_by = $4
         WHERE id = $5`,
        [nextStatus, isAdmin ? 1 : 0, isAdmin ? 0 : 1, isAdmin ? "admin" : "user", ticket_id]
      );

      if (isAdmin && Number(t.user_id) !== user.id) {
        await notifyUser(
          Number(t.user_id),
          {
            type: "support",
            title: "Ответ поддержки",
            body: (text || file.value?.name || "Вложение").slice(0, 180),
            link: "/support",
          },
          { email: true }
        ).catch(() => {});

        const target = await findUserForLog(Number(t.user_id));
        await logAdminAction(user, "support.reply", target, `Тикет #${ticket_id}`);
      }

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
      await query(
        "UPDATE support_tickets SET status = $1, updated_at = NOW() WHERE id = $2",
        [status, ticket_id]
      );
      return NextResponse.json({ ok: true });
    }

    if (action === "csat") {
      if (!ticket_id) return NextResponse.json({ error: "Укажите ticket_id" }, { status: 400 });
      const value = Number(rating);
      const note = typeof comment === "string" ? comment.trim() : "";
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        return NextResponse.json({ error: "Оценка должна быть от 1 до 5" }, { status: 400 });
      }
      if (note.length > 500) {
        return NextResponse.json({ error: "Комментарий не должен превышать 500 символов" }, { status: 400 });
      }

      const t = (await queryOne(
        "SELECT user_id, status, csat_rating FROM support_tickets WHERE id = $1",
        [ticket_id]
      )) as { user_id: number; status: string; csat_rating: number | null } | null;
      if (!t) return NextResponse.json({ error: "Тикет не найден" }, { status: 404 });
      if (t.user_id !== user.id) {
        return NextResponse.json({ error: "Оценить тикет может только его автор" }, { status: 403 });
      }
      if (t.status !== "closed") {
        return NextResponse.json({ error: "Оценить можно только закрытый тикет" }, { status: 400 });
      }
      if (t.csat_rating) {
        return NextResponse.json({ error: "Вы уже оценили этот тикет" }, { status: 409 });
      }

      await query(
        `UPDATE support_tickets
         SET csat_rating = $1, csat_comment = $2, csat_at = NOW()
         WHERE id = $3`,
        [value, note || null, ticket_id]
      );
      return NextResponse.json({ ok: true, rating: value });
    }

    if (action === "read") {
      if (!ticket_id) return NextResponse.json({ error: "Укажите ticket_id" }, { status: 400 });
      const t = await queryOne("SELECT user_id FROM support_tickets WHERE id = $1", [ticket_id]);
      if (!t) return NextResponse.json({ error: "Тикет не найден" }, { status: 404 });
      if (!isAdmin && t.user_id !== user.id) {
        return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
      }
      await query(
        isAdmin
          ? "UPDATE support_tickets SET admin_unread = 0 WHERE id = $1"
          : "UPDATE support_tickets SET user_unread = 0 WHERE id = $1",
        [ticket_id]
      );
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
