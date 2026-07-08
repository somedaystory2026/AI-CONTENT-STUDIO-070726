import { NextRequest, NextResponse } from "next/server";
import { generateAIContent } from "@/lib/ai-engine";

const fallback = (action: string, title: string, content: string, language: string) => {
  const text = content || title;
  if (action === "translate") return `[${language}] ${text}`;
  if (action === "rewrite") return `${title}\n\n핵심 내용을 더 자연스럽고 SNS 친화적인 문장으로 재구성했습니다.\n${text.slice(0, 700)}`;
  if (action === "compare") return `비교 포인트\n1. 핵심 이슈: ${title}\n2. 영향: 독자 관심도와 산업 변화 가능성\n3. 카드뉴스 전환성: 높음`;
  return `요약\n- ${title}\n- 주요 내용: ${text.slice(0, 240)}\n- 활용 추천: AI Generator 또는 Card News로 넘겨 콘텐츠화하세요.`;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action || "summary";
    const title = body.title || "Untitled news";
    const content = body.content || "";
    const language = body.language || "ko";

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ success: true, data: { output: fallback(action, title, content, language), provider: "fallback" } });
    }

    const prompt = `Action: ${action}\nLanguage: ${language}\nTitle: ${title}\nContent:\n${content}\n\nReturn concise, structured output for a content automation SaaS.`;
    const output = await generateAIContent({ prompt, system: "You are an expert news editor and social content strategist.", type: "news" });
    return NextResponse.json({ success: true, data: { output: output.text, usage: output.usage, provider: "openai" } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "News AI failed" }, { status: 500 });
  }
}
