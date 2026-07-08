import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      period: "local-demo",
      aiGenerations: 128,
      cardProjects: 34,
      amazonExports: 19,
      rssArticles: 842,
      estimatedTokens: 284500,
      estimatedCost: 3.72,
      storageItems: 213,
    },
  });
}
