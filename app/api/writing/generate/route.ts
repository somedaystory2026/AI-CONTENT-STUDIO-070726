import { NextResponse } from "next/server";
import OpenAI from "openai";

function fallbackPost(prompt: string, topic: string, mainKeyword: string) {
  const title = topic || mainKeyword || "블로그 글";
  return `<article class="wp-modern-post">
<meta name="description" content="${title}에 대한 네이버 SEO 최적화 블로그 글" />
<h1>${title}</h1>
<nav class="wp-toc"><strong>목차</strong><ol><li><a href="#intro">서론</a></li><li><a href="#summary">핵심 요약</a></li><li><a href="#body1">본문</a></li><li><a href="#checklist">체크리스트</a></li><li><a href="#faq">FAQ</a></li><li><a href="#conclusion">결론</a></li></ol></nav>
<section id="intro"><h2>서론</h2><p>${title}는 지금 블로그 콘텐츠에서 검색 의도와 체류 시간을 동시에 잡기 좋은 주제입니다. 이 글은 초보자도 이해할 수 있도록 핵심만 정리합니다.</p></section>
<section id="summary"><h2>핵심 요약</h2><ul><li>검색자는 빠른 답과 구체적인 사례를 원합니다.</li><li>메인 키워드는 자연스럽게 배치해야 합니다.</li><li>FAQ와 체크리스트는 AI 검색과 네이버 체류 시간에 도움이 됩니다.</li></ul></section>
<section id="body1"><h2>${mainKeyword || title}를 이해하는 핵심</h2><p>좋은 글은 키워드 반복보다 독자가 실제로 궁금해하는 순서대로 정보를 배치하는 것이 중요합니다. 먼저 결론을 제시하고, 그다음 이유와 예시를 보여주는 구조가 효과적입니다.</p><h3>실전 적용 방법</h3><p>첫 문단에는 문제 상황, 두 번째 문단에는 해결 방향, 세 번째 문단에는 독자가 바로 따라 할 수 있는 행동을 넣으세요.</p></section>
<section id="checklist"><h2>체크리스트</h2><ul><li>제목에 메인 키워드가 들어갔는가?</li><li>첫 3줄 안에 핵심 답이 있는가?</li><li>본문에 실제 예시가 있는가?</li><li>마지막에 다음 행동이 있는가?</li></ul></section>
<section id="faq"><h2>FAQ</h2><h3>Q. 글자 수는 어느 정도가 좋나요?</h3><p>A. 주제에 따라 다르지만 정보형 글은 1500~3000자 사이가 무난합니다.</p><h3>Q. 키워드는 몇 번 넣어야 하나요?</h3><p>A. 억지 반복보다 제목, 첫 문단, 소제목, 결론에 자연스럽게 넣는 것이 좋습니다.</p></section>
<section id="conclusion"><h2>결론</h2><p>${title} 글은 검색 의도, 구체적인 사례, 읽기 쉬운 구조가 핵심입니다. 위 체크리스트를 기준으로 보완하면 블로그 품질을 빠르게 높일 수 있습니다.</p></section>
</article>\n\n<!-- 생성 프롬프트 참고 -->\n<!-- ${prompt.slice(0, 600).replace(/--/g, "-")} -->`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = String(body.prompt || "");
    const topic = String(body.topic || "");
    const mainKeyword = String(body.mainKeyword || "");
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: true, text: fallbackPost(prompt, topic, mainKeyword), warning: "OPENAI_API_KEY가 없어 템플릿 기반 글을 생성했습니다." });
    }

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "너는 네이버 SEO, AEO, 워드프레스 HTML 구조에 강한 한국어 블로그 전문 작가다. 사용자의 지시를 따라 HTML 형식으로만 작성한다." },
        { role: "user", content: prompt },
      ],
      temperature: 0.75,
      max_tokens: 4500,
    });

    return NextResponse.json({ success: true, text: completion.choices[0].message.content?.trim() || fallbackPost(prompt, topic, mainKeyword) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "글 생성 실패" }, { status: 500 });
  }
}
