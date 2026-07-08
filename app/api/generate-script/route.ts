import { NextResponse } from "next/server";

const JSON_ONLY_RULE = "반드시 순수 JSON 객체 하나만 출력하세요. 코드블록, 설명, 인사말 없이 JSON으로만 응답합니다.";
const SCENE_SCHEMA = `{"project_metadata":{"title":"string","trend_tag":["string"],"category":"string","vibe":"string"},"episodes":[{"episode_number":1,"episode_title":"string","scenes":[{"order":1,"timing":"00:00-00:15","type":"Hook | Build-up | Twist | Climax | Punchline | CTA","speaker":"string","script":"string","visual_prompt":"string","audio":{"voice":"string","bgm":"string"}}]}]}`;

function buildScriptPrompt(mode: string, formState: Record<string, any>) {
  if (mode === "ad") {
    const { brandName = "", productName = "", usp = "", targetAudience = "", characterStyle = "", vibe = "" } = formState;
    return {
      system: `당신은 숏폼 광고 전문 카피라이터 겸 PD입니다. ${JSON_ONLY_RULE}`,
      user: `다음 조건으로 15초 내외 숏폼 광고 스토리보드를 기획하세요. 브랜드명:${brandName}, 제품명:${productName}, USP:${usp}, 타겟:${targetAudience}, AI 캐릭터 스타일:${characterStyle}, 분위기:${vibe}. 씬 개수는 4~6개, 훅→문제→제품→USP→CTA 구조. JSON 스키마: ${SCENE_SCHEMA}`,
    };
  }
  if (mode === "drama") {
    const { topic = "", template = "", characters = "", episodeLength = 1, conflictRatio = "", hookIntensity = "", creativity = 0.7 } = formState;
    return {
      system: `당신은 한국 숏드라마 전문 작가입니다. ${JSON_ONLY_RULE}`,
      user: `다음 조건으로 숏드라마 대본을 기획하세요. 소재:${topic || "자유 주제"}, 템플릿:${template}, 인물:${characters || "자유"}, 분량:${episodeLength}부작, 갈등비율:${conflictRatio}, 후킹:${hookIntensity}, 창의성:${creativity}. 각 에피소드는 4~6개 씬, 강한 클리프행어. JSON 스키마: ${SCENE_SCHEMA}`,
    };
  }
  const { topic = "", category = "", vibe = "", scriptStyle = "", twist = "", sceneCount = 5, pplEnabled, pplProductName = "", pplUsp = "" } = formState;
  return {
    system: `당신은 한국 숏폼 바이럴 영상의 시니어 작가입니다. ${JSON_ONLY_RULE}`,
    user: `다음 조건으로 1개 에피소드짜리 숏폼 영상 대본을 기획하세요. 소재:${topic || "자유 주제"}, 카테고리:${category}, 톤:${vibe}, 대본스타일:${scriptStyle}, 반전강도:${twist}, 씬 개수:${sceneCount}. ${pplEnabled ? `PPL 제품:${pplProductName}, 소구점:${pplUsp}` : "PPL 없음"}. JSON 스키마: ${SCENE_SCHEMA}`,
  };
}

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : cleaned);
}

async function callAnthropic({ system, user, auth, temperature }: { system: string; user: string; auth?: any; temperature?: number }) {
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
    body: JSON.stringify({ model, max_tokens: 8000, temperature: Math.min(1, Math.max(0, temperature ?? 0.8)), system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return (data.content || []).map((p: any) => p.text || "").join("\n");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const formState = body.formState || {};
    const { system, user } = buildScriptPrompt(body.mode, formState);
    const text = await callAnthropic({ system, user, auth: body.auth, temperature: formState.temperature ?? formState.creativity });
    const project = parseJson(text);
    return NextResponse.json({ project });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "대본 생성 실패" }, { status: 500 });
  }
}
