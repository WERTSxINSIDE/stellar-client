import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryAll, queryOne, withTransaction } from "@/lib/db";
import { grantCoins } from "@/lib/coins";
import { DAILY_QUESTS, DAILY_QUEST_MAX_REWARD, type QuestTemplate } from "@/lib/quests";

export const dynamic = "force-dynamic";

type ProgressRow = {
  play_seconds: number;
  daily_claimed: boolean;
  clan_chat: boolean;
  in_clan: boolean;
};

async function getProgress(userId: number): Promise<ProgressRow> {
  const row = (await queryOne(
    `SELECT
       COALESCE((SELECT SUM(seconds) FROM play_sessions
                 WHERE user_id = $1 AND started_at::date = CURRENT_DATE), 0)::int AS play_seconds,
       EXISTS(SELECT 1 FROM daily_rewards WHERE user_id = $1 AND last_claim = CURRENT_DATE) AS daily_claimed,
       EXISTS(SELECT 1 FROM clan_messages WHERE user_id = $1 AND created_at::date = CURRENT_DATE) AS clan_chat,
       EXISTS(SELECT 1 FROM clan_members WHERE user_id = $1) AS in_clan`,
    [userId]
  )) as ProgressRow | null;

  return (
    row ?? { play_seconds: 0, daily_claimed: false, clan_chat: false, in_clan: false }
  );
}

function questProgress(quest: QuestTemplate, progress: ProgressRow): number {
  switch (quest.key) {
    case "login":
      return 1;
    case "play_30":
    case "play_60":
      return Math.min(quest.target, Math.max(0, Number(progress.play_seconds) || 0));
    case "daily_reward":
      return progress.daily_claimed ? 1 : 0;
    case "clan_chat":
      return progress.clan_chat ? 1 : 0;
    default:
      return 0;
  }
}

async function buildState(userId: number) {
  const progress = await getProgress(userId);
  const claimedRows = await queryAll(
    "SELECT quest_key FROM daily_quest_claims WHERE user_id = $1 AND quest_date = CURRENT_DATE",
    [userId]
  );
  const claimed = new Set(claimedRows.map((row) => String(row.quest_key)));

  const quests = DAILY_QUESTS.filter(
    (quest) => !quest.requiresClan || progress.in_clan
  ).map((quest) => {
    const value = questProgress(quest, progress);
    const isClaimed = claimed.has(quest.key);
    return {
      key: quest.key,
      title_ru: quest.titleRu,
      title_en: quest.titleEn,
      desc_ru: quest.descRu,
      desc_en: quest.descEn,
      icon: quest.icon,
      reward: quest.reward,
      target: quest.target,
      unit: quest.unit,
      progress: isClaimed ? quest.target : value,
      claimed: isClaimed,
      claimable: !isClaimed && value >= quest.target,
      requires_clan: !!quest.requiresClan,
    };
  });

  const claimedReward = quests
    .filter((quest) => quest.claimed)
    .reduce((sum, quest) => sum + quest.reward, 0);
  const claimableReward = quests
    .filter((quest) => quest.claimable)
    .reduce((sum, quest) => sum + quest.reward, 0);

  return { quests, claimed_reward: claimedReward, claimable_reward: claimableReward };
}

function nextReset() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  ).toISOString();
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const state = await buildState(user.id);

    return NextResponse.json({
      ok: true,
      ...state,
      max_reward: DAILY_QUEST_MAX_REWARD,
      resets_at: nextReset(),
      balance: Number(user.sc_coins || 0),
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const key = String(body?.key || "");
    const quest = DAILY_QUESTS.find((item) => item.key === key);

    if (!quest) {
      return NextResponse.json({ error: "Неизвестный квест" }, { status: 400 });
    }

    const progress = await getProgress(user.id);
    if (quest.requiresClan && !progress.in_clan) {
      return NextResponse.json({ error: "Квест доступен только участникам клана" }, { status: 400 });
    }

    if (questProgress(quest, progress) < quest.target) {
      return NextResponse.json({ error: "Условие квеста ещё не выполнено" }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO daily_quest_claims (user_id, quest_key, quest_date, reward)
         VALUES ($1, $2, CURRENT_DATE, $3)
         ON CONFLICT (user_id, quest_key, quest_date) DO NOTHING
         RETURNING quest_key`,
        [user.id, quest.key, quest.reward]
      );

      if (!inserted.rows.length) return { already: true } as const;

      const balance = await grantCoins(
        user.id,
        quest.reward,
        "daily_quest",
        `Ежедневный квест: ${quest.titleRu}`,
        client
      );
      return { already: false, balance } as const;
    });

    if (result.already) {
      return NextResponse.json({ error: "Квест уже получен сегодня" }, { status: 409 });
    }

    const state = await buildState(user.id);

    return NextResponse.json({
      ok: true,
      reward: quest.reward,
      balance: result.balance,
      ...state,
      max_reward: DAILY_QUEST_MAX_REWARD,
      resets_at: nextReset(),
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
