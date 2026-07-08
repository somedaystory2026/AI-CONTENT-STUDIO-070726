const tools = [
  {
    title: "다윗멜로디 AI Studio v6.2",
    desc: "찬양트로트 v5, Suno Prompt Generator, Suno Trot Lyrics, 모바일 오프라인 트롯 기능을 v6.2 중심으로 편입한 메인 HTML 스튜디오입니다.",
    href: "/tools/david-melody-ai-studio-v6-2.html",
    tag: "Main Studio",
    note: "가사 · 장르 · BPM · 악기 · 보컬 · Suno 프롬프트 통합",
    primaryLabel: "🎼 v6.2 실행하기",
    secondaryLabel: "📄 HTML 파일 다운로드",
    secondaryHref: "/tools/david-melody-ai-studio-v6-2.html",
    download: true,
  },
  {
    title: "GPT 흥행 플리 생성기",
    desc: "Next.js 메인 화면입니다. YouTube 분석, 흥행 플레이리스트 생성, AI 가사 생성, SEO, 이미지 프롬프트, 일괄 내보내기를 담당합니다.",
    href: "/playlist",
    tag: "Playlist Maker",
    note: "중복 생성기는 제거하고 메인 앱으로 통합",
    primaryLabel: "🚀 GPT 플리 실행하기",
    secondaryLabel: "📦 최신 전체 프로젝트 ZIP v7",
    secondaryHref: "/downloads/david-melody-suno-studio-final-3tools-v7.zip",
    download: true,
  },

  {
    title: "포시즌 떡상채널 파인더",
    desc: "추가도구 폴더에 있던 채널 떡상 분석 HTML을 메인 도구 화면에 편입했습니다. 채널 아이디어, 벤치마킹, 급상승 소재 찾기에 사용합니다.",
    href: "/tools/channel-rise-finder.html",
    tag: "Channel Growth",
    note: "채널 분석 · 떡상 소재 · 벤치마킹 · 유튜브 성장 아이디어",
    primaryLabel: "🚀 떡상채널 파인더 실행",
    secondaryLabel: "📄 HTML 파일 다운로드",
    secondaryHref: "/tools/channel-rise-finder.html",
    download: true,
  },
  {
    title: "황금 키워드 앱",
    desc: "추가도구 폴더의 황금 키워드 프로토타입을 통합했습니다. 제목, 태그, 콘텐츠 주제 선정에 쓸 키워드 후보를 빠르게 정리합니다.",
    href: "/tools/golden-keywords.html",
    tag: "Keyword SEO",
    note: "황금 키워드 · SEO 태그 · 제목 후보 · 콘텐츠 기획",
    primaryLabel: "🔑 황금 키워드 실행",
    secondaryLabel: "📄 HTML 파일 다운로드",
    secondaryHref: "/tools/golden-keywords.html",
    download: true,
  },
  {
    title: "GPT PARK · SU-Note 수노트",
    desc: "Suno-Note 원본 도구입니다. 아티스트 변형, 댄스 스타일, 태그, 대형 프롬프트 데이터를 포함한 수노 메모/프롬프트 보조 도구입니다.",
    href: "/tools/su-note/index.html",
    tag: "SU-Note",
    note: "Suno Note 데이터 · 스타일 · 태그 보조 기능 추가",
    primaryLabel: "📝 SU-Note 실행하기",
    secondaryLabel: "📦 SU-Note ZIP 다운로드",
    secondaryHref: "/downloads/gpt-park-su-note.zip",
    download: true,
  },
  {
    title: "수노 일본 시니어 엔카 생성기",
    desc: "일본 시니어 타깃 엔카/가요 스타일 생성기입니다. 일본어 감성, 엔카 스타일, 가사/프롬프트 제작 흐름을 추가했습니다.",
    href: "/tools/japan-enka/index.html",
    tag: "Japan Enka",
    note: "일본 시니어 · 엔카 · 쇼와 감성 프롬프트 생성",
    primaryLabel: "🎌 엔카 생성기 실행하기",
    secondaryLabel: "📦 엔카 생성기 ZIP 다운로드",
    secondaryHref: "/downloads/suno-japan-senior-enka-generator.zip",
    download: true,
  },
];

