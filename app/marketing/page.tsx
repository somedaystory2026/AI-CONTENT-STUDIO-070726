"use client";

import { useMemo, useState } from "react";

const tools = [
  { category: "영상", name: "Cine Studio", desc: "대본 분석, 인물 바이블, 씬 분할, 스토리보드, Vrew/HTML/ZIP Export 개념", href: "/cine" },
  { category: "영상", name: "Shorts Studio", desc: "뉴스/상품/대본을 15·30·60초 쇼츠로 리믹스", href: "/shorts" },
  { category: "영상", name: "Viral Studio", desc: "일반 바이럴, 광고 바이럴, 숏드라마, JSON 스토리보드", href: "/viral" },
  { category: "영상", name: "Longform Studio", desc: "아이디어 → 대본 → 영상 에셋 → SEO → 블로그 5단계 파이프라인", href: "/longform" },
  { category: "영상", name: "Veo Studio", desc: "Veo3 여행 쇼츠, 카메라 무빙, AI별 프롬프트 변환", href: "/veo" },
  { category: "AI 글쓰기", name: "Writing Studio", desc: "SEO 블로그, 김블써식 작성, 웹상세 빌더", href: "/writing" },
  { category: "SNS", name: "X/Threads 생성", desc: "뉴스 기반 100자 내외 X 게시글 생성", href: "/news" },
  { category: "이미지", name: "Poster & Infographic", desc: "타이포그래피, 푸드 포스터, 패션 주석, 차트 리포트", href: "/image-studio" },
  { category: "리소스", name: "웰컴기프트 허브", desc: "무료 소스 150선, 블로그 글감, 구글링 팁, 워드프레스, 인스타 TIP 자료 통합", href: "/welcome" },
  { category: "Amazon", name: "Amazon SEO", desc: "제휴 리뷰 HTML, 가격/리뷰 분석, CTA 버튼", href: "/amazon" },
  { category: "업무", name: "Business Studio", desc: "임원 보고서, 우선순위, 문제 해결", href: "/business" },
  { category: "리포트", name: "AI Reports", desc: "성격/대화 패턴 인포그래픽 리포트", href: "/reports" },
  { category: "프롬프트", name: "Prompt OS", desc: "업로드한 프롬프트 모음 통합 검색/즐겨찾기", href: "/prompts" },
];

export default function MarketingHubPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("전체");
  const cats = ["전체", ...Array.from(new Set(tools.map(t => t.category)))];
  const filtered = useMemo(() => tools.filter(t => (cat === "전체" || t.category === cat) && `${t.category} ${t.name} ${t.desc}`.toLowerCase().includes(q.toLowerCase())), [q, cat]);
  return <main className="ml-[260px] min-h-screen bg-slate-50 p-8 text-slate-950">
    <div className="mb-6 rounded-[28px] border bg-white p-6 shadow-sm">
      <p className="text-sm font-black text-orange-600">v5.0 Marketing Hub</p>
      <h1 className="text-4xl font-black tracking-tight">마케팅 허브</h1>
      <p className="mt-2 text-slate-500">업로드한 CINEBREW/Shorts/Veo/Longform/Viral 기능을 중복 제거해서 연결한 개인용 콘텐츠 제작 허브입니다.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {cats.map(c => <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-4 py-2 text-sm font-black ${cat === c ? "bg-slate-950 text-white" : "bg-white"}`}>{c}</button>)}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="검색: SEO, 쇼츠, Amazon, 리포트..." className="mt-4 w-full rounded-2xl border px-4 py-3 font-bold outline-none focus:border-orange-500" />
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map(t => <a key={t.name} href={t.href} className="rounded-[24px] border bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-orange-400 hover:shadow-lg">
        <div className="mb-3 inline-block rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-600">{t.category}</div>
        <h2 className="text-xl font-black">{t.name}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{t.desc}</p>
      </a>)}
    </div>
  </main>;
}
