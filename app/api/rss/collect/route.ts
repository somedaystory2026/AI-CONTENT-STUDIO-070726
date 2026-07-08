import { NextResponse } from "next/server";
import { collectRssNews } from "@/lib/rss-collector";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const result = await collectRssNews({
    limit: Number(searchParams.get("limit") || 10),
    country: searchParams.get("country") || "전체",
    category: searchParams.get("category") || "전체",
    language: searchParams.get("language") || "전체",
    query: searchParams.get("q") || "",
  });

  return NextResponse.json({ success: true, ...result });
}
