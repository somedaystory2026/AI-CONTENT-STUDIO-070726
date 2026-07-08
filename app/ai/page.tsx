"use client";

import { useEffect, useMemo, useState } from "react";
import { promptLibrary } from "@/lib/prompt-library";
import { promptPresets } from "@/lib/studio-presets";

type Message = { role: "user" | "assistant"; content: string; createdAt: string };
type ToneCode = "professional" | "friendly" | "viral" | "premium" | "storytelling" | "seo";
type LanguageCode = "ko" | "en" | "ko-en" | "ja" | "es";
type ModeCode = "news" | "blog" | "sns" | "rewrite" | "translate";

const tones: { label: string; value: ToneCode }[] = [
  { label: "전문가", value: "professional" },
  { label: "친근한", value: "friendly" },
  { label: "바이럴", value: "viral" },
  { label: "고급스러운", value: "premium" },
  { label: "스토리텔링", value: "storytelling" },
  { label: "SEO 최적화", value: "seo" },
];
const languages: { label: string; value: LanguageCode }[] = [
  { label: "한국어", value: "ko" }, { label: "영어", value: "en" }, { label: "한국어+영어", value: "ko-en" }, { label: "일본어", value: "ja" }, { label: "스페인어", value: "es" },
];
const modes: { label: string; value: ModeCode }[] = [
  { label: "뉴스/요약", value: "news" }, { label: "블로그/SEO", value: "blog" }, { label: "SNS 문안", value: "sns" }, { label: "다시 작성", value: "rewrite" }, { label: "번역", value: "translate" },
];

