import ToolRunnerPage from "@/components/ToolRunnerPage";

const cards = [
  {
    title: "바이럴 빌더 원본 실행",
    desc: "업로드한 viral-builder 원본 Vite 앱을 실제 빌드해서 실행합니다. 일반 바이럴, 광고 바이럴, 숏드라마, 주제 추천, 스토리보드 JSON 출력을 원본 UI 그대로 사용합니다.",
    href: "/tools/viral-builder/index.html",
    tag: "Main Studio",
    note: "원본 UI · Claude/Vertex API 설정 · 일반/광고/숏드라마 · JSON 출력",
    primaryLabel: "🔥 바이럴 빌더 실행",
    blank: true,
  },
  {
    title: "원본 ZIP 다운로드",
    desc: "업로드한 원본 프로젝트를 보관용으로 연결했습니다.",
    href: "/downloads/viral-builder-main.zip",
    tag: "Source Backup",
    note: "node_modules 포함 · 원본 프로젝트 보관용",
    primaryLabel: "📦 원본 ZIP 다운로드",
    download: true,
  },
  {
    title: "쇼츠 스튜디오 연결",
    desc: "바이럴 소재를 쇼츠 대본, 훅, 컷 분할, 이미지/영상 프롬프트로 변환합니다.",
    href: "/shorts",
    tag: "Shorts",
    note: "바이럴 → 쇼츠",
    primaryLabel: "⚡ 쇼츠 열기",
  },
  {
    title: "씨네브루 연결",
    desc: "숏드라마나 스토리형 바이럴을 더 긴 시나리오와 스토리보드로 확장합니다.",
    href: "/cine",
    tag: "Cine",
    note: "숏드라마 · 인물 · 장면 확장",
    primaryLabel: "🎬 씨네브루 열기",
  },
  {
    title: "Amazon SEO 연결",
    desc: "광고 바이럴로 만든 상품 소구점을 Amazon 제휴 리뷰글과 SNS 문구로 이어갑니다.",
    href: "/amazon",
    tag: "Amazon",
    note: "상품 소구점 · 제휴 리뷰 · CTA",
    primaryLabel: "🛒 Amazon SEO 열기",
  },
  {
    title: "마케팅 허브 연결",
    desc: "바이럴 소재, AI 도구, 마케팅 사이트를 한곳에서 관리합니다.",
    href: "/marketing",
    tag: "Marketing",
    note: "툴 모음 · 소재 보관 · 캠페인 아이디어",
    primaryLabel: "💼 마케팅 허브 열기",
  },
];

export default function ViralPage() {
  return (
    <ToolRunnerPage
      eyebrow="Viral Studio v5.6 원본 실행 통합"
      title="바이럴 스튜디오"
      description="바이럴 빌더는 원본 기능이 강해서, 임시 생성기 대신 원본 앱을 그대로 실행하는 구조로 바꿨습니다. 일반 바이럴/광고 바이럴/숏드라마를 만들고 다른 Studio로 이어갑니다."
      chips={["일반 바이럴", "광고 바이럴", "숏드라마", "주제 추천", "스토리보드", "Claude/Vertex"]}
      cards={cards}
      accent="red"
      usage={'1) <b>바이럴 빌더 실행</b>을 누릅니다. 2) 원본 화면에서 일반/광고/숏드라마 모드를 선택합니다. 3) 주제 추천 또는 대본 생성을 진행합니다. 4) 완성 결과를 쇼츠, 씨네브루, Amazon SEO로 이어서 사용합니다.'}
    />
  );
}
