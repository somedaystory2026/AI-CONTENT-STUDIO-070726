import OpenAI from "openai";

export type JsonObject = Record<string, unknown>;

export function extractJson(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first) return cleaned.slice(first, last + 1);
  return cleaned;
}

export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(extractJson(text)) as T;
  } catch {
    return fallback;
  }
}

export function requireOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY가 없습니다. .env.local 파일을 확인하세요.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function generateJsonWithResponses<T>({
  prompt,
  fallback,
  model = process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
  temperature = 0.7,
}: {
  prompt: string;
  fallback: T;
  model?: string;
  temperature?: number;
}): Promise<{ data: T; raw: string; usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } }> {
  const openai = requireOpenAI();

  try {
    const response = await openai.responses.create({
      model,
      temperature,
      input: [
        {
          role: "system",
          content: "You are the JSON-only generation engine for AI Content Studio. Return valid JSON only, no markdown.",
        },
        { role: "user", content: prompt },
      ],
      text: { format: { type: "json_object" } },
    });

    const raw = response.output_text || "{}";
    return {
      data: safeJsonParse<T>(raw, fallback),
      raw,
      usage: {
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
        totalTokens: response.usage?.total_tokens,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Responses API 호출 실패";
    if (!message.toLowerCase().includes("unsupported") && !message.toLowerCase().includes("unknown parameter")) throw error;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_FALLBACK_TEXT_MODEL || "gpt-4o-mini",
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return valid JSON only. No markdown." },
        { role: "user", content: prompt },
      ],
    });
    const raw = completion.choices[0]?.message?.content || "{}";
    return {
      data: safeJsonParse<T>(raw, fallback),
      raw,
      usage: {
        inputTokens: completion.usage?.prompt_tokens,
        outputTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens,
      },
    };
  }
}

export function localFallbackText(title: string) {
  return {
    title: title || "AI Content",
    summary: "OPENAI_API_KEY가 없을 때 표시되는 로컬 미리보기입니다. 실제 생성은 API 키 연결 후 실행됩니다.",
    mainContent: `# ${title || "AI Content"}\n\n핵심 내용을 정리하고, 채널별로 재사용할 수 있는 콘텐츠 초안을 생성합니다.`,
    cardNews: ["문제 제기", "핵심 배경", "중요 포인트", "실무 적용", "주의사항", "마무리 CTA"],
    twitter: `${(title || "AI Content").slice(0, 42)}
#AI #뉴스 #트렌드`,
    instagram: `${title || "AI Content"}\n\n핵심 내용을 카드뉴스와 SNS 문안으로 재구성했습니다.`,
    threads: `${title || "AI Content"}에 대해 자연스럽게 풀어쓴 Threads 초안입니다.`,
    hashtags: ["AIContent", "콘텐츠자동화", "SaaS"],
    seoTitle: title || "AI Content",
    metaDescription: "AI Content Studio 로컬 미리보기 결과입니다.",
    keywords: ["AI", "콘텐츠", "자동화"],
  };
}

export async function generateAIContent({
  prompt,
  system = "You are a helpful content automation assistant.",
  type = "general",
  model = process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
  temperature = 0.7,
}: {
  prompt: string;
  system?: string;
  type?: string;
  model?: string;
  temperature?: number;
}) {
  if (!process.env.OPENAI_API_KEY) {
    const fallback = localFallbackText(type);
    return {
      text: `${fallback.mainContent}\n\n${prompt.slice(0, 500)}`,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    };
  }

  const openai = requireOpenAI();
  const response = await openai.responses.create({
    model,
    temperature,
    input: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
  });

  return {
    text: response.output_text || "",
    usage: {
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      totalTokens: response.usage?.total_tokens,
    },
  };
}
