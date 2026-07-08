"use client";

import { useEffect, useMemo, useState } from "react";

type SeoMode = "NAVER" | "RCON" | "AEO" | "INSIGHT" | "HOME" | "REVIEW";
type ResearchItem = { type: string; title: string; summary: string; url?: string };

const trendMap: Record<string, string[]> = {
  "종합": ["AI 검색", "월드컵", "여름 여행", "반도체", "가성비 제품"],
  "IT/테크": ["AI 검색", "생성형 AI", "반도체", "스마트폰", "업무 자동화"],
  "뷰티/패션": ["여름 선크림", "쿨링 패드", "데일리룩", "홈케어", "저자극"],
  "경제/비즈니스": ["환율", "금리", "부업", "자동화", "1인 기업"],
  "여행/맛집": ["LA 여행", "가족 여행", "근교 드라이브", "맛집", "호수"],
  "연예/문화": ["KPOP", "콘서트", "OST", "드라마", "팬덤"],
};

type DetailStoryboard = { title: string; desc: string };

const detailCategories = ["화장품", "식품/건강기능식품", "가전/전자/IT", "패션/의류", "생활/리빙", "스포츠/운동", "일반 상품"];
const detailPlatforms = ["스마트스토어", "쿠팡", "올리브영", "자사몰", "무신사", "카카오쇼핑", "Amazon"];
const detailSeasons = ["기본", "봄", "여름", "가을", "겨울", "명절", "연말", "블랙프라이데이"];
const detailMoods = ["기본", "프리미엄", "감성", "깔끔한 정보형", "강한 후킹", "고급 브랜드", "친근한 리뷰형"];
const detailEvents = ["없음", "할인", "1+1", "쿠폰", "증정", "무료배송", "런칭 특가"];
const detailStoryTemplates = [
  { key: "AUTO", title: "자동 추천형", desc: "카테고리/제품 소구점 기반으로 AI가 섹션 전략을 추천" },
  { key: "AIDA", title: "표준형 AIDA", desc: "Attention → Interest → Desire → Action 흐름" },
  { key: "PROBLEM", title: "문제해결 중심형", desc: "불편 공감 → 원인 → 해결 → 사용 확신" },
  { key: "SPEC", title: "제품정보 전문형", desc: "성분/소재/스펙/구성 신뢰 강조" },
  { key: "LIFE", title: "라이프스타일 연출형", desc: "장소/상황/착용/사용 장면 다양화" },
  { key: "PERFORMANCE", title: "기능·퍼포먼스 강조형", desc: "실사용 액션과 구조 설명 중심" },
  { key: "BRAND", title: "감성 브랜딩형", desc: "브랜드 무드와 취향 설득 중심" },
  { key: "FAST", title: "빠른 구매전환형", desc: "핵심 장점과 구매 이유를 빠르게 전달" },
];

function getDefaultStoryboard(category: string): DetailStoryboard[] {
  if (category.includes("화장품")) {
    return [
      { title: "제품 히어로", desc: "제품명, 패키지, 핵심 컨셉을 첫 화면에서 정확히 전달" },
      { title: "피부 고민 공감", desc: "타깃이 느끼는 피부 고민을 과장 없이 공감" },
      { title: "핵심 성분 소개", desc: "제품에 실제 포함된 핵심 성분과 함량 중심 설명" },
      { title: "성분 조합 포인트", desc: "성분 조합이 주는 사용 가치를 쉽게 설명" },
      { title: "제형과 사용감", desc: "발림, 흡수감, 마무리감 같은 체감 정보 전달" },
      { title: "사용 후 느낌", desc: "단정적 효능이 아닌 사용감과 피부 컨디션 느낌 표현" },
      { title: "사용 루틴", desc: "언제 어떻게 사용하는지 단계적으로 안내" },
      { title: "제품 가치 CTA", desc: "실제 특징과 루틴을 바탕으로 최종 구매 유도" },
    ];
  }
  if (category.includes("패션")) {
    return [
      { title: "스타일 히어로", desc: "착용 장면과 전체 무드를 첫 화면에서 전달" },
      { title: "핏/실루엣", desc: "체형 보완, 길이감, 핏감을 구체적으로 설명" },
      { title: "소재와 착용감", desc: "계절감, 촉감, 신축성, 두께감 안내" },
      { title: "디테일 포인트", desc: "넥라인, 포켓, 봉제, 컬러 등 구매 결정 요소" },
      { title: "코디 제안", desc: "상황별 스타일링 제안" },
      { title: "사이즈 체크", desc: "구매 전 확인해야 할 사이즈 팁" },
      { title: "관리 방법", desc: "세탁/보관/주의사항" },
      { title: "구매 CTA", desc: "스타일 가치와 활용도를 바탕으로 구매 유도" },
    ];
  }
  return [
    { title: "제품 히어로", desc: "제품명과 핵심 소구점을 첫 화면에 전달" },
    { title: "고객 문제 공감", desc: "사용자가 겪는 불편 또는 필요를 제시" },
    { title: "핵심 장점", desc: "가장 중요한 기능/혜택 3가지를 설명" },
    { title: "스펙/구성", desc: "소재, 용량, 구성, 크기 등 사실 정보 정리" },
    { title: "사용 장면", desc: "실제 사용 상황을 보여주는 라이프스타일 섹션" },
    { title: "구매 전 체크", desc: "주의사항, 호환성, 선택 기준 안내" },
    { title: "신뢰 요소", desc: "인증/자료가 있을 때만 사실 기반으로 정리" },
    { title: "CTA", desc: "마지막 섹션은 반드시 구매 유도 문구로 고정" },
  ];
}

