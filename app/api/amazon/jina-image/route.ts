import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ success: false, message: "이미지 프롬프트가 없습니다." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, message: "OPENAI_API_KEY가 .env.local에 없습니다." }, { status: 500 });
    }

    const client = new OpenAI({ apiKey });
    const result = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      quality: "high",
      n: 1,
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ success: false, message: "이미지 결과가 비어 있습니다." }, { status: 500 });
    }

    return NextResponse.json({ success: true, imageUrl: `data:image/png;base64,${b64}` });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "진아 이미지 생성 실패" }, { status: 500 });
  }
}
