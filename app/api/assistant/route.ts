import { NextResponse } from "next/server";
import { popularQuestions, searchAssistant, type AssistantLang } from "@/lib/assistant";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function normalizeLang(value: unknown): AssistantLang {
  return value === "en" ? "en" : "ru";
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

    const body = await req.json().catch(() => ({}));
    const message = String(body?.message || "").trim().slice(0, 500);
    const lang = normalizeLang(body?.lang);

    if (message.length < 2) {
      return NextResponse.json(
        { error: lang === "en" ? "Type a question first." : "Сначала введите вопрос." },
        { status: 400 }
      );
    }

    const result = searchAssistant(message, lang);
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
