import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateJsonWithResponses } from "@/lib/ai-engine";

export const runtime = "nodejs";

const schema = z.object({
  url: z.string().url().optional().or(z.literal("")),
  productName: z.string().optional(),
  productInfo: z.string().optional(),
  marketplace: z.string().default("US"),
  language: z.enum(["ko", "en", "ko-en", "ja", "es"]).default("ko"),
  projectId: z.string().optional().nullable(),
  saveToLibrary: z.boolean().default(true),
});

type AmazonSeoResult = {
  productName: string;
  seoTitle: string;
  bullets: string[];
  description: string;
  backendKeywords: string[];
  htmlDescription: string;
  csvRows: Record<string, string>[];
  productMeta?: { asin?: string; image?: string; url?: string };
};

function extractAsin(url?: string) {
  if (!url) return "";
  return url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)?.[1] || url.match(/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1] || "";
}

function fallback(name: string, url?: string): AmazonSeoResult {
  const asin = extractAsin(url);
  return {
    productName: name || asin || "Amazon Product",
    seoTitle: `${name || "Amazon Product"} - 구매 전환형 아마존 SEO 상품명`,
    bullets: ["고객이 바로 이해할 수 있는 핵심 장점", "실제 사용 상황을 반영한 상품 특징", "구매 신뢰를 높이는 품질 포인트", "선물·데일리·시즌 수요를 고려한 장점", "사이즈·재질·주의사항 등 구매 전 확인 정보"],
    description: "구매자의 검색 의도와 실제 사용 장면을 반영한 아마존 상품 설명입니다.",
    backendKeywords: ["amazon product", "gift", "daily use", "premium", "shopping"],
    htmlDescription: `<h2>${name || "Amazon Product"}</h2><p>구매 전환을 고려한 HTML 상세설명입니다.</p>`,
    csvRows: [{ sku: asin || "SKU-001", title: `${name || "Amazon Product"} - Optimized Amazon Listing Title`, bullet1: "Clear benefit-focused bullet point", description: "A polished Amazon product description." }],
    productMeta: { asin, url },
  };
}

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const session = await auth();
    const name = body.productName || extractAsin(body.url) || "Amazon Product";
    let data = fallback(name, body.url);
    let usage: unknown = null;
    let raw = "";

    if (process.env.OPENAI_API_KEY) {
      const prompt = `
Create Amazon SEO listing assets.
Marketplace: ${body.marketplace}
Language: ${body.language}
URL: ${body.url || "N/A"}
Product Name: ${name}
Product Info: ${body.productInfo || "N/A"}

Rules:
- Do not claim unsupported specs.
- Title should be conversion-focused and Amazon-safe.
- 5 bullet points.
- Backend keywords as array, no commas inside keywords.
- HTML description with h2, p, ul/li only.
- CSV rows array for export.
Return JSON only:
{"productName":"","seoTitle":"","bullets":[""],"description":"","backendKeywords":[""],"htmlDescription":"","csvRows":[{"sku":"","title":"","bullet1":"","bullet2":"","bullet3":"","bullet4":"","bullet5":"","description":"","backendKeywords":""}]}`.trim();
      const generated = await generateJsonWithResponses<Partial<AmazonSeoResult>>({ prompt, fallback: data, temperature: 0.55 });
      raw = generated.raw;
      usage = generated.usage;
      data = { ...data, ...generated.data, productMeta: { asin: extractAsin(body.url), url: body.url || undefined } };
    }

    let libraryItem = null;
    if (body.saveToLibrary) {
      try {
        libraryItem = await prisma.libraryItem.create({
          data: {
            title: data.seoTitle || data.productName,
            type: "AMAZON_SEO",
            status: "COMPLETED",
            summary: data.description,
            sourceUrl: body.url || null,
            projectId: body.projectId || null,
            ownerId: session?.user?.id || null,
            payload: { kind: "AMAZON_SEO_PROJECT", input: body, result: data, raw, usage },
          },
        });
      } catch (dbError) {
        console.warn("DB_OFFLINE_LIBRARY_SAVE_SKIPPED", dbError);
      }
    }

    return NextResponse.json({ success: true, data, productMeta: data.productMeta, libraryItem, usage, dbOffline: body.saveToLibrary && !libraryItem });
  } catch (error) {
    console.error("AMAZON_SEO_ERROR", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Amazon SEO 생성 실패" }, { status: 500 });
  }
}
