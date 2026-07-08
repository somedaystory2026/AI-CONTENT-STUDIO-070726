import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateJsonWithResponses } from "@/lib/ai-engine";

export const runtime = "nodejs";

const schema = z.object({
  article: z.any().optional().nullable(),
  title: z.string().optional(),
  sourceText: z.string().optional(),
  tone: z.enum(["news", "viral", "premium", "friendly"]).default("news"),
  theme: z.enum(["dark", "blue", "purple", "green", "warm"]).default("blue"),
  ratio: z.enum(["1:1", "4:5", "16:9"]).default("1:1"),
  cardCount: z.number().min(3).max(12).default(8),
  projectId: z.string().optional().nullable(),
  saveToLibrary: z.boolean().default(true),
});

type CardResult = {
  title: string;
  subtitle: string;
  cards: { id: string; eyebrow: string; title: string; body: string; imagePrompt: string }[];
  hashtags: string[];
};

function fallback(title: string, count: number): CardResult {
  return {
    title: title || "Card News",
    subtitle: "AI 카드뉴스 초안",
    cards: Array.from({ length: count }, (_, i) => ({
      id: `card-${i + 1}`,
      eyebrow: `${i + 1}/${count}`,
      title: i === 0 ? title || "핵심 이슈" : ["핵심 변화", "지금 주목할 점", "왜 중요한가", "새로운 흐름", "실전 체크포인트", "다음 전망"][i % 6],
      body: "본문 내용을 입력하면 AI가 카드뉴스 문구와 이미지 프롬프트를 생성합니다.",
      imagePrompt: `Clean modern Korean card news visual, slide ${i + 1}, editorial SaaS style`,
    })),
    hashtags: ["카드뉴스", "AI콘텐츠", "뉴스요약"],
  };
}

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const session = await auth();
    const article = body.article || null;
    const title = body.title || article?.title || "Card News";
    const source = [body.sourceText, article?.title, article?.description, article?.link].filter(Boolean).join("\n");

    let data = fallback(title, body.cardCount);
    let raw = "";
    let usage: unknown = null;

    if (process.env.OPENAI_API_KEY) {
      const prompt = `
아래 입력을 ${body.cardCount}장 카드뉴스로 만든다.
톤: ${body.tone}, 테마: ${body.theme}, 비율: ${body.ratio}
제목: ${title}
입력: ${source}

각 카드는 짧은 제목, 1~2문장 본문, 이미지 생성 프롬프트를 포함한다.
중요: 카드 제목에 Point 1, Point 2, 카드 1 같은 임시 문구를 절대 쓰지 말고 기사 내용에서 나온 자연스러운 한국어 소제목을 작성한다.
JSON만 반환한다.
{"title":"","subtitle":"","cards":[{"id":"card-1","eyebrow":"1/${body.cardCount}","title":"","body":"","imagePrompt":""}],"hashtags":[""]}`.trim();
      const generated = await generateJsonWithResponses<Partial<CardResult>>({ prompt, fallback: data, temperature: 0.7 });
      raw = generated.raw;
      usage = generated.usage;
      data = {
        ...data,
        ...generated.data,
        cards: Array.isArray(generated.data.cards) && generated.data.cards.length ? generated.data.cards.map((card, index) => ({
          id: card.id || `card-${index + 1}`,
          eyebrow: card.eyebrow || `${index + 1}/${body.cardCount}`,
          title: card.title && !/^point\s*\d+$/i.test(card.title) ? card.title : ["핵심 변화", "지금 주목할 점", "왜 중요한가", "새로운 흐름", "실전 체크포인트", "다음 전망"][index % 6],
          body: card.body || "",
          imagePrompt: card.imagePrompt || `Editorial card news image for ${title}`,
        })).slice(0, body.cardCount) : data.cards,
        hashtags: Array.isArray(generated.data.hashtags) ? generated.data.hashtags.map(String).slice(0, 12) : data.hashtags,
      };
    }

    let libraryItem = null;
    if (body.saveToLibrary) {
      try {
        libraryItem = await prisma.libraryItem.create({
          data: {
            title: data.title,
            type: "CARD_NEWS",
            status: "COMPLETED",
            summary: data.subtitle,
            sourceUrl: article?.link || null,
            projectId: body.projectId || null,
            ownerId: session?.user?.id || null,
            payload: { kind: "CARD_NEWS_PROJECT", input: body, result: data, raw, usage },
          },
        });
      } catch (dbError) {
        console.warn("DB_OFFLINE_LIBRARY_SAVE_SKIPPED", dbError);
      }
    }

    return NextResponse.json({ success: true, data, libraryItem, usage, dbOffline: body.saveToLibrary && !libraryItem });
  } catch (error) {
    console.error("CARD_NEWS_GENERATE_ERROR", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "카드뉴스 생성 실패" }, { status: 500 });
  }
}
