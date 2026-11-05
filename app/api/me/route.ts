import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { touchPresence } from "@/lib/presence";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

const BIO_MAX = 300;
const AVATAR_URL_MAX = 500;
const AVATAR_DATA_MAX = 400_000;
const BANNER_URL_MAX = 800;
const BANNER_DATA_MAX = 1_200_000;
const ACCENT_RE = /^#[0-9a-f]{6}$/i;

/** Разрешены http(s)-ссылки и сжатые data-URL картинки (jpg/png/webp). */
function validateImage(
  image: string,
  maxUrl: number,
  maxData: number,
  label: string
): string | null {
  if (!image) return null;

  const dataMatch = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/i.exec(image);
  if (dataMatch) {
    if (image.length > maxData) {
      return `Файл ${label} слишком большой — выберите изображение поменьше`;
    }
    return null;
  }

  if (image.length > maxUrl) {
    return `Ссылка на ${label} не длиннее ${maxUrl} символов`;
  }

  let parsed: URL;
  try {
    parsed = new URL(image);
  } catch {
    return `Некорректная ссылка на ${label}`;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return `Ссылка на ${label} должна начинаться с http:// или https://`;
  }
  return null;
}

function validateAvatar(avatar: string): string | null {
  return validateImage(avatar, AVATAR_URL_MAX, AVATAR_DATA_MAX, "аватара");
}

function validateBanner(banner: string): string | null {
  return validateImage(banner, BANNER_URL_MAX, BANNER_DATA_MAX, "баннера");
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }

  touchPresence(user.id).catch(() => {});

  const pa = await queryOne(
    `SELECT platform FROM partner_applications
     WHERE user_id = $1 AND status = 'approved'
     ORDER BY created_at DESC LIMIT 1`,
    [user.id]
  );

  // Тяжёлые картинки (аватар/баннер в base64) отдаём только кабинету,
  // чтобы шапка сайта не тянула их на каждой странице.
  const full = new URL(req.url).searchParams.get("profile") === "1";
  const profile = full
    ? await queryOne(
        "SELECT avatar_url, bio, banner_url, accent_color FROM users WHERE id = $1",
        [user.id]
      )
    : null;

  const publicUser = {
    ...user,
    avatar_url: profile?.avatar_url ?? null,
    bio: profile?.bio ?? null,
    banner_url: profile?.banner_url ?? null,
    accent_color: profile?.accent_color ?? null,
    platform: (pa?.platform as string) ?? null,
  };

  return NextResponse.json({ user: publicUser });
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      bio?: unknown;
      avatar_url?: unknown;
      banner_url?: unknown;
      accent_color?: unknown;
    };

    if (
      body.bio === undefined &&
      body.avatar_url === undefined &&
      body.banner_url === undefined &&
      body.accent_color === undefined
    ) {
      return NextResponse.json({ error: "Нет изменений" }, { status: 400 });
    }

    const sets: string[] = [];
    const values: unknown[] = [];

    if (body.bio !== undefined) {
      if (typeof body.bio !== "string") {
        return NextResponse.json({ error: "Био должно быть текстом" }, { status: 400 });
      }
      const bio = body.bio.replace(/\r\n/g, "\n").trim();
      if (bio.length > BIO_MAX) {
        return NextResponse.json(
          { error: `Био не длиннее ${BIO_MAX} символов` },
          { status: 400 }
        );
      }
      values.push(bio || null);
      sets.push(`bio = $${values.length}`);
    }

    if (body.avatar_url !== undefined) {
      if (typeof body.avatar_url !== "string") {
        return NextResponse.json({ error: "Ссылка на аватар должна быть текстом" }, { status: 400 });
      }
      const avatar = body.avatar_url.trim();
      const avatarError = validateAvatar(avatar);
      if (avatarError) {
        return NextResponse.json({ error: avatarError }, { status: 400 });
      }
      values.push(avatar || null);
      sets.push(`avatar_url = $${values.length}`);
    }

    if (body.banner_url !== undefined) {
      if (typeof body.banner_url !== "string") {
        return NextResponse.json({ error: "Ссылка на баннер должна быть текстом" }, { status: 400 });
      }
      const banner = body.banner_url.trim();
      const bannerError = validateBanner(banner);
      if (bannerError) {
        return NextResponse.json({ error: bannerError }, { status: 400 });
      }
      values.push(banner || null);
      sets.push(`banner_url = $${values.length}`);
    }

    if (body.accent_color !== undefined) {
      if (typeof body.accent_color !== "string") {
        return NextResponse.json({ error: "Цвет акцента должен быть текстом" }, { status: 400 });
      }
      const accent = body.accent_color.trim().toLowerCase();
      if (accent && !ACCENT_RE.test(accent)) {
        return NextResponse.json({ error: "Цвет акцента в формате #RRGGBB" }, { status: 400 });
      }
      values.push(accent || null);
      sets.push(`accent_color = $${values.length}`);
    }

    values.push(user.id);
    await query(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${values.length}`,
      values
    );

    const fresh = (await queryOne(
      "SELECT avatar_url, bio, banner_url, accent_color FROM users WHERE id = $1",
      [user.id]
    )) as {
      avatar_url: string | null;
      bio: string | null;
      banner_url: string | null;
      accent_color: string | null;
    } | null;

    return NextResponse.json({
      ok: true,
      user: {
        avatar_url: fresh?.avatar_url ?? null,
        bio: fresh?.bio ?? null,
        banner_url: fresh?.banner_url ?? null,
        accent_color: fresh?.accent_color ?? null,
      },
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
