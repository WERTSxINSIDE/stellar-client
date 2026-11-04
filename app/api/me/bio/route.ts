import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { computeAchievements } from "@/lib/achievements";
import { getAchievementStats, isSubscriptionActive } from "@/lib/achievement-stats";

export const dynamic = "force-dynamic";

const BIO_MAX = 300;

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function formatPlayTime(seconds: number) {
  if (seconds < 60) return `${seconds} ${plural(seconds, "секунду", "секунды", "секунд")}`;
  const hours = Math.floor(seconds / 3600);
  if (hours < 1) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} ${plural(minutes, "минуту", "минуты", "минут")}`;
  }
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours < 24) {
    return minutes > 0
      ? `${hours} ч ${minutes} мин`
      : `${hours} ${plural(hours, "час", "часа", "часов")}`;
  }
  const days = Math.floor(hours / 24);
  return `${days} ${plural(days, "день", "дня", "дней")}`;
}

/**
 * Собирает описание профиля из реальной статистики игрока.
 * Ничего не сохраняет — текст можно отредактировать перед сохранением.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const stats = await getAchievementStats(user.id);
    if (!stats) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const achievements = computeAchievements(stats);
    const unlocked = achievements.filter((a) => a.unlocked);

    const parts: string[] = [];

    if (stats.isLifetime) {
      parts.push("Вечный участник Stellar Client.");
    } else if (isSubscriptionActive(user.subscription_end)) {
      parts.push("Участник клуба с активной подпиской.");
    } else {
      parts.push("Участник клуба Stellar Client.");
    }

    if (stats.accountAgeDays > 0) {
      parts.push(
        `В клубе ${stats.accountAgeDays} ${plural(stats.accountAgeDays, "день", "дня", "дней")}.`
      );
    }

    if (stats.playSeconds > 0) {
      parts.push(`Провёл в клиенте ${formatPlayTime(stats.playSeconds)}.`);
    }

    if (stats.purchases > 0) {
      parts.push(
        `Сделал ${stats.purchases} ${plural(stats.purchases, "покупку", "покупки", "покупок")} на ${stats.totalSpent.toLocaleString("ru-RU")} ₽.`
      );
    }

    if (unlocked.length > 0) {
      parts.push(
        `Открыто ${unlocked.length} ${plural(unlocked.length, "достижение", "достижения", "достижений")} из ${achievements.length}.`
      );
      const best = [...unlocked].sort((a, b) => b.target - a.target)[0];
      if (best && best.rarity !== "common") {
        parts.push(`Гордится наградой «${best.title}» ${best.icon}`);
      }
    } else {
      parts.push("Только начинает путь — достижения ещё впереди.");
    }

    if (stats.reviews > 0) {
      parts.push(
        `Оставил ${stats.reviews} ${plural(stats.reviews, "отзыв", "отзыва", "отзывов")}.`
      );
    }

    let bio = parts.join(" ");
    if (bio.length > BIO_MAX) {
      bio = bio.slice(0, BIO_MAX - 1).trimEnd() + "…";
    }

    return NextResponse.json({ ok: true, bio });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
