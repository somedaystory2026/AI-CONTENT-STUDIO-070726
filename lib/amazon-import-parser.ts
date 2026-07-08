export type AmazonImportItem = {
  id: string;
  productUrl?: string;
  imageUrl?: string;
  affiliateUrl?: string;
  reviewUrl?: string;
  asin?: string;
  rawLines: string[];
  title?: string;
  brand?: string;
  rating?: string;
  reviewCount?: string;
  warning?: string;
  status: "ready" | "needs_product_url";
};

export function extractAsinFromText(text?: string) {
  if (!text) return "";
  const decoded = safeDecode(text);
  return (
    decoded.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)?.[1] ||
    decoded.match(/[?&]asin=([A-Z0-9]{10})/i)?.[1] ||
    decoded.match(/(?:^|[^A-Z0-9])([A-Z0-9]{10})(?:[^A-Z0-9]|$)/i)?.[1] ||
    ""
  ).toUpperCase();
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function cleanLine(line: string) {
  return line.trim().replace(/^[-•*\d.\s]+/, "").trim();
}

export function splitImportLines(input: string) {
  return String(input || "")
    .split(/[\n\r\t]+|(?=https?:\/\/)/g)
    .map(cleanLine)
    .filter(Boolean);
}

export function classifyAmazonUrl(line: string): "imageUrl" | "affiliateUrl" | "reviewUrl" | "productUrl" | "unknown" {
  const lower = line.toLowerCase();
  if (/^https?:\/\/m\.media-amazon\.com\/images\//i.test(line) || /\.(jpg|jpeg|png|webp)(\?|$)/i.test(line)) return "imageUrl";
  if (/^https?:\/\/(www\.)?amzn\.to\//i.test(line)) return "affiliateUrl";
  if (/customer-reviews|#customerreviews|#reviews|\/product-reviews\//i.test(lower)) return "reviewUrl";
  if (/amazon\./i.test(lower) && /(\/dp\/|\/gp\/product\/|asin=)/i.test(line)) return "productUrl";
  if (/amazon\./i.test(lower)) return "productUrl";
  return "unknown";
}

function createItem(lines: string[]): AmazonImportItem {
  const item: AmazonImportItem = { id: cryptoSafeId(), rawLines: lines, status: "needs_product_url" };
  for (const line of lines) {
    const type = classifyAmazonUrl(line);
    if (type !== "unknown" && !item[type]) item[type] = line;
    if (type === "productUrl") item.asin = extractAsinFromText(line) || item.asin;
    if (type === "reviewUrl") item.asin = extractAsinFromText(line) || item.asin;
  }
  item.asin = item.asin || extractAsinFromText(lines.join(" ")) || undefined;
  if (!item.productUrl && item.asin) item.productUrl = normalizeAmazonProductUrl(undefined, item.asin);
  if (!item.reviewUrl && item.asin) item.reviewUrl = `https://www.amazon.com/product-reviews/${item.asin}`;
  item.status = item.productUrl || item.asin || item.affiliateUrl ? "ready" : "needs_product_url";
  return item;
}

function cryptoSafeId() {
  return Math.random().toString(36).slice(2, 10);
}

export function parseAmazonImport(input: string): AmazonImportItem[] {
  const lines = splitImportLines(input);
  if (!lines.length) return [];
  const groups: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    const type = classifyAmazonUrl(line);
    const hasProduct = current.some((value) => classifyAmazonUrl(value) === "productUrl");
    const hasAffiliate = current.some((value) => classifyAmazonUrl(value) === "affiliateUrl");
    const hasImage = current.some((value) => classifyAmazonUrl(value) === "imageUrl");
    const sameAsin = extractAsinFromText(line) && extractAsinFromText(current.join(" ")) === extractAsinFromText(line);

    if (
      current.length > 0 &&
      ((type === "productUrl" && hasProduct && !sameAsin) ||
        (type === "affiliateUrl" && hasAffiliate && hasProduct) ||
        (type === "imageUrl" && hasImage && hasProduct))
    ) {
      groups.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) groups.push(current);

  return groups.map(createItem);
}

export function normalizeAmazonProductUrl(url?: string, asin?: string) {
  if (url) return url;
  if (asin) return `https://www.amazon.com/dp/${asin}`;
  return "";
}
