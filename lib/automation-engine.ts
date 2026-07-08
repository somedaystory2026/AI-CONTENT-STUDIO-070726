import { prisma } from "@/lib/prisma";
import { collectRssNews } from "@/lib/rss-collector";
import { generateAIContent, generateJsonWithResponses } from "@/lib/ai-engine";
import type { NewsItem } from "@/types/content";

export type AutomationStepKey = "rss" | "summary" | "cardNews" | "imagePrompts" | "amazonSeo" | "social" | "library";

export type AutomationRunInput = {
  name?: string;
  country?: string;
  category?: string;
  language?: string;
  query?: string;
  articleLimit?: number;
  cardCount?: number;
  tone?: string;
  targetLanguage?: "ko" | "en" | "ko-en";
  productUrl?: string;
  productName?: string;
  steps?: Partial<Record<AutomationStepKey, boolean>>;
  projectId?: string | null;
  ownerId?: string | null;
};

export type AutomationRunResult = {
  runId: string;
  name: string;
  steps: { key: AutomationStepKey; label: string; status: "완료" | "건너뜀" | "실패"; detail: string }[];
  articles: NewsItem[];
  summaries: { articleId: string; title: string; output: string }[];
  cardNews: unknown[];
  imagePrompts: { articleId: string; title: string; prompt: string }[];
  amazonSeo: unknown | null;
  socialPosts: { articleId: string; title: string; x: string; instagram: string; threads: string; hashtags: string[] }[];
  libraryItems: { id: string; title: string; type: string }[];
};

const labels: Record<AutomationStepKey, string> = {
  rss: "RSS 뉴스 수집",
  summary: "AI 요약/리라이트",
  cardNews: "카드뉴스 자동 생성",
  imagePrompts: "이미지 프롬프트 생성",
  amazonSeo: "Amazon SEO 생성",
  social: "SNS 문안 생성",
  library: "Library 저장",
};

const defaultSteps: Record<AutomationStepKey, boolean> = {
  rss: true,
  summary: true,
  cardNews: true,
  imagePrompts: true,
  amazonSeo: false,
  social: true,
  library: true,
};


