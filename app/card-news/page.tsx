/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-img-element */
"use client";

import type React from "react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type BgMode = "none" | "full" | "partial";
type CardLayout = {
  imageX: number;
  imageY: number;
  imageW: number;
  imageH: number;
  imageRadius: number;
  titleX: number;
  titleY: number;
  titleSize: number;
  bodyX: number;
  bodyY: number;
  bodySize: number;
  eyebrowX: number;
  eyebrowY: number;
  eyebrowSize: number;
  titleColor: string;
  bodyColor: string;
  eyebrowColor: string;
  titleBold: boolean;
  bodyBold: boolean;
  imageLayer: number;
  titleLayer: number;
  bodyLayer: number;
};
type Card = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  imagePrompt: string;
  imageUrl?: string;
  templateImage?: string;
  bgMode?: BgMode;
  layout?: CardLayout;
};
type Result = { title: string; subtitle: string; cards: Card[]; hashtags: string[] };
type Template = { id: string; name: string; kind: "system" | "upload"; image?: string; gradient?: string };

const SYSTEM_TEMPLATES: Template[] = [
  { id: "clean-blue", name: "Clean Blue", kind: "system", gradient: "linear-gradient(135deg,#eff6ff,#dbeafe)" },
  { id: "dark-news", name: "Dark News", kind: "system", gradient: "linear-gradient(135deg,#020617,#111827)" },
  { id: "purple-tech", name: "Purple Tech", kind: "system", gradient: "linear-gradient(135deg,#2e1065,#7c3aed)" },
  { id: "warm-editorial", name: "Warm Editorial", kind: "system", gradient: "linear-gradient(135deg,#fff7ed,#fed7aa)" },
  { id: "green-report", name: "Green Report", kind: "system", gradient: "linear-gradient(135deg,#ecfdf5,#bbf7d0)" },
  { id: "minimal-white", name: "Minimal White", kind: "system", gradient: "linear-gradient(135deg,#ffffff,#f8fafc)" },
];

const TITLE_SUGGESTIONS = ["핵심 변화", "지금 주목할 점", "왜 중요한가", "새로운 흐름", "실전 체크포인트", "다음 전망", "한눈에 요약", "꼭 알아야 할 내용"];

const DEFAULT_LAYOUT: CardLayout = {
  imageX: 8,
  imageY: 24,
  imageW: 84,
  imageH: 28,
  imageRadius: 18,
  titleX: 8,
  titleY: 64,
  titleSize: 34,
  bodyX: 8,
  bodyY: 76,
  bodySize: 18,
  eyebrowX: 8,
  eyebrowY: 8,
  eyebrowSize: 14,
  titleColor: "",
  bodyColor: "",
  eyebrowColor: "#60a5fa",
  titleBold: true,
  bodyBold: true,
  imageLayer: 10,
  titleLayer: 30,
  bodyLayer: 30,
};

function withLayout(card: Card): Card {
  return { ...card, layout: { ...DEFAULT_LAYOUT, ...(card.layout || {}) } };
}

const nudge = (value: number, delta: number, min = 0, max = 100) => Math.max(min, Math.min(max, value + delta));

