import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const apiKey = searchParams.get("apiKey") || "";
  const longOnly = searchParams.get("longOnly") === "true";

  if (!apiKey) {
    return NextResponse.json({ error: "YouTube API 키가 없습니다." }, { status: 400 });
  }

  const videoDuration = longOnly ? "&videoDuration=long" : "";

  const url =
    `https://www.googleapis.com/youtube/v3/search` +
    `?part=snippet&type=video&maxResults=10&order=viewCount` +
    `&q=${encodeURIComponent(query)}${videoDuration}&key=${apiKey}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    return NextResponse.json({ error: data.error.message }, { status: 400 });
  }

  const videoIds = data.items.map((item: any) => item.id.videoId).join(",");

  const statsUrl =
    `https://www.googleapis.com/youtube/v3/videos` +
    `?part=statistics,contentDetails&id=${videoIds}&key=${apiKey}`;

  const statsRes = await fetch(statsUrl);
  const statsData = await statsRes.json();

  const statsMap: Record<string, any> = {};
  statsData.items?.forEach((item: any) => {
    statsMap[item.id] = {
      viewCount: item.statistics?.viewCount || "0",
      commentCount: item.statistics?.commentCount || "0",
      duration: item.contentDetails?.duration || "",
    };
  });

  const results = data.items.map((item: any) => {
    const id = item.id.videoId;
    return {
      id,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.medium?.url || "",
      publishedAt: item.snippet.publishedAt,
      ...statsMap[id],
    };
  });

  return NextResponse.json({ results });
}
