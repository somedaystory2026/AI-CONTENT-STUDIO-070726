import ToolRunnerPage from "@/components/ToolRunnerPage";

const cards = [
  {
    title: "롱폼 스튜디오 원본 실행",
    desc: "업로드한 longform-studio 원본 Vite 앱을 실제 빌드해서 실행합니다. 아이디어 → 대본 → 영상 에셋 → YouTube SEO → 블로그까지 5단계 롱폼 제작 파이프라인을 그대로 사용합니다.",
    href: "/tools/longform-studio/index.html",
    tag: "Main Studio",
    note: "원본 UI · 5단계 파이프라인 · Gemini/Vertex 설정 · SEO/블로그 포함",
    primaryLabel: "🎬 롱폼 스튜디오 실행",
    blank: true,
  },
  {
    title: "원본 ZIP 다운로드",
    desc: "업로드한 원본 프로젝트를 보관용으로 연결했습니다.",
    href: "/downloads/longform-studio-main.zip",
    tag: "Source Backup",
    note: "node_modules 포함 · 원본 프로젝트 보관용",
    primaryLabel: "📦 원본 ZIP 다운로드",
    download: true,
  },
  {
    title: "씨네브루 연결",
    desc: "롱폼 대본을 장면 단위로 더 정교하게 분할하고 인물 바이블, 스토리보드로 확장합니다.",
    href: "/cine",
    tag: "Cine",
    note: "장면 분할 · 인물 바이블 · 스토리보드",
    primaryLabel: "🎬 씨네브루 열기",
  },
  {
    title: "AI 영상 프롬프트 빌더",
    desc: "카메라/모션/리얼리즘/카메라 결함/조명/스타일/피사체/출력 8개 카테고리를 조합해서 영상 프롬프트를 바로 만듭니다.",
    href: "/video-prompt-builder",
    tag: "Prompt Builder",
    note: "조합형 빌더 · 랜덤 조합 · 프리셋",
    primaryLabel: "🧩 프롬프트 빌더 열기",
  },
  {
    title: "쇼츠 스튜디오 연결",
    desc: "롱폼 내용을 15초/30초/60초 쇼츠 클립으로 재가공합니다.",
    href: "/shorts",
    tag: "Shorts",
    note: "롱폼 → 쇼츠 클립",
    primaryLabel: "⚡ 쇼츠 열기",
  },
  {
    title: "글쓰기 AI 연결",
    desc: "롱폼 대본을 블로그 글, SEO 글, 카드뉴스 원고로 바꿉니다.",
    href: "/writing",
    tag: "Writing",
    note: "블로그 · SEO · 리서치 보드",
    primaryLabel: "✍️ 글쓰기 AI 열기",
  },
  {
    title: "YouTube/SEO 연결",
    desc: "제목, 설명, 태그, 썸네일 문구를 Amazon/블로그 SEO 스타일로 확장합니다.",
    href: "/ai",
    tag: "AI Pro",
    note: "제목 · 설명 · 태그 · 썸네일 문구",
    primaryLabel: "🚀 AI 생성기 열기",
  },
];

export default function LongformPage() {
  return (
    <ToolRunnerPage
      eyebrow="Longform Studio v5.6 원본 실행 통합"
      title="롱폼 스튜디오"
      description="롱폼도 임시 UI가 아니라 원본 앱을 빌드해서 Music AI처럼 실행합니다. 중복 코드는 가져오지 않고, 결과물을 AI Content Studio의 씨네/쇼츠/글쓰기 흐름으로 연결합니다."
      chips={["아이디어", "롱폼 대본", "영상 에셋", "YouTube SEO", "블로그", "Gemini/Vertex"]}
      cards={cards}
      accent="violet"
      usage={'1) <b>롱폼 스튜디오 실행</b>을 누릅니다. 2) 원본 5단계 화면에서 아이디어와 대본을 만듭니다. 3) 영상 에셋/SEO/블로그 결과를 생성합니다. 4) 필요한 결과를 씨네브루, 쇼츠, 글쓰기 AI로 이어서 사용합니다.'}
    />
  );
}
