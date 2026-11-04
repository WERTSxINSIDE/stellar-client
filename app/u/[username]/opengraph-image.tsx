import { ImageResponse } from "next/og";
import { queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const alt = "Профиль игрока Stellar Client";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type ImageProps = {
  params: Promise<{ username: string }> | { username: string };
};

export default async function ProfileImage({ params }: ImageProps) {
  const resolved = await params;
  const raw = typeof resolved?.username === "string" ? resolved.username : "";
  const name = decodeURIComponent(raw).trim();

  let username = name || "Stellar Client";
  let bio = "Достижения, статистика и активность в Stellar Client.";

  if (name) {
    try {
      const user = (await queryOne(
        `SELECT username, bio FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
        [name]
      )) as { username: string; bio: string | null } | null;
      if (user) {
        username = user.username;
        if (user.bio) bio = user.bio.slice(0, 140);
      }
    } catch {
      // Если база недоступна — отдаём брендированную заглушку.
    }
  }

  const initial = (username.trim()[0] || "S").toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "radial-gradient(circle at 15% 0%, rgba(147,51,234,0.55), transparent 55%), radial-gradient(circle at 90% 100%, rgba(56,189,248,0.35), transparent 50%), #09090b",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: "linear-gradient(135deg,#7c3aed,#f0abfc)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 800,
            }}
          >
            SC
          </div>
          <div
            style={{
              fontSize: 22,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: "#c4b5fd",
              fontWeight: 700,
            }}
          >
            Stellar Client
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <div
            style={{
              width: 148,
              height: 148,
              borderRadius: 40,
              background: "linear-gradient(135deg,#7c3aed,#f0abfc)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 72,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div
              style={{
                fontSize: 68,
                fontWeight: 800,
                lineHeight: 1.05,
                maxWidth: 820,
                overflow: "hidden",
              }}
            >
              {username}
            </div>
            <div
              style={{
                fontSize: 28,
                color: "#a1a1aa",
                marginTop: 18,
                lineHeight: 1.35,
                maxWidth: 780,
              }}
            >
              {bio}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 24, color: "#71717a" }}>Профиль игрока</div>
          <div
            style={{
              fontSize: 24,
              color: "#c4b5fd",
              border: "1px solid rgba(196,181,253,0.35)",
              borderRadius: 999,
              padding: "10px 24px",
            }}
          >
            stellar-client.vercel.app
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
