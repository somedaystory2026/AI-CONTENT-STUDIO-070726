import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateJsonWithResponses, localFallbackText } from "@/lib/ai-engine";

export const runtime = "nodejs";

const generateSchema = z.object({
  article: z.any().optional().nullable(),
  title: z.string().optional(),
  sourceText: z.string().optional(),
  mode: z.enum(["news", "blog", "sns", "rewrite", "translate"]).default("news"),
  tone: z.enum(["professional", "friendly", "viral", "premium", "storytelling", "seo"]).default("professional"),
  language: z.enum(["ko", "en", "ko-en", "ja", "es"]).default("ko"),
  template: z.string().optional().default("standard"),
  preset: z.string().optional().default("general"),
  temperature: z.number().min(0).max(1.5).optional().default(0.7),
  maxOutputTokens: z.number().min(300).max(8000).optional().default(2200),
  projectId: z.string().optional().nullable(),
  saveToLibrary: z.boolean().default(true),
});

type AiResult = ReturnType<typeof localFallbackText> & { usage?: unknown; historyId?: string };

const labels = {
  mode: { news: "뉴스 요약/SNS/카드뉴스", blog: "SEO 블로그 초안", sns: "SNS 패키지", rewrite: "리라이트", translate: "번역/현지화" },
  tone: { professional: "전문적", friendly: "친근함", viral: "바이럴", premium: "프리미엄", storytelling: "스토리텔링", seo: "SEO 최적화" },
  language: { ko: "한국어", en: "영어", "ko-en": "한국어와 영어 혼합", ja: "일본어", es: "스페인어" },
};

function normalize(value: Partial<AiResult>, fallbackTitle: string): AiResult {
  const fallback = localFallbackText(fallbackTitle);
  return {
    ...fallback,
    ...value,
    title: String(value.title || fallback.title),
    summary: String(value.summary || fallback.summary),
    mainContent: String(value.mainContent || fallback.mainContent),
    cardNews: Array.isArray(value.cardNews) ? value.cardNews.map(String).slice(0, 12) : fallback.cardNews,
    hashtags: Array.isArray(value.hashtags) ? value.hashtags.map((v) => String(v).replace(/^#/, "")).slice(0, 20) : fallback.hashtags,
    keywords: Array.isArray(value.keywords) ? value.keywords.map(String).slice(0, 20) : fallback.keywords,
  };
}

export async function POST(req: Request) {
  try {
    const body = generateSchema.parse(await req.json());
    const session = await auth();
    const article = body.article || null;
    const inputTitle = body.title || article?.title || "AI Content";
    const inputText = [
      body.sourceText,
      article?.title ? `제목: ${article.title}` : "",
      article?.description ? `설명: ${article.description}` : "",
      article?.source ? `출처: ${article.source}` : "",
      article?.link ? `링크: ${article.link}` : "",
      article?.category ? `카테고리: ${article.category}` : "",
      article?.country ? `국가: ${article.country}` : "",
    ].filter(Boolean).join("\n");

    if (!inputText.trim() && !inputTitle.trim()) {
      return NextResponse.json({ success: false, message: "생성할 제목 또는 본문을 입력하세요." }, { status: 400 });
    }

    if (body.projectId && session?.user?.id) {
      try {
        const project = await prisma.project.findFirst({ where: { id: body.projectId, ownerId: session.user.id } });
        if (!project) return NextResponse.json({ success: false, message: "선택한 프로젝트를 찾을 수 없습니다." }, { status: 404 });
      } catch (dbError) {
        console.warn("DB_OFFLINE_PROJECT_CHECK_SKIPPED", dbError);
      }
    }

    const prompt = `
AI Content Studio SaaS용 콘텐츠를 생성한다.

[설정]
- 작업: ${labels.mode[body.mode]}
- 톤: ${labels.tone[body.tone]}
- 언어: ${labels.language[body.language]}
- 템플릿: ${body.template}
- 프리셋: ${body.preset}
- 제목: ${inputTitle}

[입력]
${inputText}

[규칙]
- 입력에 없는 사실은 만들지 않는다.
- 실무자가 바로 복사해 사용할 완성형 문장으로 작성한다.
- 카드뉴스는 6~10장으로 구성한다.
- SEO 필드는 검색 의도를 반영한다.
- hashtags는 # 없이 반환한다.
- SNS/X 요청이면 twitter 필드는 본문 80~100자 내외 + 해시태그 3~5개 + 마지막 줄 실제 기사 URL 형식으로 작성한다. Google News RSS 주소, 스레드, 긴 설명, 불필요한 목록, 이모지는 만들지 않는다.
- JSON만 반환한다.

{
  "title": "콘텐츠 제목",
  "summary": "핵심 요약 3~5문장",
  "mainContent": "완성형 본문/블로그/번역/리라이트 결과",
  "cardNews": ["카드 1", "카드 2", "카드 3", "카드 4", "카드 5", "카드 6"],
  "twitter": "본문 80~100자\n\n#태그1 #태그2 #태그3\n\nhttps://실제기사주소",
  "instagram": "Instagram 게시글",
  "threads": "Threads 게시글",
  "hashtags": ["키워드1", "키워드2"],
  "seoTitle": "SEO 제목",
  "metaDescription": "메타 설명",
  "keywords": ["키워드1", "키워드2"]
}`.trim();

    let data: AiResult;
    let raw = "";
    let usage: unknown = null;

    if (!process.env.OPENAI_API_KEY) {
      data = normalize(localFallbackText(inputTitle), inputTitle);
    } else {
      const generated = await generateJsonWithResponses<Partial<AiResult>>({
        prompt,
        fallback: localFallbackText(inputTitle),
        temperature: body.temperature,
      });
      data = normalize(generated.data, inputTitle);
      raw = generated.raw;
      usage = generated.usage;
    }

    let history: { id?: string } | null = null;
    if (body.saveToLibrary) {
      try {
        history = await prisma.libraryItem.create({
          data: {
            title: data.title,
            type: "NEWS",
            status: "COMPLETED",
            summary: data.summary,
            sourceUrl: article?.link || null,
            projectId: body.projectId || null,
            ownerId: session?.user?.id || null,
            payload: { kind: "AI_GENERATOR_HISTORY", input: body, result: data, raw, usage },
          },
        });
      } catch (dbError) {
        console.warn("DB_OFFLINE_LIBRARY_SAVE_SKIPPED", dbError);
      }
    }

    return NextResponse.json({ success: true, data: { ...data, usage, historyId: history?.id || null }, libraryItem: history, dbOffline: !history });
  } catch (error) {
    console.error("AI_GENERATE_ERROR", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "AI 생성 실패" }, { status: 500 });
  }
}
