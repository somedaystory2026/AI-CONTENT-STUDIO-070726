import { extractAsinFromText, normalizeAmazonProductUrl } from "@/lib/amazon-import-parser";

export type AmazonExtractedProduct = {
  asin?: string;
  productUrl?: string;
  reviewUrl?: string;
  imageUrl?: string;
  title?: string;
  brand?: string;
  rating?: string;
  reviewCount?: string;
  bullets?: string[];
  source: "url-only" | "html" | "fetch-failed";
  warning?: string;
};

export function buildAmazonReviewUrl(asin?: string, affiliateUrl?: string) {
  if (!asin) return "";
  const tag = extractAffiliateTag(affiliateUrl);
  const base = `https://www.amazon.com/product-reviews/${asin}`;
  return tag ? `${base}?tag=${encodeURIComponent(tag)}` : base;
}

export function extractAffiliateTag(url?: string) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("tag") || "";
  } catch {
    return url.match(/[?&]tag=([^&\s]+)/i)?.[1] || "";
  }
}

export function extractAmazonProductFromHtml(html: string, inputUrl?: string, affiliateUrl?: string): AmazonExtractedProduct {
  const asin = extractAsinFromText(html) || extractAsinFromText(inputUrl);
  const productUrl = normalizeAmazonProductUrl(inputUrl, asin);
  const imageUrl = extractMainImage(html);
  const title = cleanText(
    matchFirst(html, [
      /<span[^>]+id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i,
      /<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)/i,
      /<title>([\s\S]*?)<\/title>/i,
    ]),
  );
  const brand = cleanText(matchFirst(html, [/id=["']bylineInfo["'][^>]*>([\s\S]*?)<\/a>/i, /Brand Name\s*<[^>]+>\s*<td[^>]*>\s*([^<]+)/i]));
  const rating = cleanText(matchFirst(html, [/title=["']([0-9.]+ out of 5 stars)["']/i, /<span[^>]*class=["'][^"']*a-icon-alt[^"']*["'][^>]*>([0-9.]+ out of 5 stars)<\/span>/i]));
  const reviewCount = cleanText(matchFirst(html, [/id=["']acrCustomerReviewText["'][^>]*>([^<]+)/i, /([0-9,]+)\s+ratings/i]));
  const bullets = extractBullets(html);
  return { asin, productUrl, reviewUrl: buildAmazonReviewUrl(asin, affiliateUrl), imageUrl, title, brand, rating, reviewCount, bullets, source: "html" };
}

export async function fetchAmazonProduct(inputUrl?: string, affiliateUrl?: string): Promise<AmazonExtractedProduct> {
  const asin = extractAsinFromText(inputUrl) || extractAsinFromText(affiliateUrl);
  const productUrl = normalizeAmazonProductUrl(inputUrl, asin);
  const base: AmazonExtractedProduct = {
    asin: asin || undefined,
    productUrl: productUrl || undefined,
    reviewUrl: buildAmazonReviewUrl(asin, affiliateUrl) || undefined,
    source: "url-only",
  };

  if (!productUrl) return base;

  try {
    const response = await fetch(productUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9,ko;q=0.8",
      },
      cache: "no-store",
    });
    if (!response.ok) return { ...base, source: "fetch-failed", warning: `Amazon 페이지 읽기 실패: HTTP ${response.status}` };
    const html = await response.text();
    return { ...base, ...extractAmazonProductFromHtml(html, productUrl, affiliateUrl) };
  } catch (error) {
    return { ...base, source: "fetch-failed", warning: error instanceof Error ? error.message : "Amazon 페이지 읽기 실패" };
  }
}

function extractMainImage(html: string) {
  const colorImages = matchFirst(html, [/['\"]colorImages['\"]\s*:\s*\{\s*['\"]initial['\"]\s*:\s*(\[[\s\S]*?\])\s*\}/i]);
  if (colorImages) {
    const hiRes = matchFirst(colorImages, [/"hiRes"\s*:\s*"([^"]+)"/i]);
    if (hiRes) return unescapeJsonUrl(hiRes);
    const sy741 = matchFirst(colorImages, [/(https:\/\/m\.media-amazon\.com\/images\/I\/[^"\\]+_AC_SY741_[^"\\]+\.jpg)/i]);
    if (sy741) return unescapeJsonUrl(sy741);
  }
  const landing = matchFirst(html, [/id=["']landingImage["'][^>]+src=["']([^"']+)/i, /"large"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/i]);
  if (landing) return unescapeJsonUrl(landing);
  const anyImage = matchFirst(html, [/(https:\/\/m\.media-amazon\.com\/images\/I\/[^"'\\\s]+\.(?:jpg|png|webp))/i]);
  return anyImage ? unescapeJsonUrl(anyImage) : "";
}

function extractBullets(html: string) {
  const area = matchFirst(html, [/id=["']feature-bullets["'][\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i, /<h3[^>]*>\s*About this item\s*<\/h3>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i]);
  if (!area) return [];
  return Array.from(area.matchAll(/<li[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/li>/gi))
    .map((match) => cleanText(match[1]))
    .filter(Boolean)
    .slice(0, 8);
}

function matchFirst(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return "";
}

function cleanText(value?: string) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unescapeJsonUrl(value: string) {
  return value.replace(/\\\//g, "/").replace(/\\u0026/g, "&");
}
