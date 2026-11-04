import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { safeRefreshUserRisk } from "@/lib/risk";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { key } = await req.json();
    if (!key || !key.trim()) {
      return NextResponse.json({ error: "Введите ключ" }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      // Блокируем ключ, чтобы его нельзя было использовать дважды одновременно.
      const keyResult = await client.query(
        "SELECT * FROM keys WHERE key = $1 FOR UPDATE",
        [key.trim().toUpperCase()]
      );
      const licenseKey = keyResult.rows[0];

      if (!licenseKey) {
        return { error: "Ключ не найден", status: 404 } as const;
      }
      if (licenseKey.activated_by) {
        return { error: "Ключ уже был использован", status: 409 } as const;
      }
      if (licenseKey.duration_days !== 0) {
        return { error: "Это ключ подписки, а не сброса HWID", status: 400 } as const;
      }

      const now = new Date().toISOString().replace("T", " ").slice(0, 19);

      await client.query("UPDATE users SET hwid = NULL WHERE id = $1", [user.id]);
      await client.query(
        "UPDATE keys SET activated_by = $1, activated_at = $2 WHERE id = $3",
        [user.id, now, licenseKey.id]
      );

      return { ok: true } as const;
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await safeRefreshUserRisk(user.id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
