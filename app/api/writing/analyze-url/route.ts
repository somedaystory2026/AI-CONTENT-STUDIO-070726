import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { url } = await req.json();
  try {
    const res = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 AI Content Studio" } });
    const html = await res.text();
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || url;
    const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1] || html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i)?.[1] || "URL 본문 일부를 분석 자료로 추가했습니다.";
    return NextResponse.json({ success: true, title, summary: desc.slice(0, 1000), finalUrl: res.url });
  } catch {
    return NextResponse.json({ success: true, title: url, summary: "URL 접근이 제한되어 주소만 리서치 자료로 추가했습니다." });
  }
}
