import { NextResponse } from "next/server";
import { getCurrentUser, isSupportStaff } from "@/lib/auth";
import { popularQuestions, searchAssistant, type AssistantLang } from "@/lib/assistant";
import { chatWithAi, isAiConfigured, type AiChatTurn } from "@/lib/ai";
import {
  detectViolation,
  guestViolationMessage,
  moderateMessage,
  type ModerationResult,
} from "@/lib/moderation";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type HistoryTurn = { role?: unknown; content?: unknown };

function normalizeLang(value: unknown): AssistantLang {
  return value === "en" ? "en" : "ru";
}

function sanitizeHistory(value: unknown): AiChatTurn[] {
  if (!Array.isArray(value)) return [];

  return (value as HistoryTurn[])
    .filter(
      (turn) =>
        turn &&
        (turn.role === "user" || turn.role === "assistant") &&
        typeof turn.content === "string" &&
        turn.content.trim().length > 0
    )
    .slice(-10)
    .flatMap((turn) => {
      const content = String(turn.content).replace(/\s+/g, " ").trim().slice(0, 800);
      if (!content) return [];
      // Старые реплики пользователя не должны протаскивать мат/джейлбрейк в модель.
      if (turn.role === "user" && detectViolation(content)) return [];
      return [{ role: turn.role as "user" | "assistant", content }];
    });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lang = normalizeLang(url.searchParams.get("lang"));
  return NextResponse.json({ ok: true, questions: popularQuestions(lang) });
}

export async function POST(req: Request) {
  try {
    const limited = await enforceRateLimit(
      req,
      [{ scope: "assistant:ip", identifier: getClientIp(req), limit: 30, windowMs: 5 * 60 * 1000 }],
      "Слишком много вопросов подряд. Подождите пару минут."
    );
    if (limited) return limited;

    const user = await getCurrentUser();

    if (user) {
      const userLimited = await enforceRateLimit(
        req,
        [{ scope: "assistant:user", identifier: user.id, limit: 20, windowMs: 5 * 60 * 1000 }],
        "Слишком много вопросов подряд. Подождите пару минут."
      );
      if (userLimited) return userLimited;

      if (user.banned) {
        return NextResponse.json(
          {
            ok: false,
            error: "Аккаунт заблокирован. Обжаловать блокировку можно через поддержку.",
          },
          { status: 403 }
        );
      }
    }

    const body = await req.json().catch(() => ({}));
    const message = String(body?.message || "").trim().slice(0, 500);
    const lang = normalizeLang(body?.lang);

    if (message.length < 2) {
      return NextResponse.json(
        { error: lang === "en" ? "Type a question first." : "Сначала введите вопрос." },
        { status: 400 }
      );
    }

    const violation = detectViolation(message);
    if (violation) {
      if (!user) {
        return NextResponse.json(
          {
            ok: false,
            error: guestViolationMessage(violation.kind, lang),
            moderation: { guest: true, kind: violation.kind },
          },
          { status: 403 }
        );
      }

      const result: ModerationResult | null = await moderateMessage({
        userId: user.id,
        username: user.username,
        text: message,
        channel: "assistant",
        staff: isSupportStaff(user),
        lang,
      });

      if (result) {
        return NextResponse.json(
          {
            ok: false,
            error: result.message,
            moderation: {
              kind: result.kind,
              strikes: result.strikes,
              remaining: result.remaining,
              banned: result.banned,
              staff: result.staff,
            },
          },
          { status: 403 }
        );
      }
    }

    const faq = searchAssistant(message, lang);
    const context =
      !faq.escalate && faq.sources.length
        ? faq.sources.map((source) => `— ${source.title}: ${source.snippet}`).join("\n")
        : "";

    const history = sanitizeHistory(body?.history);
    const aiAnswer = isAiConfigured()
      ? await chatWithAi({ message, history, lang, context })
      : null;

    // Ответ модели тоже проверяем: бот не должен ругаться или раскрывать промпт.
    const safeAiAnswer = aiAnswer && !detectViolation(aiAnswer) ? aiAnswer : null;

    if (safeAiAnswer) {
      return NextResponse.json({
        ok: true,
        answer: safeAiAnswer,
        sources: faq.escalate ? [] : faq.sources,
        escalate: false,
        suggestions: faq.suggestions,
        matched: faq.matched,
        ai: true,
      });
    }

    return NextResponse.json({ ok: true, ...faq, ai: false });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
