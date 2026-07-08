const musicTools = [
  {
    title: "GPT 흥행 플리 생성기",
    desc: "YouTube 분석, 흥행 플레이리스트 생성, AI 가사 생성, SEO, 이미지 프롬프트, 일괄 내보내기를 한 화면에서 처리합니다.",
    href: "/playlist",
    tag: "Playlist Maker",
    note: "조회수/댓글 기반 분석 · 가사 · SEO · 썸네일 프롬프트",
    primaryLabel: "🚀 플리 생성기 실행",
  },
  {
    title: "다윗멜로디 AI Studio v6.2",
    desc: "찬양트로트, Suno Prompt Generator, Suno Trot Lyrics, 모바일 오프라인 트롯 기능을 통합한 메인 HTML 스튜디오입니다.",
    href: "/tools/david-melody-ai-studio-v6-2.html",
    tag: "Main Studio",
    note: "가사 · 장르 · BPM · 악기 · 보컬 · Suno 프롬프트 통합",
    primaryLabel: "🎼 v6.2 실행",
    blank: true,
  },
  {
    title: "GPT PARK · SU-Note 수노트",
    desc: "아티스트 변형, 댄스 스타일, 태그, 대형 프롬프트 데이터를 포함한 Suno 메모/프롬프트 보조 도구입니다.",
    href: "/tools/su-note/index.html",
    tag: "SU-Note",
    note: "Suno Note 데이터 · 스타일 · 태그 보조",
    primaryLabel: "📝 SU-Note 실행",
    blank: true,
  },
  {
    title: "일본 시니어 엔카 생성기",
    desc: "일본 시니어 타깃 엔카/가요 스타일 생성기입니다. 일본어 감성, 쇼와 감성, 엔카 스타일 제작 흐름을 지원합니다.",
    href: "/tools/japan-enka/index.html",
    tag: "Japan Enka",
    note: "일본 시니어 · 엔카 · 쇼와 감성 프롬프트",
    primaryLabel: "🎌 엔카 생성기 실행",
    blank: true,
  },
  {
    title: "Suno Bridge Extension",
    desc: "Chrome 우측 사이드패널 자동입력 브릿지입니다. ZIP 파일을 다운로드해서 개발자 모드로 로드할 수 있습니다.",
    href: "/downloads/suno-bridge-extension-v2.zip",
    tag: "Extension",
    note: "Suno v5.5 지원 · Style/Lyrics 복사 · 우측 사이드패널",
    primaryLabel: "📦 확장프로그램 다운로드",
    download: true,
  },
  {
    title: "통합 원본 ZIP v7",
    desc: "업로드한 david-melody-suno-studio-final-3tools-v7 전체 원본 다운로드 링크입니다.",
    href: "/downloads/david-melody-suno-studio-final-3tools-v7.zip",
    tag: "Backup",
    note: "원본 도구 보관용",
    primaryLabel: "📦 v7 ZIP 다운로드",
    download: true,
  },
];

export default function MusicPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-8 py-8 text-slate-950">
      <section className="mb-6 rounded-[28px] border border-slate-950 bg-white p-6 shadow-sm">
        <p className="text-sm font-black text-blue-600">Music AI Studio v4.3 통합 업데이트</p>
        <h1 className="mt-1 text-4xl font-black tracking-tight">Music AI Studio</h1>
        <p className="mt-2 text-sm text-slate-600">
          업로드한 다윗멜로디 Suno Studio v7 도구를 AI Content Studio 음악 AI 메뉴 안으로 통합했습니다.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
          <span className="rounded-full bg-blue-50 px-3 py-2 text-blue-700">가사 생성</span>
          <span className="rounded-full bg-purple-50 px-3 py-2 text-purple-700">Suno 프롬프트</span>
          <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">유튜브 SEO</span>
          <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-700">플레이리스트 분석</span>
          <span className="rounded-full bg-rose-50 px-3 py-2 text-rose-700">확장프로그램</span>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {musicTools.map((tool) => (
          <section key={tool.href} className="flex min-h-[260px] flex-col rounded-[24px] border border-slate-950 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
            <span className="mb-3 w-fit rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">{tool.tag}</span>
            <h2 className="text-xl font-black">{tool.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{tool.desc}</p>
            <p className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-xs font-bold leading-5 text-slate-700">{tool.note}</p>
            <a
              href={tool.href}
              target={tool.blank ? "_blank" : "_self"}
              download={tool.download}
              className="mt-auto rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-blue-600"
            >
              {tool.primaryLabel}
            </a>
          </section>
        ))}
      </div>

      <section className="mt-6 rounded-[24px] border border-slate-950 bg-white p-5">
        <h2 className="text-xl font-black">사용 순서</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          1) 흥행 플리 생성기에서 장르/키워드를 분석합니다. 2) 가사와 Suno 스타일 프롬프트를 생성합니다. 3) 유튜브 제목/설명/태그와 썸네일 프롬프트를 뽑습니다. 4) 필요하면 SU-Note나 엔카 생성기를 보조 도구로 열어 사용합니다.
        </p>
      </section>
    </div>
  );
}
