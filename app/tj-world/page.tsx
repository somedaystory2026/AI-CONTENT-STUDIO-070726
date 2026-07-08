const tjWorldPrograms = [
  {
    title: "대시보드",
    desc: "AI Content Studio 통합 대시보드. 모든 생성 콘텐츠와 진행 상황을 한눈에 관리합니다.",
    href: "/",
    tag: "Dashboard",
    note: "콘텐츠 관리 · 통계 · 자동화 현황",
    primaryLabel: "📊 대시보드 실행",
  },
  {
    title: "마케팅 허브",
    desc: "마케팅 자동화 도구 통합. 콘텐츠 전략부터 발행까지 한 곳에서 관리합니다.",
    href: "/marketing",
    tag: "Marketing",
    note: "전략 · 일정 · 채널 관리",
    primaryLabel: "🧰 마케팅 허브",
  },
  {
    title: "AI 인플루언서",
    desc: "AI 기반 인플루언서 시뮬레이터. 가상 인물을 생성하고 콘텐츠를 자동 작성합니다.",
    href: "/influencer",
    tag: "Influencer",
    note: "가상 인물 · 자동 콘텐츠 · 성격 분석",
    primaryLabel: "👩 인플루언서 생성",
  },
  {
    title: "Amazon SEO",
    desc: "Amazon 상품 최적화 및 SEO 도구. 키워드 분석, 상품 설명 자동 생성, 가격 최적화를 지원합니다.",
    href: "/amazon",
    tag: "E-Commerce",
    note: "키워드 분석 · 상품 설명 · 리뷰 분석",
    primaryLabel: "🛒 Amazon SEO",
  },
  {
    title: "음악 AI",
    desc: "음악 생성 및 플리 분석 도구. Suno 프롬프트 생성, 가사 작성, 유튜브 플레이리스트 분석을 제공합니다.",
    href: "/music",
    tag: "Music Studio",
    note: "플레이리스트 · 가사 · Suno 프롬프트",
    primaryLabel: "🎵 음악 스튜디오",
  },
  {
    title: "뉴스 AI",
    desc: "RSS 피드 기반 뉴스 수집 및 AI 요약. 글로벌 뉴스를 실시간으로 수집하고 자동 요약합니다.",
    href: "/news",
    tag: "News Generator",
    note: "RSS 수집 · AI 요약 · 카테고리 분류",
    primaryLabel: "📰 뉴스 수집",
  },
  {
    title: "글쓰기/웹상세",
    desc: "블로그 글쓰기 및 웹 상세페이지 작성. SEO 최적화된 장문 콘텐츠를 자동 생성합니다.",
    href: "/writing",
    tag: "Content Writing",
    note: "SEO 최적화 · 요약 · 구조화",
    primaryLabel: "✍️ 글쓰기 도구",
  },
  {
    title: "쇼츠 스튜디오",
    desc: "숏폼 동영상 생성 및 최적화. TikTok, Instagram Reels, YouTube Shorts 대상 콘텐츠 제작을 자동화합니다.",
    href: "/shorts",
    tag: "Short Video",
    note: "숏폼 생성 · 자동 편집 · 자막",
    primaryLabel: "⚡ 쇼츠 제작",
  },
  {
    title: "씨네브루",
    desc: "영화 및 시네마틱 콘텐츠 제작 도구. 고품질 영상 초안 생성 및 편집을 지원합니다.",
    href: "/cine",
    tag: "Cinematic",
    note: "시네마틱 편집 · 장면 구성 · 효과",
    primaryLabel: "🎞️ 씨네브루",
  },
  {
    title: "바이럴 스튜디오",
    desc: "바이럴 콘텐츠 최적화 도구. 트렌드 분석 및 바이럴 요소를 자동으로 적용합니다.",
    href: "/viral",
    tag: "Viral Content",
    note: "트렌드 분석 · 해시태그 · 썸네일",
    primaryLabel: "🔥 바이럴 제작",
  },
  {
    title: "롱폼 스튜디오",
    desc: "장편 동영상 제작 및 최적화. YouTube 롱폼 콘텐츠 생성 및 구성을 지원합니다.",
    href: "/longform",
    tag: "Long Form",
    note: "장편 구성 · 자동 편집 · SEO",
    primaryLabel: "📺 롱폼 제작",
  },
  {
    title: "Veo 스튜디오",
    desc: "Google Veo AI 동영상 생성 통합. 프롬프트 기반 고품질 영상 자동 생성을 제공합니다.",
    href: "/veo",
    tag: "AI Video",
    note: "Veo 프롬프트 · 영상 생성 · 품질 조정",
    primaryLabel: "🎥 Veo 생성",
  },
  {
    title: "영상 프롬프트 빌더",
    desc: "AI 동영상 생성용 프롬프트 작성 도구. Runway, Sora, Veo 등 다양한 플랫폼 대응 프롬프트를 생성합니다.",
    href: "/video-prompt-builder",
    tag: "Prompt Builder",
    note: "프롬프트 최적화 · 다중 플랫폼",
    primaryLabel: "🧩 프롬프트 작성",
  },
];

export default function TJWorldPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-8 py-8 text-slate-950">
      <section className="mb-6 rounded-[28px] border border-slate-950 bg-white p-6 shadow-sm">
        <p className="text-sm font-black text-purple-600">AI CONTENT STUDIO ARCHIVE</p>
        <h1 className="mt-1 text-4xl font-black tracking-tight">TJ-월드</h1>
        <p className="mt-2 text-sm text-slate-600">
          온 세상의 정보들 여기에 모아둔다. 내가 만든 프로그램, 저장해둘 자료, AI 제작 도구, 게임 유틸리티를 한 곳에서 보기 좋게 정리하는 개인 아카이브입니다.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
          <span className="rounded-full bg-purple-50 px-3 py-2 text-purple-700">포트폴리오</span>
          <span className="rounded-full bg-blue-50 px-3 py-2 text-blue-700">자동화</span>
          <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">AI 도구</span>
          <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-700">게임 유틸</span>
          <span className="rounded-full bg-rose-50 px-3 py-2 text-rose-700">아카이브</span>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {tjWorldPrograms.map((program) => (
          <section key={program.href} className="flex min-h-[260px] flex-col rounded-[24px] border border-slate-950 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
            <span className="mb-3 w-fit rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">{program.tag}</span>
            <h2 className="text-xl font-black">{program.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{program.desc}</p>
            <p className="mt-auto pt-4 text-xs text-slate-500">💡 {program.note}</p>
            <a
              href={program.href}
              target={program.blank ? "_blank" : undefined}
              rel={program.blank ? "noopener noreferrer" : undefined}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-[16px] bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800 active:scale-[0.98]"
            >
              {program.primaryLabel}
            </a>
          </section>
        ))}
      </div>
    </div>
  );
}
