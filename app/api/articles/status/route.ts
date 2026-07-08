import { NextResponse } from "next/server";
import { setArticleStatus } from "@/lib/article-status";
import type { ArticleStatus } from "@/types/content";

const allowed: ArticleStatus[] = ["collected", "generated", "carded", "imaged", "published"];

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { id?: string; status?: ArticleStatus };

    if (!body.id || !body.status || !allowed.includes(body.status)) {
      return NextResponse.json({ success: false, message: "잘못된 상태 요청입니다." }, { status: 400 });
    }

    setArticleStatus(body.id, body.status);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, message: "상태 저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}
