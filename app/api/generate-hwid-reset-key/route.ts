import { NextResponse } from "next/server";
import crypto from "crypto";
import { query, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { count = 1 } = await req.json();

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const segments = [7, 4, 4];
    const numKeys = Math.min(Math.max(1, Number(count)), 100);
    const keys: string[] = [];

    for (let i = 0; i < numKeys; i++) {
      let key = "";
      let unique = false;
      while (!unique) {
        key = "HWID-" + segments.map((len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("")).join("-");
        const existing = await queryOne("SELECT id FROM keys WHERE key = $1", [key]);
        if (!existing) unique = true;
      }
      await query("INSERT INTO keys (key, duration_days) VALUES ($1, 0)", [key]);
      keys.push(key);
    }

    return NextResponse.json({ ok: true, keys });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
