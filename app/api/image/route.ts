import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  const { prompt, openaiKey } = await req.json();

  if (!openaiKey) {
    return NextResponse.json({ error: "OpenAI API 키가 없습니다." }, { status: 400 });
  }
  if (!prompt) {
    return NextResponse.json({ error: "이미지 프롬프트가 없습니다." }, { status: 400 });
  }

  const client = new OpenAI({ apiKey: openaiKey });

  try {
    const result = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1536x1024",
      quality: "high",
      n: 1,
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ error: "이미지 생성에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ image: `data:image/png;base64,${b64}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "이미지 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
