export type RssSource = {
  id: string;
  name: string;
  url: string;
  country: string;
  language: string;
  category: string;
  priority: number;
  enabled: boolean;
};

const baseSources: RssSource[] = [
  { id: "google-us-top", name: "Google News US Top", url: "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en", country: "US", language: "en", category: "Top", priority: 10, enabled: true },
  { id: "google-us-business", name: "Google News US Business", url: "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en", country: "US", language: "en", category: "Business", priority: 9, enabled: true },
  { id: "google-us-tech", name: "Google News US Technology", url: "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-US&gl=US&ceid=US:en", country: "US", language: "en", category: "Tech", priority: 9, enabled: true },
  { id: "google-kr-top", name: "Google News Korea Top", url: "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko", country: "KR", language: "ko", category: "Top", priority: 10, enabled: true },
  { id: "google-kr-business", name: "Google News Korea Business", url: "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ko&gl=KR&ceid=KR:ko", country: "KR", language: "ko", category: "Business", priority: 9, enabled: true },
  { id: "google-kr-entertainment", name: "Google News Korea Entertainment", url: "https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl=ko&gl=KR&ceid=KR:ko", country: "KR", language: "ko", category: "Entertainment", priority: 8, enabled: true },
  { id: "google-jp-top", name: "Google News Japan Top", url: "https://news.google.com/rss?hl=ja&gl=JP&ceid=JP:ja", country: "JP", language: "ja", category: "Top", priority: 10, enabled: true },
  { id: "google-in-top", name: "Google News India Top", url: "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en", country: "IN", language: "en", category: "Top", priority: 10, enabled: true },
  { id: "google-mx-top", name: "Google News Mexico Top", url: "https://news.google.com/rss?hl=es-419&gl=MX&ceid=MX:es-419", country: "MX", language: "es", category: "Top", priority: 10, enabled: true },
  { id: "google-br-top", name: "Google News Brazil Top", url: "https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419", country: "BR", language: "pt", category: "Top", priority: 10, enabled: true },
  { id: "google-gb-top", name: "Google News UK Top", url: "https://news.google.com/rss?hl=en-GB&gl=GB&ceid=GB:en", country: "GB", language: "en", category: "Top", priority: 9, enabled: true },
  { id: "bbc-world", name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", country: "GB", language: "en", category: "World", priority: 10, enabled: true },
  { id: "bbc-business", name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", country: "GB", language: "en", category: "Business", priority: 9, enabled: true },
  { id: "guardian-world", name: "The Guardian World", url: "https://www.theguardian.com/world/rss", country: "GB", language: "en", category: "World", priority: 8, enabled: true },
  { id: "nasa-breaking", name: "NASA Breaking News", url: "https://www.nasa.gov/news-release/feed/", country: "US", language: "en", category: "Science", priority: 8, enabled: true },
  { id: "techcrunch", name: "TechCrunch", url: "https://techcrunch.com/feed/", country: "US", language: "en", category: "Tech", priority: 8, enabled: true },
  { id: "wired", name: "WIRED", url: "https://www.wired.com/feed/rss", country: "US", language: "en", category: "Tech", priority: 7, enabled: true },
  { id: "korea-policy", name: "Korea.kr Policy", url: "https://www.korea.kr/rss/policy.xml", country: "KR", language: "ko", category: "Policy", priority: 8, enabled: true },
  { id: "korea-press", name: "Korea.kr Press", url: "https://www.korea.kr/rss/pressrelease.xml", country: "KR", language: "ko", category: "Policy", priority: 8, enabled: true },
];

const topics = ["Top", "World", "Business", "Tech", "Sports", "Entertainment", "Science", "Health"];
const googleLocales: Record<string, { hl: string; gl: string; ceid: string; language: string }> = {
  US: { hl: "en-US", gl: "US", ceid: "US:en", language: "en" },
  KR: { hl: "ko", gl: "KR", ceid: "KR:ko", language: "ko" },
  JP: { hl: "ja", gl: "JP", ceid: "JP:ja", language: "ja" },
  IN: { hl: "en-IN", gl: "IN", ceid: "IN:en", language: "en" },
  MX: { hl: "es-419", gl: "MX", ceid: "MX:es-419", language: "es" },
  BR: { hl: "pt-BR", gl: "BR", ceid: "BR:pt-419", language: "pt" },
  GB: { hl: "en-GB", gl: "GB", ceid: "GB:en", language: "en" },
  CA: { hl: "en-CA", gl: "CA", ceid: "CA:en", language: "en" },
  AU: { hl: "en-AU", gl: "AU", ceid: "AU:en", language: "en" },
  DE: { hl: "de", gl: "DE", ceid: "DE:de", language: "de" },
  FR: { hl: "fr", gl: "FR", ceid: "FR:fr", language: "fr" },
};

const topicPath: Record<string, string> = {
  Top: "",
  World: "/headlines/section/topic/WORLD",
  Business: "/headlines/section/topic/BUSINESS",
  Tech: "/headlines/section/topic/TECHNOLOGY",
  Sports: "/headlines/section/topic/SPORTS",
  Entertainment: "/headlines/section/topic/ENTERTAINMENT",
  Science: "/headlines/section/topic/SCIENCE",
  Health: "/headlines/section/topic/HEALTH",
};

const generatedGoogleSources = Object.entries(googleLocales).flatMap(([country, locale]) =>
  topics.map((category, index) => ({
    id: `google-${country.toLowerCase()}-${category.toLowerCase()}`,
    name: `Google News ${country} ${category}`,
    url: `https://news.google.com/rss${topicPath[category]}?hl=${locale.hl}&gl=${locale.gl}&ceid=${locale.ceid}`,
    country,
    language: locale.language,
    category,
    priority: 10 - Math.min(index, 5),
    enabled: true,
  }))
);

export const rssCatalog: RssSource[] = Array.from(new Map([...baseSources, ...generatedGoogleSources].map((source) => [source.id, source])).values());

export const rssCountries = ["ALL", ...Array.from(new Set(rssCatalog.map((source) => source.country))).sort()];
export const rssLanguages = ["ALL", ...Array.from(new Set(rssCatalog.map((source) => source.language))).sort()];
export const rssCategories = ["ALL", ...Array.from(new Set(rssCatalog.map((source) => source.category))).sort()];
