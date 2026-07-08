"use client";

import { useEffect, useState } from "react";

type PublisherDraft = { title: string; body: string; imageUrl?: string; source?: string };

export default function PublisherPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [source, setSource] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("publisherDraft");
    if (!raw) return;
    try {
      const draft: PublisherDraft = JSON.parse(raw);
      setTitle(draft.title || "");
      setBody(draft.body || "");
      setImageUrl(draft.imageUrl || "");
      setSource(draft.source || "");
    } catch {}
    localStorage.removeItem("publisherDraft");
  }, []);

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(`${label} 복사됨`);
    setTimeout(() => setCopied(""), 1600);
  };

  const openX = () => {
    const text = [title, body].filter(Boolean).join("\n\n").slice(0, 270);
    window.open(`https://x.com/compose/post?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-950">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold text-emerald-600">SNS Publisher</p>
        <h1 className="mt-1 text-4xl font-black tracking-tight">SNS 발행</h1>
        <p className="mt-2 text-slate-500">
          {source ? "웹상세 빌더/블로그에서 넘어온 글을 확인하고 바로 발행하세요." : "글쓰기 스튜디오에서 \"SNS 발행으로 이동\"을 누르면 여기서 이어서 발행할 수 있어요."}
        </p>

        {copied && <div className="fixed right-6 top-6 z-50 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-lg">{copied}</div>}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" className="w-full rounded-xl border border-slate-300 px-4 py-3 font-bold" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="발행할 본문을 입력하거나 붙여넣으세요." className="h-96 w-full rounded-xl border border-slate-300 p-4 font-mono text-sm leading-6" />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => copy([title, body].filter(Boolean).join("\n\n"), "본문")} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black">전체 복사</button>
              <button onClick={openX} className="rounded-xl bg-black px-4 py-3 text-sm font-black text-white">X에 작성하기</button>
              <a
                href="https://www.blogger.com/blog/post/edit"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-black text-orange-700"
              >
                Blogspot 새 글 열기
              </a>
              <a
                href="https://wordpress.com/post/new"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700"
              >
                WordPress 새 글 열기
              </a>
            </div>
            <p className="text-xs text-slate-400">
              WordPress/Blogspot은 계정 로그인이 필요해서 자동 붙여넣기까지는 안 되고, 새 글 화면을 열어드려요. 위 &quot;전체 복사&quot;로 본문을 복사해서 붙여넣으면 됩니다.
            </p>
          </div>

          <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">대표 이미지</h2>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="대표 이미지" className="w-full rounded-2xl border border-slate-200 object-cover" />
            ) : (
              <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-300 text-sm text-slate-400">
                넘어온 이미지가 없어요.
              </div>
            )}
            {imageUrl && (
              <button onClick={() => copy(imageUrl, "이미지 링크")} className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-black">
                이미지 링크 복사
              </button>
            )}
            {source && <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">출처: {source === "writing-detail" ? "웹상세 빌더" : source === "writing-blog" ? "블로그 Writing Studio" : source}</p>}
          </aside>
        </div>
      </div>
    </main>
  );
}