function buildDetailPrompt(data: {
  brand: string; productName: string; detailCategory: string; volumePrice: string; platform: string; target: string; ingredients: string; specs: string; request: string; concept: string; season: string; mood: string; event: string; storyTemplate: string; sections: DetailStoryboard[]; research: ResearchItem[];
}) {
  const template = detailStoryTemplates.find((item) => item.key === data.storyTemplate);
  const researchText = data.research.length
    ? data.research.map((r, i) => `${i + 1}. [${r.type}] ${r.title}\n${r.summary}`).join("\n\n")
    : "없음";
  const storyboardText = data.sections.map((section, i) => `${i + 1}. ${section.title} - ${section.desc}`).join("\n");

  return [
    "너는 쇼핑몰 상세페이지 전략가이자 카피라이터다. 아래 제품 정보를 바탕으로 팔리는 웹 상세페이지 패키지를 작성해라.",
    "",
    "[제품 정보]",
    `브랜드명: ${data.brand || "미입력"}`,
    `제품명: ${data.productName || "미입력"}`,
    `카테고리: ${data.detailCategory}`,
    `용량/가격: ${data.volumePrice || "미입력"}`,
    `판매 플랫폼: ${data.platform}`,
    `타깃 고객: ${data.target || "미입력"}`,
    `핵심 성분/스펙: ${data.ingredients || "미입력"}`,
    `전성분/상세 스펙: ${data.specs || "미입력"}`,
    `요청사항: ${data.request || "없음"}`,
    `상세페이지 컨셉: ${data.concept || "미입력"}`,
    "",
    "[컨셉 & 스타일]",
    `시즌: ${data.season}`,
    `무드: ${data.mood}`,
    `이벤트: ${data.event}`,
    `스토리라인: ${template?.title || data.storyTemplate} - ${template?.desc || ""}`,
    "",
    "[참고 자료]",
    researchText,
    "",
    "[스토리보드]",
    storyboardText,
    "",
    "[출력]",
    "1. 제품/시장 분석 요약",
    "2. 소구점 10개",
    "3. 광고법/법적 리스크 체크리스트",
    "4. 브랜드/비주얼 가이드",
    "5. 전체 상세페이지 섹션 카피",
    "6. 섹션별 이미지 생성 프롬프트",
    "7. 썸네일/대표 이미지 프롬프트",
    "8. 스마트스토어/쿠팡/Amazon용 상품명 후보",
    "9. 상세페이지 HTML 초안",
    "10. 마지막 CTA",
    "",
    "[금지]",
    "- 근거 없는 후기, 인증, 임상, 수치 생성 금지",
    "- 이벤트가 '없음'이면 할인/증정/특가/무료배송 문구 금지",
    "- 이미지 내부에 섹션 번호 렌더링 금지",
    "- 카테고리별 광고법 기준을 반드시 반영",
  ].join("\n");
}

const seoModes: { key: SeoMode; title: string; desc: string }[] = [
  { key: "NAVER", title: "네이버 최적화", desc: "C-Rank/D.I.A. 관점: 경험, 신뢰, 체류시간, 자연스러운 키워드" },
  { key: "RCON", title: "RCON 검색의도", desc: "사용자가 바로 원하는 답부터 주고, 모바일 가독성을 우선" },
  { key: "AEO", title: "AI 브리핑/AEO", desc: "FAQ, 표, Q&A, 요약 박스로 AI 검색에 잡히기 쉬운 구조" },
  { key: "INSIGHT", title: "인사이트 엣지", desc: "상위 글과 다른 관점, 비교, 실전 팁 중심" },
  { key: "HOME", title: "홈판/스토리텔링", desc: "호기심 훅과 감성 스토리로 읽히는 매거진형" },
  { key: "REVIEW", title: "리뷰/구매가이드", desc: "실사용 후기, 장단점, 체크리스트, 구매 전 주의사항" },
];

function splitKeywords(value: string) {
  return value.split(/[,.\n]/).map((v) => v.trim()).filter(Boolean);
}

