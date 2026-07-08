import { NextResponse } from "next/server";
import { requireOpenAI, localFallbackText } from "@/lib/ai-engine";

export const runtime = "nodejs";

// Ratio -> a supported gpt-image-1 size. Smaller/square sizes render faster,
// so we don't default everything to the largest option.
const SIZE_BY_RATIO: Record<string, "1024x1024" | "1024x1536" | "1536x1024"> = {
  "1:1": "1024x1024",
  "4:5": "1024x1536",
  "9:16": "1024x1536",
  "16:9": "1536x1024",
  "5:4": "1536x1024",
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt: string = body.prompt || "";
    const headline: string = body.headline || "";
    const ratio: string = body.ratio || "1:1";
    // "fast" trades a little detail for noticeably quicker generation; this is
    // the default so a plain click on "이미지 생성" doesn't default to the
    // slowest, highest-cost setting.
    const speed: "fast" | "quality" = body.speed === "quality" ? "quality" : "fast";

    if (!prompt.trim()) {
      return NextResponse.json({ success: false, message: "이미지 프롬프트가 없습니다." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: true,
        imageUrl: "",
        message: localFallbackText(headline || prompt).summary,
        fallback: true,
      });
    }

    const client = requireOpenAI();
    const size = SIZE_BY_RATIO[ratio] || "1024x1024";
    const fullPrompt = headline ? `${prompt}\n\nHeadline text to feature prominently: "${headline}"` : prompt;

    const result = await client.images.generate({
      model: "gpt-image-1",
      prompt: fullPrompt,
      size,
      quality: speed === "fast" ? "medium" : "high",
      n: 1,
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ success: false, message: "이미지 생성에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ success: true, imageUrl: `data:image/png;base64,${b64}` });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "이미지 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
