import { NextResponse } from "next/server";

const JSON_ONLY_RULE = "반드시 순수 JSON 객체 하나만 출력하세요. 코드블록, 설명, 인사말 없이 JSON으로만 응답합니다.";

function buildSuggestPrompt(mode: string, formState: Record<string, any>) {
  if (mode === "general") {
    const { category = "전체", vibe = "트렌디" } = formState;
    return {
      system: `당신은 한국 숏폼 콘텐츠 트렌드 분석가입니다. ${JSON_ONLY_RULE}`,
      user: `카테고리 "${category}", 톤매너 "${vibe}"에 맞는 한국 숏폼 플랫폼용 바이럴 소재 아이디어 10개를 추천하세요. 각 아이디어는 제목, 2~3문장 설명, 추천 이유, 해시태그 3개로 구성하세요. JSON 스키마: {"items":[{"title":"string","body":"string","reason":"string","hashtags":["string","string","string"]}]}`,
    };
  }
  const { template = "숏드라마", characters = "" } = formState;
  return {
    system: `당신은 한국 숏드라마 기획 PD입니다. ${JSON_ONLY_RULE}`,
    user: `플롯 템플릿 "${template}"${characters ? `, 인물 구도 "${characters}"` : ""}에 맞는 숏드라마 소재 아이디어 6개를 추천하세요. 각 아이디어는 제목, 2~3문장 줄거리, 추천 이유, 해시태그 3개로 구성하세요. JSON 스키마: {"items":[{"title":"string","body":"string","reason":"string","hashtags":["string","string","string"]}]}`,
  };
}

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : cleaned);
}

async function callAnthropic({ system, user, auth }: { system: string; user: string; auth?: any }) {
  const apiKey = auth?.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic API 키가 없습니다. Viral Builder API Settings 또는 .env에 ANTHROPIC_API_KEY를 설정하세요.");
  const model = auth?.model || process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: 4000, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return (data.content || []).map((p: any) => p.text || "").join("\n");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { system, user } = buildSuggestPrompt(body.mode, body.formState || {});
    const text = await callAnthropic({ system, user, auth: body.auth });
    const data = parseJson(text);
    return NextResponse.json({ items: data.items || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "주제 추천 실패" }, { status: 500 });
  }
}