function cleanGeneratedX(text: string, fallbackInput: string) {
  const source = text || buildXFallback(fallbackInput);
  const url = source.match(/https?:\/\/\S+/)?.[0]?.replace(/[)\],.]+$/, "") || fallbackInput.match(/(?:원문|링크)[:=]\s*(https?:\/\/\S+)/)?.[1] || "";
  const tagMatches = Array.from(source.matchAll(/#[가-힣A-Za-z0-9_]+/g)).map((m) => m[0]);
  const tags = Array.from(new Set(tagMatches.length ? tagMatches : ["#뉴스", "#이슈", "#트렌드"])).slice(0, 5);
  const body = source
    .replace(/https?:\/\/\S+/g, "")
    .replace(/#[가-힣A-Za-z0-9_]+/g, "")
    .replace(/원문\s*:?/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 100)
    .trim();
  return [body || buildXBody(fallbackInput), tags.join(" "), url].filter(Boolean).join("\n\n");
}

function buildXBody(text: string) {
  const title = (text.match(/뉴스 제목:\s*(.*)/)?.[1] || text.match(/제목=([^\n]+)/)?.[1] || text.match(/제목:\s*(.*)/)?.[1] || "지금 주목할 뉴스")
    .replace(/["“”]/g, "")
    .replace(/\s+-\s+.*$/, "")
    .trim();
  return `${title.slice(0, 58)}\n핵심만 빠르게 확인해보세요.`.slice(0, 100);
}

function buildXFallback(text: string) {
  const url = text.match(/원문:\s*(https?:\/\/\S+)/)?.[1] || text.match(/원문=(https?:\/\/\S+)/)?.[1] || text.match(/링크:\s*(https?:\/\/\S+)/)?.[1] || "";
  return [buildXBody(text), "#뉴스 #이슈 #트렌드", url].filter(Boolean).join("\n\n");
}

export default function AIGeneratorProPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("AI 콘텐츠 자동화에 대한 고전환 콘텐츠 기획안을 작성해줘.");
  const [systemPrompt, setSystemPrompt] = useState("너는 AI Content Studio Pro의 한국어 콘텐츠 전략가다. 실무자가 바로 복사해 사용할 수 있는 완성형 문장으로 작성한다.");
  const [tone, setTone] = useState<ToneCode>("professional");
  const [language, setLanguage] = useState<LanguageCode>("ko");
  const [mode, setMode] = useState<ModeCode>("blog");
  const [model, setModel] = useState("openai");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [variables, setVariables] = useState("주제=AI SaaS\n타깃=콘텐츠 크리에이터\n제목=AI Content Studio\n키워드=AI 자동화");
  const [usage, setUsage] = useState({ tokens: 0, cost: 0 });
  const [category, setCategory] = useState("전체");
  const [copied, setCopied] = useState("");
  const [showPromptStudio, setShowPromptStudio] = useState(true);
  const [showHistory, setShowHistory] = useState(true);
  const [autoRunPending, setAutoRunPending] = useState(false);
  const [xDraftMode, setXDraftMode] = useState(false);

  const categories = useMemo(() => ["전체", ...Array.from(new Set(promptLibrary.map((item) => item.category)))], []);
  const filteredPrompts = useMemo(() => category === "전체" ? promptLibrary : promptLibrary.filter((item) => item.category === category), [category]);
  const variableMap = useMemo(() => Object.fromEntries(variables.split("\n").map((line) => line.split("=")).filter((item) => item.length === 2).map(([key, value]) => [key.trim(), value.trim()])), [variables]);
  const latestResult = [...messages].reverse().find((m) => m.role === "assistant")?.content || "";

  useEffect(() => {
    const saved = localStorage.getItem("ai-pro-history");
    if (saved) setHistory(JSON.parse(saved));
    const draft = localStorage.getItem("ai-pro-draft");
    if (draft) {
      try {
        const data = JSON.parse(draft) as { input?: string; systemPrompt?: string; mode?: ModeCode; tone?: ToneCode; language?: LanguageCode; variables?: string; autoRun?: boolean; xMode?: boolean };
        if (data.input) setInput(data.input);
        if (data.systemPrompt) setSystemPrompt(data.systemPrompt);
        if (data.mode) setMode(data.mode);
        if (data.tone) setTone(data.tone);
        if (data.language) setLanguage(data.language);
        if (data.variables) setVariables(data.variables);
        if (data.xMode) setXDraftMode(true);
        if (data.autoRun) {
          setShowPromptStudio(false);
          setShowHistory(false);
          setAutoRunPending(true);
        }
      } catch {}
      localStorage.removeItem("ai-pro-draft");
    } else {
      const article = localStorage.getItem("selectedArticle");
      if (article) {
        try {
          const news = JSON.parse(article) as { title?: string; description?: string; link?: string; source?: string };
          setMode("blog"); setTone("seo");
          setInput(`다음 뉴스를 바탕으로 블로그 글, 카드뉴스 핵심 포인트, SNS 문구를 생성해줘.\n\n제목: ${news.title || ""}\n출처: ${news.source || ""}\n링크: ${news.link || ""}\n내용: ${news.description || ""}`);
          setSystemPrompt("너는 AI 생성기 Pro의 뉴스 콘텐츠 에디터다. 한국어로 SEO 블로그 초안, 카드뉴스 핵심 문장, SNS 문구를 실무자가 바로 복사할 수 있게 작성한다.");
        } catch {}
        // 뉴스 페이지 재방문 시 다시 쓰기 위해 selectedArticle은 유지합니다.
      }
    }
  }, []);

  const applyVariables = (text: string) => Object.entries(variableMap).reduce((result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)).replaceAll(`[${key}]`, String(value)), text);

  const runGenerate = async (action: "generate" | "retry" | "continue" = "generate") => {
    if (!input.trim() && action !== "continue") return;
    const userText = action === "continue" ? "앞의 답변을 이어서 작성해줘." : applyVariables(input);
    setMessages((prev) => [...prev, { role: "user", content: userText, createdAt: new Date().toISOString() }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, title: userText.slice(0, 80), sourceText: `${systemPrompt}\n\n[사용자 입력]\n${userText}\n\n[AI 모델 요청]\n${model}`, tone, language, preset: "prompt-os", saveToLibrary: true }),
      });
      const json = await res.json();
      let content = json?.data?.mainContent || json?.data?.content || json?.data?.text || json?.message || JSON.stringify(json.data || json, null, 2);
      if (mode === "sns" || xDraftMode) content = cleanGeneratedX(json?.data?.twitter || json?.data?.mainContent || buildXFallback(userText), userText);
      const aiMessage: Message = { role: "assistant", content, createdAt: new Date().toISOString() };
      setMessages((prev) => [...prev, aiMessage]);
      const nextHistory = [userText, ...history.filter((item) => item !== userText)].slice(0, 20);
      setHistory(nextHistory); localStorage.setItem("ai-pro-history", JSON.stringify(nextHistory));
      const tokens = json?.data?.usage?.totalTokens || json?.usage?.totalTokens || Math.ceil((userText.length + content.length) / 4);
      setUsage((prev) => ({ tokens: prev.tokens + tokens, cost: Number((prev.cost + tokens * 0.000002).toFixed(4)) }));
    } catch (error) {
      setMessages((prev) => [...prev, { role: "assistant", content: `오류: ${error instanceof Error ? error.message : "생성 실패"}`, createdAt: new Date().toISOString() }]);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!autoRunPending) return;
    setAutoRunPending(false);
    setTimeout(() => runGenerate(), 250);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunPending]);

  const deleteMessage = (index: number) => setMessages((prev) => prev.filter((_, i) => i !== index));
  const deleteHistory = (target: string) => { const next = history.filter((item) => item !== target); setHistory(next); localStorage.setItem("ai-pro-history", JSON.stringify(next)); };
  const clearAllGenerated = () => { setMessages([]); setUsage({ tokens: 0, cost: 0 }); };
  const copyText = async (text: string, label = "결과") => { await navigator.clipboard.writeText(text); setCopied(`${label} 복사됨`); setTimeout(() => setCopied(""), 1600); };
  const openX = (text = latestResult) => {
    const finalText = text || buildXFallback(input);
    window.open(`https://x.com/compose/post?text=${encodeURIComponent(finalText)}`, "_blank", "noopener,noreferrer");
  };
  const saveToLibrary = () => { localStorage.setItem(`library-ai-${Date.now()}`, JSON.stringify({ messages, systemPrompt, tone, language, mode, model, usage })); alert("라이브러리에 저장했습니다."); };

  return (
    <main className="ml-[260px] min-h-screen bg-slate-50 p-5 text-slate-950">
      <div className="mb-4 flex items-center justify-between">
        <div><div className="text-sm font-bold text-blue-600">v3.9 AI 생성기 + X 자동작성</div><h1 className="text-3xl font-black">AI 생성기 Pro</h1><p className="text-slate-500">결과 중심 화면 · X는 본문 80~100자 + 해시태그 + 기사 URL</p></div>
        <div className="flex gap-2"><button onClick={() => setShowPromptStudio((v) => !v)} className="rounded-xl border bg-white px-4 py-3 font-bold">프롬프트 {showPromptStudio ? "접기" : "열기"}</button><button onClick={() => setShowHistory((v) => !v)} className="rounded-xl border bg-white px-4 py-3 font-bold">기록 {showHistory ? "접기" : "열기"}</button><button onClick={saveToLibrary} className="rounded-xl bg-slate-900 px-4 py-3 font-bold text-white">라이브러리 저장</button><button onClick={() => setMessages([])} className="rounded-xl border bg-white px-4 py-3 font-bold">새 대화</button></div>
      </div>
      {copied && <div className="fixed right-6 top-6 z-50 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-lg">{copied}</div>}
      <section className={`grid gap-4 ${showPromptStudio && showHistory ? "grid-cols-[300px_minmax(0,1fr)_240px]" : showPromptStudio ? "grid-cols-[300px_minmax(0,1fr)]" : showHistory ? "grid-cols-[minmax(0,1fr)_240px]" : "grid-cols-1"}`}>
        {showPromptStudio && <aside className="space-y-3 rounded-3xl border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black">프롬프트 스튜디오</h2><label className="block text-sm font-bold">시스템 프롬프트</label><textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} className="h-20 w-full rounded-xl border p-3 text-sm" />
          <div className="grid grid-cols-2 gap-3"><select value={tone} onChange={(e) => setTone(e.target.value as ToneCode)} className="rounded-xl border p-3">{tones.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><select value={language} onChange={(e) => setLanguage(e.target.value as LanguageCode)} className="rounded-xl border p-3">{languages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3"><select value={mode} onChange={(e) => setMode(e.target.value as ModeCode)} className="rounded-xl border p-3">{modes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><select value={model} onChange={(e) => setModel(e.target.value)} className="rounded-xl border p-3"><option value="openai">OpenAI</option><option value="gemini">Gemini</option><option value="claude">Claude</option><option value="grok">Grok</option></select></div>
          <label className="block text-sm font-bold">변수</label><textarea value={variables} onChange={(e) => setVariables(e.target.value)} className="h-20 w-full rounded-xl border p-3 text-sm" />
          <div className="flex items-center justify-between"><h3 className="font-black">프롬프트 모음집</h3><a href="/prompts" className="text-sm font-bold text-blue-600">전체 보기</a></div><select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border p-3">{categories.map((item) => <option key={item}>{item}</option>)}</select>
          <div className="max-h-52 space-y-2 overflow-y-auto pr-1">{filteredPrompts.slice(0, 20).map((preset) => <button key={preset.id} onClick={() => { setSystemPrompt(`너는 ${preset.name} 전문 AI 어시스턴트다. 결과는 한국어로 실무자가 바로 사용할 수 있게 작성한다.`); setInput(preset.prompt); setMode(preset.category.includes("SEO") || preset.category.includes("글쓰기") ? "blog" : preset.category.includes("SNS") ? "sns" : "news"); }} className="w-full rounded-xl border p-3 text-left transition hover:border-blue-500 hover:bg-blue-50"><div className="font-bold">{preset.name}</div><div className="text-xs text-slate-500">{preset.category} · {preset.recommendedModel}</div></button>)}</div>
          <button onClick={() => { setMode("sns"); setTone("viral"); setSystemPrompt("너는 X(트위터) 콘텐츠 전문 카피라이터다. 본문 80~100자, 해시태그 3~5개, 실제 기사 URL을 줄바꿈으로 작성한다. Google News RSS 주소는 금지한다."); setInput("다음 뉴스를 X 게시글로 만들어줘.\n\n요구사항:\n- 본문 80~100자\n- 짧은 문단 2~3줄\n- 해시태그 3~5개\n- 마지막 줄 실제 기사 URL\n- 과장/낚시/이모지 금지"); }} className="w-full rounded-xl bg-slate-950 p-3 text-left text-sm font-black text-white">X 트위터 100자 프롬프트</button><details className="rounded-xl border p-3"><summary className="cursor-pointer font-bold">기본 프리셋</summary><div className="mt-2 space-y-2">{promptPresets.map((preset) => <button key={preset.id} onClick={() => { setSystemPrompt(preset.systemPrompt); setInput(preset.userPrompt); }} className="w-full rounded-xl bg-slate-50 p-3 text-left text-sm hover:bg-slate-100">{preset.name}</button>)}</div></details>
        </aside>}
        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b pb-3"><h2 className="text-lg font-black">AI 작업공간</h2><div className="flex items-center gap-2 text-xs text-slate-500"><span>토큰 {usage.tokens.toLocaleString()} · ${usage.cost}</span>{latestResult && <button onClick={() => copyText(latestResult, "최근 결과")} className="rounded-lg border bg-white px-2 py-1 font-bold text-slate-700">최근 결과 복사</button>}{messages.length > 0 && <button onClick={clearAllGenerated} className="rounded-lg bg-red-50 px-2 py-1 font-bold text-red-600">전체 삭제</button>}{latestResult && <button onClick={() => openX()} className="rounded-lg bg-slate-950 px-3 py-1 font-bold text-white">X 작성하기</button>}</div></div>
          <div className="mb-3 max-h-[430px] min-h-[280px] space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-4">
            {messages.length === 0 && <div className="flex h-56 items-center justify-center text-slate-400">생성 버튼을 누르세요. 뉴스 X용은 들어오면 자동 생성됩니다.</div>}
            {messages.map((message, index) => message.role === "user" ? <details key={index} className="rounded-xl border bg-white/70 p-3 text-xs text-slate-500"><summary className="cursor-pointer font-bold">입력 프롬프트 보기</summary><pre className="mt-2 whitespace-pre-wrap">{message.content}</pre></details> : <div key={index} className="group relative max-w-[760px] rounded-2xl bg-white p-4 text-slate-900 shadow-sm whitespace-pre-wrap"><div className="absolute right-2 top-2 flex gap-1"><button onClick={() => copyText(message.content, "결과")} className="rounded-lg border bg-white px-2 py-1 text-xs font-bold">복사</button><button onClick={() => openX(message.content)} className="rounded-lg bg-slate-950 px-2 py-1 text-xs font-bold text-white">X 작성</button><button onClick={() => deleteMessage(index)} className="rounded-lg bg-red-600 px-2 py-1 text-xs font-bold text-white">삭제</button></div><div className="pr-36">{message.content}</div></div>)}
            {loading && <div className="w-56 animate-pulse rounded-2xl bg-white p-4 text-slate-400 shadow-sm">AI 생성 중...</div>}
          </div>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} className="h-20 w-full rounded-2xl border p-4" placeholder="여기에 요청을 입력하세요." />
          <div className="mt-3 flex gap-2"><button disabled={loading} onClick={() => runGenerate()} className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-50">생성</button><button disabled={loading} onClick={() => runGenerate("continue")} className="rounded-xl border bg-white px-5 py-3 font-bold">이어쓰기</button><button disabled={loading} onClick={() => runGenerate("retry")} className="rounded-xl border bg-white px-5 py-3 font-bold">다시 생성</button><button disabled={!latestResult} onClick={() => copyText(latestResult, "결과")} className="rounded-xl border bg-white px-5 py-3 font-bold disabled:opacity-40">복사</button><button disabled={!latestResult && !input} onClick={() => openX()} className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-40">X 바로가기</button><button disabled={!messages.length} onClick={clearAllGenerated} className="rounded-xl bg-red-50 px-5 py-3 font-bold text-red-600 disabled:opacity-40">생성물 삭제</button></div>
        </section>
        {showHistory && <aside className="space-y-3 rounded-3xl border bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-lg font-black">생성 기록</h2>{history.length > 0 && <button onClick={() => { setHistory([]); localStorage.removeItem("ai-pro-history"); }} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-600">기록 삭제</button>}</div>{history.map((item, index) => <div key={index} className="flex gap-2"><button onClick={() => setInput(item)} className="flex-1 rounded-xl bg-slate-50 p-3 text-left text-sm hover:bg-slate-100">{item.slice(0, 90)}</button><button onClick={() => deleteHistory(item)} className="rounded-xl bg-red-50 px-3 text-xs font-bold text-red-600">삭제</button></div>)}<h2 className="pt-4 text-lg font-black">미리보기</h2><div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-600">X 작성하기를 누르면 작성창에 글이 자동 입력됩니다.</div></aside>}
      </section>
    </main>
  );
}