export default function ToolsPage() {
  return (
    <main className="min-h-screen bg-[#080914] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-3xl border border-violet-500/30 bg-violet-950/20 p-6 shadow-2xl">
          <p className="mb-2 text-sm font-bold text-violet-300">Final Merged Tools v7</p>
          <h1 className="text-3xl font-black">다윗멜로디 Suno Studio Unified</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
            기존 3개 핵심 도구에 GPT PARK · SU-Note, 일본 시니어 엔카 생성기, 떡상채널 파인더, 황금 키워드 앱을 추가했습니다.
            각 도구는 바로 실행할 수 있고, 원본 ZIP도 카드에서 바로 다운로드할 수 있습니다.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="/playlist" className="inline-block rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold transition hover:-translate-y-1 hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-500/30">
              ← GPT 흥행 플리 생성기로 이동
            </a>
            <a href="/downloads/david-melody-suno-studio-final-3tools-v7.zip" download className="inline-block rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-100 transition hover:-translate-y-1 hover:bg-emerald-500/20">
              📦 최신 전체 프로젝트 ZIP 다운로드 (v7)
            </a>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {tools.map((tool) => (
            <section
              key={tool.href}
              className="group flex min-h-[282px] flex-col rounded-2xl border border-slate-800 bg-slate-950/70 p-5 transition duration-300 hover:-translate-y-1 hover:border-violet-500/70 hover:bg-slate-900 hover:shadow-2xl hover:shadow-violet-500/10"
            >
              <span className="mb-3 inline-block w-fit rounded-full bg-violet-500/15 px-3 py-1 text-xs font-bold text-violet-300">{tool.tag}</span>
              <h2 className="text-lg font-extrabold">{tool.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{tool.desc}</p>
              <p className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-200">{tool.note}</p>
              <div className="mt-auto grid gap-2 pt-5">
                <a
                  href={tool.href}
                  target={tool.href.startsWith("/tools/") ? "_blank" : "_self"}
                  className="relative rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-center text-sm font-black text-white transition duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-violet-500/30 before:pointer-events-none before:absolute before:-top-10 before:left-1/2 before:hidden before:-translate-x-1/2 before:whitespace-nowrap before:rounded-lg before:bg-black/80 before:px-3 before:py-1 before:text-xs before:text-white before:content-['바로_실행'] hover:before:block"
                >
                  {tool.primaryLabel}
                </a>
                <a
                  href={tool.secondaryHref}
                  download={tool.download}
                  className="relative rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm font-bold text-emerald-100 transition duration-300 hover:-translate-y-1 hover:bg-emerald-500/20 before:pointer-events-none before:absolute before:-top-10 before:left-1/2 before:hidden before:-translate-x-1/2 before:whitespace-nowrap before:rounded-lg before:bg-black/80 before:px-3 before:py-1 before:text-xs before:text-white before:content-['다운로드'] hover:before:block"
                >
                  {tool.secondaryLabel}
                </a>
              </div>
            </section>
          ))}

          <section className="group rounded-2xl border border-violet-500/50 bg-slate-950/70 p-5 transition duration-300 hover:-translate-y-1 hover:border-amber-400/80 hover:bg-slate-900 hover:shadow-2xl hover:shadow-amber-500/10">
            <span className="mb-3 inline-block rounded-full bg-violet-500/15 px-3 py-1 text-xs font-bold text-violet-300">Extension v2.0</span>
            <h2 className="text-lg font-extrabold">Suno Bridge Extension</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Chrome 우측 사이드패널 자동입력 브릿지입니다. ZIP 파일을 바로 다운로드해서 개발자 모드로 로드할 수 있습니다.
            </p>
            <p className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-200">
              Suno v5.5 지원 · Style/Lyrics 복사 · 우측 사이드패널 전용
            </p>
            <div className="mt-4 grid gap-2">
              <a
                href="/downloads/suno-bridge-extension-v2.zip"
                download
                title="확장프로그램 ZIP 파일 다운로드"
                className="relative rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 px-4 py-3 text-center text-sm font-black text-white transition duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-fuchsia-500/30 before:pointer-events-none before:absolute before:-top-10 before:left-1/2 before:hidden before:-translate-x-1/2 before:whitespace-nowrap before:rounded-lg before:bg-black/80 before:px-3 before:py-1 before:text-xs before:text-white before:content-['ZIP_다운로드'] hover:before:block"
              >
                📦 확장프로그램 ZIP 다운로드
              </a>
              <a
                href="#extension-guide"
                title="설치 방법 보기"
                className="relative rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm font-bold text-amber-100 transition duration-300 hover:-translate-y-1 hover:bg-amber-500/20 before:pointer-events-none before:absolute before:-top-10 before:left-1/2 before:hidden before:-translate-x-1/2 before:whitespace-nowrap before:rounded-lg before:bg-black/80 before:px-3 before:py-1 before:text-xs before:text-white before:content-['설치_방법'] hover:before:block"
              >
                📖 설치 방법 보기
              </a>
            </div>
          </section>
        </div>

        <div id="extension-guide" className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm leading-7 text-amber-100">
          <p className="font-bold text-white">Suno Bridge Extension 사용법</p>
          <p>1. 위 카드에서 <b>📦 확장프로그램 ZIP 다운로드</b>를 누릅니다.</p>
          <p>2. ZIP 압축을 풉니다.</p>
          <p>3. Chrome 주소창에 <b>chrome://extensions</b> 입력 → 개발자 모드 ON → <b>압축해제된 확장 프로그램 로드</b> 클릭.</p>
          <p>4. 압축을 푼 폴더를 선택하면 브라우저 우측 상단 아이콘에서 <b>David Melody Suno Bridge</b>를 사이드패널로 열 수 있습니다.</p>
          <p>이번 수정에서 Suno v5.5의 최신 가사 요소 <b>div.lyrics-editor-content[contenteditable=true][role=textbox]</b>를 직접 찾도록 반영했습니다.</p>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/60 p-5 text-sm leading-7 text-slate-300">
          <p className="font-bold text-white">정리된 편입 구조</p>
          <p>찬양트로트 v5 / Suno Prompt Generator / Suno Trot Lyrics / Mobile Offline 기능 → 다윗멜로디 AI Studio v6.2 쪽으로 편입</p>
          <p>플레이리스트 생성 / YouTube 분석 / SEO / 이미지 프롬프트 / 일괄 결과 생성 → GPT 흥행 플리 생성기 쪽으로 편입</p>
          <p>SU-Note / 일본 시니어 엔카 / 떡상채널 파인더 / 황금 키워드 앱 → 별도 실행 카드 + HTML 다운로드로 추가</p>
          <p>브라우저 자동 입력/사이드패널 기능 → Suno Bridge Extension 유지</p>
        </div>
      </div>
    </main>
  );
}