function buildPrompt(data: {
  topic: string; mainKeyword: string; subKeywords: string; seoMode: SeoMode; persona: string; length: string; tone: string; humanize: boolean; emoji: boolean; faq: boolean; research: ResearchItem[]; opinion: string; competitor: string;
}) {
  const mode = seoModes.find((m) => m.key === data.seoMode);
  return `너는 네이버 SEO와 블로그 수익화에 강한 전문 작가다.\n\n[주제]\n${data.topic}\n\n[메인 키워드]\n${data.mainKeyword}\n\n[서브 키워드]\n${data.subKeywords}\n\n[SEO 모드]\n${mode?.title}: ${mode?.desc}\n\n[타깃]\n${data.persona}\n\n[분량]\n${data.length}자 기준\n\n[톤]\n${data.tone}\n\n[옵션]\n- 인간화: ${data.humanize ? "적용" : "미적용"}\n- 이모지: ${data.emoji ? "적용" : "미적용"}\n- FAQ: ${data.faq ? "포함" : "제외"}\n\n[경쟁사 분석]\n${data.competitor || "아직 없음"}\n\n[리서치 자료]\n${data.research.map((r, i) => `${i + 1}. [${r.type}] ${r.title}\n${r.summary}\n${r.url || ""}`).join("\n\n") || "없음"}\n\n[내 의견]\n${data.opinion || "없음"}\n\n[출력 규칙]\n1. SEO 메타 제목/설명 먼저 작성\n2. 제목은 H1, 본문은 H2/H3 구조\n3. 서론 → 핵심 요약 → 본론 5개 이상 → 체크리스트 → FAQ → 결론\n4. 메인 키워드는 자연스럽게 3~6회 사용\n5. 초보자도 이해하게 구체적 예시 포함\n6. 복사해서 워드프레스/네이버에 바로 붙일 수 있는 HTML 형식으로 출력\n7. 과장, 허위 경험, 근거 없는 수치 금지`; 
}

