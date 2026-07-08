"use client";

import { useEffect, useMemo, useState } from "react";
import { deleteLibraryItem, getLibraryItems, getLibraryTypeLabel } from "@/lib/library";
import type { LibraryItem, LibraryItemType } from "@/types/content";

const typeFilters: (LibraryItemType | "전체")[] = ["전체", "article", "ai-result", "card-news", "image", "sns"];

export default function LibraryClient() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState<LibraryItemType | "전체">("전체");

  const refresh = () => setItems(getLibraryItems());

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return items.filter((item) => {
      const typeMatched = type === "전체" || item.type === type;
      const keywordMatched = !q || [item.title, item.description, item.source, item.type].join(" ").toLowerCase().includes(q);
      return typeMatched && keywordMatched;
    });
  }, [items, keyword, type]);

  const remove = (id: string) => {
    deleteLibraryItem(id);
    refresh();
  };

  return (
    <div className="space-y-6 p-8">
      <div>
        <p className="text-sm font-semibold text-blue-600">Library</p>
        <h1 className="mt-1 text-3xl font-black text-slate-950">콘텐츠 라이브러리</h1>
        <p className="mt-2 text-slate-500">AI 생성 결과, 카드뉴스 초안, 이미지 초안을 브라우저 저장소 기준으로 관리합니다.</p>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="제목, 출처, 설명 검색" className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900" />
          <select value={type} onChange={(event) => setType(event.target.value as LibraryItemType | "전체")} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
            {typeFilters.map((item) => (
              <option key={item} value={item}>{item === "전체" ? "전체 타입" : getLibraryTypeLabel(item)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {filtered.map((item) => (
          <article key={item.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{getLibraryTypeLabel(item.type)}</span>
              <span className="text-xs text-slate-400">{new Date(item.updatedAt).toLocaleString()}</span>
            </div>
            <h2 className="line-clamp-2 text-lg font-black text-slate-950">{item.title}</h2>
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-500">{item.description || "저장된 설명이 없습니다."}</p>
            {item.source && <p className="mt-3 text-xs font-semibold text-blue-600">출처: {item.source}</p>}
            <button onClick={() => remove(item.id)} className="mt-5 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200">삭제</button>
          </article>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400">아직 저장된 콘텐츠가 없습니다. Card News Studio에서 초안을 저장해보세요.</div>
      )}
    </div>
  );
}
