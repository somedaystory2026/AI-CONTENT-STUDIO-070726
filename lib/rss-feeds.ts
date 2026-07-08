import type { RssFeed } from "@/types/content";

const googleNews = (query: string, countryCode: string, language: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${language}&gl=${countryCode}&ceid=${countryCode}:${language.split("-")[0]}`;

export const rssFeeds: RssFeed[] = [
  { name: "Google News AI Korea", url: googleNews("AI OR 인공지능", "KR", "ko"), country: "한국", category: "AI" },
  { name: "Google News Korea Entertainment", url: googleNews("연예 OR KPOP OR 엔터테인먼트", "KR", "ko"), country: "한국", category: "연예" },
  { name: "Google News Korea Health", url: googleNews("건강 OR 의료 OR 헬스케어", "KR", "ko"), country: "한국", category: "건강" },
  { name: "Google News Korea Sports", url: googleNews("축구 OR 월드컵 OR 스포츠", "KR", "ko"), country: "한국", category: "스포츠" },
  { name: "Google News US AI", url: googleNews("AI OR OpenAI OR technology", "US", "en-US"), country: "미국", category: "AI" },
  { name: "Google News US Business", url: googleNews("business OR economy OR stocks", "US", "en-US"), country: "미국", category: "경제" },
  { name: "Google News Japan", url: googleNews("AI OR 経済 OR スポーツ", "JP", "ja"), country: "일본", category: "글로벌" },
  { name: "Google News India", url: googleNews("AI OR Bollywood OR cricket OR business", "IN", "en-IN"), country: "인도", category: "글로벌" },
  { name: "Google News Mexico", url: googleNews("IA OR economía OR fútbol OR noticias", "MX", "es-419"), country: "멕시코", category: "글로벌" },
  { name: "Google News World Cup Global", url: googleNews("World Cup OR FIFA OR football", "US", "en-US"), country: "글로벌", category: "스포츠" },
  { name: "Korea Policy", url: "https://www.korea.kr/rss/policy.xml", country: "한국", category: "정책" },
  { name: "Korea Press Release", url: "https://www.korea.kr/rss/pressrelease.xml", country: "한국", category: "보도자료" },
  { name: "Korea Fact Check", url: "https://www.korea.kr/rss/fact.xml", country: "한국", category: "팩트체크" },
];

export const countries = ["전체", ...Array.from(new Set(rssFeeds.map((feed) => feed.country)))] as const;
export const categories = ["전체", ...Array.from(new Set(rssFeeds.map((feed) => feed.category)))] as const;
