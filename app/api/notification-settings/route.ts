import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import {
  getNotificationSettings,
  NOTIFICATION_CATEGORIES,
  updateNotificationSettings,
  type NotificationCategory,
} from "@/lib/notification-settings";

export const dynamic = "force-dynamic";

function serialize(settings: Awaited<ReturnType<typeof getNotificationSettings>>, email: string) {
  return {
    ok: true,
    email,
    categories: NOTIFICATION_CATEGORIES,
    settings: {
      email_security: settings.email_security,
      email_referral: settings.email_referral,
      email_support: settings.email_support,
      email_achievements: settings.email_achievements,
      email_other: settings.email_other,
    },
  };
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const row = (await queryOne("SELECT email FROM users WHERE id = $1", [user.id])) as
      | { email: string }
      | null;

    const settings = await getNotificationSettings(user.id);
    return NextResponse.json(serialize(settings, String(row?.email || user.email)));
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const patch: Partial<Record<NotificationCategory, boolean>> = {};

    for (const category of NOTIFICATION_CATEGORIES) {
      if (typeof body[category.key] === "boolean") {
        patch[category.key] = body[category.key];
      }
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "Нет изменений" }, { status: 400 });
    }

    const settings = await updateNotificationSettings(user.id, patch);
    return NextResponse.json(serialize(settings, user.email));
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
