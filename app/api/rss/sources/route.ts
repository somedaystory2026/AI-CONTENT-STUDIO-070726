import { NextRequest, NextResponse } from "next/server";
import { rssCatalog, rssCategories, rssCountries, rssLanguages } from "@/lib/rss-catalog";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const country = searchParams.get("country") || "ALL";
  const language = searchParams.get("language") || "ALL";
  const category = searchParams.get("category") || "ALL";
  const keyword = (searchParams.get("q") || "").toLowerCase();

  const sources = rssCatalog
    .filter((source) => country === "ALL" || source.country === country)
    .filter((source) => language === "ALL" || source.language === language)
    .filter((source) => category === "ALL" || source.category === category)
    .filter((source) => !keyword || `${source.name} ${source.url} ${source.country} ${source.category}`.toLowerCase().includes(keyword))
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));

  return NextResponse.json({ success: true, data: { sources, countries: rssCountries, languages: rssLanguages, categories: rssCategories, total: sources.length } });
}
