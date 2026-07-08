import { NextResponse } from "next/server";
import { requireOpenAI } from "@/lib/ai-engine";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = String(body.prompt || body.sourceText || body.title || "").trim();
    if (!input) return NextResponse.json({ success: false, message: "스트리밍할 입력이 없습니다." }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ success: false, message: "OPENAI_API_KEY가 없습니다." }, { status: 500 });

    const openai = requireOpenAI();
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await openai.responses.stream({
            model: process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
            input: `다음 입력을 ${body.language || "ko"}로 ${body.tone || "professional"} 톤의 완성형 콘텐츠로 작성해줘.\n\n${input}`,
          });
          for await (const event of response) {
            if (event.type === "response.output_text.delta") controller.enqueue(encoder.encode(event.delta));
          }
        } catch (error) {
          controller.enqueue(encoder.encode(`\n[STREAM_ERROR] ${error instanceof Error ? error.message : "stream failed"}`));
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "스트리밍 실패" }, { status: 500 });
  }
}
