import { getArticleStatus } from "@/lib/article-status";
import { rssFeeds } from "@/lib/rss-feeds";
import { cleanText, createId } from "@/lib/text";
import type { NewsItem } from "@/types/content";

export type RssCollectOptions = {
  limit?: number;
  country?: string;
  category?: string;
  language?: string;
  query?: string;
  maxFeeds?: number;
};

export type RssCollectResult = {
  data: NewsItem[];
  count: number;
  feedCount: number;
  errors: { feed: string; message: string; status?: number }[];
};

type ParsedItem = Pick<NewsItem, "title" | "link" | "pubDate" | "description"> & { originalLink?: string; isGoogleNewsFallback?: boolean };

function extractTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? cleanText(match[1]) : "";
}

function isGoogleOwnedUrl(url: string) {
  return /(^|\.)google\.|googleusercontent\.com|gstatic\.com|schema\.org|news\.google\.com/i.test(url);
}

function normalizeGoogleNewsUrl(url: string) {
  return url.replace(/&amp;/g, "&");
}

function extractHref(xml: string) {
  const hrefs = [...xml.matchAll(/href=["']([^"']+)["']/gi)].map((match) => normalizeGoogleNewsUrl(match[1] || ""));
  return hrefs.find((href) => href.startsWith("http") && !href.includes("news.google.com"));
}

function parseItems(xml: string, limit: number): ParsedItem[] {
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/g) || [];
  return itemBlocks.slice(0, limit).map((item) => {
    const link = normalizeGoogleNewsUrl(extractTag(item, "link"));
    const originalLink = extractHref(item);
    return {
      title: extractTag(item, "title"),
      link,
      originalLink,
      pubDate: extractTag(item, "pubDate"),
      description: extractTag(item, "description"),
    };
  });
}

function isAll(value?: string) {
  return !value || ["ALL", "전체"].includes(value);
}

export async function collectRssNews(options: RssCollectOptions = {}): Promise<RssCollectResult> {
  const limitPerFeed = Math.min(Number(options.limit || 10), 30);
  const query = (options.query || "").trim().toLowerCase();

  const selectedFeeds = rssFeeds
    .filter((feed) => {
      const countryMatched = isAll(options.country) || feed.country === options.country;
      const categoryMatched = isAll(options.category) || feed.category === options.category;
      const languageMatched = isAll(options.language) || feed.language === options.language;
      const queryMatched = !query || [feed.name, feed.url, feed.country, feed.category, feed.language].join(" ").toLowerCase().includes(query);
      return countryMatched && categoryMatched && languageMatched && queryMatched;
    })
    .slice(0, options.maxFeeds || 20);

  const errors: { feed: string; message: string; status?: number }[] = [];

  // Fetch every feed in parallel instead of one-by-one — this alone used to make
  // collection take (feed count) x (single fetch latency) seconds sequentially.
  const perFeedResults = await Promise.allSettled(
    selectedFeeds.map(async (feed) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(feed.url, {
          cache: "no-store",
          signal: controller.signal,
          headers: {
            "User-Agent": "AI-Content-Studio/3.0 Mozilla/5.0",
            Accept: "application/rss+xml, application/xml, text/xml",
          },
        });

        if (!res.ok) {
          errors.push({ feed: feed.name, status: res.status, message: res.statusText });
          return [] as NewsItem[];
        }

        const xml = await res.text();
        if (!xml.includes("<item")) {
          errors.push({ feed: feed.name, message: "RSS item이 없습니다." });
          return [] as NewsItem[];
        }

        const feedItems: NewsItem[] = [];
        for (const item of parseItems(xml, limitPerFeed)) {
          if (!item.title || !item.link) continue;
          const searchable = [item.title, item.description].join(" ").toLowerCase();
          if (query && !searchable.includes(query) && !feed.name.toLowerCase().includes(query)) continue;

          // Only use what we already have for free (the RSS <link> and any href already
          // present in the feed XML). We deliberately do NOT make a network call per
          // article here — resolving the real article URL (decoding Google News links)
          // is comparatively slow, and doing it for every item during bulk collection is
          // what made collection crawl. Unresolved links are flagged as a fallback and
          // get resolved on demand via the "원문 재시도" button / resolve endpoint.
          const originalLink = item.originalLink || item.link;
          const isGoogleNewsFallback = isGoogleOwnedUrl(originalLink);
          const uniqueKey = originalLink || item.link || item.title;
          const id = createId(uniqueKey);
          feedItems.push({
            id,
            ...item,
            link: originalLink,
            originalLink,
            isGoogleNewsFallback,
            source: feed.name,
            country: feed.country,
            category: feed.category,
            status: getArticleStatus(id),
          });
        }
        return feedItems;
      } catch (error) {
        errors.push({ feed: feed.name, message: error instanceof Error ? error.message : String(error) });
        return [] as NewsItem[];
      } finally {
        clearTimeout(timer);
      }
    })
  );

  const seen = new Set<string>();
  const results: NewsItem[] = [];
  for (const settled of perFeedResults) {
    if (settled.status !== "fulfilled") continue;
    for (const item of settled.value) {
      const uniqueKey = item.originalLink || item.link || item.title;
      if (seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);
      results.push(item);
    }
  }

  return { data: results, count: results.length, feedCount: selectedFeeds.length, errors };
}