export default function CardNewsPage() {
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [tone, setTone] = useState("news");
  const [theme, setTheme] = useState("dark");
  const [ratio, setRatio] = useState("1:1");
  const [cardCount, setCardCount] = useState(8);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const [selectAll, setSelectAll] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState("dark-news");
  const [uploadedTemplates, setUploadedTemplates] = useState<Template[]>([]);
  const [bgMode, setBgMode] = useState<BgMode>("partial");
  const [message, setMessage] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);

  // --- merged in from the old /image-studio page ---
  const [showImagePanel, setShowImagePanel] = useState(false);
  const [freeHeadline, setFreeHeadline] = useState("");
  const [freePrompt, setFreePrompt] = useState("");
  const [freeImageLoading, setFreeImageLoading] = useState(false);
  const [freeImage, setFreeImage] = useState("");
  const [freeImageHistory, setFreeImageHistory] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("imageStudioHistory");
    if (saved) {
      try {
        setFreeImageHistory(JSON.parse(saved));
      } catch {}
    }
  }, []);

  async function generateFreeImage() {
    if (!freePrompt.trim()) {
      alert("프롬프트를 입력하세요.");
      return;
    }
    setFreeImageLoading(true);
    try {
      const r = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: freePrompt, headline: freeHeadline, template: "card-news", ratio }),
      });
      const j = await r.json();
      if (!j.success || !j.imageUrl) {
        alert(j.message || "이미지 생성 실패");
        return;
      }
      setFreeImage(j.imageUrl);
      const next = [j.imageUrl, ...freeImageHistory].slice(0, 12);
      setFreeImageHistory(next);
      localStorage.setItem("imageStudioHistory", JSON.stringify(next));
    } finally {
      setFreeImageLoading(false);
    }
  }

  function applyFreeImageToCard(url: string) {
    if (!result) {
      alert("먼저 카드뉴스를 생성하세요.");
      return;
    }
    const targets = selectAll ? result.cards.map((_, idx) => idx) : [selected];
    const cards = [...result.cards];
    targets.forEach((idx) => {
      cards[idx] = withLayout({ ...cards[idx], imageUrl: url, bgMode });
    });
    setResult({ ...result, cards });
    setMessage(targets.length > 1 ? "선택한 모든 카드에 이미지를 적용했습니다." : "카드에 이미지를 적용했습니다.");
    setTimeout(() => setMessage(""), 1800);
  }
  // --- end merged /image-studio ---

  const templates = useMemo(() => [...SYSTEM_TEMPLATES, ...uploadedTemplates], [uploadedTemplates]);
  const selectedTemplate = templates.find((t) => t.id === activeTemplate) || SYSTEM_TEMPLATES[1];

  useEffect(() => {
    const draft = localStorage.getItem("cardNewsDraft");
    if (!draft) return;
    try {
      const d = JSON.parse(draft);
      const importedTitle = d.result?.title || d.article?.title || "";
      const importedSource = d.result?.summary || d.article?.description || "";
      setTitle(importedTitle);
      setSourceText(importedSource);
      if (d.result?.cardNews) {
        const total = d.result.cardNews.length;
        setResult({
          title: d.result.title,
          subtitle: d.result.summary,
          cards: d.result.cardNews.map((text: string, i: number) => ({
            id: `card-${i + 1}`,
            eyebrow: `${i + 1}/${total}`,
            title: i === 0 ? d.result.title : TITLE_SUGGESTIONS[(i - 1) % TITLE_SUGGESTIONS.length],
            body: text,
            imagePrompt: `Editorial Korean card news image about ${d.result.title}`,
            bgMode: "partial" as BgMode,
          })).map(withLayout),
          hashtags: d.result.hashtags || [],
        });
      } else if (d.article?.title) {
        // 뉴스 AI에서 "카드뉴스로" 넘어온 경우 — 제목만 채워두지 않고 바로 카드뉴스를 생성해서
        // 넘어오자마자 결과물이 보이도록 합니다.
        void generate(importedTitle, importedSource);
      }
      localStorage.removeItem("cardNewsDraft");
    } catch {}
  }, []);

  async function generate(overrideTitle?: string, overrideSourceText?: string) {
    const useTitle = overrideTitle ?? title;
    const useSourceText = overrideSourceText ?? sourceText;
    setLoading(true);
    setMessage("AI가 카드뉴스 문구를 생성 중입니다...");
    try {
      const r = await fetch("/api/card-news/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: useTitle, sourceText: useSourceText, tone, theme, ratio, cardCount }),
      });
      const j = await r.json();
      if (!j.success) return alert(j.message || "생성 실패");
      const data: Result = {
        ...j.data,
        cards: j.data.cards.map((card: Card) => withLayout({ ...card, bgMode: card.bgMode || bgMode, templateImage: selectedTemplate.image })),
      };
      setResult(data);
      setSelected(0);
      setSelectAll(false);
      localStorage.setItem("cardNewsProject", JSON.stringify(data));
      setMessage("카드뉴스 생성 완료");
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(""), 1800);
    }
  }

  function updateCard(i: number, patch: Partial<Card>) {
    if (!result) return;
    const cards = [...result.cards];
    cards[i] = withLayout({ ...cards[i], ...patch });
    setResult({ ...result, cards });
  }

  function move(i: number, dir: number) {
    if (!result) return;
    const ni = i + dir;
    if (ni < 0 || ni >= result.cards.length) return;
    const cards = [...result.cards];
    [cards[i], cards[ni]] = [cards[ni], cards[i]];
    const renumbered = cards.map((card, idx) => withLayout({ ...card, eyebrow: `${idx + 1}/${cards.length}` }));
    setResult({ ...result, cards: renumbered });
    setSelected(ni);
  }

  function addCard() {
    if (!result) return;
    const next = result.cards.length + 1;
    setResult({
      ...result,
      cards: [
        ...result.cards,
        {
          id: `card-${Date.now()}`,
          eyebrow: `${next}/${next}`,
          title: "새 핵심 문구",
          body: "본문을 입력하세요.",
          imagePrompt: "Clean modern Korean card news image",
          templateImage: selectedTemplate.image,
          bgMode,
        },
      ].map((card, idx, arr) => withLayout({ ...card, eyebrow: `${idx + 1}/${arr.length}` })),
    });
    setSelected(next - 1);
  }

  function removeCard(i: number) {
    if (!result) return;
    const cards = result.cards.filter((_, idx) => idx !== i).map((card, idx, arr) => withLayout({ ...card, eyebrow: `${idx + 1}/${arr.length}` }));
    setResult({ ...result, cards });
    setSelected(Math.max(0, Math.min(i, cards.length - 1)));
  }

  async function genImagesForSelection() {
    if (!result) return;
    const indexes = selectAll ? result.cards.map((_, idx) => idx) : [selected];
    setImageLoading(true);
    setMessage(selectAll ? "전체 카드 이미지 재생성 중입니다..." : "선택 카드 이미지 재생성 중입니다...");
    try {
      const cards = [...result.cards];
      const generated = await Promise.all(
        indexes.map(async (idx) => {
          const c = cards[idx];
          try {
            const r = await fetch("/api/image/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt: c.imagePrompt, headline: c.title, template: "card-news", ratio }),
            });
            const j = await r.json();
            return j.success && j.imageUrl ? { idx, imageUrl: j.imageUrl } : null;
          } catch {
            return null;
          }
        })
      );
      generated.forEach((g) => {
        if (!g) return;
        cards[g.idx] = withLayout({ ...cards[g.idx], imageUrl: g.imageUrl, bgMode });
      });
      setResult((prev) => (prev ? { ...prev, cards } : prev));
      const failCount = generated.filter((g) => !g).length;
      setMessage(failCount > 0 ? `${indexes.length - failCount}개 완료, ${failCount}개 실패` : selectAll ? "전체 이미지 변경 완료" : "이미지 변경 완료");
    } finally {
      setImageLoading(false);
      setTimeout(() => setMessage(""), 1800);
    }
  }

  async function regenerateSelectedText() {
    if (!result) return;
    const card = result.cards[selected];
    setLoading(true);
    try {
      const r = await fetch("/api/card-news/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: card.title, sourceText: `${sourceText}\n현재 카드 본문: ${card.body}`, tone, theme, ratio, cardCount: 3, saveToLibrary: false }),
      });
      const j = await r.json();
      if (!j.success) return alert(j.message || "문구 재생성 실패");
      const next = j.data.cards?.[0];
      if (next) updateCard(selected, { title: next.title, body: next.body, imagePrompt: next.imagePrompt });
    } finally {
      setLoading(false);
    }
  }

  function suggestTitle() {
    const base = TITLE_SUGGESTIONS[Math.floor(Math.random() * TITLE_SUGGESTIONS.length)];
    const keyword = title.replace(/["“”]/g, "").split(/[\s｜|:-]/).filter(Boolean).slice(0, 2).join(" ");
    updateCard(selected, { title: keyword ? `${base}: ${keyword}` : base });
  }
  function updateLayout(patch: Partial<CardLayout>) {
    if (!currentCard) return;
    updateCard(selected, { layout: { ...DEFAULT_LAYOUT, ...(currentCard.layout || {}), ...patch } });
  }

  function resetLayout() {
    updateCard(selected, { layout: { ...DEFAULT_LAYOUT } });
  }

  function applyTemplate(template: Template) {
    setActiveTemplate(template.id);
    if (!result) return;
    updateCard(selected, { templateImage: template.image, bgMode });
  }

  function uploadTemplate(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = String(reader.result || "");
      const item: Template = { id: `upload-${Date.now()}`, name: file.name.slice(0, 18), kind: "upload", image };
      setUploadedTemplates((prev) => [...prev, item]);
      setActiveTemplate(item.id);
      if (result) updateCard(selected, { templateImage: image, bgMode });
    };
    reader.readAsDataURL(file);
  }

  function downloadSvg(i: number) {
    const c = result?.cards[i];
    if (!c) return;
    const fill = selectedTemplate.gradient || (theme === "dark" ? "#020617" : "#eff6ff");
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='1080'><rect width='100%' height='100%' fill='${fill.includes("linear") ? "#020617" : fill}'/><text x='70' y='110' font-size='34' fill='#60a5fa' font-family='Arial'>${escapeXml(c.eyebrow)}</text><foreignObject x='70' y='180' width='940' height='760'><div xmlns='http://www.w3.org/1999/xhtml' style='font-family:Arial;color:${theme === "dark" ? "white" : "#111827"}'><h1 style='font-size:76px;line-height:1.05;margin:0 0 44px;font-weight:900'>${escapeXml(c.title)}</h1><p style='font-size:42px;line-height:1.45;margin:0'>${escapeXml(c.body)}</p></div></foreignObject></svg>`;
    const a = document.createElement("a");
    a.href = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    a.download = `card-${i + 1}.svg`;
    a.click();
  }

  function downloadPdf() {
    window.print();
  }

  const currentCard = result?.cards[selected];

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-950">
      <style jsx global>{`
        .studio-btn { cursor: pointer; transition: transform .14s ease, box-shadow .14s ease, opacity .14s ease, border-color .14s ease; }
        .studio-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(15,23,42,.12); }
        .studio-btn:active:not(:disabled) { transform: scale(.97); }
        .studio-btn:disabled { cursor: not-allowed; opacity: .55; }
        .card-tile { cursor: pointer; transition: transform .16s ease, box-shadow .16s ease, outline-color .16s ease; }
        .card-tile:hover { transform: translateY(-3px); box-shadow: 0 18px 40px rgba(15,23,42,.18); }
        .canvas-el { position:absolute; cursor:move; transition:outline-color .12s ease, transform .12s ease; }
        .canvas-el:hover { outline:2px dashed rgba(59,130,246,.85); outline-offset:4px; }
        .canvas-img { object-fit:cover; box-shadow:0 14px 32px rgba(15,23,42,.22); }
        .canvas-handle { cursor:nwse-resize; }
        .pulse-click { animation: pulseClick .35s ease; }
        @keyframes pulseClick { 0%{transform:scale(.98)} 70%{transform:scale(1.02)} 100%{transform:scale(1)} }
        @media print { aside, .no-print, nav, button, input, textarea, select { display:none!important; } .print-grid { display:grid!important; grid-template-columns: repeat(2, minmax(0, 1fr))!important; } }
      `}</style>

      <div className="mb-6 flex items-start justify-between gap-4 no-print">
        <div>
          <p className="text-sm font-semibold text-blue-600">Card News Studio v2.1.2 Mouse UX</p>
          <h1 className="text-3xl font-black">Canva 스타일 카드뉴스 제작</h1>
          <p className="text-slate-500">마우스로 글자/이미지를 직접 이동하고, 상단에서 전체선택·이미지 재생성을 바로 실행합니다.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImagePanel((v) => !v)} className="studio-btn rounded-2xl border bg-white px-5 py-4 font-bold text-slate-700">
            {showImagePanel ? "이미지 생성 접기" : "🖼️ 이미지 먼저 만들기"}
          </button>
          <button onClick={generate} disabled={loading} className="studio-btn rounded-2xl bg-slate-950 px-6 py-4 font-bold text-white">
            {loading ? "생성 중..." : "AI 카드뉴스 생성"}
          </button>
        </div>
      </div>

      {showImagePanel && (
        <div className="no-print mb-6 rounded-3xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black">이미지 먼저 만들기</h2>
              <p className="text-sm text-slate-500">포스터/인포그래픽 이미지를 먼저 만들고, 완성되면 선택한 카드(또는 전체 카드)의 배경으로 바로 적용하세요.</p>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-3">
              <input className="w-full rounded-xl border p-3" placeholder="Headline (선택)" value={freeHeadline} onChange={(e) => setFreeHeadline(e.target.value)} />
              <textarea className="h-28 w-full rounded-xl border p-3" placeholder="이미지 프롬프트" value={freePrompt} onChange={(e) => setFreePrompt(e.target.value)} />
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <button type="button" onClick={() => setFreePrompt(`A premium Korean typography poster featuring the phrase "${freeHeadline || "주제"}" as the dominant centerpiece, contemporary Korean brush-pen lettering, luxury editorial layout, cinematic gradient background, clean negative space, highly polished graphic design`)} className="studio-btn rounded-xl border p-2">타이포 포스터</button>
                <button type="button" onClick={() => setFreePrompt(`Create a professional minimalistic food poster featuring ${freeHeadline || "food item"} as the high-end hero subject, hyper-realistic texture, cinematic lighting, premium typography, clean commercial layout, ample negative space`)} className="studio-btn rounded-xl border p-2">푸드 포스터</button>
                <button type="button" onClick={() => setFreePrompt(`Fashion editorial photo with red handwritten English fashion annotations, arrows, cute crown, ribbon and heart stickers, praising outfit details and accessories, soft neutral background, high-resolution fashion photography`)} className="studio-btn rounded-xl border p-2">패션 주석</button>
                <button type="button" onClick={() => setFreePrompt(`Premium infographic report, dashboard style cards, progress bars, charts, clean Korean typography, data-driven layout, modern startup report aesthetic`)} className="studio-btn rounded-xl border p-2">인포그래픽</button>
              </div>
              <button onClick={generateFreeImage} disabled={freeImageLoading} className="studio-btn w-full rounded-xl bg-purple-600 p-3 font-bold text-white disabled:opacity-50">
                {freeImageLoading ? "생성 중..." : "이미지 생성"}
              </button>
            </div>
            <div className="flex items-center justify-center rounded-2xl border bg-slate-50 p-2">
              {freeImage ? (
                <img src={freeImage} alt="generated" className="max-h-64 w-full object-contain" />
              ) : (
                <span className="text-sm text-slate-400">생성된 이미지가 여기에 보여요.</span>
              )}
            </div>
            <div className="flex flex-col justify-center gap-2">
              <button onClick={() => applyFreeImageToCard(freeImage)} disabled={!freeImage} className="studio-btn rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
                {selectAll ? "전체 카드 배경으로 적용" : "선택 카드 배경으로 적용"}
              </button>
              <a href={freeImage || undefined} download={freeImage ? "image.png" : undefined} className={`studio-btn rounded-xl border px-4 py-3 text-center text-sm font-bold ${freeImage ? "" : "pointer-events-none opacity-40"}`}>
                이미지 다운로드
              </a>
            </div>
          </div>
          {freeImageHistory.length > 0 && (
            <div className="mt-4 grid grid-cols-4 gap-2 md:grid-cols-8">
              {freeImageHistory.map((h, i) => (
                <button key={i} onClick={() => setFreeImage(h)} className={`studio-btn overflow-hidden rounded-xl border ${freeImage === h ? "border-blue-600 ring-2 ring-blue-100" : ""}`}>
                  <img src={h} alt="history" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {message && <div className="no-print mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700">{message}</div>}

      <div className="grid gap-6 xl:grid-cols-[360px_1fr_360px]">
        <aside className="no-print space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
          <input className="w-full rounded-xl border p-3" placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="h-44 w-full rounded-xl border p-3" placeholder="기사/본문" value={sourceText} onChange={(e) => setSourceText(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <select className="rounded-xl border p-3" value={tone} onChange={(e) => setTone(e.target.value)}>{["news", "viral", "premium", "friendly"].map((v) => <option key={v}>{v}</option>)}</select>
            <select className="rounded-xl border p-3" value={theme} onChange={(e) => setTheme(e.target.value)}>{["blue", "dark", "purple", "green", "warm"].map((v) => <option key={v}>{v}</option>)}</select>
            <select className="rounded-xl border p-3" value={ratio} onChange={(e) => setRatio(e.target.value)}>{["1:1", "4:5", "16:9"].map((v) => <option key={v}>{v}</option>)}</select>
            <input className="rounded-xl border p-3" type="number" min={3} max={12} value={cardCount} onChange={(e) => setCardCount(Number(e.target.value))} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["none", "partial", "full"] as BgMode[]).map((v) => <button key={v} onClick={() => setBgMode(v)} className={`studio-btn rounded-xl border p-2 text-sm ${bgMode === v ? "border-blue-600 bg-blue-50 text-blue-700" : ""}`}>{v === "none" ? "배경없음" : v === "partial" ? "일부분" : "전체"}</button>)}
          </div>
          <button onClick={addCard} disabled={!result} className="studio-btn w-full rounded-xl bg-blue-600 p-3 font-bold text-white">카드 추가</button>
          <button onClick={downloadPdf} disabled={!result} className="studio-btn w-full rounded-xl bg-slate-900 p-3 font-bold text-white">PDF 출력</button>
          <div className="space-y-2">
            {result?.cards.map((c, i) => (
              <button key={c.id} onClick={() => { setSelected(i); setSelectAll(false); }} className={`studio-btn w-full rounded-xl border p-3 text-left text-sm ${selected === i ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100" : "bg-white"}`}>
                {i + 1}. {c.title}
              </button>
            ))}
          </div>
        </aside>

        <main className="space-y-6">
          {result ? (
            <>
              <section className="rounded-3xl border bg-white p-6 shadow-sm">
                <h2 className="text-xl font-black">{result.title}</h2>
                <p className="mt-1 text-slate-500">{result.subtitle}</p>
                <p className="mt-2 text-sm text-slate-400">#{result.hashtags.join(" #")}</p>
              </section>
              <div className="no-print sticky top-3 z-20 flex flex-wrap items-center gap-2 rounded-2xl border bg-white/95 p-3 shadow-sm backdrop-blur">
                <button onClick={() => setSelectAll((v) => !v)} className={`studio-btn rounded-xl border px-4 py-2 text-sm font-black ${selectAll ? "border-blue-600 bg-blue-600 text-white" : "bg-white"}`}>{selectAll ? "전체선택 해제" : "전체선택"}</button>
                <button onClick={genImagesForSelection} disabled={imageLoading} className="studio-btn rounded-xl bg-purple-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{selectAll ? "전체 이미지 재생성" : "선택 이미지 재생성"}</button>
                <button onClick={regenerateSelectedText} disabled={loading || selectAll} className="studio-btn rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">선택 문구 재생성</button>
                <span className="text-xs font-bold text-slate-500">마우스로 카드 위 글자/이미지를 바로 움직일 수 있습니다.</span>
              </div>
              <div ref={previewRef} className="print-grid grid gap-5 md:grid-cols-2">
                {result.cards.map((c, i) => (
                  <CardPreview key={c.id} card={c} index={i} selected={selectAll || selected === i} template={selectedTemplate} theme={theme} onClick={() => { setSelected(i); setSelectAll(false); }} onLayoutChange={(patch) => { setSelected(i); updateCard(i, { layout: { ...DEFAULT_LAYOUT, ...(c.layout || {}), ...patch } }); }} onTextChange={(patch) => { setSelected(i); updateCard(i, patch); }} />
                ))}
              </div>
            </>
          ) : (
            <div className="flex min-h-[500px] items-center justify-center rounded-3xl border border-dashed bg-white text-center text-slate-500">
              왼쪽에 기사/본문을 넣고 AI 카드뉴스 생성을 누르세요.
            </div>
          )}
        </main>

        <aside className="no-print space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black">선택 카드 편집</h3>
          {currentCard ? (
            <>
              <input className="w-full rounded-xl border p-3" value={currentCard.eyebrow} onChange={(e) => updateCard(selected, { eyebrow: e.target.value })} />
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input className="w-full rounded-xl border p-3" value={currentCard.title} onChange={(e) => updateCard(selected, { title: e.target.value })} />
                <button onClick={suggestTitle} className="studio-btn rounded-xl bg-amber-100 px-3 font-bold text-amber-700">추천</button>
              </div>
              <textarea className="h-28 w-full rounded-xl border p-3" value={currentCard.body} onChange={(e) => updateCard(selected, { body: e.target.value })} />
              <textarea className="h-24 w-full rounded-xl border p-3" value={currentCard.imagePrompt} onChange={(e) => updateCard(selected, { imagePrompt: e.target.value })} />

              <div className="rounded-2xl border bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-black">마우스 편집 모드</h4>
                  <button onClick={resetLayout} className="studio-btn rounded-xl bg-white px-3 py-2 text-xs font-bold">위치 초기화</button>
                </div>
                <p className="text-sm leading-relaxed text-slate-600">
                  카드 미리보기에서 제목, 본문, 번호, 이미지를 마우스로 끌어서 위치를 조정하세요. 오른쪽 숫자 슬라이더는 제거했습니다.
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-bold">
                  <label>제목색<input className="mt-1 h-10 w-full rounded-lg border" type="color" value={(currentCard.layout || DEFAULT_LAYOUT).titleColor || (theme === "dark" ? "#ffffff" : "#0f172a")} onChange={(e) => updateLayout({ titleColor: e.target.value })} /></label>
                  <label>본문색<input className="mt-1 h-10 w-full rounded-lg border" type="color" value={(currentCard.layout || DEFAULT_LAYOUT).bodyColor || (theme === "dark" ? "#ffffff" : "#334155")} onChange={(e) => updateLayout({ bodyColor: e.target.value })} /></label>
                  <label>번호색<input className="mt-1 h-10 w-full rounded-lg border" type="color" value={(currentCard.layout || DEFAULT_LAYOUT).eyebrowColor || "#60a5fa"} onChange={(e) => updateLayout({ eyebrowColor: e.target.value })} /></label>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className={`studio-btn rounded-xl border p-2 text-sm ${((currentCard.layout || DEFAULT_LAYOUT).titleBold) ? "bg-slate-950 text-white" : "bg-white"}`} onClick={() => updateLayout({ titleBold: !((currentCard.layout || DEFAULT_LAYOUT).titleBold) })}>제목 굵게</button>
                  <button className={`studio-btn rounded-xl border p-2 text-sm ${((currentCard.layout || DEFAULT_LAYOUT).bodyBold) ? "bg-slate-950 text-white" : "bg-white"}`} onClick={() => updateLayout({ bodyBold: !((currentCard.layout || DEFAULT_LAYOUT).bodyBold) })}>본문 굵게</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => move(selected, -1)} className="studio-btn rounded-xl border p-3">위로</button>
                <button onClick={() => move(selected, 1)} className="studio-btn rounded-xl border p-3">아래로</button>
                <button onClick={regenerateSelectedText} disabled={loading} className="studio-btn rounded-xl bg-indigo-600 p-3 font-bold text-white">문구 재생성</button>
                <button onClick={genImagesForSelection} disabled={imageLoading} className="studio-btn rounded-xl bg-purple-600 p-3 font-bold text-white">{selectAll ? "전체 이미지 재생성" : "이미지 재생성"}</button>
                <button onClick={() => downloadSvg(selected)} className="studio-btn rounded-xl bg-green-600 p-3 font-bold text-white">PNG/SVG</button>
                <button onClick={() => removeCard(selected)} className="studio-btn rounded-xl bg-red-50 p-3 font-bold text-red-600">삭제</button>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-black">무료 템플릿</h4>
                  <label className="studio-btn cursor-pointer rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold">
                    업로드
                    <input type="file" accept="image/*" onChange={uploadTemplate} className="hidden" />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {templates.map((t) => <button key={t.id} onClick={() => applyTemplate(t)} className={`studio-btn overflow-hidden rounded-xl border p-2 text-left text-xs font-bold ${activeTemplate === t.id ? "border-blue-600 ring-2 ring-blue-100" : ""}`}>
                    <div className="mb-2 h-14 rounded-lg bg-slate-100" style={{ background: t.image ? `url(${t.image}) center/cover` : t.gradient }} />
                    {t.name}
                  </button>)}
                </div>
              </div>
            </>
          ) : <p className="text-sm text-slate-500">카드를 생성하거나 선택하세요.</p>}
        </aside>
      </div>
    </div>
  );
}

