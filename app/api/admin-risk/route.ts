import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { logAdminAction, findUserForLog } from "@/lib/audit";
import { getRiskOverview, getRiskStats, scanAllRisk } from "@/lib/risk";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });

    const scan = new URL(req.url).searchParams.get("scan");
    let scanResult: { scanned: number; flagged: number } | null = null;
    if (scan === "1") {
      scanResult = await scanAllRisk();
    }

    const [users, stats] = await Promise.all([getRiskOverview(), getRiskStats()]);
    return NextResponse.json({ ok: true, users, stats, scan: scanResult });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const userId = Number(body.user_id);

    if (action === "scan") {
      const result = await scanAllRisk();
      await logAdminAction(admin, "risk.scan", null, `Проверено: ${result.scanned}, с риском: ${result.flagged}`);
      return NextResponse.json({ ok: true, ...result });
    }

    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: "Укажите user_id" }, { status: 400 });
    }

    const target = await findUserForLog(userId);
    if (!target) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });

    if (action === "clear") {
      await query(
        "UPDATE users SET risk_score = 0, risk_flags = NULL WHERE id = $1",
        [userId]
      );
      await query(
        `UPDATE risk_events SET status = 'resolved', resolved_at = NOW(), resolved_by = $1
         WHERE user_id = $2 AND status = 'open'`,
        [admin.id, userId]
      );
      await logAdminAction(admin, "risk.clear", target, "Флаги риска сброшены");
      return NextResponse.json({ ok: true });
    }

    if (action === "ban") {
      const reason = String(body.reason || "Подозрительная активность (риск-скор)").slice(0, 500);
      await query("UPDATE users SET banned = 1, ban_reason = $1 WHERE id = $2", [reason, userId]);
      await query("DELETE FROM sessions WHERE user_id = $1", [userId]);
      await logAdminAction(admin, "risk.ban", target, reason);
      return NextResponse.json({ ok: true });
    }

    if (action === "unban") {
      await query("UPDATE users SET banned = 0, ban_reason = NULL WHERE id = $1", [userId]);
      await logAdminAction(admin, "risk.unban", target);
      return NextResponse.json({ ok: true });
    }

    if (action === "reset-hwid") {
      await query("UPDATE users SET hwid = NULL WHERE id = $1", [userId]);
      await logAdminAction(admin, "risk.reset-hwid", target);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Неверное действие" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
