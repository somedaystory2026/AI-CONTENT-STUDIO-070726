import { NextResponse } from "next/server";
import OpenAI from "openai";

function fallbackScenes(topic: string, style: string) {
  const labels = style === "쇼핑쇼츠" ? ["훅", "문제 제기", "상품 등장", "사용 장면", "소구점 강화", "CTA"] : ["훅", "공감", "핵심 1", "핵심 2", "반전", "CTA"];
  return labels.map((label, index) => ({
    scene: index + 1,
    time: index === 0 ? "0-3s" : `${index * 8}-${index * 8 + 8}s`,
    visual: `${topic} — ${label} 장면`,
    narration: `${topic}에 대한 ${label} 내레이션`,
    caption: `${label}`,
    imagePrompt: `Vertical 9:16 cinematic scene about ${topic}, ${label}, clean social media composition, no text`,
    videoPrompt: `Camera moves slowly through a realistic vertical video scene about ${topic}, ${label}, natural motion, 4K`,
    negativePrompt: "blurry, low quality, watermark, distorted face, unreadable text",
  }));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const topic = String(body.topic || body.title || "").trim();
    const style = String(body.style || "쇼츠");
    const platform = String(body.platform || "YouTube Shorts");
    const duration = String(body.duration || "60초");
    const tone = String(body.tone || "정보형, 빠른 템포");
    const originalUrl = String(body.originalUrl || "");
    const category = String(body.category || "일반");

    if (!topic) return NextResponse.json({ success: false, message: "영상 주제를 입력하세요." }, { status: 400 });

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ success: true, data: { title: topic, platform, duration, tone, style, hook: `${topic}, 이 장면에서 바로 멈추게 만듭니다.`, description: `${style} 형식의 영상 기획안`, scenes: fallbackScenes(topic, style), hashtags: ["AI영상", "쇼츠", category], fallback: true } });
    }

    const prompt = `너는 AI Content Studio의 Video Scenario Master다. 아래 조건으로 JSON만 반환해라.\n\n주제: ${topic}\n스타일: ${style}\n플랫폼: ${platform}\n길이: ${duration}\n톤: ${tone}\n상품/카테고리: ${category}\n원본 영상 URL(쇼핑쇼츠 참고용): ${originalUrl || "없음"}\n\n규칙:\n- 쇼츠는 첫 0~3초에 질문형/충격형/공감형/숫자형 훅을 넣는다.\n- 쇼핑쇼츠는 원본 영상 픽셀/음원/자막을 재사용하지 말고 구조와 소구점만 참고한다.\n- 각 씬마다 imagePrompt와 videoPrompt를 영어로 작성한다.\n- Runway/Kling/Veo에 바로 붙여넣을 수 있게 shot type, camera movement, background, lighting, mood를 포함한다.\n- negativePrompt도 포함한다.\n\n반환 JSON:\n{\n  "title":"영상 제목",\n  "hook":"첫 3초 후킹 문장",\n  "description":"영상 설명",\n  "platform":"${platform}",\n  "duration":"${duration}",\n  "tone":"${tone}",\n  "style":"${style}",\n  "scenes":[{"scene":1,"time":"0-3s","visual":"화면 설명","narration":"내레이션","caption":"자막","imagePrompt":"영문 이미지 프롬프트","videoPrompt":"영문 영상 프롬프트","negativePrompt":"영문 네거티브","changes":"쇼핑쇼츠일 때 원본 대비 변경점"}],\n  "hashtags":["태그1","태그2"]\n}`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: "JSON만 반환하는 영상 시나리오/프롬프트 생성 엔진이다." },
        { role: "user", content: prompt },
      ],
    });
    const content = (completion.choices[0]?.message?.content || "{}").trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
    const data = JSON.parse(content);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "영상 기획 생성 실패" }, { status: 500 });
  }
}
