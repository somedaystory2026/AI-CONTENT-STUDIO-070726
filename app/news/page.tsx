"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { categories, countries } from "@/lib/rss-feeds";
import type { NewsItem, ArticleStatus } from "@/types/content";

type RssSource = { id: string; name: string; url: string; country: string; language: string; category: string; priority: number; enabled: boolean };

const statusStyle: Record<ArticleStatus, string> = {
  collected: "bg-slate-100 text-slate-700",
  generated: "bg-blue-50 text-blue-700",
  carded: "bg-purple-50 text-purple-700",
  imaged: "bg-pink-50 text-pink-700",
  published: "bg-green-50 text-green-700",
};

const statusLabel: Record<ArticleStatus, string> = {
  collected: "수집 완료",
  generated: "AI 생성 완료",
  carded: "카드뉴스 완료",
  imaged: "이미지 완료",
  published: "발행 완료",
};

export default function NewsPage() {
  const router = useRouter();
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [country, setCountry] = useState("전체");
  const [category, setCategory] = useState("전체");
  const [limit, setLimit] = useState(10);
  const [errors, setErrors] = useState<{ feed: string; message: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<"x" | "ai">("x");
  const [xDrafts, setXDrafts] = useState<Record<string, string>>({});
  const [xGenerating, setXGenerating] = useState<string[]>([]);
  const [publishedIds, setPublishedIds] = useState<string[]>([]);
  const [pendingPublishIds, setPendingPublishIds] = useState<string[]>([]);
  const [generatedIds, setGeneratedIds] = useState<string[]>([]);
  const [hasLoadedLocalCache, setHasLoadedLocalCache] = useState(false);
  const [urlResolvingIds, setUrlResolvingIds] = useState<string[]>([]);
  const [urlResolveMessages, setUrlResolveMessages] = useState<Record<string, string>>({});

  // --- merged in from the old /rss page ---
  const [showSources, setShowSources] = useState(false);
  const [sources, setSources] = useState<RssSource[]>([]);
  const [srcCountries, setSrcCountries] = useState<string[]>(["ALL"]);
  const [srcLanguages, setSrcLanguages] = useState<string[]>(["ALL"]);
  const [srcCategories, setSrcCategories] = useState<string[]>(["ALL"]);
  const [srcCountry, setSrcCountry] = useState("ALL");
  const [srcLanguage, setSrcLanguage] = useState("ALL");
  const [srcCategory, setSrcCategory] = useState("ALL");
  const [srcQuery, setSrcQuery] = useState("");
  const [favoriteSourceIds, setFavoriteSourceIds] = useState<string[]>([]);
  const [aiAction, setAiAction] = useState<"summary" | "translate" | "rewrite" | "compare">("summary");
  const [aiOutputs, setAiOutputs] = useState<Record<string, string>>({});
  const [aiLoadingIds, setAiLoadingIds] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("rss-favorites");
    if (saved) {
      try {
        setFavoriteSourceIds(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const loadSources = async () => {
    const params = new URLSearchParams({ country: srcCountry, language: srcLanguage, category: srcCategory, q: srcQuery });
    const res = await fetch(`/api/rss/sources?${params.toString()}`);
    const json = await res.json();
    setSources(json.data.sources);
    setSrcCountries(json.data.countries);
    setSrcLanguages(json.data.languages);
    setSrcCategories(json.data.categories);
  };

  useEffect(() => {
    if (showSources) void loadSources();
  }, [showSources, srcCountry, srcLanguage, srcCategory]);

  const toggleFavoriteSource = (id: string) => {
    const next = favoriteSourceIds.includes(id) ? favoriteSourceIds.filter((item) => item !== id) : [...favoriteSourceIds, id];
    setFavoriteSourceIds(next);
    localStorage.setItem("rss-favorites", JSON.stringify(next));
  };

  const exportSources = () => {
    const blob = new Blob([JSON.stringify(sources, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rss-sources-export.json";
    a.click();
  };

  const runQuickAI = async (news: NewsItem, action: typeof aiAction) => {
    setAiAction(action);
    setActivePreviewId(news.id);
    setPanelTab("ai");
    setAiLoadingIds((prev) => Array.from(new Set([...prev, news.id])));
    try {
      const res = await fetch("/api/news/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, title: news.title, content: news.description, language: "ko" }),
      });
      const json = await res.json();
      setAiOutputs((prev) => ({ ...prev, [news.id]: json.data?.output || "AI 결과를 가져오지 못했습니다." }));
    } catch {
      setAiOutputs((prev) => ({ ...prev, [news.id]: "AI 요청 중 오류가 발생했습니다." }));
    } finally {
      setAiLoadingIds((prev) => prev.filter((id) => id !== news.id));
    }
  };

  const sendToCardNews = (news: NewsItem) => {
    localStorage.setItem(
      "cardNewsDraft",
      JSON.stringify({ article: { title: news.title, description: news.description } })
    );
    router.push("/card-news");
  };
  // --- end merged /rss features ---

  useEffect(() => {
    try {
      setNewsItems(JSON.parse(localStorage.getItem("newsItemsCache") || "[]"));
      setErrors(JSON.parse(localStorage.getItem("newsErrorsCache") || "[]"));
      setXDrafts(JSON.parse(localStorage.getItem("newsXDrafts") || "{}"));
      setPublishedIds(JSON.parse(localStorage.getItem("publishedArticleIds") || "[]"));
      setPendingPublishIds(JSON.parse(localStorage.getItem("pendingPublishArticleIds") || "[]"));
      setGeneratedIds(JSON.parse(localStorage.getItem("generatedArticleIds") || "[]"));
    } catch {
      // 로컬 캐시가 깨져도 화면은 정상 표시합니다.
    } finally {
      setHasLoadedLocalCache(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedLocalCache) return;
    localStorage.setItem("newsItemsCache", JSON.stringify(newsItems));
  }, [hasLoadedLocalCache, newsItems]);

  useEffect(() => {
    if (!hasLoadedLocalCache) return;
    localStorage.setItem("newsErrorsCache", JSON.stringify(errors));
  }, [hasLoadedLocalCache, errors]);

  useEffect(() => {
    if (!hasLoadedLocalCache) return;
    localStorage.setItem("publishedArticleIds", JSON.stringify(publishedIds));
  }, [hasLoadedLocalCache, publishedIds]);

  useEffect(() => {
    if (!hasLoadedLocalCache) return;
    localStorage.setItem("pendingPublishArticleIds", JSON.stringify(pendingPublishIds));
  }, [hasLoadedLocalCache, pendingPublishIds]);

  useEffect(() => {
    if (!hasLoadedLocalCache) return;
    localStorage.setItem("generatedArticleIds", JSON.stringify(generatedIds));
  }, [hasLoadedLocalCache, generatedIds]);

  useEffect(() => {
    if (!hasLoadedLocalCache) return;
    localStorage.setItem("newsXDrafts", JSON.stringify(xDrafts));
  }, [hasLoadedLocalCache, xDrafts]);

  const [addressFilter, setAddressFilter] = useState<"all" | "google" | "resolved">("all");

  const filteredItems = useMemo(() => {
    const value = keyword.trim().toLowerCase();

    return newsItems.filter((item) => {
      const matchesCountry = country === "전체" || item.country === country;
      const matchesCategory = category === "전체" || item.category === category;
      const matchesAddress =
        addressFilter === "all" ||
        (addressFilter === "google" && item.isGoogleNewsFallback) ||
        (addressFilter === "resolved" && !item.isGoogleNewsFallback);
      const matchesKeyword =
        !value ||
        [item.title, item.description, item.source, item.country, item.category]
          .join(" ")
          .toLowerCase()
          .includes(value);

      return matchesCountry && matchesCategory && matchesAddress && matchesKeyword;
    });
  }, [addressFilter, category, country, keyword, newsItems]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => filteredItems.some((item) => item.id === id)));
  }, [filteredItems]);

  const collectNews = async () => {
    try {
      setLoading(true);
      setErrors([]);

      const params = new URLSearchParams({
        limit: String(limit),
        country,
        category,
      });

      const res = await fetch(`/api/rss/collect?${params.toString()}`);
      const json = await res.json();

      if (!json.success) {
        alert(json.message || "뉴스 수집 실패");
        return;
      }

      const incoming = (json.data || []) as NewsItem[];
      setNewsItems((prev) => {
        const map = new Map<string, NewsItem>();
        [...incoming, ...prev].forEach((item) => {
          const published = publishedIds.includes(item.id);
          const pending = pendingPublishIds.includes(item.id);
          const generated = generatedIds.includes(item.id);
          map.set(item.id, {
            ...item,
            status: published ? "published" : pending || generated ? "generated" : item.status,
          });
        });
        return Array.from(map.values());
      });
      setErrors(json.errors || []);
    } catch (error) {
      console.error(error);
      alert("뉴스 수집 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const resolveArticleUrl = async (news: NewsItem, force = false) => {
    const current = news.originalLink || news.link || "";
    if (!current.includes("news.google.com")) return { url: current, fallback: false, message: "이미 원문 주소입니다." };

    try {
      const params = new URLSearchParams({
        url: current,
        title: news.title || "",
        source: news.source || "",
        force: force ? "1" : "0",
      });
      const res = await fetch(`/api/rss/resolve?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      const resolved = json.url || current;
      return {
        url: resolved,
        fallback: Boolean(json.fallback || resolved.includes("news.google.com")),
        message: json.message || "",
      };
    } catch {
      return { url: current, fallback: true, message: "재시도 실패: 네트워크 또는 Google News 응답 문제" };
    }
  };

  const retryResolveArticleUrl = async (news: NewsItem) => {
    setUrlResolvingIds((prev) => Array.from(new Set([...prev, news.id])));
    setUrlResolveMessages((prev) => ({ ...prev, [news.id]: "원문 주소 다시 확인 중..." }));

    const result = await resolveArticleUrl(news, true);
    setNewsItems((prev) =>
      prev.map((item) =>
        item.id === news.id
          ? { ...item, link: result.url, originalLink: result.url, isGoogleNewsFallback: result.fallback }
          : item
      )
    );

    if (xDrafts[news.id]) {
      setXDrafts((prev) => ({ ...prev, [news.id]: buildXPost({ ...news, link: result.url, originalLink: result.url, isGoogleNewsFallback: result.fallback }, result.url) }));
    }

    setUrlResolveMessages((prev) => ({
      ...prev,
      [news.id]: result.fallback ? "아직 실패 · Google News가 원문을 숨김" : "원문 복원 완료",
    }));
    setUrlResolvingIds((prev) => prev.filter((id) => id !== news.id));
  };

  const cleanTitle = (title: string) =>
    title
      .replace(/\s+-\s+[^-]{2,25}$/, "")
      .replace(/["“”‘’]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const sanitizeTag = (value: string) =>
    value
      .replace(/[＃#]/g, "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[^0-9A-Za-z가-힣一-龥ぁ-んァ-ン]/g, "")
      .trim();

  const addTag = (tags: string[], raw: string) => {
    const tag = sanitizeTag(raw);
    if (!tag || tag.length < 2 || tag.length > 22) return;
    const normalized = tag.toLowerCase();
    if (tags.some((item) => item.slice(1).toLowerCase() === normalized)) return;
    tags.push(`#${tag}`);
  };

  const extractSeoKeywords = (news: NewsItem) => {
    const title = cleanTitle(news.title || "");
    const description = news.description || "";
    const source = news.source || "";
    const text = `${title} ${description}`;
    const tags: string[] = [];

    const stopWords = new Set([
      "단독", "속보", "영상", "사진", "종합", "오늘", "뉴스", "관련", "이번", "대한", "위해", "에서", "으로", "에게", "까지", "부터", "한다", "했다", "있는", "없는", "기자", "억원", "만원", "구독", "확인", "핵심", "빠르게",
      "google", "news", "korea", "entertainment", "nate", "naver", "chosun", "joins", "yna", "reuters", "ap", "bbc", "cnn", "the", "and", "for", "with", "from", "that", "this", "have", "after", "before", "says", "said",
    ]);

    // 1) 제목에 직접 등장하는 인물/기업/사건 키워드를 가장 먼저 태그화합니다.
    const quoted = title.match(/[가-힣A-Za-z0-9][가-힣A-Za-z0-9\s·&.'’-]{1,24}(?=,|，|…|\.\.\.|\s)/g) || [];
    quoted.slice(0, 3).forEach((keyword) => addTag(tags, keyword));

    const englishEntities = text.match(/\b[A-Z][A-Za-z0-9&.'’+-]{1,}(?:\s+[A-Z][A-Za-z0-9&.'’+-]{1,}){0,3}\b/g) || [];
    englishEntities.slice(0, 6).forEach((keyword) => addTag(tags, keyword));

    const koreanCandidates = text.match(/[가-힣A-Za-z0-9]{2,12}/g) || [];
    const scored = new Map<string, number>();
    koreanCandidates.forEach((word, index) => {
      const clean = sanitizeTag(word);
      if (!clean || stopWords.has(clean.toLowerCase())) return;
      if (/^[0-9]+$/.test(clean)) return;
      const score = (title.includes(clean) ? 8 : 2) + Math.max(0, 5 - index * 0.15) + (clean.length >= 3 ? 1 : 0);
      scored.set(clean, (scored.get(clean) || 0) + score);
    });

    Array.from(scored.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .forEach(([keyword]) => addTag(tags, keyword));

    // 2) 카테고리/국가별 검색 유입 태그를 보강합니다.
    const categoryTagMap: Record<string, string[]> = {
      연예: ["연예뉴스", "실시간이슈", "KPOP", "한류", "연예속보"],
      경제: ["경제뉴스", "증시", "투자", "시장분석", "비즈니스"],
      정치: ["정치뉴스", "국회", "정부", "정책", "사회이슈"],
      스포츠: ["스포츠뉴스", "축구", "야구", "월드컵", "경기결과"],
      건강: ["건강뉴스", "의료", "헬스케어", "건강정보"],
      패션: ["패션뉴스", "트렌드", "스타일", "패션이슈"],
      기술: ["테크뉴스", "AI", "IT", "스타트업", "인공지능"],
      AI: ["AI뉴스", "인공지능", "테크뉴스", "챗GPT"],
    };

    const commonByCountry: Record<string, string[]> = {
      한국: ["한국뉴스", "실시간뉴스"],
      일본: ["JapanNews", "日本ニュース"],
      인도: ["IndiaNews", "Bollywood", "India"],
      미국: ["USNews", "BreakingNews"],
      글로벌: ["WorldNews", "GlobalNews"],
    };

    (categoryTagMap[news.category] || [news.category === "전체" ? "뉴스" : news.category, "이슈", "실시간뉴스"]).forEach((tag) => addTag(tags, tag));
    (commonByCountry[news.country] || []).forEach((tag) => addTag(tags, tag));

    // 3) 기사 내용 기반 보강 태그입니다.
    const ruleTags: Array<[RegExp, string[]]> = [
      [/악플|고소|신원|명예훼손|댓글/i, ["악플", "고소", "온라인이슈"]],
      [/배우|아이돌|가수|드라마|영화|콘서트|팬/i, ["연예", "스타뉴스"]],
      [/AI|인공지능|ChatGPT|OpenAI|로봇/i, ["AI", "인공지능", "테크"]],
      [/SpaceX|Starship|NASA|rocket|우주|발사/i, ["SpaceX", "Starship", "NASA", "우주산업"]],
      [/월드컵|축구|FIFA|선수|감독/i, ["월드컵", "축구", "스포츠이슈"]],
      [/주가|증시|반도체|환율|금리|시장|투자/i, ["증시", "투자", "경제이슈"]],
    ];
    ruleTags.forEach(([regex, candidates]) => {
      if (regex.test(text)) candidates.forEach((tag) => addTag(tags, tag));
    });

    addTag(tags, source.replace(/Google News|Korea|Entertainment/gi, ""));
    return tags;
  };

  const makeHashtags = (news: NewsItem, maxChars = 86) => {
    const tags = extractSeoKeywords(news);
    const selected: string[] = [];

    for (const tag of tags) {
      const next = [...selected, tag].join(" ");
      if (next.length <= maxChars) selected.push(tag);
      if (selected.length >= 10) break;
    }

    if (selected.length < 6) {
      ["#뉴스", "#이슈", "#실시간뉴스"].forEach((tag) => {
        const next = [...selected, tag].join(" ");
        if (!selected.includes(tag) && next.length <= maxChars) selected.push(tag);
      });
    }

    return selected.join(" ");
  };

  const buildXPost = (news: NewsItem, realUrl: string) => {
    const title = cleanTitle(news.title || "오늘의 이슈");
    const hook = title.length > 74 ? `${title.slice(0, 72)}…` : title;
    const categoryLabel = news.category && news.category !== "전체" ? `${news.category}뉴스` : "실시간 뉴스";
    let body = `${hook}\n핵심만 빠르게 확인해보세요. · ${categoryLabel}`;
    let hashtags = makeHashtags(news, 92);
    let draft = `${body}\n\n${hashtags}\n\n${realUrl}`;

    // X는 280자까지 가능하지만, 미리보기는 짧고 태그가 풍부하게 보이도록 자동 조절합니다.
    if (draft.length > 260) {
      body = hook.length > 66 ? `${hook.slice(0, 64)}…` : hook;
      hashtags = makeHashtags(news, 72);
      draft = `${body}\n\n${hashtags}\n\n${realUrl}`;
    }

    if (draft.length > 280) {
      hashtags = makeHashtags(news, 54);
      draft = `${body}\n\n${hashtags}\n\n${realUrl}`;
    }

    return draft;
  };

  const markPublished = (id: string) => {
    setPublishedIds((prev) => Array.from(new Set([...prev, id])));
    setPendingPublishIds((prev) => prev.filter((item) => item !== id));
    setNewsItems((prev) => prev.map((item) => item.id === id ? { ...item, status: "published" as ArticleStatus } : item));
  };

  const saveXDraft = async (news: NewsItem) => {
    setXGenerating((prev) => Array.from(new Set([...prev, news.id])));
    const resolved = await resolveArticleUrl(news, true);
    const realUrl = resolved.url;
    const draft = buildXPost(news, realUrl);
    const updated = { ...news, link: realUrl, originalLink: realUrl, status: "generated" as ArticleStatus, isGoogleNewsFallback: resolved.fallback };
    setXDrafts((prev) => ({ ...prev, [news.id]: draft }));
    setActivePreviewId(news.id);
    setPanelTab("x");
    setPendingPublishIds((prev) => Array.from(new Set([...prev, news.id])));
    setNewsItems((prev) => prev.map((item) => item.id === news.id ? updated : item));
    setXGenerating((prev) => prev.filter((id) => id !== news.id));
    return draft;
  };

  const generateSelectedX = async () => {
    const targets = filteredItems.filter((item) => selectedIds.includes(item.id));
    if (targets.length === 0) {
      alert("먼저 기사를 선택하세요.");
      return;
    }
    for (const item of targets) {
      // 한 번에 너무 많은 요청이 몰리지 않도록 순서대로 처리합니다.
      await saveXDraft(item);
    }
  };

  const goToAI = async (news: NewsItem) => {
    const resolved = await resolveArticleUrl(news, true);
    const articleUrl = resolved.url;
    const updated = { ...news, link: articleUrl, originalLink: articleUrl, status: "generated" as ArticleStatus, isGoogleNewsFallback: resolved.fallback };
    setGeneratedIds((prev) => Array.from(new Set([...prev, news.id])));
    setNewsItems((prev) => prev.map((item) => item.id === news.id ? updated : item));
    localStorage.setItem("selectedArticle", JSON.stringify(updated));
    router.push("/ai");
  };

  const openXCompose = (text: string) => {
    window.open(`https://x.com/compose/post?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    const visibleIds = filteredItems.map((item) => item.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? selectedIds.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...selectedIds, ...visibleIds])));
  };

  const toggleXPreview = (id: string) => {
    setPanelTab("x");
    setActivePreviewId((prev) => (prev === id ? null : id));
  };

  const goToXAI = async (news: NewsItem) => {
    await saveXDraft(news);
  };

  const activeNews = activePreviewId ? newsItems.find((item) => item.id === activePreviewId) : undefined;
  const activeDraft = activePreviewId ? xDrafts[activePreviewId] : undefined;

  return (
    <div className="p-8">
      <div className="sticky top-0 z-20 -mx-8 space-y-4 bg-[#f8fafc] px-8 pb-4 pt-8 shadow-[0_8px_12px_-10px_rgba(15,23,42,0.15)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">News AI</p>
            <h1 className="mt-1 text-3xl font-bold text-gray-900">뉴스 수집</h1>
            <p className="mt-2 text-gray-500">
              RSS와 Google News에서 국가별, 카테고리별 기사를 수집하고 AI 생성 상태까지 관리합니다.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowSources((prev) => !prev)}
              className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {showSources ? "RSS 소스 숨기기" : "RSS 소스 관리"}
            </button>
            <button
              onClick={collectNews}
              disabled={loading}
              className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "뉴스 수집 중..." : "최신 뉴스 수집하기"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="기사 제목, 키워드, 출처 검색"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
          />

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-3 text-sm"
            >
              {countries.map((item) => (
                <option key={item} value={item}>{item === "전체" ? "전체 국가" : item}</option>
              ))}
            </select>

            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-3 text-sm"
            >
              {categories.map((item) => (
                <option key={item} value={item}>{item === "전체" ? "전체 카테고리" : item}</option>
              ))}
            </select>

            <select
              value={addressFilter}
              onChange={(event) => setAddressFilter(event.target.value as typeof addressFilter)}
              className="rounded-xl border border-gray-200 px-3 py-3 text-sm font-medium"
            >
              <option value="all">주소: 전체</option>
              <option value="resolved">🟢 원문 링크만</option>
              <option value="google">🔶 구글 주소만</option>
            </select>

            <select
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="rounded-xl border border-gray-200 px-3 py-3 text-sm"
            >
              <option value={10}>피드당 10개</option>
              <option value={20}>피드당 20개</option>
              <option value={30}>피드당 30개</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Metric label="수집 기사" value={`${newsItems.length}개`} />
            <button onClick={() => setAddressFilter((prev) => (prev === "resolved" ? "all" : "resolved"))} className="text-left">
              <Metric
                label="원문 링크 확인됨"
                value={`${newsItems.filter((item) => !item.isGoogleNewsFallback).length}개`}
                highlighted={addressFilter === "resolved"}
                tone="green"
              />
            </button>
            <button onClick={() => setAddressFilter((prev) => (prev === "google" ? "all" : "google"))} className="text-left">
              <Metric
                label="구글 주소로 남음"
                value={`${newsItems.filter((item) => item.isGoogleNewsFallback).length}개`}
                highlighted={addressFilter === "google"}
                tone="amber"
              />
            </button>
            <Metric label="AI 생성 완료" value={`${newsItems.filter((item) => item.status === "generated").length}개`} />
            <Metric label="수집 오류" value={`${errors.length}개`} />
          </div>
          {addressFilter !== "all" && (
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
              {addressFilter === "google" ? "구글 주소만 보는 중" : "원문 링크만 보는 중"}
              <button onClick={() => setAddressFilter("all")} className="rounded-full border border-slate-300 px-2 py-0.5 hover:bg-slate-50">전체 보기</button>
            </div>
          )}

          {errors.length > 0 && (
            <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              일부 RSS 피드는 응답하지 않았습니다. 정상 응답한 피드의 기사만 표시합니다.
            </div>
          )}
        </div>

        {showSources && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-black text-slate-900">RSS 소스 관리</h2>
              <div className="flex flex-wrap gap-2">
                <input
                  value={srcQuery}
                  onChange={(event) => setSrcQuery(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") void loadSources(); }}
                  placeholder="RSS 소스 검색"
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <select value={srcCountry} onChange={(event) => setSrcCountry(event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  {srcCountries.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select value={srcLanguage} onChange={(event) => setSrcLanguage(event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  {srcLanguages.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select value={srcCategory} onChange={(event) => setSrcCategory(event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  {srcCategories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <button onClick={() => void loadSources()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">검색</button>
                <button onClick={exportSources} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold hover:bg-slate-50">JSON 내보내기</button>
              </div>
            </div>
            <div className="grid max-h-[360px] gap-2 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
              {sources.map((source) => (
                <div key={source.id} className="rounded-xl border border-gray-100 p-3 transition hover:border-blue-300 hover:bg-blue-50/40">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-slate-800">{source.name}</div>
                      <div className="text-xs text-slate-500">{source.country} · {source.language} · {source.category}</div>
                    </div>
                    <button onClick={() => toggleFavoriteSource(source.id)} className="text-lg leading-none">
                      {favoriteSourceIds.includes(source.id) ? "⭐" : "☆"}
                    </button>
                  </div>
                  <div className="mt-2 truncate text-xs text-slate-400">{source.url}</div>
                </div>
              ))}
              {sources.length === 0 && (
                <div className="col-span-full py-8 text-center text-sm text-slate-400">조건에 맞는 RSS 소스가 없습니다.</div>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
              <div className="text-sm font-semibold text-slate-700">
                선택 {selectedIds.length}개 · 발행대기 {pendingPublishIds.length}개 · 발행완료 {publishedIds.length}개
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={toggleSelectAll} className="rounded-lg border border-slate-900 px-4 py-2 text-sm font-bold hover:bg-slate-50">
                  {filteredItems.length > 0 && filteredItems.every((item) => selectedIds.includes(item.id)) ? "전체 해제" : "전체 선택"}
                </button>
                <button onClick={generateSelectedX} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
                  선택 X용 생성
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">선택</th>
                    <th className="px-4 py-3 text-left">제목</th>
                    <th className="px-4 py-3 text-left">주소</th>
                    <th className="px-4 py-3 text-left">출처</th>
                    <th className="px-4 py-3 text-left">국가</th>
                    <th className="px-4 py-3 text-left">카테고리</th>
                    <th className="px-4 py-3 text-left">상태</th>
                    <th className="px-4 py-3 text-left">날짜</th>
                    <th className="px-4 py-3 text-left">작업</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredItems.map((news) => (
                    <tr key={news.id} className={`hover:bg-gray-50 ${activePreviewId === news.id ? "bg-slate-50" : ""}`}>
                      <td className="px-4 py-4">
                        <input type="checkbox" checked={selectedIds.includes(news.id)} onChange={() => toggleSelect(news.id)} className="h-4 w-4" />
                      </td>
                      <td className="max-w-xl px-4 py-4 font-medium text-gray-900">
                        <a href={news.originalLink || news.link} target="_blank" rel="noopener noreferrer" title={news.title} className="line-clamp-1 hover:underline">
                          {news.title}
                        </a>
                        {news.isGoogleNewsFallback && (
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-amber-600">
                            <span>원문 복원 실패 · Google News 주소 임시 사용</span>
                            <button
                              onClick={() => retryResolveArticleUrl(news)}
                              disabled={urlResolvingIds.includes(news.id)}
                              className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-black text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                            >
                              {urlResolvingIds.includes(news.id) ? "재시도중" : "원문 재시도"}
                            </button>
                            {urlResolveMessages[news.id] && <span className={urlResolveMessages[news.id].includes("완료") ? "text-green-600" : "text-amber-700"}>{urlResolveMessages[news.id]}</span>}
                          </div>
                        )}
                        {!news.isGoogleNewsFallback && urlResolveMessages[news.id] && (
                          <div className="mt-1 text-xs font-bold text-green-600">{urlResolveMessages[news.id]}</div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {news.isGoogleNewsFallback ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                            🔶 구글 주소
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">
                            🟢 원문 링크
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-gray-500">{news.source}</td>
                      <td className="px-4 py-4 text-gray-500">{news.country}</td>
                      <td className="px-4 py-4 text-gray-500">{news.category}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyle[news.status]}`}>
                          {statusLabel[news.status]}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-400">{news.pubDate || "-"}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <button onClick={() => goToAI(news)} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700">
                            AI 생성
                          </button>
                          <button onClick={() => goToXAI(news)} disabled={xGenerating.includes(news.id)} className="rounded-lg bg-slate-950 px-4 py-2 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
                            {xGenerating.includes(news.id) ? "생성중" : "X용 생성"}
                          </button>
                          {xDrafts[news.id] && (
                            <button onClick={() => toggleXPreview(news.id)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold hover:bg-slate-50">
                              {activePreviewId === news.id && panelTab === "x" ? "접기" : "보기"}
                            </button>
                          )}
                          <select
                            onChange={(event) => {
                              const action = event.target.value as typeof aiAction;
                              event.target.value = "";
                              if (action) void runQuickAI(news, action);
                            }}
                            disabled={aiLoadingIds.includes(news.id)}
                            defaultValue=""
                            className="rounded-lg border border-purple-200 bg-purple-50 px-2 py-2 text-xs font-bold text-purple-700 disabled:opacity-50"
                          >
                            <option value="" disabled>{aiLoadingIds.includes(news.id) ? "처리중..." : "AI 퀵액션"}</option>
                            <option value="summary">AI 요약</option>
                            <option value="translate">번역</option>
                            <option value="rewrite">Rewrite</option>
                            <option value="compare">비교</option>
                          </select>
                          <button onClick={() => sendToCardNews(news)} className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100">
                            카드뉴스로
                          </button>
                          {xDrafts[news.id] && pendingPublishIds.includes(news.id) && !publishedIds.includes(news.id) && (
                            <button onClick={() => markPublished(news.id)} className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100">발행대기</button>
                          )}
                          {publishedIds.includes(news.id) && (
                            <span className="rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-700">발행완료</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                        아직 수집된 뉴스가 없습니다. 필터를 선택한 뒤 최신 뉴스를 수집하세요.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:sticky lg:top-[220px]">
            {activeNews ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex gap-1 rounded-full bg-slate-100 p-1 text-xs font-bold">
                      <button
                        onClick={() => setPanelTab("x")}
                        className={`rounded-full px-3 py-1 transition ${panelTab === "x" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                      >
                        X 미리보기
                      </button>
                      <button
                        onClick={() => setPanelTab("ai")}
                        className={`rounded-full px-3 py-1 transition ${panelTab === "ai" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                      >
                        AI 퀵액션
                      </button>
                    </div>
                    <div className="mt-2 line-clamp-1 text-xs text-slate-500" title={activeNews.title}>{activeNews.title}</div>
                  </div>
                  <button onClick={() => setActivePreviewId(null)} className="rounded-lg px-2 py-1 text-xs font-bold text-slate-400 hover:bg-slate-50 hover:text-slate-700">
                    닫기
                  </button>
                </div>

                {panelTab === "x" && (
                  activeDraft ? (
                    <>
                      <div className="mb-2 text-xs font-bold text-slate-500">글자수 {activeDraft.length}/280 · 제목 키워드 기반 SEO 태그 자동 생성</div>
                      <pre className="max-h-[360px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-7 text-slate-800">{activeDraft}</pre>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button onClick={() => navigator.clipboard.writeText(activeDraft)} className="rounded-lg border px-3 py-2 text-xs font-bold hover:bg-slate-50">복사</button>
                        <button onClick={() => openXCompose(activeDraft)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800">X 작성</button>
                        {pendingPublishIds.includes(activeNews.id) && !publishedIds.includes(activeNews.id) && (
                          <button onClick={() => markPublished(activeNews.id)} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700">발행 완료로 변경</button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-400">아직 X 게시글이 생성되지 않았습니다.</div>
                  )
                )}

                {panelTab === "ai" && (
                  <>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {([["summary", "AI 요약"], ["translate", "번역"], ["rewrite", "Rewrite"], ["compare", "비교"]] as const).map(([action, label]) => (
                        <button
                          key={action}
                          onClick={() => void runQuickAI(activeNews, action)}
                          disabled={aiLoadingIds.includes(activeNews.id)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                            aiAction === action ? "border-purple-400 bg-purple-50 text-purple-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {aiLoadingIds.includes(activeNews.id) ? (
                      <div className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-400">AI 처리 중...</div>
                    ) : aiOutputs[activeNews.id] ? (
                      <>
                        <pre className="max-h-[360px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-7 text-slate-800">{aiOutputs[activeNews.id]}</pre>
                        <div className="mt-3">
                          <button onClick={() => navigator.clipboard.writeText(aiOutputs[activeNews.id])} className="rounded-lg border px-3 py-2 text-xs font-bold hover:bg-slate-50">복사</button>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-400">위 버튼을 눌러 AI 요약/번역/Rewrite/비교 결과를 받아보세요.</div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
                기사 목록에서 <span className="font-bold text-slate-500">X용 생성</span>, <span className="font-bold text-slate-500">보기</span>, 또는 <span className="font-bold text-slate-500">AI 퀵액션</span>을 누르면 여기에 결과가 고정돼 표시됩니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, highlighted, tone }: { label: string; value: string; highlighted?: boolean; tone?: "green" | "amber" }) {
  const toneClass = tone === "green" ? "bg-green-50" : tone === "amber" ? "bg-amber-50" : "bg-slate-50";
  return (
    <div className={`rounded-xl p-4 transition ${highlighted ? `${toneClass} ring-2 ring-inset ring-slate-900/10` : "bg-slate-50"}`}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-black text-slate-900">{value}</div>
    </div>
  );
}
