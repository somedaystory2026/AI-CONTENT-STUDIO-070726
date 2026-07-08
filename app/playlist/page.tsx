"use client";

import { useState, useEffect, useRef } from "react";

// ─── 상수 ────────────────────────────────────────────────────────────────────

const genres = [
  ["Lo-fi", "border-indigo-500"],
  ["Pop", "border-rose-500"],
  ["Jazz", "border-orange-500"],
  ["R&B", "border-sky-500"],
  ["K-Pop", "border-purple-500"],
  ["Indie", "border-teal-500"],
  ["Study", "border-slate-500"],
  ["Workout", "border-red-500"],
  ["Meditation", "border-blue-500"],
  ["Acoustic", "border-amber-500"],
  ["Hyperpop", "border-pink-400"],
  ["Digicore", "border-cyan-400"],
  ["Jazz Jam", "border-yellow-600"],
  ["한국 사극 Traditional", "border-amber-700"],
  ["한국 트로트 Trot", "border-fuchsia-500"],
  ["일본 City Pop", "border-pink-600"],
  ["일본 Anime OST", "border-red-400"],
  ["일본 밴드 애니송", "border-violet-400"],
  ["일본 Enka", "border-orange-700"],
  ["인도 Bollywood", "border-yellow-500"],
  ["Bollywood Wedding EDM Anthem", "border-orange-400"],
  ["인도 Classical", "border-lime-600"],
];

const sortOptions = ["조회수 높은 순", "최신 인기순", "댓글 많은 순", "관련성 높은 순", "랜덤 추천"];

const languageOptions = [
  { value: "ko", label: "🇰🇷 한국어" },
  { value: "en", label: "🇺🇸 English" },
  { value: "mix", label: "🌐 한영 믹스" },
  { value: "ja", label: "🇯🇵 日本語" },
  { value: "hi", label: "🇮🇳 हिन्दी" },
];

// 음악적 변주 옵션 (플레이리스트 일괄 생성용)
const variationOptions = [
  "더 다이나믹한 드럼 추가",
  "여성 보컬 추가",
  "카페 스타일에 어울리도록 편곡",
  "오케스트라 요소 추가",
  "템포를 약간 빠르게",
  "Lo-fi 스타일로 리믹스",
  "베이스 라인 강조 (Groovy)",
  "80년대 레트로 신스 사운드",
  "웅장한 시네마틱 사운드",
  "No intro, direct vocal start at 0:00",
  "후렴 단어/문구 반복 강조 (Hook repetition lock-in)",
  "끝나지 않는 루프 엔딩 (Seamless loop, no resolution)",
  "스토리 없이 감정 위주 폭발 (설명 없이 감정만)",
];

// 플레이리스트 용도/장르 옵션 (다중 선택)
const useCaseOptions = [
  "Lo-fi (Chill)",
  "Pop Hits",
  "Jazz Bar",
  "R&B Soul",
  "K-Pop Trend",
  "Indie Folk",
  "Study/Focus",
  "Workout/GYM",
  "Meditation/Zen",
  "Acoustic/Live",
  "드라이브",
  "휴식",
  "Bollywood OST",
  "Wedding/Festival",
];

// SEO 다국어 탭
const seoLangs: { code: keyof SeoResult; label: string }[] = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "es", label: "Español" },
  { code: "zh", label: "中文" },
  { code: "pt", label: "Português" },
];

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function formatViews(n: string | number) {
  const num = Number(n);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return String(num);
}

function parseDuration(iso: string) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";
  const h = match[1] ? `${match[1]}:` : "";
  const m = match[2] || "0";
  const s = (match[3] || "0").padStart(2, "0");
  return `${h}${m}:${s}`;
}

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface VideoResult {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  publishedAt: string;
  viewCount: string;
  commentCount: string;
  duration: string;
}

interface AnalysisResult {
  successFormula: string;
  titleStrategy: string;
  audienceTarget: string;
  contentStructure: string;
  trendKeywords: string[];
  recommendation: string;
  score: number;
}

interface SongStyle {
  genre: string;
  tempo: string;
  mood: string;
  instruments: string[];
  vocalStyle: string;
  referenceSounds: string;
}

interface GenerateResult {
  songTitle: string;
  style: SongStyle;
  structure: string[];
  lyrics: {
    intro: string;
    verse1: string;
    preChorus1: string;
    chorus: string;
    verse2: string;
    preChorus2: string;
    chorus2: string;
    bridge: string;
    finalChorus: string;
    outro: string;
  };
  sunoStylePrompt: string;
  productionNotes: string;
  targetEmotion: string;
  imagePrompt: string;
}

interface SeoEntry {
  title: string;
  description: string;
  hashtags: string[];
}

interface SeoResult {
  ko: SeoEntry;
  en: SeoEntry;
  ja: SeoEntry;
  es: SeoEntry;
  zh: SeoEntry;
  pt: SeoEntry;
}

interface PlaylistSong {
  id: string;
  songTitle: string;
  mood: string;
  sunoStylePrompt: string;
  lyrics: string;
  imagePromptKo: string;
  imagePromptEn: string;
  image?: string;
  generatingImage?: boolean;
  seo?: SeoResult;
  generatingSeo?: boolean;
  error?: string;
}

// ─── 가사 섹션 레이블 ─────────────────────────────────────────────────────────

const lyricLabels: Record<string, string> = {
  intro:       "🎵 Intro",
  verse1:      "📖 Verse 1",
  preChorus1:  "⬆️ Pre-Chorus 1",
  chorus:      "✨ Chorus",
  verse2:      "📖 Verse 2",
  preChorus2:  "⬆️ Pre-Chorus 2",
  chorus2:     "✨ Chorus 2",
  bridge:      "🌉 Bridge",
  finalChorus: "🔥 Final Chorus",
  outro:       "🎵 Outro",
};

const lyricColors: Record<string, string> = {
  intro:       "text-gray-400",
  verse1:      "text-white",
  preChorus1:  "text-sky-300",
  chorus:      "text-yellow-300",
  verse2:      "text-white",
  preChorus2:  "text-sky-300",
  chorus2:     "text-yellow-300",
  bridge:      "text-violet-300",
  finalChorus: "text-orange-300",
  outro:       "text-gray-400",
};

// ─── SEO 다국어 탭 컴포넌트 ────────────────────────────────────────────────────

