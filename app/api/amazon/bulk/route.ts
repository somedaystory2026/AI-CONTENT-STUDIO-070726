import { NextRequest, NextResponse } from "next/server";
import { normalizeAmazonProductUrl, parseAmazonImport } from "@/lib/amazon-import-parser";
import { buildAmazonReviewUrl, fetchAmazonProduct } from "@/lib/amazon-product-extractor";

type BulkRow = {
  index: number;
  productUrl: string;
  imageUrl?: string;
  affiliateUrl?: string;
  reviewUrl?: string;
  asin: string;
  title: string;
  bullets: string[];
  backendKeywords: string;
  status: "ready" | "needs_product_url";
  brand?: string;
  rating?: string;
  reviewCount?: string;
  warning?: string;
};

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const items = parseAmazonImport(String(body.input || body.urls || ""));
  const keyword = String(body.keyword || "").trim();
  const pastedHtml = String(body.html || "");

  const rows: BulkRow[] = await Promise.all(
    items.map(async (item, index) => {
      const product = pastedHtml
        ? (await import("@/lib/amazon-product-extractor")).extractAmazonProductFromHtml(pastedHtml, item.productUrl, item.affiliateUrl)
        : await fetchAmazonProduct(item.productUrl, item.affiliateUrl);
      const asin = item.asin || product.asin || "확인 필요";
      const productLabel = product.title || keyword || (asin !== "확인 필요" ? `Amazon 상품 ${asin}` : "Amazon 상품");
      const bullets = product.bullets?.length
        ? product.bullets.slice(0, 5)
        : [
            "고객이 바로 이해할 수 있는 핵심 장점 정리",
            "검색 키워드와 구매 의도를 반영한 상품 특징",
            "착용감·사용감·활용 상황 중심의 설명",
            "선물·데일리·시즌 수요를 고려한 구매 포인트",
            "사이즈·재질·주의사항 등 구매 전 확인 정보",
          ];

      return {
        index: index + 1,
        productUrl: item.productUrl || product.productUrl || normalizeAmazonProductUrl(undefined, asin),
        imageUrl: item.imageUrl || product.imageUrl,
        affiliateUrl: item.affiliateUrl,
        reviewUrl: item.reviewUrl || buildAmazonReviewUrl(asin !== "확인 필요" ? asin : undefined, item.affiliateUrl) || product.reviewUrl,
        asin,
        status: item.status,
        title: `${productLabel} | 구매 전환형 SEO 상품명`,
        bullets,
        backendKeywords: `${asin !== "확인 필요" ? asin : keyword || "amazon product"}, amazon seo, product listing, keyword optimized`,
        brand: product.brand,
        rating: product.rating,
        reviewCount: product.reviewCount,
        warning: product.warning,
      };
    }),
  );

  return NextResponse.json({
    success: true,
    data: rows,
    summary: {
      total: rows.length,
      ready: rows.filter((row) => row.status === "ready").length,
      failed: rows.filter((row) => row.status !== "ready").length,
      images: rows.filter((row) => row.imageUrl).length,
      affiliates: rows.filter((row) => row.affiliateUrl).length,
      reviews: rows.filter((row) => row.reviewUrl).length,
    },
  });
}
