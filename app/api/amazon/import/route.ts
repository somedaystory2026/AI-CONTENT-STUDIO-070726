import { NextRequest, NextResponse } from "next/server";
import { parseAmazonImport } from "@/lib/amazon-import-parser";
import { buildAmazonReviewUrl, fetchAmazonProduct } from "@/lib/amazon-product-extractor";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const enrich = body.enrich !== false;
  const items = parseAmazonImport(String(body.input || ""));
  const pastedHtml = String(body.html || "");

  const data = enrich
    ? await Promise.all(
        items.map(async (item) => {
          const product = pastedHtml
            ? (await import("@/lib/amazon-product-extractor")).extractAmazonProductFromHtml(pastedHtml, item.productUrl, item.affiliateUrl)
            : await fetchAmazonProduct(item.productUrl, item.affiliateUrl);
          const asin = item.asin || product.asin;
          return {
            ...item,
            asin,
            productUrl: item.productUrl || product.productUrl,
            reviewUrl: item.reviewUrl || buildAmazonReviewUrl(asin, item.affiliateUrl) || product.reviewUrl,
            imageUrl: item.imageUrl || product.imageUrl,
            title: product.title,
            brand: product.brand,
            rating: product.rating,
            reviewCount: product.reviewCount,
            warning: product.warning,
          };
        }),
      )
    : items;

  return NextResponse.json({
    success: true,
    data,
    summary: {
      total: data.length,
      ready: data.filter((item) => item.status === "ready").length,
      needsReview: data.filter((item) => item.status !== "ready").length,
      withImage: data.filter((item) => item.imageUrl).length,
      withAffiliate: data.filter((item) => item.affiliateUrl).length,
      withReview: data.filter((item) => item.reviewUrl).length,
    },
  });
}
