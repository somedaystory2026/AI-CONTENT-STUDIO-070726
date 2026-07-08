import ToolRunnerPage from "@/components/ToolRunnerPage";

const cards = [
  {
    title: "GPT PARK 쇼츠 리믹스 원본 실행",
    desc: "업로드한 AI-Shorts-Script-Remix 원본 Vite 앱을 실제 빌드해서 Music AI처럼 바로 실행합니다. 바이럴 소재, 쇼츠 대본, 웹툰/이미지 프롬프트까지 원본 UI 그대로 사용합니다.",
    href: "/tools/shorts-remix/index.html",
    tag: "Main Studio",
    note: "원본 UI · Gemini 기반 · 쇼츠 대본 · 웹툰 이미지 프롬프트 · API 키 설정 포함",
    primaryLabel: "⚡ 쇼츠 리믹스 실행",
    blank: true,
  },
  {
    title: "원본 ZIP 다운로드",
    desc: "업로드한 원본 프로젝트를 보관용으로 연결했습니다. 독립 실행이나 비교가 필요할 때 내려받아 사용할 수 있습니다.",
    href: "/downloads/AI-Shorts-Script-Remix-Tool-GPT-PARK-main.zip",
    tag: "Source Backup",
    note: "node_modules 포함 · 원본 프로젝트 보관용",
    primaryLabel: "📦 원본 ZIP 다운로드",
    download: true,
  },
  {
    title: "씨네브루 연결",
    desc: "쇼츠 아이디어를 더 긴 시나리오, 인물 바이블, 스토리보드로 확장할 때 사용합니다.",
    href: "/cine",
    tag: "Cine",
    note: "대본 확장 · 인물 설정 · 장면 분할",
    primaryLabel: "🎬 씨네브루 열기",
  },
  {
    title: "AI 영상 프롬프트 빌더",
    desc: "카메라/모션/리얼리즘/카메라 결함/조명/스타일/피사체/출력을 조합해서 완성된 영상 프롬프트를 바로 만듭니다.",
    href: "/video-prompt-builder",
    tag: "Prompt Builder",
    note: "조합형 빌더 · 랜덤 조합 · 프리셋",
    primaryLabel: "🧩 프롬프트 빌더 열기",
  },
  {
    title: "Veo 스튜디오 연결",
    desc: "완성된 쇼츠 장면을 Veo3, Runway, Kling용 영상 프롬프트로 변환할 때 사용합니다.",
    href: "/veo",
    tag: "Veo",
    note: "영상 프롬프트 · 9:16 · 여행/쇼츠 포맷",
    primaryLabel: "🎥 Veo 스튜디오 열기",
  },
  {
    title: "AI 생성기 Pro 연결",
    desc: "쇼츠 대본을 복사해서 더 짧게, 더 자극적으로, X/릴스/블로그용으로 재가공합니다.",
    href: "/ai",
    tag: "AI Pro",
    note: "프롬프트 보강 · 재작성 · SNS 변환",
    primaryLabel: "🚀 AI 생성기 열기",
  },
  {
    title: "뉴스 AI 연결",
    desc: "뉴스 기사에서 쇼츠 소재를 뽑고, X 게시글과 카드뉴스까지 이어갈 때 사용합니다.",
    href: "/news",
    tag: "News",
    note: "뉴스 → 쇼츠 → X → 카드뉴스",
    primaryLabel: "📰 뉴스 AI 열기",
  },
];

export default function ShortsPage() {
  return (
    <ToolRunnerPage
      eyebrow="Shorts Studio v5.6 원본 실행 통합"
      title="쇼츠 스튜디오"
      description="이제 임시 카드 생성기가 아니라, 업로드한 GPT PARK 쇼츠 리믹스 원본 앱을 Music AI처럼 실행합니다. 중복 기능은 억지로 섞지 않고 원본 실행 + AI Content Studio 연결 방식으로 정리했습니다."
      chips={["원본 UI 실행", "쇼츠 대본", "바이럴 소재", "웹툰 프롬프트", "이미지 프롬프트", "AI Pro 연결"]}
      cards={cards}
      accent="amber"
      usage={'1) <b>쇼츠 리믹스 실행</b>을 누릅니다. 2) 원본 화면에서 소재/카테고리/톤을 선택합니다. 3) 쇼츠 대본과 이미지 프롬프트를 생성합니다. 4) 결과를 복사해서 씨네브루, Veo, AI 생성기 Pro로 이어서 사용합니다.'}
    />
  );
}
