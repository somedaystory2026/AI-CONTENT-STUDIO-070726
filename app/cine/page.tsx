const cineTools = [
  {
    title: "AI 씨네브루 원본 실행",
    desc: "업로드한 AI-CENEBREW-main을 다시 빌드해서 Music AI처럼 원본 화면을 그대로 실행합니다. 대본 입력, 스타일 선택, 엔진 선택, 화면비, 씬 개수, 자동 진행 흐름을 그대로 사용할 수 있습니다.",
    href: "/tools/cinebrew/index.html",
    tag: "Main Studio",
    note: "빌드 확인 완료 · Vite/React 원본 UI · 16가지 스타일 · Nanobanana/Gemini/Vertex 연동",
    primaryLabel: "🎬 씨네브루 실행",
    blank: true,
  },
  {
    title: "AI-CENEBREW 원본 ZIP",
    desc: "이번에 다시 올린 원본 ZIP입니다. node_modules 포함 ZIP을 그대로 보관해서 필요하면 독립 실행/비교/복구에 사용할 수 있습니다.",
    href: "/downloads/AI-CENEBREW-main-with-node_modules.zip",
    tag: "Source Backup",
    note: "node_modules 포함 · 원본 프로젝트 보관용",
    primaryLabel: "📦 원본 ZIP 다운로드",
    download: true,
  },
  {
    title: "AI 생성기 Pro 연결",
    desc: "씨네브루에서 만든 대본, 인물 바이블, 스토리보드, 이미지 프롬프트를 AI 생성기 Pro로 보내 후속 작업을 진행합니다.",
    href: "/ai",
    tag: "AI Pro",
    note: "프롬프트 보강 · 번역 · 재작성 · SNS/블로그 변환",
    primaryLabel: "🚀 AI 생성기 열기",
  },
  {
    title: "이미지 스튜디오 연결",
    desc: "씬별 이미지 프롬프트를 이미지 스튜디오에서 카드뉴스, 포스터, 썸네일, 인포그래픽으로 확장합니다.",
    href: "/image-studio",
    tag: "Image",
    note: "씬 이미지 · 포스터 · 썸네일 · 스타일 변환",
    primaryLabel: "🖼 이미지 스튜디오 열기",
  },
  {
    title: "비디오 스튜디오 연결",
    desc: "스토리보드와 영상 프롬프트를 Veo, Runway, Kling, Hailuo용 작업으로 이어갈 수 있습니다.",
    href: "/video-studio",
    tag: "Video",
    note: "영상 프롬프트 · 컷 분할 · 쇼츠/롱폼 연결",
    primaryLabel: "🎞 비디오 스튜디오 열기",
  },
  {
    title: "쇼츠 스튜디오 연결",
    desc: "씨네브루 대본을 15초/30초/60초 쇼츠 대본으로 재가공하고 훅, 자막, CTA까지 생성합니다.",
    href: "/shorts",
    tag: "Shorts",
    note: "쇼츠 리믹스 · 훅 강화 · 컷 분할",
    primaryLabel: "⚡ 쇼츠 스튜디오 열기",
  },
];

export default function CinePage() {
  return (
    <div className="min-h-screen bg-slate-50 px-8 py-8 text-slate-950">
      <section className="mb-6 rounded-[28px] border border-slate-950 bg-white p-6 shadow-sm">
        <p className="text-sm font-black text-red-600">Cine Studio v5.5 원본 CENEBREW 재빌드 통합</p>
        <h1 className="mt-1 text-4xl font-black tracking-tight">AI 씨네브루</h1>
        <p className="mt-2 text-sm text-slate-600">
          이번 업로드 파일은 node_modules가 포함되어 있어 원본 Vite 앱을 실제로 다시 빌드했습니다. 중복 기능은 AI Content Studio에 억지로 섞지 않고, Music AI처럼 카드에서 원본 스튜디오를 바로 실행하는 방식으로 정리했습니다.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
          <span className="rounded-full bg-red-50 px-3 py-2 text-red-700">원본 UI 실행</span>
          <span className="rounded-full bg-violet-50 px-3 py-2 text-violet-700">대본 입력</span>
          <span className="rounded-full bg-blue-50 px-3 py-2 text-blue-700">인물 바이블</span>
          <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">스토리보드</span>
          <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-700">Vrew/HTML/ZIP Export</span>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {cineTools.map((tool) => (
          <section key={tool.href + tool.title} className="flex min-h-[250px] flex-col rounded-[24px] border border-slate-950 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
            <span className="mb-3 w-fit rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">{tool.tag}</span>
            <h2 className="text-xl font-black">{tool.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{tool.desc}</p>
            <p className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-xs font-bold leading-5 text-slate-700">{tool.note}</p>
            <a
              href={tool.href}
              target={tool.blank ? "_blank" : "_self"}
              download={tool.download}
              className="mt-auto rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-red-600"
            >
              {tool.primaryLabel}
            </a>
          </section>
        ))}
      </div>

      <section className="mt-6 rounded-[24px] border border-slate-950 bg-white p-5">
        <h2 className="text-xl font-black">사용 순서</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          1) <b>씨네브루 실행</b>을 누릅니다. 2) 원본 앱 화면에서 비주얼 스타일, 생성 엔진, 화면비를 선택합니다. 3) 대본이나 시나리오를 입력하고 생성합니다. 4) 결과는 복사해서 AI 생성기 Pro, 이미지 스튜디오, 비디오 스튜디오로 이어서 사용합니다.
        </p>
      </section>
    </div>
  );
}
