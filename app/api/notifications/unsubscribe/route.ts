import { NextResponse } from "next/server";
import { NOTIFICATION_CATEGORIES, unsubscribeByToken } from "@/lib/notification-settings";
import { SITE_URL } from "@/lib/notify";

export const dynamic = "force-dynamic";

function page(title: string, message: string) {
  return `<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:40px 16px;background:#09090b;color:#e4e4e7;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#111114;border:1px solid #27272a;border-radius:24px;padding:36px;">
    <p style="margin:0 0 18px;font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#a78bfa;font-weight:700;">Stellar Client</p>
    <h1 style="margin:0 0 14px;font-size:24px;color:#ffffff;">${title}</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#a1a1aa;">${message}</p>
    <a href="${SITE_URL}/dashboard" style="display:inline-block;padding:13px 24px;border-radius:14px;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;">Вернуться в кабинет</a>
  </div>
</body>
</html>`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = (url.searchParams.get("token") || "").trim();
  const category = (url.searchParams.get("category") || "all").trim();

  if (!token) {
    return new NextResponse(page("Ссылка недействительна", "В ссылке нет токена отписки."), {
      status: 400,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const result = await unsubscribeByToken(token, category);
  if (!result.ok) {
    return new NextResponse(
      page("Ссылка недействительна", "Возможно, настройки уже менялись. Отписаться можно в кабинете."),
      { status: 404, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  const label =
    result.category === "all"
      ? "все письма"
      : NOTIFICATION_CATEGORIES.find((c) => c.key === result.category)?.label || "эту категорию";

  return new NextResponse(
    page("Вы отписаны", `Уведомления на почту (${label}) отключены. Уведомления в колокольчике продолжат приходить.`),
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}