function makeShortXPost(title: string, link?: string) {
  const cleanTitle = title.replace(/["“”]/g, "").replace(/\s+-\s+.*$/, "").trim();
  const body = `${cleanTitle.slice(0, 58)}\n핵심만 빠르게 확인해보세요.`.slice(0, 100);
  const tags = "#뉴스 #이슈 #트렌드";
  return [body, tags, link].filter(Boolean).join("\n\n");
}

function extractAsin(url?: string) {
  if (!url) return "";
  return url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)?.[1] || url.match(/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1] || "";
}

function fallbackCard(title: string, count: number) {
  return {
    title,
    subtitle: "AI 자동화 카드뉴스 초안",
    cards: Array.from({ length: count }, (_, index) => ({
      id: `card-${index + 1}`,
      eyebrow: `${index + 1}/${count}`,
      title: ["핵심 이슈", "배경 이해", "주요 변화", "영향 분석", "실전 체크", "다음 전망"][index % 6],
      body: `${title} 관련 핵심 내용을 카드뉴스용 문장으로 정리합니다.`,
      imagePrompt: `Korean editorial card news image about ${title}, clean modern SaaS style`,
    })),
    hashtags: ["AI자동화", "카드뉴스", "뉴스요약"],
  };
}

async function saveLibrary(input: {
  title: string;
  type: "NEWS" | "CARD_NEWS" | "IMAGE" | "AMAZON_SEO" | "WORKFLOW";
  summary?: string | null;
  sourceUrl?: string | null;
  payload: unknown;
  projectId?: string | null;
  ownerId?: string | null;
}) {
  try {
    const item = await prisma.libraryItem.create({
      data: {
        title: input.title,
        type: input.type,
        status: "COMPLETED",
        summary: input.summary || null,
        sourceUrl: input.sourceUrl || null,
        projectId: input.projectId || null,
        ownerId: input.ownerId || null,
        payload: input.payload as object,
      },
    });
    return { id: item.id, title: item.title, type: item.type };
  } catch (dbError) {
    console.warn("DB_OFFLINE_AUTOMATION_LIBRARY_SAVE_SKIPPED", dbError);
    return { id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: input.title, type: input.type };
  }
}

export async function runAutomation(input: AutomationRunInput): Promise<AutomationRunResult> {
  const steps = { ...defaultSteps, ...(input.steps || {}) };
  const runId = `auto-${Date.now()}`;
  const name = input.name || "AI 자동화 워크플로우";
  const stepLog: AutomationRunResult["steps"] = [];
  const libraryItems: AutomationRunResult["libraryItems"] = [];

  let job: { id?: string } | null = null;
  try {
    job = await prisma.queueJob.create({
      data: {
        externalId: runId,
        type: "RSS_COLLECT",
        status: "ACTIVE",
        progress: 5,
        input: input as object,
        ownerId: input.ownerId || null,
      },
    });
  } catch (dbError) {
    console.warn("DB_OFFLINE_AUTOMATION_JOB_SAVE_SKIPPED", dbError);
  }

  try {
    let articles: NewsItem[] = [];
    const summaries: AutomationRunResult["summaries"] = [];
    const cardNews: unknown[] = [];
    const imagePrompts: AutomationRunResult["imagePrompts"] = [];
    const socialPosts: AutomationRunResult["socialPosts"] = [];
    let amazonSeo: unknown | null = null;

    if (steps.rss) {
      const collected = await collectRssNews({
        limit: Math.min(input.articleLimit || 5, 10),
        country: input.country || "전체",
        category: input.category || "전체",
        language: input.language || "전체",
        query: input.query || "",
        maxFeeds: 8,
      });
      articles = collected.data.slice(0, input.articleLimit || 5);
      stepLog.push({ key: "rss", label: labels.rss, status: "완료", detail: `${articles.length}개 기사 수집 / RSS ${collected.feedCount}개 확인` });
    } else {
      stepLog.push({ key: "rss", label: labels.rss, status: "건너뜀", detail: "사용자가 비활성화" });
    }

    if (steps.summary) {
      for (const article of articles) {
        const generated = await generateAIContent({
          type: "news-summary",
          temperature: 0.45,
          system: "뉴스 콘텐츠 자동화 도우미입니다. 한국어로 짧고 명확하게 요약합니다.",
          prompt: `다음 기사를 ${input.targetLanguage || "ko"} 언어로 요약하고, 카드뉴스에 쓸 수 있는 핵심 포인트 5개를 작성하세요.\n제목: ${article.title}\n본문: ${article.description || ""}\n링크: ${article.link || ""}`,
        });
        summaries.push({ articleId: article.id || article.link || article.title, title: article.title, output: generated.text });
      }
      stepLog.push({ key: "summary", label: labels.summary, status: "완료", detail: `${summaries.length}개 AI 요약 생성` });
    } else {
      stepLog.push({ key: "summary", label: labels.summary, status: "건너뜀", detail: "사용자가 비활성화" });
    }

    if (steps.cardNews) {
      for (const article of articles) {
        const fallback = fallbackCard(article.title, input.cardCount || 6);
        const generated = process.env.OPENAI_API_KEY
          ? await generateJsonWithResponses({
              fallback,
              temperature: 0.65,
              prompt: `기사 제목과 설명을 바탕으로 ${input.cardCount || 6}장 카드뉴스 JSON을 생성하세요. Point 1 같은 임시 제목은 금지합니다. 자연스러운 한국어 소제목을 사용하세요.\n제목: ${article.title}\n설명: ${article.description || ""}\n반환 형식: {"title":"","subtitle":"","cards":[{"id":"card-1","eyebrow":"1/${input.cardCount || 6}","title":"","body":"","imagePrompt":""}],"hashtags":[""]}`,
            })
          : { data: fallback };
        cardNews.push({ articleId: article.id, articleTitle: article.title, ...(generated.data as object) });
      }
      stepLog.push({ key: "cardNews", label: labels.cardNews, status: "완료", detail: `${cardNews.length}개 카드뉴스 프로젝트 생성` });
    } else {
      stepLog.push({ key: "cardNews", label: labels.cardNews, status: "건너뜀", detail: "사용자가 비활성화" });
    }

    if (steps.imagePrompts) {
      for (const item of (cardNews as { articleId?: string; articleTitle?: string; title?: string; cards?: { imagePrompt?: string }[] }[])) {
        imagePrompts.push({
          articleId: item.articleId || item.articleTitle || item.title || runId,
          title: item.articleTitle || item.title || "카드뉴스 이미지",
          prompt: item.cards?.[0]?.imagePrompt || `Clean Korean editorial image for ${item.articleTitle || item.title}`,
        });
      }
      stepLog.push({ key: "imagePrompts", label: labels.imagePrompts, status: "완료", detail: `${imagePrompts.length}개 이미지 프롬프트 준비` });
    } else {
      stepLog.push({ key: "imagePrompts", label: labels.imagePrompts, status: "건너뜀", detail: "사용자가 비활성화" });
    }

    if (steps.amazonSeo && (input.productUrl || input.productName)) {
      const asin = extractAsin(input.productUrl);
      const fallback = {
        productName: input.productName || asin || "Amazon Product",
        seoTitle: `${input.productName || asin || "Amazon Product"} - SEO Optimized Listing`,
        bullets: ["구매자가 바로 이해할 수 있는 핵심 장점", "사용 상황을 반영한 실용적인 설명", "검색 키워드를 자연스럽게 포함", "선물과 일상 사용 모두 강조", "주의사항과 호환 정보 정리"],
        description: "Amazon SEO 자동화 설명 초안입니다.",
        backendKeywords: ["amazon", "seo", "listing"],
      };
      const generated = process.env.OPENAI_API_KEY
        ? await generateJsonWithResponses({
            fallback,
            temperature: 0.5,
            prompt: `Amazon 상품 SEO를 생성하세요. 한국어 사용자도 이해하기 쉽게 작성하세요. URL:${input.productUrl || ""} 상품명:${input.productName || asin} JSON: {"productName":"","seoTitle":"","bullets":[""],"description":"","backendKeywords":[""]}`,
          })
        : { data: fallback };
      amazonSeo = generated.data;
      stepLog.push({ key: "amazonSeo", label: labels.amazonSeo, status: "완료", detail: "Amazon SEO 세트 생성" });
    } else {
      stepLog.push({ key: "amazonSeo", label: labels.amazonSeo, status: steps.amazonSeo ? "건너뜀" : "건너뜀", detail: steps.amazonSeo ? "상품 URL/상품명이 없음" : "사용자가 비활성화" });
    }

    if (steps.social) {
      for (const article of articles) {
        socialPosts.push({
          articleId: article.id || article.link || article.title,
          title: article.title,
          x: makeShortXPost(article.title, article.link),
          instagram: `${article.title}\n\n뉴스 핵심을 카드뉴스로 정리했습니다. 저장하고 나중에 확인하세요.`,
          threads: `${article.title}\n\n이 이슈는 앞으로 콘텐츠 제작과 시장 흐름에 영향을 줄 수 있습니다. 핵심 포인트를 이어서 정리해볼게요.`,
          hashtags: ["뉴스", "이슈"],
        });
      }
      stepLog.push({ key: "social", label: labels.social, status: "완료", detail: `${socialPosts.length}개 SNS 문안 생성` });
    } else {
      stepLog.push({ key: "social", label: labels.social, status: "건너뜀", detail: "사용자가 비활성화" });
    }

    if (steps.library) {
      for (const summary of summaries) {
        libraryItems.push(await saveLibrary({ title: summary.title, type: "NEWS", summary: summary.output.slice(0, 300), payload: { kind: "AUTOMATION_NEWS_SUMMARY", summary }, projectId: input.projectId, ownerId: input.ownerId }));
      }
      for (const item of (cardNews as { title?: string; subtitle?: string; articleTitle?: string }[])) {
        libraryItems.push(await saveLibrary({ title: item.title || item.articleTitle || "자동 카드뉴스", type: "CARD_NEWS", summary: item.subtitle || null, payload: { kind: "AUTOMATION_CARD_NEWS", item }, projectId: input.projectId, ownerId: input.ownerId }));
      }
      for (const image of imagePrompts) {
        libraryItems.push(await saveLibrary({ title: image.title, type: "IMAGE", summary: image.prompt, payload: { kind: "AUTOMATION_IMAGE_PROMPT", image }, projectId: input.projectId, ownerId: input.ownerId }));
      }
      if (amazonSeo) {
        libraryItems.push(await saveLibrary({ title: "Amazon SEO 자동화 결과", type: "AMAZON_SEO", summary: "AI Automation에서 생성된 Amazon SEO 결과", payload: { kind: "AUTOMATION_AMAZON_SEO", amazonSeo }, projectId: input.projectId, ownerId: input.ownerId }));
      }
      stepLog.push({ key: "library", label: labels.library, status: "완료", detail: `${libraryItems.length}개 Library 저장` });
    } else {
      stepLog.push({ key: "library", label: labels.library, status: "건너뜀", detail: "사용자가 비활성화" });
    }

    const result: AutomationRunResult = { runId, name, steps: stepLog, articles, summaries, cardNews, imagePrompts, amazonSeo, socialPosts, libraryItems };

    libraryItems.push(await saveLibrary({ title: name, type: "WORKFLOW", summary: `${stepLog.filter((s) => s.status === "완료").length}개 단계 완료`, payload: { kind: "AI_AUTOMATION_RUN", result }, projectId: input.projectId, ownerId: input.ownerId }));

    if (job?.id) {
      try {
        await prisma.queueJob.update({ where: { id: job.id }, data: { status: "COMPLETED", progress: 100, output: result as object } });
      } catch (dbError) {
        console.warn("DB_OFFLINE_AUTOMATION_JOB_UPDATE_SKIPPED", dbError);
      }
    }
    return { ...result, libraryItems };
  } catch (error) {
    if (job?.id) {
      try {
        await prisma.queueJob.update({ where: { id: job.id }, data: { status: "FAILED", error: error instanceof Error ? error.message : String(error), progress: 100 } });
      } catch (dbError) {
        console.warn("DB_OFFLINE_AUTOMATION_JOB_UPDATE_SKIPPED", dbError);
      }
    }
    throw error;
  }
}