function CardPreview({ card, selected, template, theme, onClick, onLayoutChange, onTextChange }: { card: Card; index: number; selected: boolean; template: Template; theme: string; onClick: () => void; onLayoutChange: (patch: Partial<CardLayout>) => void; onTextChange: (patch: Partial<Card>) => void }) {
  const [editTarget, setEditTarget] = useState<"title" | "body">("title");
  const dark = theme === "dark" || template.id.includes("dark") || template.id.includes("purple");
  const bgImage = card.imageUrl || card.templateImage || template.image;
  const mode = card.bgMode || "partial";
  const layout = { ...DEFAULT_LAYOUT, ...(card.layout || {}) };
  const backgroundStyle = bgImage && mode === "full" ? { backgroundImage: `linear-gradient(rgba(2,6,23,.62),rgba(2,6,23,.74)),url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: template.gradient || (dark ? "#020617" : "#eff6ff") };
  const textColor = dark || mode === "full" ? "text-white" : "text-slate-950";

  function startDrag(e: React.PointerEvent<HTMLElement>, target: "image" | "title" | "body" | "eyebrow") {
    e.preventDefault();
    e.stopPropagation();
    onClick();
    const box = e.currentTarget.closest("[data-card-canvas]") as HTMLElement | null;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { ...layout };
    const move = (ev: PointerEvent) => {
      const dx = ((ev.clientX - startX) / rect.width) * 100;
      const dy = ((ev.clientY - startY) / rect.height) * 100;
      if (target === "image") onLayoutChange({ imageX: nudge(start.imageX, dx), imageY: nudge(start.imageY, dy) });
      if (target === "title") onLayoutChange({ titleX: nudge(start.titleX, dx), titleY: nudge(start.titleY, dy) });
      if (target === "body") onLayoutChange({ bodyX: nudge(start.bodyX, dx), bodyY: nudge(start.bodyY, dy) });
      if (target === "eyebrow") onLayoutChange({ eyebrowX: nudge(start.eyebrowX, dx), eyebrowY: nudge(start.eyebrowY, dy) });
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function startResize(e: React.PointerEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    onClick();
    const box = e.currentTarget.closest("[data-card-canvas]") as HTMLElement | null;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { ...layout };
    const move = (ev: PointerEvent) => {
      const dx = ((ev.clientX - startX) / rect.width) * 100;
      const dy = ((ev.clientY - startY) / rect.height) * 100;
      onLayoutChange({ imageW: Math.max(10, Math.min(100, start.imageW + dx)), imageH: Math.max(8, Math.min(100, start.imageH + dy)) });
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === "Enter") onClick(); }} className={`card-tile pulse-click relative aspect-square overflow-hidden rounded-[28px] p-0 text-left shadow-sm outline outline-2 ${selected ? "outline-blue-500" : "outline-transparent"}`} style={backgroundStyle}>
      <div data-card-canvas className={`relative h-full w-full ${textColor}`}>
        <p onPointerDown={(e) => startDrag(e, "eyebrow")} className="canvas-el font-black" style={{ left: `${layout.eyebrowX}%`, top: `${layout.eyebrowY}%`, fontSize: layout.eyebrowSize, color: layout.eyebrowColor || "#60a5fa", zIndex: 40 }}>{card.eyebrow}</p>
        {bgImage && mode === "partial" && (
          <div onPointerDown={(e) => startDrag(e, "image")} className="canvas-el" style={{ left: `${layout.imageX}%`, top: `${layout.imageY}%`, width: `${layout.imageW}%`, height: `${layout.imageH}%`, zIndex: layout.imageLayer }}>
            <img src={bgImage} alt="" className="canvas-img h-full w-full" style={{ borderRadius: layout.imageRadius }} draggable={false} />
            {selected && <span onPointerDown={startResize} className="canvas-handle absolute -bottom-2 -right-2 h-5 w-5 rounded-full border-2 border-white bg-blue-600 shadow" title="이미지 크기 조절" />}
          </div>
        )}
        {selected && (
          <div className="absolute left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-2xl border bg-white/95 p-2 text-slate-950 shadow-xl backdrop-blur" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            <div className="flex overflow-hidden rounded-lg border text-xs font-black">
              <button className={`px-2 py-1 ${editTarget === "title" ? "bg-slate-950 text-white" : "bg-white"}`} onClick={() => setEditTarget("title")}>제목</button>
              <button className={`px-2 py-1 ${editTarget === "body" ? "bg-slate-950 text-white" : "bg-white"}`} onClick={() => setEditTarget("body")}>본문</button>
            </div>
            <button
              className="rounded-lg border px-2 py-1 text-xs font-black"
              onClick={() =>
                editTarget === "title"
                  ? onLayoutChange({ titleSize: Math.max(16, layout.titleSize - 2) })
                  : onLayoutChange({ bodySize: Math.max(12, layout.bodySize - 1) })
              }
            >
              A-
            </button>
            <span className="min-w-[34px] text-center text-xs font-bold tabular-nums text-slate-500">
              {editTarget === "title" ? layout.titleSize : layout.bodySize}px
            </span>
            <button
              className="rounded-lg border px-2 py-1 text-xs font-black"
              onClick={() =>
                editTarget === "title"
                  ? onLayoutChange({ titleSize: Math.min(70, layout.titleSize + 2) })
                  : onLayoutChange({ bodySize: Math.min(34, layout.bodySize + 1) })
              }
            >
              A+
            </button>
            <button
              className={`rounded-lg border px-2 py-1 text-xs font-black ${(editTarget === "title" ? layout.titleBold : layout.bodyBold) ? "bg-slate-950 text-white" : "bg-white"}`}
              onClick={() =>
                editTarget === "title"
                  ? onLayoutChange({ titleBold: !layout.titleBold })
                  : onLayoutChange({ bodyBold: !layout.bodyBold })
              }
            >
              굵게
            </button>
            <input
              title={editTarget === "title" ? "제목 색상" : "본문 색상"}
              type="color"
              value={(editTarget === "title" ? layout.titleColor : layout.bodyColor) || (dark ? "#ffffff" : "#0f172a")}
              onChange={(e) => onLayoutChange(editTarget === "title" ? { titleColor: e.target.value } : { bodyColor: e.target.value })}
              className="h-7 w-8 rounded border"
            />
          </div>
        )}
        <h3 contentEditable suppressContentEditableWarning onBlur={(e)=>onTextChange({ title: e.currentTarget.innerText.trim() || card.title })} onPointerDown={(e) => startDrag(e, "title")} onDoubleClick={(e)=>{e.stopPropagation(); (e.currentTarget as HTMLElement).focus();}} className="canvas-el max-w-[88%] leading-tight drop-shadow-sm" style={{ left: `${layout.titleX}%`, top: `${layout.titleY}%`, fontSize: layout.titleSize, color: layout.titleColor || undefined, fontWeight: layout.titleBold ? 900 : 600, zIndex: layout.titleLayer }}>{card.title}</h3>
        <p contentEditable suppressContentEditableWarning onBlur={(e)=>onTextChange({ body: e.currentTarget.innerText.trim() || card.body })} onPointerDown={(e) => startDrag(e, "body")} onDoubleClick={(e)=>{e.stopPropagation(); (e.currentTarget as HTMLElement).focus();}} className="canvas-el max-w-[86%] leading-relaxed opacity-90" style={{ left: `${layout.bodyX}%`, top: `${layout.bodyY}%`, fontSize: layout.bodySize, color: layout.bodyColor || undefined, fontWeight: layout.bodyBold ? 700 : 400, zIndex: layout.bodyLayer }}>{card.body}</p>
        {selected && <span className="pointer-events-none absolute bottom-4 right-4 rounded-full bg-blue-600 px-3 py-1 text-xs font-black text-white">선택됨 · 더블클릭 수정 · 드래그 이동</span>}
      </div>
    </div>
  );
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;", "'": "&apos;" }[c] || c));
}