export default function WritingPage() {
  const [topic, setTopic] = useState("");
  const [mainKeyword, setMainKeyword] = useState("");
  const [subKeywords, setSubKeywords] = useState("");
  const [trendCategory, setTrendCategory] = useState("종합");
  const [seoMode, setSeoMode] = useState<SeoMode>("RCON");
  const [persona, setPersona] = useState("누구나");
  const [length, setLength] = useState("2000");
  const [tone, setTone] = useState("정보 전달형");
  const [humanize, setHumanize] = useState(true);
  const [emoji, setEmoji] = useState(false);
  const [faq, setFaq] = useState(true);
  const [url, setUrl] = useState("");
  const [opinion, setOpinion] = useState("");
  const [research, setResearch] = useState<ResearchItem[]>([]);
  const [competitor, setCompetitor] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState("");
  const [saved, setSaved] = useState("");
  const [activeStudio, setActiveStudio] = useState<"blog" | "detail">("blog");
  const [brand, setBrand] = useState("");
  const [productName, setProductName] = useState("");
  const [detailCategory, setDetailCategory] = useState("화장품");
  const [volumePrice, setVolumePrice] = useState("");
  const [platform, setPlatform] = useState("스마트스토어");
  const [target, setTarget] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [specs, setSpecs] = useState("");
  const [request, setRequest] = useState("");
  const [concept, setConcept] = useState("");
  const [season, setSeason] = useState("기본");
  const [mood, setMood] = useState("기본");
  const [event, setEvent] = useState("없음");
  const [storyTemplate, setStoryTemplate] = useState("AUTO");
  const [sections, setSections] = useState<DetailStoryboard[]>(() => getDefaultStoryboard("화장품"));
  const [detailResult, setDetailResult] = useState("");
  const [autoRunDetailPending, setAutoRunDetailPending] = useState(false);
  const [detailUrl, setDetailUrl] = useState("");
  const [productImageUrl, setProductImageUrl] = useState("");

  // 아마존 가져오기 매니저(/amazon)의 "웹상세 빌더로 보내기"에서 넘어온 초안을 받습니다.
  useEffect(() => {
    const draft = localStorage.getItem("writingDraft");
    if (!draft) return;
    try {
      const d = JSON.parse(draft);
      setActiveStudio("detail");
      if (d.brand) setBrand(d.brand);
      if (d.productName) setProductName(d.productName);
      if (d.detailCategory) updateDetailCategory(d.detailCategory);
      if (d.platform) setPlatform(d.platform);
      if (d.target) setTarget(d.target);
      if (d.specs) setSpecs(d.specs);
      if (d.volumePrice) setVolumePrice(d.volumePrice);
      if (d.request) setRequest(d.request);
      if (d.productUrl) setDetailUrl(d.productUrl);
      if (d.imageUrl) setProductImageUrl(d.imageUrl);
      setAutoRunDetailPending(true);
    } catch {}
    localStorage.removeItem("writingDraft");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prompt = useMemo(() => buildPrompt({ topic, mainKeyword, subKeywords, seoMode, persona, length, tone, humanize, emoji, faq, research, opinion, competitor }), [topic, mainKeyword, subKeywords, seoMode, persona, length, tone, humanize, emoji, faq, research, opinion, competitor]);

  const detailPrompt = useMemo(() => buildDetailPrompt({ brand, productName, detailCategory, volumePrice, platform, target, ingredients, specs, request, concept, season, mood, event, storyTemplate, sections, research }), [brand, productName, detailCategory, volumePrice, platform, target, ingredients, specs, request, concept, season, mood, event, storyTemplate, sections, research]);

  const updateDetailCategory = (value: string) => {
    setDetailCategory(value);
    setSections(getDefaultStoryboard(value));
  };

  const updateSection = (index: number, key: keyof DetailStoryboard, value: string) => {
    setSections((prev) => prev.map((section, i) => i === index ? { ...section, [key]: value } : section));
  };

  const moveSection = (index: number, dir: -1 | 1) => {
    setSections((prev) => {
      const next = [...prev];
      const targetIndex = index + dir;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const addSection = () => setSections((prev) => [...prev, { title: "새 섹션", desc: "섹션 설명을 입력하세요" }]);
  const removeSection = (index: number) => setSections((prev) => prev.filter((_, i) => i !== index));

  const addTrend = (kw: string) => {
    if (!mainKeyword) setMainKeyword(kw);
    else if (!subKeywords.includes(kw)) setSubKeywords((prev) => prev ? `${prev}, ${kw}` : kw);
  };

  const extractKeywords = () => {
    const words = splitKeywords(topic.replace(/["'“”‘’]/g, " ")).flatMap((w) => w.split(/\s+/)).filter((w) => w.length >= 2);
    if (words[0]) setMainKeyword(words.slice(0, 3).join(" "));
    const subs = Array.from(new Set([...words.slice(3, 10), ...trendMap[trendCategory].slice(0, 3)]));
    setSubKeywords(subs.join(", "));
  };

  const analyzeCompetitor = async () => {
    setBusy("competitor");
    const res = await fetch("/api/writing/competitor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keyword: mainKeyword || topic }) });
    const data = await res.json();
    setCompetitor(data.text || "분석 실패");
    setBusy("");
  };

  const analyzeUrl = async () => {
    if (!url.trim()) return;
    setBusy("url");
    const res = await fetch("/api/writing/analyze-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
    const data = await res.json();
    setResearch((prev) => [{ type: "URL", title: data.title || url, summary: data.summary || "URL 분석 자료", url }, ...prev]);
    setUrl("");
    setBusy("");
  };

  const handleFile = async (file: File, type: string) => {
    const text = await file.text().catch(() => "");
    setResearch((prev) => [{ type, title: file.name, summary: text ? text.slice(0, 1000) : `${file.name} 업로드됨. AI 생성 시 참고 자료로 사용하세요.` }, ...prev]);
  };

  const generate = async () => {
    setBusy("generate");
    const res = await fetch("/api/writing/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, topic, mainKeyword, seoMode }) });
    const data = await res.json();
    setResult(data.text || data.error || "생성 실패");
    setBusy("");
  };

  const generateDetail = async () => {
    setBusy("detail");
    const res = await fetch("/api/writing/detail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: detailPrompt, productName, brand, category: detailCategory }) });
    const data = await res.json();
    setDetailResult(data.text || data.error || "상세페이지 생성 실패");
    setBusy("");
  };

  // /amazon에서 넘어온 초안이 있으면 화면이 뜨자마자 자동으로 상세페이지를 생성합니다.
  useEffect(() => {
    if (!autoRunDetailPending) return;
    setAutoRunDetailPending(false);
    setTimeout(() => generateDetail(), 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunDetailPending]);

  const analyzeDetailUrl = async () => {
    if (!detailUrl.trim()) return;
    setBusy("detail-url");
    try {
      const res = await fetch("/api/writing/analyze-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: detailUrl }) });
      const data = await res.json();
      if (data.title && !productName) setProductName(data.title);
      if (data.summary) setConcept((prev) => prev ? prev : data.summary);
      setRequest((prev) => [prev, `상품 페이지 참고: ${detailUrl}`].filter(Boolean).join("\n"));
    } finally {
      setBusy("");
    }
  };

  const importSingleSeoInfo = () => {
    const saved = localStorage.getItem("amazonSingleSeoInfo");
    if (!saved) {
      alert("/amazon 의 단일 SEO 탭에서 먼저 \"저장\"을 눌러주세요.");
      return;
    }
    try {
      const data = JSON.parse(saved);
      setActiveStudio("detail");
      const info: string = data.productInfo || "";
      const grab = (label: string) => info.match(new RegExp(`${label}:\\s*(.+)`))?.[1]?.trim() || "";

      if (data.productName) setProductName(data.productName);
      const productLink = grab("제품링크") || data.url || "";
      if (productLink) setDetailUrl(productLink);
      const brandValue = grab("브랜드");
      if (brandValue) setBrand(brandValue);
      const rating = grab("평점");
      const reviewCount = grab("리뷰수");
      if (rating || reviewCount) {
        setSpecs((prev) => [prev, [rating && `평점 ${rating}`, reviewCount && `리뷰 ${reviewCount}개`].filter(Boolean).join(" · ")].filter(Boolean).join("\n"));
      }
      const links = [
        grab("이미지링크") && `이미지: ${grab("이미지링크")}`,
        grab("제휴링크") && `제휴: ${grab("제휴링크")}`,
        grab("리뷰링크") && `리뷰: ${grab("리뷰링크")}`,
      ].filter(Boolean);
      if (links.length) setRequest((prev) => [prev, `[아마존 참고 링크]\n${links.join("\n")}`].filter(Boolean).join("\n\n"));
      const imageLink = grab("이미지링크");
      if (imageLink) setProductImageUrl(imageLink);
    } catch {
      alert("저장된 정보를 불러오지 못했습니다.");
    }
  };

  const saveDetailLibrary = async () => {
    const res = await fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: productName || brand || "웹상세 빌더 결과", type: "DETAIL_PAGE", status: "DRAFT", summary: detailCategory, payload: { detailResult, detailPrompt, brand, productName, detailCategory, platform, sections } }) });
    setSaved(res.ok ? "상세페이지 라이브러리 저장 완료" : "저장 실패");
  };

  const startNewDoc = () => {
    if (activeStudio === "detail") {
      setBrand(""); setProductName(""); setVolumePrice(""); setTarget(""); setIngredients(""); setSpecs(""); setRequest(""); setConcept("");
      setSeason("기본"); setMood("기본"); setEvent("없음"); setStoryTemplate("AUTO");
      setDetailUrl(""); setProductImageUrl(""); setDetailResult("");
      setSections(getDefaultStoryboard(detailCategory));
      setSaved("새 상세페이지로 초기화했습니다.");
    } else {
      setResult("");
    }
    setTimeout(() => setSaved(""), 1600);
  };

  const sendDetailToCardNews = () => {
    localStorage.setItem(
      "cardNewsDraft",
      JSON.stringify({ article: { title: productName || brand || "상세페이지 카드뉴스", description: detailResult || detailPrompt } })
    );
    window.location.href = "/card-news";
  };

  const sendDetailToPublisher = () => {
    localStorage.setItem(
      "publisherDraft",
      JSON.stringify({ title: productName || brand || "발행할 글", body: detailResult, imageUrl: productImageUrl, source: "writing-detail" })
    );
    window.location.href = "/publisher";
  };

  const sendBlogToPublisher = () => {
    localStorage.setItem(
      "publisherDraft",
      JSON.stringify({ title: topic || mainKeyword || "발행할 글", body: result, imageUrl: "", source: "writing-blog" })
    );
    window.location.href = "/publisher";
  };

  const saveProject = () => {
    const project = { topic, mainKeyword, subKeywords, trendCategory, seoMode, persona, length, tone, humanize, emoji, faq, opinion, research, competitor, result, savedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `writing-studio-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const loadProject = async (file: File) => {
    const data = JSON.parse(await file.text());
    setTopic(data.topic || ""); setMainKeyword(data.mainKeyword || ""); setSubKeywords(data.subKeywords || ""); setTrendCategory(data.trendCategory || "종합"); setSeoMode(data.seoMode || "RCON"); setPersona(data.persona || "누구나"); setLength(data.length || "2000"); setTone(data.tone || "정보 전달형"); setHumanize(data.humanize ?? true); setEmoji(data.emoji ?? false); setFaq(data.faq ?? true); setOpinion(data.opinion || ""); setResearch(data.research || []); setCompetitor(data.competitor || ""); setResult(data.result || "");
  };

  const saveLibrary = async () => {
    const res = await fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: topic || mainKeyword || "Writing Studio 글", type: "BLOG_POST", status: "DRAFT", summary: mainKeyword, payload: { result, prompt, topic, mainKeyword, subKeywords, seoMode, persona, length, tone, research, competitor } }) });
    setSaved(res.ok ? "라이브러리 저장 완료" : "저장 실패");
  };

  const copy = async (text: string) => { await navigator.clipboard.writeText(text); setSaved("복사됨"); setTimeout(() => setSaved(""), 1400); };

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-950">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-black text-emerald-600">v4.8 Writing + 웹상세 빌더</div>
            <h1 className="text-4xl font-black tracking-tight">Writing Studio</h1>
            <p className="mt-2 text-slate-500">블로그 글쓰기와 상품 상세페이지 제작을 한 화면에서 분리해 사용합니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={saveProject} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black">프로젝트 저장</button>
            <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black">불러오기<input type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && loadProject(e.target.files[0])}/></label>
            <button onClick={startNewDoc} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">새 글</button>
          </div>
        </div>

        <div className="mb-6 grid gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-2">
          <button onClick={() => setActiveStudio("blog")} className={`rounded-2xl px-5 py-4 text-left font-black transition ${activeStudio === "blog" ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>✍️ 블로그 Writing Studio<div className="mt-1 text-xs font-medium opacity-80">키워드/경쟁사/리서치 기반 블로그 작성</div></button>
          <button onClick={() => setActiveStudio("detail")} className={`rounded-2xl px-5 py-4 text-left font-black transition ${activeStudio === "detail" ? "bg-purple-600 text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>🛍️ 웹상세 빌더<div className="mt-1 text-xs font-medium opacity-80">상품 상세페이지·소구점·이미지 프롬프트 생성</div></button>
        </div>

        {activeStudio === "blog" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <main className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-black">1. 실시간 키워드 트렌드</h2>
                <select value={trendCategory} onChange={(e) => setTrendCategory(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold">
                  {Object.keys(trendMap).map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                {trendMap[trendCategory].map((kw) => <button key={kw} onClick={() => addTrend(kw)} className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">+ {kw}</button>)}
              </div>
            </section>

            <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
              <div className="md:col-span-2">
                <div className="mb-2 flex items-center justify-between"><label className="text-sm font-black text-blue-600">프로젝트 주제 / 제목</label><button onClick={extractKeywords} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">키워드 자동 추출</button></div>
                <textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="예: 네이버 AI 검색 공개 이후 블로그 SEO 전략" className="min-h-[90px] w-full rounded-2xl border border-slate-300 p-4 text-lg font-bold outline-none focus:border-blue-500" />
              </div>
              <div><label className="mb-2 block text-sm font-black text-blue-600">메인 키워드</label><input value={mainKeyword} onChange={(e) => setMainKeyword(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-bold" placeholder="Primary keyword" /></div>
              <div><label className="mb-2 block text-sm font-black text-blue-600">서브 키워드</label><input value={subKeywords} onChange={(e) => setSubKeywords(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3" placeholder="쉼표로 구분" /></div>
            </section>

            <section className="rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-xl font-black text-red-600">2. 경쟁사 분석</h2><p className="text-sm text-slate-500">상위글 공통 구조, 부족한 내용, 차별화 포인트를 프롬프트에 반영합니다.</p></div><button onClick={analyzeCompetitor} disabled={!mainKeyword && !topic} className="rounded-xl bg-red-50 px-4 py-3 text-sm font-black text-red-600 disabled:opacity-40">{busy === "competitor" ? "분석중..." : "경쟁사 분석"}</button></div>
              {competitor ? <pre className="whitespace-pre-wrap rounded-2xl bg-red-50 p-4 text-sm text-slate-700">{competitor}</pre> : <div className="rounded-2xl border border-dashed border-red-200 p-6 text-sm text-slate-400">메인 키워드를 넣고 분석 버튼을 누르세요.</div>}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black">3. 스마트 리서치 보드</h2>
              <p className="mt-1 text-sm text-slate-500">URL, 이미지, PDF/TXT/DOCX, 직접 의견을 글에 반영합니다.</p>
              <div className="mt-4 flex gap-2"><input value={url} onChange={(e) => setUrl(e.target.value)} className="flex-1 rounded-xl border border-slate-300 px-4 py-3" placeholder="URL 붙여넣기" /><button onClick={analyzeUrl} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">{busy === "url" ? "분석중" : "URL 분석"}</button></div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="cursor-pointer rounded-2xl border border-dashed border-slate-300 p-5 hover:border-blue-400">🖼️ 이미지 분석<input hidden type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], "이미지")}/><p className="mt-1 text-xs text-slate-400">파일명/메모를 리서치 자료로 저장</p></label>
                <label className="cursor-pointer rounded-2xl border border-dashed border-slate-300 p-5 hover:border-blue-400">📄 문서 분석<input hidden type="file" accept=".pdf,.docx,.txt,.md" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], "문서")}/><p className="mt-1 text-xs text-slate-400">TXT/MD는 본문 일부 자동 추출</p></label>
              </div>
              <textarea value={opinion} onChange={(e) => setOpinion(e.target.value)} className="mt-4 min-h-[140px] w-full rounded-2xl border border-slate-300 p-4" placeholder="직접 의견/경험/강조하고 싶은 포인트" />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {research.map((r, i) => <div key={i} className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-emerald-600">{r.type}</div><div className="font-black">{r.title}</div><p className="mt-2 line-clamp-4 text-sm text-slate-600">{r.summary}</p></div>)}
              </div>
            </section>
          </main>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black">4. SEO 옵션</h2>
              <div className="mt-4 space-y-3">{seoModes.map((m) => <button key={m.key} onClick={() => setSeoMode(m.key)} className={`w-full rounded-2xl border p-4 text-left ${seoMode === m.key ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}><div className="font-black">{m.title}</div><p className="mt-1 text-xs text-slate-500">{m.desc}</p></button>)}</div>
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black">5. 글 설정</h2>
              <div className="mt-4 grid gap-3">
                <select value={persona} onChange={(e) => setPersona(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3"><option>누구나</option><option>10대~20대</option><option>30대~40대</option><option>50대~60대</option><option>60대 이상</option></select>
                <select value={length} onChange={(e) => setLength(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3"><option value="1000">1000자</option><option value="2000">2000자</option><option value="3000">3000자</option></select>
                <select value={tone} onChange={(e) => setTone(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3"><option>정보 전달형</option><option>리뷰형</option><option>홍보형</option><option>선배가 알려주는 형식</option></select>
                <label className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 font-bold">인간화<input type="checkbox" checked={humanize} onChange={(e) => setHumanize(e.target.checked)} /></label>
                <label className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 font-bold">이모지<input type="checkbox" checked={emoji} onChange={(e) => setEmoji(e.target.checked)} /></label>
                <label className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 font-bold">FAQ 포함<input type="checkbox" checked={faq} onChange={(e) => setFaq(e.target.checked)} /></label>
              </div>
              <button onClick={generate} disabled={!topic && !mainKeyword} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-500 px-5 py-5 text-lg font-black text-white disabled:opacity-40">{busy === "generate" ? "작성중..." : "블로그 작성 시작"}</button>
            </section>
          </aside>
        </div>

        )}

        {activeStudio === "detail" && (
          <div className="grid gap-6 xl:grid-cols-[1fr_430px]">
            <main className="space-y-6">
              <section className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black">웹상세 빌더</h2>
                    <p className="mt-1 text-sm text-slate-500">제품 정보 → 카테고리별 법적 리스크 → 스토리보드 → 상세페이지 카피/이미지 프롬프트</p>
                  </div>
                  <button onClick={() => { setSections(getDefaultStoryboard(detailCategory)); setSaved("스토리보드를 초기화했습니다."); setTimeout(() => setSaved(""), 1600); }} className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-black text-purple-700">스토리보드 초기화</button>
                </div>
                <div className="mb-4 flex gap-2">
                  <input value={detailUrl} onChange={(e) => setDetailUrl(e.target.value)} placeholder="Amazon 등 상품 페이지 URL을 붙여넣으면 제목/설명을 긁어와 채웁니다" className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm" />
                  <button onClick={analyzeDetailUrl} disabled={busy === "detail-url"} className="rounded-xl bg-purple-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{busy === "detail-url" ? "분석중..." : "URL 분석해서 채우기"}</button>
                  <button onClick={importSingleSeoInfo} className="rounded-xl bg-orange-600 px-4 py-3 text-sm font-black text-white whitespace-nowrap">📥 단일 SEO 정보 가져오기</button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="브랜드명" className="rounded-xl border border-slate-300 px-4 py-3" />
                  <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="제품명" className="rounded-xl border border-slate-300 px-4 py-3" />
                  <select value={detailCategory} onChange={(e) => updateDetailCategory(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3">{detailCategories.map((item) => <option key={item}>{item}</option>)}</select>
                  <input value={volumePrice} onChange={(e) => setVolumePrice(e.target.value)} placeholder="용량 / 가격" className="rounded-xl border border-slate-300 px-4 py-3" />
                  <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3">{detailPlatforms.map((item) => <option key={item}>{item}</option>)}</select>
                  <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="타깃 고객" className="rounded-xl border border-slate-300 px-4 py-3" />
                  <textarea value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder="핵심 성분 / 주요 스펙" className="min-h-[110px] rounded-xl border border-slate-300 px-4 py-3" />
                  <textarea value={specs} onChange={(e) => setSpecs(e.target.value)} placeholder="전성분 / 상세 스펙 / 인증 자료" className="min-h-[110px] rounded-xl border border-slate-300 px-4 py-3" />
                  <textarea value={request} onChange={(e) => setRequest(e.target.value)} placeholder="사용자 요청사항" className="min-h-[110px] rounded-xl border border-slate-300 px-4 py-3" />
                  <textarea value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="상세페이지 컨셉" className="min-h-[110px] rounded-xl border border-slate-300 px-4 py-3" />
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-black">참고자료 업로드</h2>
                <p className="mt-1 text-sm text-slate-500">제품 사진, 기존 상세페이지, 성분표, 스펙 문서 등을 추가하면 상세페이지 생성에 반영됩니다.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {productImageUrl ? (
                    <div className="relative overflow-hidden rounded-2xl border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={productImageUrl} alt="제품 이미지" className="h-40 w-full object-cover" />
                      <button onClick={() => setProductImageUrl("")} className="absolute right-2 top-2 rounded-lg bg-white/90 px-2 py-1 text-xs font-black text-red-600">제거</button>
                      <div className="bg-white px-3 py-2 text-xs font-bold text-slate-500">아마존에서 가져온 제품 이미지</div>
                    </div>
                  ) : (
                    <label className="cursor-pointer rounded-2xl border border-dashed border-slate-300 p-5 hover:border-purple-400">🖼️ 제품/상세페이지 이미지<input hidden type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], "상세 이미지")}/><p className="mt-1 text-xs text-slate-400">제품 사진 또는 기존 상세페이지 이미지</p></label>
                  )}
                  <label className="cursor-pointer rounded-2xl border border-dashed border-slate-300 p-5 hover:border-purple-400">📄 성분표/스펙 문서<input hidden type="file" accept=".pdf,.doc,.docx,.txt,.html,.md" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], "상세 문서")}/><p className="mt-1 text-xs text-slate-400">TXT/HTML/MD는 일부 본문 자동 추출</p></label>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-black">스토리보드 설계</h2>
                  <button onClick={addSection} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white">+ 섹션 추가</button>
                </div>
                <div className="space-y-3">
                  {sections.map((section, i) => (
                    <div key={`${section.title}-${i}`} className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[40px_1fr_1.5fr_120px]">
                      <div className="font-black text-slate-400">{i + 1}</div>
                      <input value={section.title} onChange={(e) => updateSection(i, "title", e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 font-bold" />
                      <input value={section.desc} onChange={(e) => updateSection(i, "desc", e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2" />
                      <div className="flex gap-1">
                        <button onClick={() => moveSection(i, -1)} className="rounded-lg border px-2 text-xs font-black">↑</button>
                        <button onClick={() => moveSection(i, 1)} className="rounded-lg border px-2 text-xs font-black">↓</button>
                        <button onClick={() => removeSection(i)} className="rounded-lg bg-red-50 px-2 text-xs font-black text-red-600">삭제</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </main>

            <aside className="space-y-6">
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-black">컨셉 & 스타일</h2>
                <div className="mt-4 grid gap-3">
                  <select value={season} onChange={(e) => setSeason(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3">{detailSeasons.map((item) => <option key={item}>{item}</option>)}</select>
                  <select value={mood} onChange={(e) => setMood(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3">{detailMoods.map((item) => <option key={item}>{item}</option>)}</select>
                  <select value={event} onChange={(e) => setEvent(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3">{detailEvents.map((item) => <option key={item}>{item}</option>)}</select>
                  <select value={storyTemplate} onChange={(e) => setStoryTemplate(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3">{detailStoryTemplates.map((item) => <option key={item.key} value={item.key}>{item.title}</option>)}</select>
                </div>
              </section>
              <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
                <h2 className="text-xl font-black text-amber-800">법적 리스크 기준</h2>
                <ul className="mt-3 space-y-2 text-sm font-semibold text-amber-800">
                  <li>근거 없는 후기/인증/임상/수치 생성 금지</li>
                  <li>행사 옵션이 없으면 할인/증정/특가 문구 금지</li>
                  <li>카테고리별 광고법 기준 반영</li>
                  <li>마지막 섹션은 CTA로 고정</li>
                </ul>
              </section>
              <button onClick={generateDetail} disabled={!productName && !brand} className="w-full rounded-3xl bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-6 text-lg font-black text-white disabled:opacity-40">{busy === "detail" ? "상세페이지 생성중..." : "상세페이지 자동 생성"}</button>
            </aside>
          </div>
        )}

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-2xl font-black">{activeStudio === "detail" ? "상세페이지 생성 결과" : "생성 결과"}</h2><div className="flex flex-wrap gap-2"><button onClick={() => activeStudio === "detail" ? setDetailResult("") : setResult("")} className="rounded-xl bg-red-50 px-4 py-2 text-sm font-black text-red-600">현재 생성 삭제</button><button onClick={() => copy(activeStudio === "detail" ? detailResult : result)} className="rounded-xl border px-4 py-2 text-sm font-black">복사</button><button onClick={activeStudio === "detail" ? saveDetailLibrary : saveLibrary} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white">라이브러리 저장</button><button onClick={activeStudio === "detail" ? sendDetailToCardNews : () => { localStorage.setItem("cardNewsDraft", JSON.stringify({ article: { title: topic || mainKeyword || "카드뉴스", description: result } })); window.location.href = "/card-news"; }} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white">카드뉴스로 이동</button><button onClick={activeStudio === "detail" ? sendDetailToPublisher : sendBlogToPublisher} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white">SNS 발행으로 이동</button></div></div>
          {saved && <div className="mb-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{saved}</div>}
          {activeStudio === "detail" ? (detailResult ? <textarea value={detailResult} onChange={(e) => setDetailResult(e.target.value)} className="min-h-[520px] w-full rounded-2xl border border-slate-300 p-5 font-mono text-sm leading-7" /> : <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-400">상세페이지 생성 결과가 여기에 표시됩니다.</div>) : (result ? <textarea value={result} onChange={(e) => setResult(e.target.value)} className="min-h-[520px] w-full rounded-2xl border border-slate-300 p-5 font-mono text-sm leading-7" /> : <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-400">블로그 작성 결과가 여기에 표시됩니다.</div>)}
        </section>
      </div>
    </div>
  );
}
