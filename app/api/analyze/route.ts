import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
    const { video, openaiKey } = await req.json();

    if (!openaiKey) {
      return NextResponse.json({ error: "OpenAI API 키가 없습니다." }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: openaiKey });

    const prompt = `
다음 유튜브 플레이리스트 영상을 분석해서 흥행 성공 공식을 알려줘.

제목: ${video.title}
채널: ${video.channel}
조회수: ${Number(video.viewCount).toLocaleString()}회
댓글수: ${Number(video.commentCount).toLocaleString()}개
업로드일: ${video.publishedAt?.slice(0, 10)}

다음 항목을 JSON으로 응답해줘 (다른 텍스트 없이 JSON만):
{
  "successFormula": "한 줄 성공 공식 요약",
  "titleStrategy": "제목 전략 분석 (2-3문장)",
  "audienceTarget": "타겟 청중 분석",
  "contentStructure": "콘텐츠 구조/특징",
  "trendKeywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "recommendation": "신규 플리 제작시 추천사항 (3-4문장)",
  "score": 85
}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const raw = completion.choices[0].message.content || "";
    const clean = raw.replace(/```json|```/g, "").trim();

    try {
      const parsed = JSON.parse(clean);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ error: "GPT 응답 파싱 실패", raw }, { status: 500 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "분석 중 알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
