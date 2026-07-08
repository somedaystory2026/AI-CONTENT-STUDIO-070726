import { NextResponse } from "next/server";
import OpenAI from "openai";

function fallbackDetail(productName: string, brand: string, category: string, prompt: string) {
  const name = productName || brand || "상품";
  return `<article class="product-detail-page">
<h1>${name} 상세페이지 기획안</h1>
<section><h2>1. 제품/시장 분석 요약</h2><p>${category} 카테고리 상품은 첫 화면에서 핵심 소구점과 사용 장면을 빠르게 전달하는 것이 중요합니다. 제품 정보가 구체적일수록 상세페이지 카피와 이미지 프롬프트의 품질이 좋아집니다.</p></section>
<section><h2>2. 핵심 소구점</h2><ol><li>첫 화면에서 제품명과 핵심 혜택 전달</li><li>타깃 고객의 문제 상황 공감</li><li>성분/스펙/소재 등 사실 정보 정리</li><li>사용 장면과 루틴 제안</li><li>구매 전 체크포인트 제공</li></ol></section>
<section><h2>3. 법적 리스크 체크</h2><ul><li>근거 없는 후기, 인증, 임상, 수치 생성 금지</li><li>이벤트가 없으면 할인/증정/특가 문구 금지</li><li>화장품/건기식/의료 관련 표현은 단정적 효능 표현 금지</li><li>마지막 섹션은 CTA로 구성</li></ul></section>
<section><h2>4. 상세페이지 섹션 카피</h2><h3>제품 히어로</h3><p>${name}, 일상에서 바로 체감할 수 있는 사용 가치를 첫 화면에서 전달하세요.</p><h3>고객 문제 공감</h3><p>고객이 느끼는 불편을 과장 없이 짚고, 제품이 어떤 상황에서 도움이 되는지 설명합니다.</p><h3>구매 CTA</h3><p>제품의 실제 특징과 사용 장면을 확인하고 나에게 맞는 옵션을 선택해보세요.</p></section>
<section><h2>5. 이미지 프롬프트</h2><pre>Vertical Korean ecommerce product detail page, clean premium layout, product hero composition, realistic product photography, soft natural lighting, no fake certification, no section number text, commercial shopping mall style</pre></section>
</article>\n\n<!-- 참고 프롬프트 -->\n<!-- ${prompt.slice(0, 500).replace(/--/g, "-")} -->`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = String(body.prompt || "");
    const productName = String(body.productName || "");
    const brand = String(body.brand || "");
    const category = String(body.category || "일반 상품");
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: true, text: fallbackDetail(productName, brand, category, prompt), warning: "OPENAI_API_KEY가 없어 템플릿 기반 상세페이지를 생성했습니다." });
    }

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "너는 한국 쇼핑몰 상세페이지, 광고법 리스크, 상세페이지 카피, 이미지 프롬프트에 강한 전문가다. 근거 없는 효능/후기/수치/인증을 만들지 않는다." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 5000,
    });

    return NextResponse.json({ success: true, text: completion.choices[0].message.content?.trim() || fallbackDetail(productName, brand, category, prompt) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "상세페이지 생성 실패" }, { status: 500 });
  }
}
