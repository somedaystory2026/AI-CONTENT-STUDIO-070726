"use client";

import { useEffect, useMemo, useState } from "react";
import { promptCategories, promptLibrary } from "@/lib/prompt-library";

const categoryEmoji: Record<string, string> = {
  "전체": "🔎",
  "즐겨찾기": "⭐",
  "음악 AI": "🎵",
  "SNS": "🚀",
  "쇼츠": "⚡",
  "글쓰기/SEO": "✍️",
  "쇼핑/Amazon": "🛒",
  "이미지": "🖼️",
  "영상": "🎬",
  "채널 셋업": "📺",
  "AI 도구": "🧰",
};

export default function PromptOSPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const [selectedId, setSelectedId] = useState(promptLibrary[0]?.id || "");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("prompt-os-favorites");
    if (saved) setFavorites(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("prompt-os-favorites", JSON.stringify(favorites));
  }, [favorites]);

  const categories = useMemo(() => ["전체", "즐겨찾기", ...promptCategories], []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return promptLibrary.filter((item) => {
      const categoryOk =
        category === "전체" ||
        (category === "즐겨찾기" ? favorites.includes(item.id) : item.category === category);
      const text = `${item.name} ${item.category} ${item.sourceCategory} ${item.description} ${item.tags.join(" ")} ${item.prompt}`.toLowerCase();
      return categoryOk && (!q || text.includes(q));
    });
  }, [category, favorites, query]);

  const selected = promptLibrary.find((item) => item.id === selectedId) || filtered[0] || promptLibrary[0];

  const useInAI = () => {
    if (!selected) return;
    localStorage.setItem("prompt-os-selected", JSON.stringify(selected));
    location.href = "/ai";
  };

  const copyPrompt = async (value = selected?.prompt || "") => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1300);
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  return (
    <main className="ml-[260px] min-h-screen bg-slate-50 p-7 text-slate-950">
      <div className="mb-5 rounded-[28px] border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm font-black text-violet-600">v4.5 Prompt OS + Suno Producer Bible</div>
            <h1 className="text-4xl font-black tracking-tight">프롬프트 모음집</h1>
            <p className="text-slate-500">검색 → 선택 → 복사 또는 AI 생성기에서 바로 사용. 음악 AI/Suno 프롬프트도 추가했습니다.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-slate-100 px-5 py-3"><div className="text-2xl font-black">{promptLibrary.length}</div><div className="text-xs text-slate-500">전체</div></div>
            <div className="rounded-2xl bg-slate-100 px-5 py-3"><div className="text-2xl font-black">{filtered.length}</div><div className="text-xs text-slate-500">검색결과</div></div>
            <div className="rounded-2xl bg-slate-100 px-5 py-3"><div className="text-2xl font-black">{favorites.length}</div><div className="text-xs text-slate-500">즐겨찾기</div></div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`rounded-full border px-4 py-2 text-sm font-black transition ${category === item ? "border-slate-950 bg-slate-950 text-white" : "bg-white hover:border-violet-500 hover:bg-violet-50"}`}
            >
              {categoryEmoji[item] || "📌"} {item}
            </button>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-[390px_1fr] gap-5">
        <aside className="rounded-[28px] border bg-white p-5 shadow-sm">
          <div className="sticky top-4 z-10 bg-white pb-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="검색: Suno, KPOP, 쇼츠, YouTube, Amazon, 썸네일..."
              className="w-full rounded-2xl border px-4 py-3 font-bold outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            />
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>카테고리: <b className="text-slate-900">{category}</b></span>
              <button onClick={() => setCompact(!compact)} className="rounded-full border px-3 py-1 font-bold text-slate-700">{compact ? "자세히" : "간단히"}</button>
            </div>
          </div>

          <div className="max-h-[690px] space-y-2 overflow-y-auto pr-1">
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full cursor-pointer rounded-2xl border p-3 text-left transition hover:border-violet-500 hover:bg-violet-50 active:scale-[0.99] ${selected?.id === item.id ? "border-violet-500 bg-violet-50 shadow-sm" : "bg-white"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="line-clamp-1 font-black">{item.name}</div>
                    <div className="mt-1 text-xs font-bold text-violet-600">{item.category} · {item.recommendedModel}</div>
                  </div>
                  <span onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }} className="rounded-full px-1 text-xl leading-none">{favorites.includes(item.id) ? "★" : "☆"}</span>
                </div>
                {!compact && <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{item.description}</p>}
                {!compact && <div className="mt-2 flex flex-wrap gap-1">{item.tags.slice(0, 4).map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">#{tag}</span>)}</div>}
              </button>
            ))}
            {filtered.length === 0 && <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">검색 결과가 없습니다.</div>}
          </div>
        </aside>

        <section className="rounded-[28px] border bg-white p-6 shadow-sm">
          {selected ? (
            <>
              <div className="mb-5 flex items-start justify-between gap-4 border-b pb-5">
                <div>
                  <div className="text-sm font-black text-violet-600">{selected.sourceCategory} · {selected.category}</div>
                  <h2 className="text-3xl font-black tracking-tight">{selected.name}</h2>
                  <p className="mt-2 text-slate-500">{selected.description}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => toggleFavorite(selected.id)} className="rounded-xl border bg-white px-4 py-3 font-black transition hover:bg-slate-100">{favorites.includes(selected.id) ? "★ 저장됨" : "☆ 저장"}</button>
                  <button onClick={() => copyPrompt()} className="rounded-xl border bg-white px-4 py-3 font-black transition hover:bg-slate-100 active:scale-95">{copied ? "복사됨" : "복사"}</button>
                  <button onClick={useInAI} className="rounded-xl bg-slate-950 px-4 py-3 font-black text-white transition hover:scale-[1.02] active:scale-95">AI 생성기에서 사용</button>
                </div>
              </div>

              <div className="mb-5 grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">추천 AI</div><div className="text-lg font-black">{selected.recommendedModel}</div></div>
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">변수</div><div className="text-sm font-bold leading-6">{selected.variables.join(", ")}</div></div>
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">태그</div><div className="text-sm font-bold leading-6">{selected.tags.join(", ")}</div></div>
              </div>

              <div className="mb-3 flex items-center justify-between">
                <div className="font-black">프롬프트 내용</div>
                <button onClick={() => copyPrompt()} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-black text-white">{copied ? "복사됨" : "내용 복사"}</button>
              </div>
              <textarea readOnly value={selected.prompt} className="h-[590px] w-full resize-none rounded-2xl border bg-slate-950 p-5 font-mono text-sm leading-6 text-slate-100 outline-none" />
            </>
          ) : <div>프롬프트가 없습니다.</div>}
        </section>
      </section>
    </main>
  );
}
