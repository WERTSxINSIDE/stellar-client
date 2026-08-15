import { NextResponse } from "next/server";
import { query, queryOne, queryAll, addBalanceHistory } from "@/lib/db";
import bcrypt from "bcrypt";

export async function POST(req: Request) {
  try {
    const { admin_token, action, user_id, role, ban_reason, days, new_password, new_username } = await req.json();

    if (admin_token !== "euphoria-admin-2024") {
      return NextResponse.json({ error: "Неверный токен" }, { status: 403 });
    }

    if (action === "list") {
      const users = await queryAll("SELECT id, username, email, role, subscription_end, hwid, is_admin, banned, ban_reason, created_at, balance FROM users ORDER BY id");
      return NextResponse.json({ ok: true, users });
    }

    if (action === "set-role") {
      if (!user_id || !role) return NextResponse.json({ error: "Укажите user_id и role" }, { status: 400 });
      const validRoles = ["user", "media", "tester", "admin"];
      if (!validRoles.includes(role)) return NextResponse.json({ error: `Роль должна быть: ${validRoles.join(", ")}` }, { status: 400 });
      const isAdmin = role === "admin" ? 1 : 0;
      await query("UPDATE users SET is_admin = $1, role = $2 WHERE id = $3", [isAdmin, role, user_id]);
      return NextResponse.json({ ok: true });
    }

    if (action === "ban") {
      if (!user_id) return NextResponse.json({ error: "Укажите user_id" }, { status: 400 });
      await query("UPDATE users SET banned = 1, ban_reason = $1 WHERE id = $2", [ban_reason || null, user_id]);
      await query("DELETE FROM sessions WHERE user_id = $1", [user_id]);
      return NextResponse.json({ ok: true });
    }

    if (action === "unban") {
      if (!user_id) return NextResponse.json({ error: "Укажите user_id" }, { status: 400 });
      await query("UPDATE users SET banned = 0, ban_reason = NULL WHERE id = $1", [user_id]);
      return NextResponse.json({ ok: true });
    }

    if (action === "delete") {
      if (!user_id) return NextResponse.json({ error: "Укажите user_id" }, { status: 400 });
      await query("DELETE FROM sessions WHERE user_id = $1", [user_id]);
      await query("DELETE FROM users WHERE id = $1", [user_id]);
      return NextResponse.json({ ok: true });
    }

    if (action === "reduce-subscription") {
      if (!user_id) return NextResponse.json({ error: "Укажите user_id" }, { status: 400 });
      if (!days || days < 1) return NextResponse.json({ error: "Укажите количество дней" }, { status: 400 });
      const user = await queryAll("SELECT subscription_end FROM users WHERE id = $1", [user_id]);
      if (!user.length || !(user[0] as any).subscription_end) return NextResponse.json({ error: "У пользователя нет подписки" }, { status: 400 });
      const current = new Date((user[0] as any).subscription_end.replace(" ", "T"));
      current.setDate(current.getDate() - days);
      const newEnd = current.toISOString().slice(0, 19).replace("T", " ");
      await query("UPDATE users SET subscription_end = $1 WHERE id = $2", [newEnd, user_id]);
      return NextResponse.json({ ok: true, subscription_end: newEnd });
    }

    if (action === "add-subscription") {
      if (!user_id) return NextResponse.json({ error: "Укажите user_id" }, { status: 400 });
      if (!days || days < 1) return NextResponse.json({ error: "Укажите количество дней" }, { status: 400 });
      const user = await queryAll("SELECT subscription_end FROM users WHERE id = $1", [user_id]);
      let base: Date;
      if (user.length && (user[0] as any).subscription_end) {
        const current = new Date((user[0] as any).subscription_end.replace(" ", "T"));
        base = current > new Date() ? current : new Date();
      } else {
        base = new Date();
      }
      base.setDate(base.getDate() + days);
      const newEnd = base.toISOString().slice(0, 19).replace("T", " ");
      await query("UPDATE users SET subscription_end = $1 WHERE id = $2", [newEnd, user_id]);
      return NextResponse.json({ ok: true, subscription_end: newEnd });
    }

    if (action === "change-password") {
      if (!user_id || !new_password) return NextResponse.json({ error: "Укажите user_id и новый пароль" }, { status: 400 });
      if (String(new_password).length < 6) return NextResponse.json({ error: "Пароль минимум 6 символов" }, { status: 400 });
      const hash = await bcrypt.hash(String(new_password), 10);
      await query("UPDATE users SET password = $1 WHERE id = $2", [hash, user_id]);
      return NextResponse.json({ ok: true });
    }

    if (action === "change-username") {
      if (!user_id) return NextResponse.json({ error: "Укажите user_id" }, { status: 400 });
      if (!new_username || String(new_username).length < 2) return NextResponse.json({ error: "Ник минимум 2 символа" }, { status: 400 });
      const exists = await queryOne("SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2", [String(new_username), user_id]);
      if (exists) return NextResponse.json({ error: "Ник уже занят" }, { status: 400 });
      await query("UPDATE users SET username = $1 WHERE id = $2", [String(new_username), user_id]);
      return NextResponse.json({ ok: true });
    }

    if (action === "add-balance") {
      if (!user_id) return NextResponse.json({ error: "Укажите user_id" }, { status: 400 });
      if (!days && days !== 0) return NextResponse.json({ error: "Укажите сумму" }, { status: 400 });
      const amount = Number(days);
      if (isNaN(amount) || amount === 0) return NextResponse.json({ error: "Неверная сумма" }, { status: 400 });
      await query("UPDATE users SET balance = balance + $1 WHERE id = $2", [amount, user_id]);
      await addBalanceHistory(user_id, amount, "topup", amount > 0 ? "Начисление администратором" : "Списание администратором");
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
