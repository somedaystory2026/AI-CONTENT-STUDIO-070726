/* =========================================
   수노 일본 시니어 엔카 생성기 — app.js
   =========================================
   ⚠️  ANTHROPIC_API_KEY 설정 필요
   .env 파일을 만들거나 아래 CONFIG에 직접 입력하세요.
   (단, 키를 깃허브에 절대 올리지 마세요 — .gitignore 참고)
   ========================================= */

const CONFIG = {
  // 방법 A: 직접 입력 (로컬 테스트용, 깃허브 업로드 금지!)
  API_KEY: "",

  // 방법 B: 서버 사이드 프록시 URL (권장)
  // 예: "/api/generate" 또는 "https://your-worker.workers.dev/generate"
  PROXY_URL: "",

  MODEL: "claude-sonnet-4-20250514",
  MAX_TOKENS: 1000,
};

// ---- Tab switching ----
function switchTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
  const idx = { make: 0, eq: 1, tips: 2 }[name];
  document.querySelectorAll(".tab")[idx].classList.add("active");
  document.getElementById("tab-" + name).classList.add("active");
}

// ---- Chip logic ----
function setupChips() {
  // Genre — single select
  document.querySelectorAll("#genre-chips .chip").forEach((c) => {
    c.addEventListener("click", () => {
      document.querySelectorAll("#genre-chips .chip").forEach((x) => x.classList.remove("active"));
      c.classList.add("active");
    });
  });

  // Region — single select
  document.querySelectorAll("#region-chips .chip").forEach((c) => {
    c.addEventListener("click", () => {
      document.querySelectorAll("#region-chips .chip").forEach((x) => x.classList.remove("active"));
      c.classList.add("active");
    });
  });

  // Instrument — multi select
  document.querySelectorAll("#inst-chips .chip").forEach((c) => {
    c.addEventListener("click", () => c.classList.toggle("active"));
  });
}

// ---- Helpers ----
function getActiveVals(groupId, dataAttr = "val") {
  return [...document.querySelectorAll(`#${groupId} .chip.active`)]
    .map((c) => c.dataset[dataAttr])
    .filter(Boolean);
}

function copyText(sourceId, okId) {
  const text = document.getElementById(sourceId).textContent;
  navigator.clipboard.writeText(text).then(() => {
    const ok = document.getElementById(okId);
    ok.style.opacity = "1";
    setTimeout(() => (ok.style.opacity = "0"), 2000);
  });
}

// ---- Build prompts ----
function buildPrompts() {
  const genre    = document.querySelector("#genre-chips .chip.active")?.textContent || "엔카 정통";
  const theme    = document.getElementById("theme").value;
  const mood     = document.getElementById("mood").value;
  const region   = document.querySelector("#region-chips .chip.active")?.dataset.val || "";
  const insts    = getActiveVals("inst-chips");
  const vocal    = document.getElementById("vocal").value;
  const introType = document.getElementById("intro-type").value;
  const dynamic  = document.getElementById("dynamic").value;
  const era      = document.getElementById("era").value;
  const lyricLang = document.getElementById("lyric-lang").value;
  const ytFmt    = document.getElementById("yt-fmt").value;
  const ref      = document.getElementById("ref").value;
  const extra    = document.getElementById("extra").value.trim();

  const instStr = insts.length
    ? insts.join("; ")
    : "fingerstyle acoustic guitar carrying the emotional core; string ensemble swelling beneath the vocal; subtle synth pad creating ambient depth";

  const system = `You are a professional Suno AI prompt engineer and lyricist specialized in Japanese enka and Showa-era music for senior audiences (60-80s). Follow these rules strictly:
1. Style of Music: natural English prose, 150-250 characters, NO structural tags like [BPM=120], NO negative instructions
2. Most important elements (genre, mood) come first in Style
3. Artist reference: 1-2 max
4. Always end Style with: [Audio quality improved to masterpiece]
5. Lyrics: use Suno section tags [Intro][Verse 1][Pre-Chorus][Chorus][Verse 2][Pre-Chorus][Chorus][Bridge][Final Chorus][Outro]
6. Lyrics must feel like a real person speaking — no clichés (no "dream", "shining", "forever")
7. Song title in Japanese`;

  const user = `Create a Suno AI optimized Japanese ${genre} song:
- Theme: ${theme}
- Mood: ${mood}
- Region/Setting: ${region || "unspecified"}
- Instruments: ${instStr}
- Vocal: ${vocal}
- Intro type: ${introType}
- Dynamics: ${dynamic}
- Era: ${era}
- Reference artist: ${ref || "none"}
- Lyric language: ${lyricLang}
- YouTube title format: ${ytFmt}
${extra ? "- Extra notes: " + extra : ""}

Output ONLY valid JSON, no markdown fences:
{
  "title_jp": "song title in Japanese",
  "title_read": "reading in hiragana or romaji",
  "title_kr": "Korean title",
  "style_of_music": "English prose 150-250 chars, 5-step formula",
  "suno_tags": "comma-separated English keyword tags",
  "youtube_title": "YouTube title in Japanese matching requested format",
  "checklist": "3-second check result as 3 lines, each starting with ✓ or △",
  "lyrics": "full lyrics with all section tags"
}`;

  return { system, user };
}

