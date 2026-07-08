import ToolRunnerPage from "@/components/ToolRunnerPage";

const cards = [
  {
    title: "Google Veo3 여행 쇼츠 메이커 실행",
    desc: "업로드한 Google-Veo3-short-maker 원본 HTML 도구를 그대로 실행합니다. 나라, 도시, 관광지 수, 스타일, 카메라 무빙 기반으로 Veo3용 쇼츠 프롬프트를 생성합니다.",
    href: "/tools/veo3-short-maker/index.html",
    tag: "Main Studio",
    note: "원본 HTML 실행 · Veo3 프롬프트 · 여행 쇼츠 · 카메라 무빙",
    primaryLabel: "🎥 Veo3 메이커 실행",
    blank: true,
  },
  {
    title: "원본 ZIP 다운로드",
    desc: "업로드한 원본 프로젝트를 보관용으로 연결했습니다.",
    href: "/downloads/Google-Veo3-short-maker-main.zip",
    tag: "Source Backup",
    note: "원본 프로젝트 보관용",
    primaryLabel: "📦 원본 ZIP 다운로드",
    download: true,
  },
  {
    title: "쇼츠 스튜디오 연결",
    desc: "Veo 프롬프트를 만들기 전, 15초/30초/60초 쇼츠 대본과 훅을 먼저 만들 수 있습니다.",
    href: "/shorts",
    tag: "Shorts",
    note: "쇼츠 대본 · 훅 · 자막 · CTA",
    primaryLabel: "⚡ 쇼츠 스튜디오 열기",
  },
  {
    title: "비디오 스튜디오 연결",
    desc: "Veo, Runway, Kling, Hailuo용 프롬프트를 한곳에서 비교하고 확장합니다.",
    href: "/video-studio",
    tag: "Video",
    note: "멀티 영상 모델 프롬프트",
    primaryLabel: "🎞 비디오 스튜디오 열기",
  },
  {
    title: "롱폼 스튜디오 연결",
    desc: "여행 쇼츠 소재를 유튜브 롱폼 기획, 대본, SEO, 블로그 글로 확장합니다.",
    href: "/longform",
    tag: "Longform",
    note: "롱폼 대본 · SEO · 블로그",
    primaryLabel: "🎬 롱폼 열기",
  },
  {
    title: "AI 영상 프롬프트 빌더",
    desc: "카메라/모션/리얼리즘/카메라 결함/조명/스타일/피사체/출력 8개 카테고리를 조합해서 Veo3, Kling, Hailuo, Krea 2용 프롬프트를 바로 만듭니다.",
    href: "/video-prompt-builder",
    tag: "Prompt Builder",
    note: "조합형 빌더 · 랜덤 조합 · 프리셋",
    primaryLabel: "🧩 프롬프트 빌더 열기",
  },
  {
    title: "프롬프트 모음 연결",
    desc: "Veo, Runway, Kling, 이미지, 쇼츠용 프롬프트 템플릿을 검색합니다.",
    href: "/prompts",
    tag: "Prompt OS",
    note: "영상 프롬프트 라이브러리",
    primaryLabel: "🧠 프롬프트 열기",
  },
];

export default function VeoPage() {
  return (
    <ToolRunnerPage
      eyebrow="Veo Studio v5.6 원본 실행 통합"
      title="Veo 스튜디오"
      description="Veo3 도구도 Music AI처럼 원본 실행 카드 방식으로 정리했습니다. 프롬프트 생성 도구는 원본 화면 그대로 쓰고, 결과는 쇼츠/비디오/롱폼으로 연결합니다."
      chips={["Veo3", "여행 쇼츠", "9:16", "카메라 무빙", "복붙 프롬프트", "Video 연결"]}
      cards={cards}
      accent="blue"
      usage={'1) <b>Veo3 메이커 실행</b>을 누릅니다. 2) 나라/도시/관광지/스타일을 선택합니다. 3) 생성된 프롬프트를 복사합니다. 4) Veo, Runway, Kling 등 외부 영상 사이트에 붙여넣어 사용합니다.'}
    />
  );
}