function SeoTabs({ seo }: { seo: SeoResult }) {
  const [lang, setLang] = useState<keyof SeoResult>("ko");
  const entry = seo[lang];

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1">
        {seoLangs.map((l) => (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            className={`rounded px-2 py-1 text-xs font-bold transition ${lang === l.code ? "bg-cyan-600" : "bg-[#2b304a] hover:bg-[#37405c]"}`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className="space-y-1 rounded-lg bg-[#0f1220] p-2 text-xs">
        <p className="font-bold text-white">{entry?.title}</p>
        <p className="text-gray-300">{entry?.description}</p>
        <p className="text-violet-300">{entry?.hashtags?.join(" ")}</p>
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function Home() {
  const [selectedGenre, setSelectedGenre] = useState("Lo-fi");
  const [keyword, setKeyword] = useState("Lo-fi Chill Mix");
  const [sort, setSort] = useState("조회수 높은 순");
  const [longOnly, setLongOnly] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const [showApiModal, setShowApiModal] = useState(false);
  const [openaiKey, setOpenaiKey] = useState("");
  const [youtubeKey, setYoutubeKey] = useState("");

  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [activeTab, setActiveTab] = useState<"analyze" | "generate" | "playlist">("analyze");
  const [selectedVideo, setSelectedVideo] = useState<VideoResult | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [generated, setGenerated] = useState<GenerateResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [language, setLanguage] = useState("ko");
  const [activeLyricSection, setActiveLyricSection] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState("");
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);

  // ── 플레이리스트 일괄 생성 ──
  const [playlistSelection, setPlaylistSelection] = useState<VideoResult[]>([]);
  const [showPlaylistSettings, setShowPlaylistSettings] = useState(false);
  const [songCount, setSongCount] = useState(20);
  const [playlistLanguage, setPlaylistLanguage] = useState("ko");
  const [selectedVariations, setSelectedVariations] = useState<string[]>([]);
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([]);
  const [generatingPlaylist, setGeneratingPlaylist] = useState(false);
  const [playlistSongs, setPlaylistSongs] = useState<PlaylistSong[]>([]);
  const [generatingAllImages, setGeneratingAllImages] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOpenaiKey(localStorage.getItem("OPENAI_KEY") || "");
    setYoutubeKey(localStorage.getItem("YOUTUBE_KEY") || "");
  }, []);

  function openModal() {
    setOpenaiKey(localStorage.getItem("OPENAI_KEY") || "");
    setYoutubeKey(localStorage.getItem("YOUTUBE_KEY") || "");
    setShowApiModal(true);
  }

  function saveKeys() {
    localStorage.setItem("OPENAI_KEY", openaiKey);
    localStorage.setItem("YOUTUBE_KEY", youtubeKey);
    setShowApiModal(false);
  }

  async function handleSearch(overrideKeyword?: string, overrideSort?: string) {
    if (!youtubeKey) { alert("YouTube API 키를 먼저 설정해주세요."); openModal(); return; }
    setSearching(true);
    setSearchError("");
    setVideos([]);

    const effectiveSort = overrideSort ?? sort;
    let q = overrideKeyword ?? keyword;
    if (effectiveSort === "최신 인기순") q += " 2024";
    if (effectiveSort === "랜덤 추천") q += " " + ["mix", "playlist", "chill", "vibes"][Math.floor(Math.random() * 4)];

    try {
      const res = await fetch(`/api/youtube?q=${encodeURIComponent(q)}&apiKey=${youtubeKey}&longOnly=${longOnly}`);
      const data = await res.json();
      if (data.error) {
        setSearchError(data.error);
      } else {
        let results: VideoResult[] = data.results;
        if (effectiveSort === "댓글 많은 순") results = results.sort((a, b) => Number(b.commentCount) - Number(a.commentCount));
        else if (effectiveSort === "랜덤 추천") results = results.sort(() => Math.random() - 0.5);
        setVideos(results);
      }
    } catch {
      setSearchError("네트워크 오류가 발생했습니다.");
    } finally {
      setSearching(false);
    }
  }

  function handleAddUrl() {
    const match = urlInput.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (!match) { alert("올바른 유튜브 URL을 입력해주세요."); return; }
    const id = match[1];
    const manual: VideoResult = {
      id, title: `직접 추가: ${urlInput}`, channel: "수동 추가",
      thumbnail: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
      publishedAt: new Date().toISOString(), viewCount: "0", commentCount: "0", duration: "",
    };
    setVideos((prev) => [manual, ...prev]);
    setUrlInput("");
  }

  async function handleAnalyze(video: VideoResult) {
    if (!openaiKey) { alert("OpenAI API 키를 먼저 설정해주세요."); openModal(); return; }
    setSelectedVideo(video);
    setActiveTab("analyze");
    setAnalyzing(true);
    setAnalysis(null);
    setGenerated(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video, openaiKey }),
      });
      const data = await res.json();
      if (data.error) alert("분석 오류: " + data.error);
      else setAnalysis(data);
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleGenerate() {
    if (!openaiKey) { alert("OpenAI API 키를 먼저 설정해주세요."); openModal(); return; }
    setActiveTab("generate");
    setGenerating(true);
    setGenerated(null);
    setActiveLyricSection(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genre: selectedGenre, keyword, analysis, openaiKey, language }),
      });
      const data = await res.json();
      if (data.error) alert("생성 오류: " + data.error);
      else setGenerated(data);
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setGenerating(false);
    }
  }

  function copySection(key: string, text: string) {
    navigator.clipboard.writeText(text || "");
    setCopiedSection(key);
    setBridgeStatus("복사됨");
    setTimeout(() => { setCopiedSection(null); setBridgeStatus(""); }, 1800);
  }

  function sendSongToBridge(song: { songTitle: string; sunoStylePrompt: string; lyrics: string }) {
    if (!song?.songTitle || !song?.sunoStylePrompt || !song?.lyrics) {
      setBridgeStatus("제목 / 스타일 / 가사가 모두 있어야 확장프로그램으로 보낼 수 있습니다.");
      setTimeout(() => setBridgeStatus(""), 2500);
      return;
    }

    let answered = false;
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || msg.source !== "suno-bridge-extension" || msg.type !== "SEND_TO_SUNO_BRIDGE_RESULT") return;
      answered = true;
      window.removeEventListener("message", handler);
      setBridgeStatus(msg.success ? "확장프로그램으로 보냈습니다." : `전송 실패: ${msg.error || "확장프로그램 응답 없음"}`);
      setTimeout(() => setBridgeStatus(""), 2500);
    };

    window.addEventListener("message", handler);
    window.postMessage({
      source: "playlist-maker",
      type: "SEND_TO_SUNO_BRIDGE",
      payload: {
        songTitle: song.songTitle,
        sunoStylePrompt: song.sunoStylePrompt,
        lyrics: song.lyrics,
      },
    }, "*");

    setBridgeStatus("확장프로그램으로 보내는 중...");
    setTimeout(() => {
      if (!answered) {
        window.removeEventListener("message", handler);
        setBridgeStatus("확장프로그램 응답이 없습니다. David Melody Suno Bridge가 설치/활성화되어 있는지 확인하세요.");
        setTimeout(() => setBridgeStatus(""), 3500);
      }
    }, 1200);
  }

  function resetAll() {
    setVideos([]);
    setAnalysis(null);
    setGenerated(null);
    setSelectedVideo(null);
    setPlaylistSelection([]);
    setPlaylistSongs([]);
    setSelectedSongId(null);
    setBridgeStatus("새 작업으로 초기화했습니다.");
    setTimeout(() => setBridgeStatus(""), 1800);
  }


  async function handleRegenerateSection(key: string) {
    if (!openaiKey || !generated) return;
    setRegeneratingSection(key);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genre: selectedGenre, keyword, analysis, openaiKey, language, sectionKey: key }),
      });
      const data = await res.json();
      if (data.text) {
        setGenerated((prev) => prev ? { ...prev, lyrics: { ...prev.lyrics, [key]: data.text } } : prev);
      }
    } catch {
      alert("재생성 오류가 발생했습니다.");
    } finally {
      setRegeneratingSection(null);
    }
  }

  function copyAllLyrics() {
    if (!generated) return;
    const full = Object.entries(generated.lyrics)
      .map(([, v]) => v)
      .join("\n\n");
    const sunoReady = `[Style of Music]:\n${generated.sunoStylePrompt}\n\n[Lyrics]:\n${full}`;
    navigator.clipboard.writeText(sunoReady);
    setCopiedSection("all");
    setTimeout(() => setCopiedSection(null), 2000);
  }

  // ── 플레이리스트 일괄 생성 핸들러 ──────────────────────────────────────────

  function togglePlaylistSelection(video: VideoResult) {
    setPlaylistSelection((prev) =>
      prev.some((v) => v.id === video.id)
        ? prev.filter((v) => v.id !== video.id)
        : [...prev, video]
    );
  }

  function toggleVariation(opt: string) {
    setSelectedVariations((prev) =>
      prev.includes(opt) ? prev.filter((v) => v !== opt) : [...prev, opt]
    );
  }

  function toggleUseCase(opt: string) {
    setSelectedUseCases((prev) =>
      prev.includes(opt) ? prev.filter((v) => v !== opt) : [...prev, opt]
    );
  }

  async function handleGeneratePlaylist() {
    if (!openaiKey) { alert("OpenAI API 키를 먼저 설정해주세요."); openModal(); return; }
    if (playlistSelection.length === 0) { alert("참조 영상을 1개 이상 선택해주세요."); return; }

    setShowPlaylistSettings(false);
    setGeneratingPlaylist(true);
    setActiveTab("playlist");
    setPlaylistSongs([]);

    try {
      const res = await fetch("/api/playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videos: playlistSelection,
          count: songCount,
          language: playlistLanguage,
          variations: selectedVariations,
          useCases: selectedUseCases,
          genre: selectedGenre,
          keyword,
          openaiKey,
        }),
      });
      const data = await res.json();
      if (data.error) alert("플레이리스트 생성 오류: " + data.error);
      else {
        setPlaylistSongs(data.songs);
        setSelectedSongId(data.songs?.[0]?.id ?? null);
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setGeneratingPlaylist(false);
    }
  }

  async function generateSongImage(songId: string) {
    if (!openaiKey) { alert("OpenAI API 키를 먼저 설정해주세요."); openModal(); return; }
    const song = playlistSongs.find((s) => s.id === songId);
    if (!song) return;

    setPlaylistSongs((prev) => prev.map((s) => (s.id === songId ? { ...s, generatingImage: true } : s)));

    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: song.imagePromptEn, openaiKey }),
      });
      const data = await res.json();
      if (data.error) alert("이미지 생성 오류: " + data.error);
      setPlaylistSongs((prev) =>
        prev.map((s) => (s.id === songId ? { ...s, image: data.image ?? s.image, generatingImage: false } : s))
      );
    } catch {
      setPlaylistSongs((prev) => prev.map((s) => (s.id === songId ? { ...s, generatingImage: false } : s)));
      alert("이미지 생성 중 네트워크 오류가 발생했습니다.");
    }
  }

  async function generateAllImages() {
    if (!openaiKey) { alert("OpenAI API 키를 먼저 설정해주세요."); openModal(); return; }
    setGeneratingAllImages(true);
    for (const song of playlistSongs) {
      if (song.image) continue;
      await generateSongImage(song.id);
    }
    setGeneratingAllImages(false);
  }

  async function generateSongSeo(songId: string) {
    if (!openaiKey) { alert("OpenAI API 키를 먼저 설정해주세요."); openModal(); return; }
    const song = playlistSongs.find((s) => s.id === songId);
    if (!song) return;

    setPlaylistSongs((prev) => prev.map((s) => (s.id === songId ? { ...s, generatingSeo: true } : s)));

    try {
      const res = await fetch("/api/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songTitle: song.songTitle, mood: song.mood, openaiKey }),
      });
      const data = await res.json();
      if (data.error) alert("SEO 생성 오류: " + data.error);
      setPlaylistSongs((prev) =>
        prev.map((s) => (s.id === songId ? { ...s, seo: data.error ? s.seo : data, generatingSeo: false } : s))
      );
    } catch {
      setPlaylistSongs((prev) => prev.map((s) => (s.id === songId ? { ...s, generatingSeo: false } : s)));
      alert("SEO 생성 중 네트워크 오류가 발생했습니다.");
    }
  }

  async function generateAllSeo() {
    if (!openaiKey) { alert("OpenAI API 키를 먼저 설정해주세요."); openModal(); return; }
    for (const song of playlistSongs) {
      if (song.seo) continue;
      await generateSongSeo(song.id);
    }
  }

  function extractAllImagePrompts() {
    if (playlistSongs.length === 0) return;
    const text = playlistSongs
      .map((s, i) => `${i + 1}. ${s.songTitle}\n[한글] ${s.imagePromptKo}\n[English] ${s.imagePromptEn}`)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    alert("모든 이미지 프롬프트를 클립보드에 복사했습니다.");
  }

  function updateSongField(songId: string, field: "imagePromptKo" | "imagePromptEn", value: string) {
    setPlaylistSongs((prev) => prev.map((s) => (s.id === songId ? { ...s, [field]: value } : s)));
  }

  function handleImageUpload(songId: string, file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPlaylistSongs((prev) =>
        prev.map((s) => (s.id === songId ? { ...s, image: reader.result as string } : s))
      );
    };
    reader.readAsDataURL(file);
  }

  function downloadAllImages() {
    const withImages = playlistSongs.filter((s) => s.image);
    if (withImages.length === 0) { alert("다운로드할 이미지가 없습니다. 먼저 이미지를 생성해주세요."); return; }
    withImages.forEach((s, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = s.image as string;
        a.download = `${i + 1}_${s.songTitle.replace(/[\\/:*?"<>|]/g, "")}.png`;
        a.click();
      }, i * 300);
    });
  }

  function resetPlaylistResult() {
    setPlaylistSongs([]);
    setPlaylistSelection([]);
    setSelectedSongId(null);
    setActiveTab("analyze");
  }

  function escapeHtml(str: string) {
    return (str || "").replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
    ));
  }

  function downloadHtmlReport() {
    if (playlistSongs.length === 0) return;

    const body = playlistSongs
      .map(
        (s, i) => `
      <div style="margin-bottom:40px;padding:20px;border:1px solid #444;border-radius:12px;">
        <h2>${i + 1}. ${escapeHtml(s.songTitle)}</h2>
        <p><em>${escapeHtml(s.mood || "")}</em></p>
        ${s.image ? `<img src="${s.image}" style="max-width:100%;border-radius:8px;" />` : ""}
        <h3>Style of Music</h3>
        <pre style="white-space:pre-wrap;background:#1a1a1a;color:#9f9;padding:10px;border-radius:8px;">${escapeHtml(s.sunoStylePrompt || "")}</pre>
        <h3>Lyrics</h3>
        <pre style="white-space:pre-wrap;background:#1a1a1a;color:#eee;padding:10px;border-radius:8px;">${escapeHtml(s.lyrics || "")}</pre>
        ${
          s.seo
            ? `
        <h3>YouTube SEO (한국어)</h3>
        <p><b>${escapeHtml(s.seo.ko.title)}</b></p>
        <p>${escapeHtml(s.seo.ko.description)}</p>
        <p>${s.seo.ko.hashtags.map(escapeHtml).join(" ")}</p>
        `
            : ""
        }
      </div>
    `
      )
      .join("\n");

    const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>플레이리스트 작업지시서</title></head>
      <body style="font-family:sans-serif;max-width:800px;margin:40px auto;background:#0f1220;color:#fff;">
        <h1>🎶 플레이리스트 작업지시서</h1>
        ${body}
      </body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "playlist-report.html";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── 렌더 ────────────────────────────────────────────────────────────────

  const selectedSongIndex = playlistSongs.findIndex((s) => s.id === selectedSongId);
  const selectedSong = selectedSongIndex >= 0 ? playlistSongs[selectedSongIndex] : null;

  return (
    <main className="min-h-screen bg-[#171b2e] text-white">
      {/* 헤더 */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-[#171b2e]/80 px-5 py-4 backdrop-blur">
        <h1 className="text-xl font-bold md:text-2xl">
          <span className="text-yellow-400">GPT </span>
          <span className="text-violet-400">흥행 플리 생성기</span>
        </h1>
        <div className="hidden gap-3 md:flex">
          <a href="/tools" className="rounded-full border border-violet-500/40 bg-violet-600/20 px-3 py-1 text-xs font-bold text-violet-200 hover:bg-violet-600/40">통합 도구</a>
          <button className="rounded-full border border-white/10 bg-[#272d46] px-3 py-1 text-xs font-bold text-blue-400">GPT</button>
          <button onClick={openModal} className="rounded-lg bg-[#2d334f] px-4 py-2 font-bold hover:bg-[#373d5f] transition">🔑 API 키 관리</button>
          <button
            onClick={resetAll}
            className="rounded-lg bg-[#2d334f] px-4 py-2 font-bold hover:bg-[#373d5f] transition"
          >↻ 새로 시작</button>
        </div>
      </header>

      {bridgeStatus && (
        <div className="fixed right-6 top-20 z-50 rounded-xl bg-violet-700 px-4 py-3 text-sm font-bold text-white shadow-2xl">
          {bridgeStatus}
        </div>
      )}

      <p className="mb-8 px-4 text-center text-gray-400">
        AI가 인기 유튜브 플레이리스트의 성공 공식을 분석하여 그 감성에 맞는 오리지널 가사를 창작합니다.
      </p>

      {activeTab === "playlist" && playlistSongs.length > 0 ? (
        /* ── 플레이리스트 생성 결과: 좌(목록) + 우(선택 곡 상세 리포트) 2단 레이아웃 ── */
        <section className="mx-auto max-w-7xl px-4 pb-10">
          <div className="mb-4 rounded-xl bg-gradient-to-r from-emerald-900/60 to-teal-900/60 p-5">
            <p className="text-2xl font-black text-white">🎶 생성된 플레이리스트 ({playlistSongs.length}곡)</p>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr] lg:items-start">
            {/* ── 좌: 곡 목록 ── */}
            <div className="space-y-3 lg:sticky lg:top-20">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={generateAllImages}
                  disabled={generatingAllImages}
                  className="rounded-lg bg-violet-600 py-2 text-xs font-bold hover:bg-violet-500 transition disabled:opacity-50"
                >
                  {generatingAllImages ? "⏳ 생성 중..." : "🖼 이미지 일괄 생성"}
                </button>
                <button
                  onClick={extractAllImagePrompts}
                  className="rounded-lg bg-orange-600 py-2 text-xs font-bold hover:bg-orange-500 transition"
                >
                  📤 프롬프트 일괄 추출
                </button>
                <button
                  onClick={() => selectedSong && sendSongToBridge(selectedSong)}
                  disabled={!selectedSong}
                  className="col-span-2 rounded-lg bg-gradient-to-r from-violet-600 to-orange-500 py-2 text-xs font-bold hover:opacity-90 transition disabled:opacity-50"
                >
                  🧩 선택곡 확장프로그램으로 보내기
                </button>
                <button
                  onClick={downloadAllImages}
                  className="rounded-lg bg-sky-700 py-2 text-xs font-bold hover:bg-sky-600 transition"
                >
                  ⬇ 이미지 일괄 다운로드 ({playlistSongs.filter((s) => s.image).length})
                </button>
                <button
                  onClick={downloadHtmlReport}
                  className="rounded-lg bg-[#37405c] py-2 text-xs font-bold hover:bg-[#454e6b] transition"
                >
                  📄 HTML 리포트 다운로드
                </button>
                <button
                  onClick={generateAllSeo}
                  className="col-span-2 rounded-lg bg-cyan-700 py-2 text-xs font-bold hover:bg-cyan-600 transition"
                >
                  🌐 SEO 일괄 생성
                </button>
              </div>
              <button
                onClick={resetPlaylistResult}
                className="w-full rounded-lg bg-rose-800 py-2 text-xs font-bold hover:bg-rose-700 transition"
              >
                ↻ 새로 만들기
              </button>

              <div className="max-h-[75vh] space-y-2 overflow-y-auto pr-1">
                {playlistSongs.map((song, idx) => (
                  <button
                    key={song.id}
                    onClick={() => setSelectedSongId(song.id)}
                    className={`block w-full rounded-xl p-3 text-left transition ${
                      selectedSongId === song.id
                        ? "bg-[#2b304a] ring-2 ring-violet-500"
                        : "bg-[#22283e] hover:bg-[#262c46]"
                    }`}
                  >
                    <p className="mb-1 line-clamp-1 text-sm font-bold text-white">
                      {idx + 1}. 🎵 {song.songTitle}
                    </p>
                    {song.mood && <p className="mb-2 line-clamp-1 text-xs text-gray-400">{song.mood}</p>}
                    <div className="flex items-center gap-2">
                      {song.image ? (
                        <img src={song.image} alt={song.songTitle} className="h-10 w-16 flex-shrink-0 rounded object-cover" />
                      ) : (
                        <div className="flex h-10 w-16 flex-shrink-0 items-center justify-center rounded bg-[#1a1f35] text-[10px] text-gray-500">
                          {song.generatingImage ? "생성 중" : "이미지 없음"}
                        </div>
                      )}
                      <span className="text-[11px] text-gray-400">
                        {song.seo ? <span className="text-cyan-400">✓ SEO 완료</span> : "SEO 미생성"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ── 우: 선택된 곡 상세 리포트 ── */}
            <div className="min-w-0">
              {selectedSong ? (
                <div className="space-y-4 rounded-xl bg-[#22283e] p-5">
                  <div>
                    <p className="text-xl font-bold text-white">
                      {selectedSongIndex + 1}. 🎵 {selectedSong.songTitle}
                    </p>
                    {selectedSong.mood && <p className="mt-1 text-sm text-gray-400">{selectedSong.mood}</p>}
                    <button
                      onClick={() => sendSongToBridge(selectedSong)}
                      className="mt-3 rounded-xl bg-gradient-to-r from-violet-600 to-orange-500 px-4 py-2 text-sm font-bold text-white hover:opacity-90"
                    >
                      🧩 확장프로그램으로 보내기
                    </button>
                  </div>

                  {/* 이미지 + 프롬프트 */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-[240px_1fr]">
                    <div>
                      {selectedSong.image ? (
                        <img src={selectedSong.image} alt={selectedSong.songTitle} className="h-40 w-full rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-40 w-full items-center justify-center rounded-lg bg-[#1a1f35] text-xs text-gray-500">
                          {selectedSong.generatingImage ? "생성 중..." : "이미지 없음"}
                        </div>
                      )}
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => generateSongImage(selectedSong.id)}
                          disabled={selectedSong.generatingImage}
                          className="flex-1 rounded-lg bg-violet-700 py-1.5 text-xs font-bold hover:bg-violet-600 transition disabled:opacity-50"
                        >
                          {selectedSong.generatingImage ? "⏳ 생성 중..." : "✨ 이미지 생성"}
                        </button>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 rounded-lg bg-[#37405c] py-1.5 text-xs font-bold hover:bg-[#454e6b] transition"
                        >
                          ⬆ 이미지 업로드
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(selectedSong.id, e.target.files?.[0])}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <p className="text-xs font-bold text-gray-300">프롬프트 (한글)</p>
                          <button
                            onClick={() => copySection(`pko-${selectedSong.id}`, selectedSong.imagePromptKo)}
                            className="text-xs text-gray-400 hover:text-white"
                          >
                            {copiedSection === `pko-${selectedSong.id}` ? "✅ 복사됨" : "📋 복사"}
                          </button>
                        </div>
                        <textarea
                          value={selectedSong.imagePromptKo}
                          onChange={(e) => updateSongField(selectedSong.id, "imagePromptKo", e.target.value)}
                          rows={3}
                          className="w-full resize-none rounded-lg bg-[#1a1f35] p-2 text-xs leading-relaxed text-gray-200 outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <p className="text-xs font-bold text-gray-300">프롬프트 (영문)</p>
                          <button
                            onClick={() => copySection(`pen-${selectedSong.id}`, selectedSong.imagePromptEn)}
                            className="text-xs text-gray-400 hover:text-white"
                          >
                            {copiedSection === `pen-${selectedSong.id}` ? "✅ 복사됨" : "📋 복사"}
                          </button>
                        </div>
                        <textarea
                          value={selectedSong.imagePromptEn}
                          onChange={(e) => updateSongField(selectedSong.id, "imagePromptEn", e.target.value)}
                          rows={3}
                          className="w-full resize-none rounded-lg bg-[#1a1f35] p-2 text-xs font-mono leading-relaxed text-gray-200 outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Style of Music */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-xs font-bold text-green-400">🎼 Style of Music (Suno)</p>
                      <button
                        onClick={() => copySection(`style-${selectedSong.id}`, selectedSong.sunoStylePrompt)}
                        className="text-xs text-gray-400 hover:text-white"
                      >
                        {copiedSection === `style-${selectedSong.id}` ? "✅ 복사됨" : "📋 복사"}
                      </button>
                    </div>
                    <p className="rounded-lg bg-[#1a1f35] p-3 text-xs font-mono leading-relaxed text-green-300">
                      {selectedSong.sunoStylePrompt}
                    </p>
                  </div>

                  {/* Lyrics */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-xs font-bold text-violet-300">📝 Lyrics (가사)</p>
                      <button
                        onClick={() => copySection(`lyrics-${selectedSong.id}`, selectedSong.lyrics)}
                        className="text-xs text-gray-400 hover:text-white"
                      >
                        {copiedSection === `lyrics-${selectedSong.id}` ? "✅ 복사됨" : "📋 복사"}
                      </button>
                    </div>
                    <p className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[#1a1f35] p-3 text-sm leading-relaxed text-gray-200">
                      {selectedSong.lyrics}
                    </p>
                  </div>

                  {/* SEO */}
                  <div className="rounded-lg bg-[#1a1f35] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-bold text-cyan-300">🌐 YouTube 최적화 (SEO)</p>
                      {!selectedSong.seo && (
                        <button
                          onClick={() => generateSongSeo(selectedSong.id)}
                          disabled={selectedSong.generatingSeo}
                          className="rounded-lg bg-cyan-700 px-3 py-1 text-xs font-bold hover:bg-cyan-600 transition disabled:opacity-50"
                        >
                          {selectedSong.generatingSeo ? "⏳ 생성 중..." : "SEO 생성"}
                        </button>
                      )}
                    </div>
                    {selectedSong.seo && <SeoTabs seo={selectedSong.seo} />}
                  </div>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center rounded-xl bg-[#22283e] text-sm text-gray-400">
                  왼쪽 목록에서 곡을 선택해주세요.
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 pb-10 lg:grid-cols-2">

        {/* ── 왼쪽: 검색 패널 */}
        <div className="rounded-xl bg-[#2b304a] p-6 shadow-2xl">
          <h2 className="mb-4 text-xl font-bold text-violet-400">1. 레퍼런스 음악 찾기</h2>
          <p className="mb-5 text-sm text-gray-400">인기 장르를 선택하거나 키워드로 검색해 성공 사례를 찾아보세요.</p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {genres.map(([name, border]) => (
              <button
                key={name}
                onClick={() => {
                  const newKeyword = `${name} playlist`;
                  setSelectedGenre(name);
                  setKeyword(newKeyword);
                  handleSearch(newKeyword);
                }}
                className={`rounded-xl border-2 ${border} p-3 text-center transition hover:bg-white/10 ${selectedGenre === name ? "bg-white/10 scale-105" : ""}`}
              >
                <div className="mb-1 text-xl">✦</div>
                <div className="truncate text-xs font-bold text-white/80">{name}</div>
              </button>
            ))}
          </div>

          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="mt-5 w-full rounded-lg bg-[#37405c] p-3 text-white outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="음악 장르나 분위기 입력"
          />

          <div className="relative mt-4">
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
              className="w-full rounded-lg border border-cyan-400/30 bg-[#37405c] p-3 pr-16 text-white outline-none focus:ring-2 focus:ring-cyan-400"
              placeholder="유튜브 영상 URL 직접 입력"
            />
            <button onClick={handleAddUrl} className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-cyan-500 px-3 py-1.5 text-xs font-bold hover:bg-cyan-400 transition">추가</button>
          </div>

          <h3 className="mb-3 mt-5 font-semibold text-gray-300">☷ 검색 조건</h3>
          <div className="mb-3 rounded-lg border border-gray-700 bg-[#22283e] p-3 text-sm">
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" className="h-5 w-5 accent-violet-500" checked={longOnly} onChange={(e) => setLongOnly(e.target.checked)} />
              20분 이상 플레이리스트만 검색
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {sortOptions.map((option) => (
              <button
                key={option}
                onClick={() => {
                  setSort(option);
                  handleSearch(undefined, option);
                }}
                className={`rounded-md px-3 py-2 text-sm transition ${sort === option ? "bg-violet-600 font-bold" : "bg-gray-600 hover:bg-gray-500"}`}
              >
                {option}
              </button>
            ))}
          </div>

          <button
            onClick={() => handleSearch()}
            disabled={searching}
            className="mt-6 w-full rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 px-6 py-3 font-bold transition hover:opacity-90 disabled:opacity-50"
          >
            {searching ? "🔍 검색 중..." : "💡 성공사례 음악 검색"}
          </button>

          {searchError && <p className="mt-3 rounded-lg bg-red-900/40 p-3 text-sm text-red-400">{searchError}</p>}

          {videos.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="font-semibold text-gray-300">검색 결과 {videos.length}개 · 클릭하면 분석 시작</h3>
              {videos.map((v) => {
                const isSelected = playlistSelection.some((p) => p.id === v.id);
                return (
                  <div
                    key={v.id}
                    className={`w-full rounded-xl bg-[#22283e] p-3 transition ${selectedVideo?.id === v.id ? "ring-2 ring-violet-500" : ""} ${isSelected ? "ring-2 ring-emerald-500" : ""}`}
                  >
                    <button onClick={() => handleAnalyze(v)} className="flex w-full gap-3 text-left">
                      <img src={v.thumbnail} alt={v.title} className="h-16 w-28 flex-shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold text-white">{v.title}</p>
                        <p className="mt-1 text-xs text-gray-400">{v.channel}</p>
                        <div className="mt-1 flex gap-3 text-xs text-gray-500">
                          <span>👁 {formatViews(v.viewCount)}</span>
                          <span>💬 {formatViews(v.commentCount)}</span>
                          {v.duration && <span>⏱ {parseDuration(v.duration)}</span>}
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => togglePlaylistSelection(v)}
                      className={`mt-2 w-full rounded-lg py-1.5 text-xs font-bold transition ${isSelected ? "bg-red-700 hover:bg-red-600" : "bg-emerald-700 hover:bg-emerald-600"}`}
                    >
                      {isSelected ? "− 생성 목록에서 제거" : "+ 생성 목록에 추가"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {playlistSelection.length > 0 && (
            <div className="mt-4 rounded-xl bg-emerald-900/40 p-4">
              <p className="mb-2 text-sm font-semibold text-emerald-300">✅ {playlistSelection.length}개 영상 선택됨</p>
              <button
                onClick={() => setShowPlaylistSettings(true)}
                className="w-full rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 py-3 font-bold transition hover:opacity-90"
              >
                🎶 선택된 {playlistSelection.length}개 영상으로 플레이리스트 생성
              </button>
            </div>
          )}
        </div>

        {/* ── 오른쪽: 분석 / 작사 패널 */}
        <div className="rounded-xl bg-[#2b304a] p-6 shadow-2xl">
          <div className="mb-4 flex gap-5 border-b border-gray-700">
            <button
              onClick={() => setActiveTab("analyze")}
              className={`pb-3 text-lg font-bold transition ${activeTab === "analyze" ? "border-b-2 border-violet-500 text-violet-400" : "text-gray-400 hover:text-gray-200"}`}
            >
              🔍 AI 성공 공식 분석
            </button>
            <button
              onClick={() => setActiveTab("generate")}
              className={`pb-3 text-lg font-bold transition ${activeTab === "generate" ? "border-b-2 border-cyan-500 text-cyan-400" : "text-gray-400 hover:text-gray-200"}`}
            >
              ✍️ AI 가사 창작
            </button>
            <button
              onClick={() => setActiveTab("playlist")}
              className={`pb-3 text-lg font-bold transition ${activeTab === "playlist" ? "border-b-2 border-emerald-500 text-emerald-400" : "text-gray-400 hover:text-gray-200"}`}
            >
              🎶 플레이리스트 생성
            </button>
          </div>

          {/* ── 분석 탭 */}
          {activeTab === "analyze" && (
            <>
              {analyzing && (
                <div className="flex min-h-[350px] flex-col items-center justify-center gap-4">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
                  <p className="text-gray-400">GPT가 성공 공식을 분석 중입니다...</p>
                </div>
              )}

              {!analyzing && !analysis && (
                <div className="flex min-h-[350px] items-center justify-center text-center text-gray-400">
                  왼쪽 목록에서 분석할 영상을 클릭하세요.
                </div>
              )}

              {!analyzing && analysis && selectedVideo && (
                <div className="space-y-4">
                  <div className="flex gap-3 rounded-xl bg-[#22283e] p-3">
                    <img src={selectedVideo.thumbnail} className="h-14 w-24 rounded-lg object-cover" alt="" />
                    <div>
                      <p className="line-clamp-2 text-sm font-bold">{selectedVideo.title}</p>
                      <p className="text-xs text-gray-400">{selectedVideo.channel}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 rounded-xl bg-gradient-to-r from-violet-900/50 to-cyan-900/50 p-4">
                    <div className="text-5xl font-black text-yellow-400">{analysis.score}</div>
                    <div>
                      <p className="text-xs text-gray-400">흥행 점수</p>
                      <p className="font-bold text-white">{analysis.successFormula}</p>
                    </div>
                  </div>

                  {[
                    { label: "📝 제목 전략", value: analysis.titleStrategy },
                    { label: "🎯 타겟 청중", value: analysis.audienceTarget },
                    { label: "🏗 콘텐츠 구조", value: analysis.contentStructure },
                    { label: "💡 제작 추천사항", value: analysis.recommendation },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl bg-[#22283e] p-4">
                      <p className="mb-2 text-sm font-bold text-violet-300">{label}</p>
                      <p className="text-sm text-gray-300">{value}</p>
                    </div>
                  ))}

                  <div className="rounded-xl bg-[#22283e] p-4">
                    <p className="mb-3 text-sm font-bold text-violet-300">🔥 트렌드 키워드</p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.trendKeywords.map((kw) => (
                        <span key={kw} className="rounded-full bg-violet-700/50 px-3 py-1 text-xs font-bold">#{kw}</span>
                      ))}
                    </div>
                  </div>

                  {/* 가사 창작으로 이동 버튼 */}
                  <div className="rounded-xl bg-[#1a1f35] p-4">
                    <p className="mb-3 text-sm font-semibold text-gray-300">✍️ 이 분석으로 가사 창작하기</p>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {languageOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setLanguage(opt.value)}
                          className={`rounded-lg px-3 py-2 text-sm font-bold transition ${language === opt.value ? "bg-cyan-600" : "bg-[#37405c] hover:bg-[#454e6b]"}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={handleGenerate}
                      className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-violet-600 py-3 font-bold transition hover:opacity-90"
                    >
                      🎤 이 분석 기반으로 가사 창작
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── 가사 창작 탭 */}
          {activeTab === "generate" && (
            <>
              {!generating && !generated && (
                <div className="flex min-h-[350px] flex-col items-center justify-center gap-5 text-center">
                  <p className="text-gray-400">
                    영상을 분석하면 그 분위기에 맞는 가사를 창작합니다.<br />
                    분석 없이도 장르/키워드 기반으로 바로 창작할 수 있어요.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {languageOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setLanguage(opt.value)}
                        className={`rounded-lg px-3 py-2 text-sm font-bold transition ${language === opt.value ? "bg-cyan-600" : "bg-[#37405c] hover:bg-[#454e6b]"}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleGenerate}
                    className="rounded-lg bg-gradient-to-r from-cyan-600 to-violet-600 px-8 py-3 font-bold transition hover:opacity-90"
                  >
                    🎤 가사 바로 창작하기
                  </button>
                </div>
              )}

              {generating && (
                <div className="flex min-h-[350px] flex-col items-center justify-center gap-4">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
                  <p className="text-gray-400">GPT가 가사를 창작 중입니다...</p>
                  <p className="text-xs text-gray-500">노래 스타일 분석 → 가사 구조 설계 → 창작 중</p>
                </div>
              )}

              {!generating && generated && (
                <div className="space-y-4">
                  {/* 제목 + 감정 */}
                  <div className="rounded-xl bg-gradient-to-r from-violet-900/60 to-cyan-900/60 p-5">
                    <p className="text-2xl font-black text-white">🎵 {generated.songTitle}</p>
                    <p className="mt-2 text-sm text-cyan-300">💭 {generated.targetEmotion}</p>
                    <button
                      onClick={() => sendSongToBridge({
                        songTitle: generated.songTitle,
                        sunoStylePrompt: generated.sunoStylePrompt,
                        lyrics: Object.values(generated.lyrics).join("\n\n"),
                      })}
                      className="mt-4 rounded-xl bg-gradient-to-r from-violet-600 to-orange-500 px-4 py-2 text-sm font-bold text-white hover:opacity-90"
                    >
                      🧩 확장프로그램으로 보내기
                    </button>
                  </div>

                  {/* Suno Style Prompt */}
                  <div className="rounded-xl bg-[#1a1f35] p-4 ring-1 ring-violet-500/50">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-violet-300">🎛 Suno Style of Music</p>
                        <p className="text-xs text-gray-500 mt-0.5">Suno AI에 바로 붙여넣기 가능</p>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generated.sunoStylePrompt);
                          setCopiedSection("suno");
                          setTimeout(() => setCopiedSection(null), 2000);
                        }}
                        className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold hover:bg-violet-500 transition"
                      >
                        {copiedSection === "suno" ? "✅ Copied!" : "📋 Copy"}
                      </button>
                    </div>
                    <p className="rounded-lg bg-[#0f1220] p-3 text-sm leading-relaxed text-green-300 font-mono">
                      {generated.sunoStylePrompt}
                    </p>
                  </div>

                  {/* 전체 복사 버튼 */}
                  <button
                    onClick={copyAllLyrics}
                    className="w-full rounded-lg bg-gradient-to-r from-violet-700 to-cyan-700 py-2.5 text-sm font-bold hover:opacity-90 transition"
                  >
                    {copiedSection === "all" ? "✅ Copied! (Style + Lyrics)" : "📋 Copy All for Suno AI (Style + Lyrics)"}
                  </button>

                  {/* 스타일 + 프로듀싱 노트 합친 카드 */}
                  <div className="rounded-xl bg-[#22283e] p-4">
                    <p className="mb-3 text-sm font-bold text-violet-300">🎼 Song Style & Production</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg bg-[#2b304a] p-2">
                        <p className="text-xs text-gray-500">Genre</p>
                        <p className="font-semibold">{generated.style.genre}</p>
                      </div>
                      <div className="rounded-lg bg-[#2b304a] p-2">
                        <p className="text-xs text-gray-500">Tempo</p>
                        <p className="font-semibold">{generated.style.tempo}</p>
                      </div>
                      <div className="rounded-lg bg-[#2b304a] p-2">
                        <p className="text-xs text-gray-500">Mood</p>
                        <p className="font-semibold">{generated.style.mood}</p>
                      </div>
                      <div className="rounded-lg bg-[#2b304a] p-2">
                        <p className="text-xs text-gray-500">Vocal Style</p>
                        <p className="font-semibold">{generated.style.vocalStyle}</p>
                      </div>
                    </div>
                    <div className="mt-2 rounded-lg bg-[#2b304a] p-2">
                      <p className="text-xs text-gray-500">Instruments</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {generated.style.instruments.map((inst) => (
                          <span key={inst} className="rounded-full bg-violet-800/60 px-2 py-0.5 text-xs">{inst}</span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-2 rounded-lg bg-[#2b304a] p-2">
                      <p className="text-xs text-gray-500">Reference Sound</p>
                      <p className="mt-0.5 text-sm text-yellow-300">{generated.style.referenceSounds}</p>
                    </div>
                    <div className="mt-2 rounded-lg bg-[#1e2338] p-3">
                      <p className="text-xs text-gray-500">🎚 Production Notes</p>
                      <p className="mt-1 text-sm text-gray-300">{generated.productionNotes}</p>
                    </div>
                  </div>

                  {/* 이미지 프롬프트 */}
                  <div className="rounded-xl bg-[#22283e] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-bold text-violet-300">🖼 Image Prompt (16:9)</p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generated.imagePrompt);
                          setCopiedSection("img");
                          setTimeout(() => setCopiedSection(null), 2000);
                        }}
                        className="rounded-lg bg-[#37405c] px-3 py-1 text-xs font-bold hover:bg-[#454e6b] transition"
                      >
                        {copiedSection === "img" ? "✅ Copied!" : "📋 Copy Prompt"}
                      </button>
                    </div>
                    <p className="rounded-lg bg-[#1e2338] p-3 text-sm leading-relaxed text-yellow-200">
                      {generated.imagePrompt}
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      💡 Midjourney · DALL-E · Stable Diffusion · Sora 등에 바로 사용 가능
                    </p>
                  </div>

                  {/* 곡 구조 */}
                  <div className="rounded-xl bg-[#22283e] p-4">
                    <p className="mb-3 text-sm font-bold text-violet-300">🏗 Song Structure</p>
                    <div className="flex flex-wrap gap-2">
                      {generated.structure.map((section, i) => (
                        <span key={i} className="rounded-full bg-[#2b304a] px-3 py-1 text-xs font-semibold text-gray-300">
                          {i + 1}. {section}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 가사 섹션 - 코드블럭 스타일 */}
                  <div className="rounded-xl bg-[#22283e] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-bold text-violet-300">📝 Lyrics</p>
                      <button
                        onClick={() => {
                          const full = Object.entries(generated.lyrics)
                            .map(([k, v]) => `[${lyricLabels[k] || k}]\n${v}`)
                            .join("\n\n");
                          navigator.clipboard.writeText(full);
                          setCopiedSection("lyrics-all");
                          setTimeout(() => setCopiedSection(null), 2000);
                        }}
                        className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold hover:bg-violet-500 transition"
                      >
                        {copiedSection === "lyrics-all" ? "✅ Copied!" : "📋 Copy All Lyrics"}
                      </button>
                    </div>
                    <div className="space-y-3">
                      {Object.entries(generated.lyrics).map(([key, text]) => (
                        <div key={key} className="rounded-xl bg-[#1a1f35] p-4 ring-1 ring-violet-500/30">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-bold text-violet-400">{lyricLabels[key] || key}</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleRegenerateSection(key)}
                                disabled={regeneratingSection === key}
                                className="rounded-lg bg-cyan-800 px-3 py-1 text-xs font-bold hover:bg-cyan-700 transition disabled:opacity-50"
                              >
                                {regeneratingSection === key ? "⏳ 생성 중..." : "🔄 다시생성"}
                              </button>
                              <button
                                onClick={() => copySection(key, text)}
                                className="rounded-lg bg-[#2b304a] px-3 py-1 text-xs font-bold hover:bg-[#37405c] transition"
                              >
                                {copiedSection === key ? "✅ Copied!" : "📋 Copy"}
                              </button>
                            </div>
                          </div>
                          {regeneratingSection === key ? (
                            <div className="rounded-lg bg-[#0f1220] p-3 flex items-center justify-center text-cyan-400 text-sm">
                              <span className="animate-pulse">✨ 가사 재창작 중...</span>
                            </div>
                          ) : (
                            <p className={`rounded-lg bg-[#0f1220] p-3 font-mono text-sm leading-relaxed whitespace-pre-wrap ${lyricColors[key] || "text-white"}`}>
                              {text}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 다시 생성 */}
                  <div className="flex flex-wrap gap-2">
                    {languageOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setLanguage(opt.value)}
                        className={`rounded-lg px-3 py-2 text-xs font-bold transition ${language === opt.value ? "bg-cyan-600" : "bg-[#37405c] hover:bg-[#454e6b]"}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleGenerate}
                    className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-violet-600 py-3 font-bold transition hover:opacity-90"
                  >
                    🔄 다시 창작하기
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── 플레이리스트 생성 탭 */}
          {activeTab === "playlist" && (
            <>
              {playlistSongs.length === 0 && (
                <div className="flex min-h-[350px] flex-col items-center justify-center gap-3 text-center text-gray-400">
                  <p>
                    왼쪽에서 참조 영상을 여러 개 선택한 뒤<br />
                    &quot;플레이리스트 생성&quot; 버튼을 눌러주세요.
                  </p>
                  {playlistSelection.length > 0 && (
                    <button
                      onClick={() => setShowPlaylistSettings(true)}
                      className="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 px-6 py-3 font-bold transition hover:opacity-90"
                    >
                      🎶 선택된 {playlistSelection.length}개 영상으로 설정 열기
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>
      )}

      {/* 플레이리스트 생성 설정 모달 */}
      {showPlaylistSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-[#2b304a] p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-emerald-400">
                아래 {playlistSelection.length}개의 성공사례를 종합하여<br />새로운 플레이리스트를 생성하시겠습니까?
              </h2>
              <button onClick={() => setShowPlaylistSettings(false)} className="text-2xl text-gray-400 hover:text-white">✕</button>
            </div>

            <h3 className="mb-2 text-sm font-bold text-gray-300">참조 영상 목록</h3>
            <div className="mb-5 space-y-2">
              {playlistSelection.map((v) => (
                <div key={v.id} className="flex items-center gap-3 rounded-lg bg-[#22283e] p-2">
                  <img src={v.thumbnail} alt={v.title} className="h-10 w-16 flex-shrink-0 rounded object-cover" />
                  <p className="line-clamp-1 flex-1 text-sm text-gray-200">{v.title}</p>
                  <button
                    onClick={() => togglePlaylistSelection(v)}
                    className="flex-shrink-0 text-xl text-red-400 hover:text-red-300"
                    title="목록에서 제거"
                  >
                    ⊖
                  </button>
                </div>
              ))}
              {playlistSelection.length === 0 && (
                <p className="rounded-lg bg-[#22283e] p-3 text-center text-xs text-gray-500">
                  선택된 영상이 없습니다. 모달을 닫고 영상을 추가해주세요.
                </p>
              )}
            </div>

            <div className="mb-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-300">제작할 곡 수: {songCount}</label>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={songCount}
                  onChange={(e) => setSongCount(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-300">곡 가사 언어</label>
                <select
                  value={playlistLanguage}
                  onChange={(e) => setPlaylistLanguage(e.target.value)}
                  className="w-full rounded-lg bg-[#37405c] p-3 text-white outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {languageOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <h3 className="mb-3 text-sm font-bold text-gray-300">음악적 변주 추가 (선택)</h3>
            <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {variationOptions.map((opt) => (
                <label key={opt} className="flex cursor-pointer items-center gap-2 rounded-lg bg-[#22283e] p-2 text-xs">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-emerald-500"
                    checked={selectedVariations.includes(opt)}
                    onChange={() => toggleVariation(opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>

            <h3 className="mb-3 text-sm font-bold text-gray-300">플레이리스트 용도 / 장르 (선택)</h3>
            <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {useCaseOptions.map((opt) => (
                <label key={opt} className="flex cursor-pointer items-center gap-2 rounded-lg bg-[#22283e] p-2 text-xs">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-emerald-500"
                    checked={selectedUseCases.includes(opt)}
                    onChange={() => toggleUseCase(opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowPlaylistSettings(false)} className="flex-1 rounded-lg bg-[#37405c] py-3 font-bold hover:bg-[#454e6b] transition">
                취소
              </button>
              <button
                onClick={handleGeneratePlaylist}
                disabled={playlistSelection.length === 0}
                className="flex-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 py-3 font-bold hover:opacity-90 transition disabled:opacity-40"
              >
                ✨ 플레이리스트 생성
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 플레이리스트 생성 중 로딩 오버레이 */}
      {generatingPlaylist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl bg-[#2b304a] p-8 text-center">
            <div className="mx-auto mb-5 h-16 w-16 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            <p className="mb-2 text-lg font-bold text-white">작업지시서 생성 중...</p>
            <p className="text-sm text-gray-400">
              AI가 SEO, 썸네일 프롬프트, 음악 스타일, 가사를 모두 포함한 제작 문서를 만들고 있습니다.
              곡 {songCount}개를 생성 중이라 시간이 조금 걸릴 수 있어요.
            </p>
          </div>
        </div>
      )}

      {/* API 설정 모달 */}
      {showApiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-md rounded-xl bg-[#2b304a] p-6 shadow-2xl ring-1 ring-violet-500/20">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-bold">🔑 API 설정</h2>
              <div className="flex items-center gap-2">
                <a href="/tools" className="rounded-lg bg-violet-600/20 px-3 py-1 text-xs font-bold text-violet-200 hover:bg-violet-600/40">통합도구</a>
                <button onClick={resetAll} className="rounded-lg bg-white/10 px-3 py-1 text-xs font-bold text-white hover:bg-white/20">새로시작</button>
                <button onClick={() => setShowApiModal(false)} className="text-2xl text-gray-400 hover:text-white">✕</button>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-300">YouTube Data API v3 Key</label>
                <input
                  value={youtubeKey}
                  onChange={(e) => setYoutubeKey(e.target.value)}
                  className="w-full rounded-lg bg-[#37405c] p-3 outline-none focus:ring-2 focus:ring-cyan-400"
                  placeholder="AIzaSy..."
                />
                <p className="mt-1 text-xs text-gray-500">Google Cloud Console → YouTube Data API v3</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-300">OpenAI API Key</label>
                <input
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  type="password"
                  className="w-full rounded-lg bg-[#37405c] p-3 outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="sk-..."
                />
                <p className="mt-1 text-xs text-gray-500">platform.openai.com → API Keys</p>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={openModal}
                  className="w-auto rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-violet-200 hover:bg-white/20"
                >
                  키 불러오기 →
                </button>
              </div>
              <div className="rounded-lg bg-yellow-900/30 p-3 text-xs text-yellow-400">
                ⚠️ API 키는 브라우저 로컬스토리지에만 저장되며 서버로 전송되지 않습니다.
              </div>
              <button onClick={saveKeys} className="w-full rounded-lg bg-violet-600 py-3 font-bold transition hover:bg-violet-500">저장</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
