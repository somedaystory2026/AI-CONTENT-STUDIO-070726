import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { runAutomation } from "@/lib/automation-engine";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().optional(),
  country: z.string().optional(),
  category: z.string().optional(),
  language: z.string().optional(),
  query: z.string().optional(),
  articleLimit: z.number().min(1).max(10).default(5),
  cardCount: z.number().min(3).max(12).default(6),
  tone: z.string().optional(),
  targetLanguage: z.enum(["ko", "en", "ko-en"]).default("ko"),
  productUrl: z.string().optional(),
  productName: z.string().optional(),
  projectId: z.string().nullable().optional(),
  steps: z.record(z.string(), z.boolean()).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    const body = schema.parse(await req.json());
    const result = await runAutomation({ ...body, ownerId: session?.user?.id || null });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("AI_AUTOMATION_RUN_ERROR", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "AI 자동화 실행 실패" }, { status: 500 });
  }
}
