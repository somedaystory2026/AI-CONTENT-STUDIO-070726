// ============================================================
// AI 인플루언서 진아 생성기 — 앱 로직
// 일반 스크립트로 로드됩니다 (type=module 아님) — file:// 더블클릭 실행 호환
// Gemini SDK는 필요한 시점에 동적 import()로 불러옵니다.
// ============================================================
(function () {
  const D = window.JinaData;
  let GoogleGenAI = null;
  let JSZipLib = null;

  async function ensureSDK() {
    if (GoogleGenAI) return;
    const mod = await import("https://esm.sh/@google/genai@^1.35.0");
    GoogleGenAI = mod.GoogleGenAI;
  }

  async function ensureZip() {
    if (JSZipLib) return;
    const mod = await import("https://esm.sh/jszip@3.10.1");
    JSZipLib = mod.default || mod;
  }

  // ---------------------------------------------------------------
  // localStorage 안전 래퍼
  // (일부 브라우저는 file:// 로 연 페이지에서 localStorage 접근을 막아
  //  예외를 던지는 경우가 있어, 실패해도 앱 전체가 멈추지 않도록 처리합니다)
  // ---------------------------------------------------------------
  const memoryStore = {};
  function safeGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return memoryStore[key] || null;
    }
  }
  function safeSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      memoryStore[key] = value;
    }
  }

  // ---------------------------------------------------------------
  // 상태
  // ---------------------------------------------------------------
  const state = {
    geminiKey: safeGet("jina_gemini_key") || safeGet("jina_api_key") || "", // 이전 버전 키 이름 호환
    openaiKey: safeGet("jina_openai_key") || "",
    claudeKey: safeGet("jina_claude_key") || "",
    captionEngine: safeGet("jina_caption_engine") || "gemini",
    personImage: null,
    gender: "female",
    ethnicity: "kr",
    age: "24",
    hairStyle: "ref_same",
    faceStyle: "elegant",
    expression: "g_smile",
    pose: "selfie",
    outfit: D.OUTFIT_GROUPS[0].options[0].detail,
    location: D.LOCATION_GROUPS[0].options[0].detail,
    isAdMode: false,
    productType: "top",
    productName: "",
    productImages: [], // [{ dataUrl, name }]
    lighting: "daylight",
    camera: "iphone_front",
    film: "modern_digital",
    skins: ["glow", "pore"],
    aspectRatio: "3:4",
    quality: "1K",
    storyContext: "",
    loading: false,
    results: [], // [{ status: 'idle'|'loading'|'done'|'error', image?, prompt?, error? }] length 4
    selectedIndex: -1,
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function dataUrlToMime(dataUrl) {
    const m = /^data:([^;]+);base64,/.exec(dataUrl || "");
    return m ? m[1] : "image/png";
  }
  function dataUrlToBase64(dataUrl) {
    const idx = (dataUrl || "").indexOf(",");
    return idx >= 0 ? dataUrl.slice(idx + 1) : "";
  }
  function dataUrlToBytes(dataUrl) {
    const binary = atob(dataUrlToBase64(dataUrl));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  // ---------------------------------------------------------------
  // ZIP 다운로드 (선택한 컷 / 전체)
  // ---------------------------------------------------------------
  async function downloadAsZip(files, zipName) {
    await ensureZip();
    const zip = new JSZipLib();
    files.forEach((f) => zip.file(f.name, dataUrlToBytes(f.dataUrl)));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  }

  async function downloadSelectedZip() {
    const r = state.results[state.selectedIndex];
    if (!r || r.status !== "done") {
      setStatus("먼저 다운로드할 컷을 클릭해서 선택해주세요.", true);
      return;
    }
    try {
      setStatus("ZIP 파일을 만드는 중...");
      await downloadAsZip(
        [{ name: `jina-cut-${state.selectedIndex + 1}.png`, dataUrl: r.image }],
        `jina-선택컷-${Date.now()}.zip`
      );
      setStatus("ZIP 다운로드 완료!");
    } catch (err) {
      console.error(err);
      setStatus(`ZIP 생성 실패: ${err.message || err}`, true);
    }
  }

  async function downloadAllZip() {
    const doneItems = state.results
      .map((r, i) => ({ r, i }))
      .filter((x) => x.r && x.r.status === "done");
    if (doneItems.length === 0) {
      setStatus("다운로드할 완료된 컷이 없습니다. 먼저 생성해주세요.", true);
      return;
    }
    try {
      setStatus("ZIP 파일을 만드는 중...");
      await downloadAsZip(
        doneItems.map((x) => ({ name: `jina-cut-${x.i + 1}.png`, dataUrl: x.r.image })),
        `jina-4컷-${Date.now()}.zip`
      );
      setStatus(`${doneItems.length}장을 ZIP으로 다운로드했습니다.`);
    } catch (err) {
      console.error(err);
      setStatus(`ZIP 생성 실패: ${err.message || err}`, true);
    }
  }

  // ---------------------------------------------------------------
  // 옵션 렌더 헬퍼
  // ---------------------------------------------------------------
  function fillSelect(el, items, current, labelKey) {
    labelKey = labelKey || "ko";
    el.innerHTML = items
      .map((it) => `<option value="${it.id}" ${it.id === current ? "selected" : ""}>${it[labelKey]}</option>`)
      .join("");
  }

  // 값(id) 기반 그룹 셀렉트 (카메라처럼 카테고리 + id 옵션)
  function fillGroupedSelectById(el, groups, current) {
    el.innerHTML = groups
      .map(
        (g) =>
          `<optgroup label="${g.category}">` +
          g.options
            .map((o) => `<option value="${o.id}" ${o.id === current ? "selected" : ""}>${o.ko}</option>`)
            .join("") +
          `</optgroup>`
      )
      .join("");
  }

  // 값(detail 문자열) 기반 그룹 셀렉트 (아웃핏/장소 추천 드롭다운 — 고르면 텍스트 입력창에 채워짐)
  function fillGroupedSelectByDetail(el, groups, placeholder) {
    el.innerHTML =
      `<option value="">${placeholder}</option>` +
      groups
        .map(
          (g) =>
            `<optgroup label="${g.category}">` +
            g.options.map((o) => `<option value="${escapeAttr(o.detail)}">${o.ko}</option>`).join("") +
            `</optgroup>`
        )
        .join("");
  }

  function renderProductThumbs() {
    const wrap = $("#product-thumbs");
    if (!wrap) return;
    if (state.productImages.length === 0) {
      wrap.innerHTML = `<p class="hint" style="margin:0;">아직 업로드된 제품 이미지가 없습니다.</p>`;
      return;
    }
    wrap.innerHTML = state.productImages
      .map(
        (p, i) =>
          `<div class="product-thumb">
            <img src="${p.dataUrl}" alt="제품 이미지 ${i + 1}" />
            <button type="button" class="remove-thumb" data-idx="${i}" title="삭제">✕</button>
          </div>`
      )
      .join("");
  }

  function escapeAttr(str) {
    return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  }

  function syncOutfitLocationInputs() {
    $("#outfit-text").value = state.outfit;
    $("#location-text").value = state.location;
  }

  function initControls() {
    fillSelect($("#sel-gender"), D.GENDERS, state.gender);
    fillSelect($("#sel-ethnicity"), D.ETHNICITIES, state.ethnicity);
    fillSelect($("#sel-age"), D.AGES, state.age);
    fillSelect($("#sel-hair"), D.HAIRSTYLES, state.hairStyle);
    fillSelect($("#sel-facestyle"), D.FACE_STYLES, state.faceStyle);
    fillSelect($("#sel-expression"), D.EXPRESSIONS, state.expression);
    fillSelect($("#sel-pose"), D.POSES, state.pose);
    fillGroupedSelectByDetail($("#sel-outfit"), D.OUTFIT_GROUPS, "🎁 추천 아웃핏에서 선택...");
    fillGroupedSelectByDetail($("#sel-location"), D.LOCATION_GROUPS, "📍 추천 장소에서 선택...");
    fillSelect($("#sel-product-type"), D.PRODUCT_TYPES, state.productType);
    fillSelect($("#sel-lighting"), D.LIGHTINGS, state.lighting);
    fillGroupedSelectById($("#sel-camera"), D.CAMERAS, state.camera);
    fillSelect($("#sel-film"), D.FILMS, state.film);
    fillSelect($("#sel-quality"), D.QUALITIES, state.quality);
    fillSelect($("#sel-aspect"), D.ASPECT_RATIOS, state.aspectRatio);
    syncOutfitLocationInputs();

    const skinWrap = $("#skin-chips");
    skinWrap.innerHTML = D.SKINS.map(
      (s) =>
        `<button type="button" data-skin="${s.id}" class="skin-chip ${state.skins.includes(s.id) ? "active" : ""}">${s.ko}</button>`
    ).join("");

    const weekWrap = $("#weekday-chips");
    weekWrap.innerHTML = D.WEEKDAY_THEMES.map(
      (w) => `<button type="button" data-week="${w.id}" class="week-chip">${w.ko}<span>${w.label}</span></button>`
    ).join("");

    const vibeWrap = $("#vibe-chips");
    vibeWrap.innerHTML = D.DAILY_VIBES.map(
      (v) => `<button type="button" data-vibe="${v.id}" class="vibe-chip">${v.ko}</button>`
    ).join("");

    renderProductThumbs();
  }

  function bindControls() {
    $("#sel-gender").addEventListener("change", (e) => (state.gender = e.target.value));
    $("#sel-ethnicity").addEventListener("change", (e) => (state.ethnicity = e.target.value));
    $("#sel-age").addEventListener("change", (e) => (state.age = e.target.value));
    $("#sel-hair").addEventListener("change", (e) => (state.hairStyle = e.target.value));
    $("#sel-facestyle").addEventListener("change", (e) => (state.faceStyle = e.target.value));
    $("#sel-expression").addEventListener("change", (e) => (state.expression = e.target.value));
    $("#sel-pose").addEventListener("change", (e) => (state.pose = e.target.value));

    $("#outfit-text").addEventListener("input", (e) => (state.outfit = e.target.value));
    $("#location-text").addEventListener("input", (e) => (state.location = e.target.value));

    $("#sel-outfit").addEventListener("change", (e) => {
      if (!e.target.value) return;
      state.outfit = e.target.value;
      $("#outfit-text").value = state.outfit;
      e.target.value = "";
    });
    $("#sel-location").addEventListener("change", (e) => {
      if (!e.target.value) return;
      state.location = e.target.value;
      $("#location-text").value = state.location;
      e.target.value = "";
    });

    $("#product-mode-toggle").addEventListener("change", (e) => {
      state.isAdMode = e.target.checked;
      $("#product-mode-body").classList.toggle("hidden", !state.isAdMode);
    });
    $("#sel-product-type").addEventListener("change", (e) => (state.productType = e.target.value));
    $("#product-name").addEventListener("input", (e) => (state.productName = e.target.value));
    $("#product-upload").addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        const dataUrl = await fileToDataURL(file);
        state.productImages.push({ dataUrl, name: file.name });
      }
      e.target.value = ""; // 같은 파일 다시 선택 가능하도록 초기화
      renderProductThumbs();
      if (state.productImages.length > 0 && !state.isAdMode) {
        setStatus("제품 이미지가 추가되었습니다. 위 체크박스를 켜면 이 제품을 착용한 모습으로 생성돼요.");
      }
    });
    $("#product-thumbs").addEventListener("click", (e) => {
      const btn = e.target.closest(".remove-thumb");
      if (!btn) return;
      const idx = Number(btn.dataset.idx);
      state.productImages.splice(idx, 1);
      renderProductThumbs();
    });

    $("#sel-lighting").addEventListener("change", (e) => (state.lighting = e.target.value));
    $("#sel-camera").addEventListener("change", (e) => (state.camera = e.target.value));
    $("#sel-film").addEventListener("change", (e) => (state.film = e.target.value));
    $("#sel-quality").addEventListener("change", (e) => (state.quality = e.target.value));
    $("#sel-aspect").addEventListener("change", (e) => (state.aspectRatio = e.target.value));
    $("#story-context").addEventListener("input", (e) => (state.storyContext = e.target.value));

    $("#skin-chips").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-skin]");
      if (!btn) return;
      const id = btn.dataset.skin;
      if (state.skins.includes(id)) {
        state.skins = state.skins.filter((s) => s !== id);
        btn.classList.remove("active");
      } else {
        state.skins.push(id);
        btn.classList.add("active");
      }
    });

    $("#weekday-chips").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-week]");
      if (!btn) return;
      const theme = D.WEEKDAY_THEMES.find((w) => w.id === btn.dataset.week);
      applyWeekdayTheme(theme);
    });

    const weekRandomBtn = $("#weekday-random-btn");
    if (weekRandomBtn) {
      weekRandomBtn.addEventListener("click", () => {
        applyWeekdayTheme(pickRandom(D.WEEKDAY_THEMES));
      });
    }

    $("#vibe-chips").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-vibe]");
      if (!btn) return;
      const vibe = D.DAILY_VIBES.find((v) => v.id === btn.dataset.vibe);
      applyVibe(vibe);
    });

    const vibeRandomBtn = $("#vibe-random-btn");
    if (vibeRandomBtn) {
      vibeRandomBtn.addEventListener("click", () => {
        applyVibe(pickRandom(D.DAILY_VIBES));
      });
    }

    const randomizeAllBtn = $("#randomize-all-btn");
    if (randomizeAllBtn) {
      randomizeAllBtn.addEventListener("click", () => {
        randomizeStyling();
      });
    }

    const externalPromptBtn = $("#gen-from-external-btn");
    if (externalPromptBtn) {
      externalPromptBtn.addEventListener("click", () => {
        generateImage({ rawPrompt: $("#external-prompt-text").value });
      });
    }
  }

  // ---------------------------------------------------------------
  // 랜덤 유틸 + 프리셋 적용 (클릭 / 랜덤 버튼 공용)
  // ---------------------------------------------------------------
  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function applyWeekdayTheme(theme) {
    if (!theme) return;
    const outfitDetail = D.OUTFIT_GROUPS.flatMap((g) => g.options).find((o) => o.id === theme.outfit)?.detail;
    const locationDetail = D.LOCATION_GROUPS.flatMap((g) => g.options).find((o) => o.id === theme.location)?.detail;
    state.outfit = outfitDetail || state.outfit;
    state.location = locationDetail || state.location;
    state.lighting = theme.lighting;
    state.pose = theme.pose;
    state.expression = theme.expression;
    initControls();
    setStatus(`"${theme.label}" 테마가 적용되었습니다. 생성 버튼을 눌러주세요.`);
  }

  function applyVibe(vibe) {
    if (!vibe) return;
    const c = vibe.config;
    state.outfit = c.outfit;
    state.location = c.location;
    state.expression = c.expression;
    state.pose = c.pose;
    state.lighting = c.lighting;
    state.hairStyle = c.hairStyle;
    state.camera = c.camera;
    state.film = c.filmStock;
    state.skins = c.skin.slice();
    initControls();
    setStatus(`"${vibe.ko}" 프리셋이 적용되었습니다. 생성 버튼을 눌러주세요.`);
  }

  // 장소/포즈/촬영설정 등 스타일링 항목을 전부 랜덤으로 섞습니다.
  // 성별/나이/에스닉(인물 정체성)은 절대 건드리지 않습니다 — 에스닉은 사용자가
  // 직접 고른 값(기본 한국인)을 그대로 유지해야 합니다.
  function randomizeStyling() {
    state.outfit = pickRandom(D.OUTFIT_GROUPS.flatMap((g) => g.options)).detail;
    state.location = pickRandom(D.LOCATION_GROUPS.flatMap((g) => g.options)).detail;
    state.pose = pickRandom(D.POSES).id;
    state.expression = pickRandom(D.EXPRESSIONS).id;
    state.hairStyle = pickRandom(D.HAIRSTYLES).id;
    state.faceStyle = pickRandom(D.FACE_STYLES).id;
    state.lighting = pickRandom(D.LIGHTINGS).id;
    state.camera = pickRandom(D.CAMERAS.flatMap((g) => g.options)).id;
    state.film = pickRandom(D.FILMS).id;
    const skinPool = D.SKINS.map((s) => s.id);
    state.skins = [pickRandom(skinPool), pickRandom(skinPool)].filter((v, i, arr) => arr.indexOf(v) === i);
    initControls();
    setStatus("장소 · 포즈 · 촬영설정을 랜덤으로 새로 섞었습니다. (인물 설정/에스닉은 유지됩니다) 생성 버튼을 눌러주세요.");
  }

  // ---------------------------------------------------------------
  // 레퍼런스 이미지 (진아 얼굴 고정)
  // 이미지는 reference-data.js 에 base64로 내장되어 있습니다.
  // (Chrome은 file:// 페이지에서 fetch()로 로컬 파일을 읽는 것을 막기 때문에,
  //  내장된 데이터를 바로 사용해야 double-click 실행 시에도 안전하게 동작합니다)
  // ---------------------------------------------------------------
  // ---------------------------------------------------------------
  // 진아 전용 얼굴 고정 프롬프트 (Google Flow 등 API 미지원 도구용)
  // ---------------------------------------------------------------
  function buildFaceLockPromptText() {
    return (
      "Photorealistic image of the same young Korean woman shown in the attached reference image.\n" +
      "Keep her face, eyes, nose, mouth, skin tone, hairstyle, and body proportions EXACTLY the same as the reference photo — do not change her identity.\n\n" +
      D.FACE_LOCK_RULES + ".\n\n" +
      D.NEGATIVE_RULES
    );
  }

  function initFaceLockPromptBox() {
    const box = $("#face-lock-prompt-text");
    const btn = $("#copy-face-lock-btn");
    if (!box || !btn) return;
    box.value = buildFaceLockPromptText();

    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(box.value);
      } catch (e) {
        box.select();
        document.execCommand("copy");
      }
      btn.textContent = "✅ 복사됨!";
      setTimeout(() => (btn.textContent = "📋 복사"), 1500);
    });
  }

  function initReferenceGallery() {
    const gallery = $("#ref-gallery");
    const images = window.JinaReferenceImages || {};
    const files = Object.keys(images);

    if (files.length === 0) {
      gallery.innerHTML = `<p class="muted" style="grid-column:1/-1;">reference-data.js 를 찾을 수 없습니다. index.html과 같은 폴더에 있는지 확인해주세요.</p>`;
      return;
    }

    gallery.innerHTML = files
      .map(
        (f, i) =>
          `<button type="button" class="ref-thumb ${i === 0 ? "active" : ""}" data-file="${f}">
            <img src="${images[f]}" alt="진아 레퍼런스 ${i + 1}" />
          </button>`
      )
      .join("");

    const setActive = (file, btn) => {
      state.personImage = images[file];
      $$(".ref-thumb").forEach((t) => t.classList.remove("active"));
      if (btn) btn.classList.add("active");
    };

    gallery.addEventListener("click", (e) => {
      const btn = e.target.closest(".ref-thumb");
      if (!btn) return;
      setActive(btn.dataset.file, btn);
    });

    setActive(files[0], gallery.querySelector(".ref-thumb"));

    $("#upload-ref").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      state.personImage = await fileToDataURL(file);
      $$(".ref-thumb").forEach((t) => t.classList.remove("active"));
      setStatus("직접 업로드한 이미지로 얼굴이 고정되었습니다.");
    });
  }

  // ---------------------------------------------------------------
  // 프롬프트 구성
  // ---------------------------------------------------------------
  function buildPrompt() {
    const genderDetail = D.GENDERS.find((g) => g.id === state.gender)?.detail || state.gender;
    const ethnicityDetail = D.ETHNICITIES.find((e) => e.id === state.ethnicity)?.detail || state.ethnicity;
    const ageDetail = D.AGES.find((a) => a.id === state.age)?.detail || `${state.age} years old`;
    const hairDetail =
      state.hairStyle === "ref_same"
        ? "EXACTLY MATCH THE HAIR STYLE, TEXTURE, AND COLOR OF THE REFERENCE IMAGE"
        : D.HAIRSTYLES.find((h) => h.id === state.hairStyle)?.detail || state.hairStyle;
    const faceDetail = D.FACE_STYLES.find((f) => f.id === state.faceStyle)?.detail || state.faceStyle;
    const lightingDetail = D.LIGHTINGS.find((l) => l.id === state.lighting)?.detail || state.lighting;
    const cameraDetail = D.CAMERAS.flatMap((g) => g.options).find((c) => c.id === state.camera)?.detail || state.camera;
    const filmDetail = D.FILMS.find((f) => f.id === state.film)?.detail || state.film;
    const expressionDetail = D.EXPRESSIONS.find((x) => x.id === state.expression)?.detail || state.expression;
    const poseDetail = D.POSES.find((p) => p.id === state.pose)?.detail || state.pose;
    const skinDetail = state.skins
      .map((s) => D.SKINS.find((sk) => sk.id === s)?.detail)
      .filter(Boolean)
      .join(", ");

    const poseLower = poseDetail.toLowerCase();
    let perspective;
    if (poseLower.includes("mirror")) {
      perspective = "[CAMERA PERSPECTIVE: MIRROR SELFIE] The subject is facing a mirror, smartphone visible in hand.";
    } else if (poseLower.includes("selfie") || poseLower.includes("vlog") || poseLower.includes("gimbal")) {
      perspective = "[CAMERA PERSPECTIVE: FRONT-FACING HANDHELD SELFIE] Handheld at arm's length, natural selfie framing.";
    } else {
      perspective = "[CAMERA PERSPECTIVE: THIRD-PERSON EDITORIAL] Professional editorial shot, no camera in hand.";
    }

    const useProducts = state.isAdMode && state.productImages.length > 0;
    const productTypeKo = D.PRODUCT_TYPES.find((p) => p.id === state.productType)?.ko || "제품";

    const productBlock = useProducts
      ? `
[PRODUCT INTEGRATION — CRITICAL]
- Separate REFERENCE IMAGE(S) of a real product (${productTypeKo}${state.productName ? `: "${state.productName}"` : ""}) were provided in addition to the face reference image.
- You MUST composite this EXACT product onto the subject, worn or held naturally depending on the product type.
- The product's color, pattern, shape, material, and any logo/branding MUST look IDENTICAL to the provided product image(s) — do not invent a different design.
- The product must be clearly visible and in focus.
- If the outfit description below only covers other clothing items, combine them naturally with this product (e.g., product is the top, outfit text describes the bottom).
`.trim()
      : "";

    const outfitLine = useProducts
      ? `[Outfit] Wearing the exact product shown in the reference image${state.productImages.length > 1 ? "s" : ""} (${productTypeKo}). Additional styling: ${state.outfit}.`
      : `[Outfit] ${state.outfit}.`;

    const prompt = `
Photorealistic image of the same young ${ethnicityDetail} ${genderDetail}, ${state.personImage ? "matching the face in the reference image exactly" : "consistent character"}.

[Technical] ${lightingDetail}, ${cameraDetail}, ${filmDetail}. Skin: ${skinDetail || "realistic skin texture"}, hyper-realistic skin texture.
${perspective}
[Subject] ${ageDetail}, ${faceDetail}. Hair: ${hairDetail}. Expression: ${expressionDetail}. Pose: ${poseDetail}.
${outfitLine}
[Setting] ${state.location}.
${state.storyContext ? `[Narrative] ${state.storyContext}` : ""}
${productBlock}

[Rules] ${D.FACE_LOCK_RULES}
${D.NEGATIVE_RULES}
`.trim();

    return prompt;
  }

  // ---------------------------------------------------------------
  // Gemini 호출
  // ---------------------------------------------------------------
  const BATCH_SIZE = 2;
  const VARIATION_NOTES = [
    "Variation A: natural default framing for this scene.",
    "Variation B: slightly different camera angle and body angle, same face/outfit/location.",
    "Variation C: slightly different micro-expression and hand/arm position, same face/outfit/location.",
    "Variation D: slightly different framing distance (a bit closer or wider), same face/outfit/location.",
  ];

  async function generateOneImage(variationIndex, options) {
    await ensureSDK();
    const ai = new GoogleGenAI({ apiKey: state.geminiKey });
    const rawPrompt = options && options.rawPrompt;
    const prompt = rawPrompt
      ? `${rawPrompt.trim()}\n\n[Face Lock] Keep the face, eyes, nose, mouth, skin tone, hairstyle, and body proportions EXACTLY the same as the attached reference image — do not change her identity.\n${D.FACE_LOCK_RULES}.\n${D.NEGATIVE_RULES}\n\n[Variation Hint] ${VARIATION_NOTES[variationIndex] || "Provide a distinct variation."}`
      : buildPrompt() + `\n\n[Variation Hint] ${VARIATION_NOTES[variationIndex] || "Provide a distinct variation."}`;

    const parts = [
      { inlineData: { data: dataUrlToBase64(state.personImage), mimeType: dataUrlToMime(state.personImage) } },
    ];
    if (state.isAdMode) {
      state.productImages.forEach((p) => {
        parts.push({ inlineData: { data: dataUrlToBase64(p.dataUrl), mimeType: dataUrlToMime(p.dataUrl) } });
      });
    }
    parts.push({ text: prompt });

    const result = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: state.aspectRatio,
          imageSize: state.quality,
        },
      },
    });

    const cparts = (result && result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts) || [];
    const imgPart = cparts.find((p) => p.inlineData);
    if (!imgPart) throw new Error("이미지 생성 결과가 없습니다.");

    return { image: `data:image/png;base64,${imgPart.inlineData.data}`, prompt };
  }

  function friendlyErrorMessage(err) {
    const raw = (err && err.message) || String(err);
    if (/RESOURCE_EXHAUSTED|prepayment credits are depleted|429/i.test(raw)) {
      return "Gemini API 크레딧/한도가 소진되었습니다. Google AI Studio(aistudio.google.com)에서 결제 설정을 확인하거나 다른 키로 교체해주세요.";
    }
    if (/API key not valid|API_KEY_INVALID|401|403/i.test(raw)) {
      return "Gemini API 키가 유효하지 않습니다. 설정에서 키를 다시 확인해주세요.";
    }
    return raw;
  }

  async function runSlot(i, options) {
    state.results[i] = { status: "loading" };
    renderCell(i);
    try {
      const { image, prompt } = await generateOneImage(i, options);
      state.results[i] = { status: "done", image, prompt };
    } catch (err) {
      console.error(err);
      state.results[i] = { status: "error", error: friendlyErrorMessage(err) };
    }
    renderCell(i);
  }

  async function generateImage(options) {
    const rawPrompt = options && options.rawPrompt;
    if (!state.geminiKey) {
      openSettingsModal();
      setStatus("먼저 Gemini API 키를 등록해주세요. (이미지 생성은 항상 Gemini를 사용합니다)", true);
      return;
    }
    if (!state.personImage) {
      setStatus("진아의 얼굴 고정을 위해 레퍼런스 이미지를 선택하거나 업로드해주세요.", true);
      return;
    }
    if (rawPrompt !== undefined && !rawPrompt.trim()) {
      setStatus("외부에서 가져온 프롬프트를 입력해주세요.", true);
      return;
    }
    if (state.isAdMode && state.productImages.length === 0) {
      setStatus("제품 착용 모드가 켜져 있는데 업로드된 제품 이미지가 없습니다.", true);
      return;
    }

    state.loading = true;
    state.selectedIndex = -1;
    state.results = Array.from({ length: BATCH_SIZE }, () => ({ status: "loading" }));
    renderLoading(true);
    renderGrid();

    await Promise.allSettled(Array.from({ length: BATCH_SIZE }, (_, i) => runSlot(i, { rawPrompt })));

    state.loading = false;
    renderLoading(false);

    const doneCount = state.results.filter((r) => r.status === "done").length;
    if (doneCount === 0) {
      setStatus("2장 모두 생성에 실패했습니다. 각 칸의 '다시 시도'를 눌러보세요.", true);
    } else {
      const firstDone = state.results.findIndex((r) => r.status === "done");
      selectResult(firstDone);
      setStatus(`${doneCount}/${BATCH_SIZE}장 생성 완료! 마음에 드는 컷을 클릭해서 선택하세요.`);
    }
  }

  async function retrySlot(i) {
    await runSlot(i);
    if (state.results[i].status === "done" && state.selectedIndex === -1) {
      selectResult(i);
    }
  }

  function selectResult(i) {
    if (!state.results[i] || state.results[i].status !== "done") return;
    state.selectedIndex = i;
    renderGrid();
    $("#prompt-preview").textContent = state.results[i].prompt || "";
    $("#selected-hint").textContent = `${i + 1}번 컷 선택됨`;
  }

  function captionEngineLabel(id) {
    const e = D.CAPTION_ENGINES.find((x) => x.id === id);
    return e ? `${e.ko}(${e.sub})` : id;
  }

  function buildCaptionPrompt() {
    const ageDetail = D.AGES.find((a) => a.id === state.age)?.detail || state.age;
    const genderKo = D.GENDERS.find((g) => g.id === state.gender)?.ko || "인플루언서";
    return `
Role: You are a famous Korean Instagram influencer named "진아" (${ageDetail}, ${genderKo}).
Task: Write 3 DISTINCT Instagram caption options in Korean for this post.
Context: 장소는 "${state.location}", 착장은 "${state.outfit}" 입니다. ${state.storyContext ? `스토리: ${state.storyContext}` : ""}

Output Format: Return ONLY a JSON array of 3 strings, no markdown, no extra commentary. ["옵션1", "옵션2", "옵션3"]
Guidelines:
1. 옵션1 (감성/스토리텔링): 분위기와 장소, 감정을 중심으로 조금 길게.
2. 옵션2 (위트/펀치라인): 짧고 트렌디하게, MZ 감성.
3. 옵션3 (질문형/소통): 팔로워에게 질문을 던지는 톤.
`.trim();
  }

  async function callGeminiText(prompt) {
    await ensureSDK();
    const ai = new GoogleGenAI({ apiKey: state.geminiKey });
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: prompt }] },
    });
    return (
      (result && result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts) || []
    )
      .map((p) => p.text || "")
      .join("");
  }

  async function callOpenAIText(prompt) {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9,
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`OpenAI API 오류 (${resp.status}): ${body.slice(0, 200)}`);
    }
    const data = await resp.json();
    return (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
  }

  async function callClaudeText(prompt) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": state.claudeKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`Claude API 오류 (${resp.status}): ${body.slice(0, 200)}`);
    }
    const data = await resp.json();
    return ((data && data.content) || []).map((b) => b.text || "").join("");
  }

  async function generateCaptions() {
    const engine = state.captionEngine;
    const keyByEngine = { gemini: state.geminiKey, openai: state.openaiKey, claude: state.claudeKey };
    if (!keyByEngine[engine]) {
      openSettingsModal();
      setStatus(`캡션 생성용 ${captionEngineLabel(engine)} API 키가 없습니다. 설정에서 등록해주세요.`, true);
      return;
    }

    const captionArea = $("#caption-result");
    captionArea.innerHTML = `<p class="muted">캡션 생성 중... (${captionEngineLabel(engine)})</p>`;
    openModal("#modal-caption");

    try {
      const prompt = buildCaptionPrompt();
      let text;
      if (engine === "openai") text = await callOpenAIText(prompt);
      else if (engine === "claude") text = await callClaudeText(prompt);
      else text = await callGeminiText(prompt);

      text = (text || "[]").trim();
      if (text.startsWith("```")) text = text.replace(/^```json?\s*/, "").replace(/```$/, "");
      const arrMatch = text.match(/\[[\s\S]*\]/);
      if (arrMatch) text = arrMatch[0];

      let captions = [];
      try {
        captions = JSON.parse(text);
      } catch (e) {
        captions = [text];
      }

      captionArea.innerHTML = captions
        .map(
          (c, i) =>
            `<div class="caption-card"><span class="caption-num">옵션 ${i + 1}</span><p>${escapeHtml(c)}</p>
             <button type="button" class="btn-small copy-caption" data-text="${encodeURIComponent(c)}">복사</button></div>`
        )
        .join("");
    } catch (err) {
      captionArea.innerHTML = `<p class="error">캡션 생성 실패 (${captionEngineLabel(engine)}): ${escapeHtml(err.message || String(err))}</p>`;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------------------------------------------------------------
  // 렌더링 / UI 유틸
  // ---------------------------------------------------------------
  function renderLoading(isLoading) {
    $("#generate-btn").disabled = isLoading;
    $("#generate-btn").textContent = isLoading ? "생성 중... (2장)" : "✨ 진아 생성하기 (2장)";
    const hasAnyResult = state.results.some((r) => r && (r.status === "done" || r.status === "loading" || r.status === "error"));
    $("#result-placeholder").classList.toggle("hidden", isLoading || hasAnyResult);
    $("#result-loading").classList.toggle("hidden", !isLoading);
    $("#result-grid").classList.toggle("hidden", isLoading || !hasAnyResult);
  }

  function cellHtml(i) {
    const r = state.results[i] || { status: "idle" };
    if (r.status === "loading") {
      return `<div class="cell-loading"><div class="cell-spinner"></div><span>${i + 1}번 컷 생성 중...</span></div>`;
    }
    if (r.status === "error") {
      return `<div class="cell-error">${i + 1}번 컷 생성 실패<br/>${escapeHtml(r.error || "")}
        <div><button type="button" class="btn-small cell-retry" data-retry="${i}">🔄 다시 시도</button></div>
      </div>`;
    }
    if (r.status === "done") {
      return `<img src="${r.image}" alt="진아 생성 결과 ${i + 1}" /><span class="cell-badge">${i + 1}번${state.selectedIndex === i ? " · 선택됨" : ""}</span>`;
    }
    return "";
  }

  function renderCell(i) {
    const cell = document.querySelector(`.result-cell[data-idx="${i}"]`);
    if (!cell) {
      renderGrid();
      return;
    }
    const r = state.results[i] || { status: "idle" };
    cell.className = "result-cell" + (r.status === "error" ? " failed" : "") + (state.selectedIndex === i ? " selected" : "");
    cell.innerHTML = cellHtml(i);
    renderLoading(state.loading);
  }

  function renderGrid() {
    const grid = $("#result-grid");
    grid.innerHTML = Array.from({ length: BATCH_SIZE }, (_, i) => {
      const r = state.results[i] || { status: "idle" };
      let cls = "result-cell";
      if (r.status === "error") cls += " failed";
      if (state.selectedIndex === i) cls += " selected";
      return `<div class="${cls}" data-idx="${i}">${cellHtml(i)}</div>`;
    }).join("");
    renderLoading(state.loading);
  }

  function setStatus(msg, isError) {
    const el = $("#status-bar");
    el.textContent = msg;
    el.classList.toggle("error", !!isError);
    el.classList.remove("hidden");
    clearTimeout(setStatus._t);
    setStatus._t = setTimeout(() => el.classList.add("hidden"), 6000);
  }

  function openModal(sel) {
    $(sel).classList.remove("hidden");
  }
  function closeModal(sel) {
    $(sel).classList.add("hidden");
  }
  function openSettingsModal() {
    $("#input-gemini-key").value = state.geminiKey;
    $("#input-openai-key").value = state.openaiKey;
    $("#input-claude-key").value = state.claudeKey;
    renderEnginePicker();
    openModal("#modal-settings");
  }

  // ---------------------------------------------------------------
  // 모달 & 설정
  // ---------------------------------------------------------------
  function renderEnginePicker() {
    const wrap = $("#caption-engine-picker");
    if (!wrap) return;
    const keyByEngine = { gemini: state.geminiKey, openai: state.openaiKey, claude: state.claudeKey };
    wrap.innerHTML = D.CAPTION_ENGINES.map((e) => {
      const active = state.captionEngine === e.id ? " active" : "";
      return `<button type="button" class="engine-pill${active}" data-engine="${e.id}">${e.ko}<span class="engine-sub">${e.sub}</span></button>`;
    }).join("");
  }

  function initModals() {
    $("#btn-settings").addEventListener("click", openSettingsModal);
    $("#btn-help").addEventListener("click", () => openModal("#modal-help"));
    $$("[data-close]").forEach((btn) =>
      btn.addEventListener("click", () => closeModal(`#${btn.dataset.close}`))
    );

    $("#caption-engine-picker").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-engine]");
      if (!btn) return;
      state.captionEngine = btn.dataset.engine;
      renderEnginePicker();
    });

    $("#save-api-key").addEventListener("click", () => {
      state.geminiKey = $("#input-gemini-key").value.trim();
      state.openaiKey = $("#input-openai-key").value.trim();
      state.claudeKey = $("#input-claude-key").value.trim();
      safeSet("jina_gemini_key", state.geminiKey);
      safeSet("jina_openai_key", state.openaiKey);
      safeSet("jina_claude_key", state.claudeKey);
      safeSet("jina_caption_engine", state.captionEngine);
      closeModal("#modal-settings");
      setStatus("API 설정이 저장되었습니다.");
    });

    $("#btn-generate-caption").addEventListener("click", generateCaptions);

    $("#modal-caption").addEventListener("click", (e) => {
      const btn = e.target.closest(".copy-caption");
      if (!btn) return;
      navigator.clipboard.writeText(decodeURIComponent(btn.dataset.text));
      btn.textContent = "복사됨!";
      setTimeout(() => (btn.textContent = "복사"), 1500);
    });
  }

  // ---------------------------------------------------------------
  // 초기화
  // ---------------------------------------------------------------
  function init() {
    try {
      initControls();
      bindControls();
      initReferenceGallery();
      initFaceLockPromptBox();
      initModals();
      renderEnginePicker();

      $("#generate-btn").addEventListener("click", generateImage);
      $("#download-selected-btn").addEventListener("click", downloadSelectedZip);
      $("#download-all-btn").addEventListener("click", downloadAllZip);

      $("#result-grid").addEventListener("click", (e) => {
        const retryBtn = e.target.closest("[data-retry]");
        if (retryBtn) {
          retrySlot(Number(retryBtn.dataset.retry));
          return;
        }
        const cell = e.target.closest(".result-cell");
        if (!cell) return;
        selectResult(Number(cell.dataset.idx));
      });

      if (!state.geminiKey) {
        setTimeout(() => setStatus("👋 시작하려면 우측 상단 '설정'에서 Gemini API 키를 등록해주세요."), 500);
      }

      // /amazon 페이지의 "진아 얼굴로 생성하러 가기"에서 넘어온 프롬프트를 받습니다.
      const inboxPrompt = safeGet("jina_external_prompt_inbox");
      if (inboxPrompt) {
        const box = $("#external-prompt-text");
        if (box) {
          box.value = inboxPrompt;
          box.scrollIntoView({ behavior: "smooth", block: "center" });
          setStatus("아마존에서 가져온 프롬프트가 채워졌습니다. 진아 얼굴 참조 이미지를 고른 뒤 아래 생성 버튼을 눌러주세요.");
        }
        try {
          window.localStorage.removeItem("jina_external_prompt_inbox");
        } catch (e) {}
      }
    } catch (err) {
      console.error("초기화 실패:", err);
      const wrap = document.querySelector(".sidebar");
      if (wrap) {
        const box = document.createElement("div");
        box.style.cssText = "background:#3a1414;border:1px solid #ff6b6b;color:#ffb4b4;padding:12px;border-radius:10px;font-size:12px;margin-bottom:16px;";
        box.textContent = "초기화 중 오류가 발생했습니다: " + (err && err.message ? err.message : err);
        wrap.prepend(box);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