// ---- API call ----
async function callClaude(system, user) {
  const body = JSON.stringify({
    model: CONFIG.MODEL,
    max_tokens: CONFIG.MAX_TOKENS,
    system,
    messages: [{ role: "user", content: user }],
  });

  // Use proxy if configured, otherwise call Anthropic directly
  const url = CONFIG.PROXY_URL || "https://api.anthropic.com/v1/messages";
  const headers = { "Content-Type": "application/json" };

  if (!CONFIG.PROXY_URL) {
    if (!CONFIG.API_KEY) {
      throw new Error("API_KEY가 설정되지 않았습니다. CONFIG.API_KEY를 입력하거나 PROXY_URL을 설정하세요.");
    }
    headers["x-api-key"] = CONFIG.API_KEY;
    headers["anthropic-version"] = "2023-06-01";
  }

  const res = await fetch(url, { method: "POST", headers, body });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API 오류 ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.content.map((i) => i.text || "").join("");
}

// ---- Render result ----
function renderResult(p) {
  document.getElementById("r-title").textContent =
    p.title_jp + (p.title_kr ? "  /  " + p.title_kr : "");
  document.getElementById("r-sub").textContent = p.title_read || "";
  document.getElementById("r-som").textContent = p.style_of_music || "";
  document.getElementById("r-yt").textContent = p.youtube_title || "";
  document.getElementById("r-check").textContent = p.checklist || "";
  document.getElementById("r-lyrics").textContent = p.lyrics || "";

  const tagsEl = document.getElementById("r-tags");
  tagsEl.innerHTML = "";
  (p.suno_tags || "").split(",").forEach((t) => {
    const span = document.createElement("span");
    span.className = "pill";
    span.textContent = t.trim();
    tagsEl.appendChild(span);
  });

  const resultEl = document.getElementById("result");
  resultEl.classList.add("show");
  resultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ---- Main generate ----
async function generate() {
  const btn = document.getElementById("gen-btn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>生成中...';

  try {
    const { system, user } = buildPrompts();
    const rawText = await callClaude(system, user);
    const clean = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    renderResult(parsed);
  } catch (e) {
    alert("생성 오류: " + e.message);
    console.error(e);
  }

  btn.disabled = false;
  btn.innerHTML = "演歌を生成する — 프로 엔카 생성";
}

// ---- Copy buttons ----
function setupCopyButtons() {
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      copyText(btn.dataset.copy, btn.dataset.ok);
    });
  });
}

// ---- Init ----
document.addEventListener("DOMContentLoaded", () => {
  setupChips();
  setupCopyButtons();

  document.getElementById("gen-btn").addEventListener("click", generate);
  document.getElementById("regen-btn")?.addEventListener("click", generate);
});
