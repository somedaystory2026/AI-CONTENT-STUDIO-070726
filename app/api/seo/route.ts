import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  const { songTitle, genre, mood, keyword, openaiKey } = await req.json();

  if (!openaiKey) {
    return NextResponse.json({ error: "OpenAI API 키가 없습니다." }, { status: 400 });
  }
  if (!songTitle) {
    return NextResponse.json({ error: "곡 제목이 없습니다." }, { status: 400 });
  }

  const client = new OpenAI({ apiKey: openaiKey });

  const prompt = `
당신은 유튜브 음악 채널 SEO 전문가입니다.
다음 곡 정보를 바탕으로 6개 언어로 유튜브 업로드용 SEO 메타데이터(제목, 설명, 해시태그)를 작성해주세요.

곡 제목: ${songTitle}
장르/키워드: ${genre || keyword || ""}
분위기: ${mood || ""}

규칙:
- title: 클릭을 유도하는 매력적인 유튜브 제목 (이모지 1개 포함 가능, 60자 이내)
- description: 영상 설명 2~3문장
- hashtags: 5개, # 포함된 문자열 배열

다음 JSON 형식으로만 응답 (다른 텍스트나 마크다운 코드블록 없이):
{
  "ko": { "title": "", "description": "", "hashtags": [] },
  "en": { "title": "", "description": "", "hashtags": [] },
  "ja": { "title": "", "description": "", "hashtags": [] },
  "es": { "title": "", "description": "", "hashtags": [] },
  "zh": { "title": "", "description": "", "hashtags": [] },
  "pt": { "title": "", "description": "", "hashtags": [] }
}
`;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    });

    const raw = completion.choices[0].message.content || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "SEO 메타데이터 생성에 실패했습니다.";
    return NextResponse.json({ error: "SEO 메타데이터 생성에 실패했습니다.", detail: message }, { status: 500 });
  }
}
