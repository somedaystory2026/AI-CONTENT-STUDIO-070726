/* Sunote (수노트) — Suno prompt manager runtime
 * Data is provided by data/data.js as window.SUNO_DATA = { entries, sections, artists }.
 */
(function () {
  'use strict';

  const DATA = window.SUNO_DATA || { entries: [], sections: [], artists: [], templates: [] };
  // Merge any hand-curated additions from data/extras.js
  if (window.SUNO_DATA_EXTRAS) {
    if (Array.isArray(window.SUNO_DATA_EXTRAS.artists)) DATA.artists = DATA.artists.concat(window.SUNO_DATA_EXTRAS.artists);
    if (Array.isArray(window.SUNO_DATA_EXTRAS.templates)) DATA.templates = DATA.templates.concat(window.SUNO_DATA_EXTRAS.templates);
  }
  // Drop Excel admin-hint rows (e.g. "Led Zeppelin - moved to 70s peak",
  // "The Eagles - skip duplicate", any row whose song is 'placeholder') —
  // those aren't real artists and shouldn't surface in the preset grid.
  DATA.artists = DATA.artists.filter(a => {
    const name = String(a.artist || '');
    const song = String(a.song || '');
    return name && !/\b(?:moved\s+to|skip\s+duplicate|placeholder)\b/i.test(name)
                 && song.toLowerCase() !== 'placeholder';
  });
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // -------- State --------
  const state = {
    tab: 'builder',
    selectedArtist: null,
    chips: [],                // array of {tag, source}
    palette: 'genre',
    paletteQuery: '',
    presets: loadPresets(),
    cat: { builder: 'all', artists: 'all' },
    englishPct: 0,            // 0 = pure Korean … 100 = pure English
    metaphorPct: 50,          // 0 = 직설 (literal) … 100 = 시적·은유 (heavily metaphorical)
    rapPct: 0,                // 0 = 보컬 100% (all sung) … 100 = 랩 100% (all rapped)
  };

  function langConfig() {
    const en = state.englishPct;
    const ko = 100 - en;
    let mode;
    if (en === 0)        mode = 'ko';
    else if (en === 100) mode = 'en';
    else                 mode = 'mixed';
    return { mode, koreanPct: ko, englishPct: en };
  }
  function langLabel() {
    const { mode, koreanPct, englishPct } = langConfig();
    const koWord = tx('lbl.ko', '한글');
    const enWord = tx('lbl.en', '영문');
    if (mode === 'ko') return `${koWord} 100%`;
    if (mode === 'en') return `${enWord} 100%`;
    return `${koWord} ${koreanPct}% · ${enWord} ${englishPct}%`;
  }
  function applyLangUI() {
    const pct = state.englishPct;
    const slider = document.getElementById('lang-slider');
    if (slider) {
      slider.value = String(pct);
      slider.style.setProperty('--pct', pct + '%');
    }
    const label = langLabel();
    const ro = document.getElementById('lang-readout');     if (ro) ro.textContent = label;
    const mi = document.getElementById('ai-lang-mirror');   if (mi) mi.textContent = label;
    const hd = document.getElementById('header-ai-lang');
    if (hd) {
      const en = state.englishPct;
      hd.textContent = en === 0 ? 'KO 100%' : en === 100 ? 'EN 100%' : `KO ${100-en} · EN ${en}`;
    }
    renderStyleOut();
  }

  // Header AI provider chip — updated whenever provider changes
  function updateHeaderAI() {
    const provHeader = document.getElementById('header-ai-provider');
    if (!provHeader) return;
    const labels = { anthropic: 'Claude', openai: 'GPT', google: 'Gemini' };
    provHeader.textContent = labels[ai.provider] || 'AI';
  }

  // ---- Metaphor / poetic intensity slider ---------------------------------
  function metaphorLabel() {
    const m = state.metaphorPct;
    if (m <= 20)  return `${tx('lbl.direct', '직설')} ${m}%`;
    if (m <= 40)  return `${tx('lbl.semidirect', '거의 직설')} ${m}%`;
    if (m <= 60)  return `${tx('lbl.balanced', '균형')} ${m}%`;
    if (m <= 80)  return `${tx('lbl.poetic', '시적')} ${m}%`;
    return        `${tx('lbl.metaphorical', '시적·은유')} ${m}%`;
  }
  function applyMetaphorUI() {
    const pct = state.metaphorPct;
    const slider = document.getElementById('metaphor-slider');
    if (slider) {
      slider.value = String(pct);
      slider.style.setProperty('--pct', pct + '%');
    }
    const label = metaphorLabel();
    const ro = document.getElementById('metaphor-readout');    if (ro) ro.textContent = label;
    const mi = document.getElementById('ai-metaphor-mirror');  if (mi) mi.textContent = label;
  }

  // ---- Rap vs Vocal balance slider ----------------------------------------
  function rapLabel() {
    const r = state.rapPct;
    const voc = tx('lbl.vocal', '보컬');
    const rap = tx('lbl.rap', '랩');
    if (r <= 10)  return `${voc} ${100 - r}%`;
    if (r <= 30)  return `${tx('lbl.vocalheavy', '보컬 위주')} (${rap} ${r}%)`;
    if (r <= 60)  return `${tx('lbl.balanced', '균형')} (${rap} ${r}%)`;
    if (r <= 85)  return `${tx('lbl.rapheavy', '랩 위주')} ${r}%`;
    return        `${rap} ${r}%`;
  }
  function applyRapUI() {
    const pct = state.rapPct;
    const slider = document.getElementById('rap-slider');
    if (slider) {
      slider.value = String(pct);
      slider.style.setProperty('--pct', pct + '%');
    }
    const label = rapLabel();
    const ro = document.getElementById('rap-readout');    if (ro) ro.textContent = label;
    const mi = document.getElementById('ai-rap-mirror');  if (mi) mi.textContent = label;
  }

  // -------- Category classification (한국 가요 / POP 우선) --------
  const RE_KOREAN = /\bK[- ]?Pop\b|\bKorean\b|한국|가요|트로트|발라드|아이돌|걸그룹|보이그룹/i;
  const RE_POP    = /\bPop\b/i;
  const SHEET_PRIORITY = {
    'Sheet2_한국가요특화': 0,
    'Sheet3_2020년대이전가요': 1,
    'Sheet4_세계인기장르': 2,
    'Sheet1_기본태그가이드': 3,
    'Sheet5_시대별세계인기장르': 4,
  };
  function categoryOf(text) {
    const s = String(text || '');
    if (RE_KOREAN.test(s)) return 'korean';
    if (RE_POP.test(s))    return 'pop';
    return 'other';
  }
  function categoryRank(text) {
    const c = categoryOf(text);
    return c === 'korean' ? 0 : c === 'pop' ? 1 : 2;
  }
  function sortByCategory(arr, key) {
    return arr.slice().sort((a, b) => {
      const ra = categoryRank(key(a)), rb = categoryRank(key(b));
      if (ra !== rb) return ra - rb;
      return String(key(a)).localeCompare(String(key(b)), 'ko');
    });
  }
  function filterByCategory(arr, key, cat) {
    if (!cat || cat === 'all') return arr;
    return arr.filter(x => categoryOf(key(x)) === cat);
  }
  function tagCategory(entry) {
    // pick the more specific signal: tag/category/section text, falling back to sheet
    const text = `${entry.tag} ${entry.category} ${entry.section || ''}`;
    const c = categoryOf(text);
    if (c !== 'other') return c;
    if (entry.sheet === 'Sheet2_한국가요특화' || entry.sheet === 'Sheet3_2020년대이전가요') return 'korean';
    if (entry.sheet === 'Sheet4_세계인기장르') return 'pop';
    return 'other';
  }

  // -------- Helpers --------
  function reflectClass(r) {
    if (!r) return '';
    if (r.includes('🟢')) return 'green';
    if (r.includes('🟡')) return 'yellow';
    if (r.includes('🔴')) return 'red';
    return '';
  }
  function reflectIcon(r) {
    const c = reflectClass(r);
    return c === 'green' ? '🟢' : c === 'yellow' ? '🟡' : c === 'red' ? '🔴' : '⚪';
  }
  function uniqueSorted(arr) { return Array.from(new Set(arr.filter(Boolean))).sort(); }
  // Convenience lookup — pulls a translated string for the current
  // UI language (set up by initLang() further below). Falls back to
  // the supplied default when initLang has not run yet or when the
  // key is missing from the STRINGS table.
  function tx(key, fallback) {
    return (typeof window !== 'undefined' && window.SU_T)
      ? (window.SU_T(key) ?? fallback)
      : fallback;
  }
  // tdx() — data-translation. Substitutes common Korean catalog
  // words (걸그룹, 발라드, 1980년대 etc.) with English equivalents
  // when EN mode is active. Idempotent in KO mode (returns input).
  // Used in render functions for template / artist / genre / subtitle
  // strings that come from the data layer rather than hand-written
  // UI copy. Order matters — longest phrase first so multi-character
  // tokens don't get partially eaten by shorter rules.
  const TDX_MAP = [
    // Multi-word phrases (apply first)
    ['(현대 케이팝)', '(Modern K-pop)'],
    // Bilingual preset titles — collapse Korean half ("X / Y" → "Y")
    ['🌹 박재범 / Jay Park (R&B/힙합)', '🌹 Jay Park (R&B/Hip-hop)'],
    ['🔥 빈지노 / Beenzino 2010s', '🔥 Beenzino 2010s'],
    ['💎 빈지노 / 도끼 (얼터너티브 힙합)', '💎 Beenzino / Dok2 (Alternative Hip-hop)'],
    ['🎼 NRG/신화 (보이그룹)', '🎼 NRG / Shinhwa (Boy group)'],
    ['🌌 god (보이그룹)', '🌌 god (Boy group)'],
    ['🌟 god (보이그룹)', '🌟 god (Boy group)'],
    ['🌟 BTS 방탄소년단 (보이그룹)', '🌟 BTS (Boy group)'],
    ['🎤 TXT 투모로우바이투게더 (보이그룹)', '🎤 TXT (Tomorrow x Together) (Boy group)'],
    ['🍓 Red Velvet (걸그룹)', '🍓 Red Velvet (Girl group)'],
    ['🍓 볼빨간사춘기 (인디팝)', '🍓 Bolbbalgan4 (Indie pop)'],
    ['🍬 원더걸스 (걸그룹)', '🍬 Wonder Girls (Girl group)'],
    ['🍭 TWICE (걸그룹)', '🍭 TWICE (Girl group)'],
    ['🎯 카라 (걸그룹)', '🎯 KARA (Girl group)'],
    ['🎯 다이나믹듀오 (힙합 듀오)', '🎯 Dynamic Duo (Hip-hop duo)'],
    ['🎷 한국 시티팝 (윤수일/김현철)', '🎷 Korean City Pop (Yoon Soo-il / Kim Hyun-chul)'],
    ['🎸 신중현 사이키델릭 록', '🎸 Shin Jung-hyun Psychedelic Rock'],
    ['🎸 장기하와 얼굴들 (인디록)', '🎸 Jang Kiha & the Faces (Indie rock)'],
    ['🎸 토이/이승환 (자작곡 발라드)', '🎸 Toy / Lee Seung-hwan (Self-written Ballad)'],
    ['🎸 80년대 한국 록', '🎸 80s Korean Rock'],
    ['🎸 정통 통기타 포크', '🎸 Authentic Folk Guitar'],
    ['🎸 인디 록 템플릿', '🎸 Indie Rock template'],
    ['🎤 80년대 후반 트로트', '🎤 Late-80s Trot'],
    ['🎤 90년대 붐백', '🎤 90s Boom Bap'],
    ['🎤 MC몽 / 리쌍 (대중적 힙합)', '🎤 MC Mong / Leessang (Mainstream Hip-hop)'],
    ['🎤 OST 인기 가수 영입', '🎤 OST Popular Singer Cast'],
    ['🎤 서태지와 아이들', '🎤 Seo Taiji and Boys'],
    ['🎤 쇼미더머니 / 언프리티 시대', '🎤 Show Me the Money / Unpretty era'],
    ['🎤 슈퍼주니어 (보이그룹)', '🎤 Super Junior (Boy group)'],
    ['🎤 에픽하이 (힙합 트리오)', '🎤 Epik High (Hip-hop trio)'],
    ['🎤 이상은 / 자우림 (얼터너티브)', '🎤 Lee Sang-eun / Jaurim (Alternative)'],
    ['🎤 정통 올드 트로트', '🎤 Authentic Old Trot'],
    ['🎤 정통 트로트 (송가인/장윤정)', '🎤 Authentic Trot (Song Ga-in / Jang Yoon-jung)'],
    ['🎤 젝키 (보이그룹)', '🎤 Sechs Kies (Boy group)'],
    ['🎤 지코 (Block B / 솔로)', '🎤 Zico (Block B / Solo)'],
    ['🎤 한국 힙합', '🎤 Korean Hip-hop'],
    ['🎤 휘성/거미 (모던 R&B)', '🎤 Wheesung / Gummy (Modern R&B)'],
    ['🎨 자이언티 (네오소울)', '🎨 Zion.T (Neo-soul)'],
    ['🎬 OST 발라드 (감정 절정)', '🎬 OST Ballad (emotional climax)'],
    ['🎻 OST 발라드 (K-Drama)', '🎻 OST Ballad (K-Drama)'],
    ['🎺 1950년대 재즈 가요', '🎺 1950s Jazz Pop'],
    ['🎺 댄스 트로트 (홍진영)', '🎺 Dance Trot (Hong Jin-young)'],
    ['🎺 마리아치 템플릿', '🎺 Mariachi template'],
    ['🎼 가요제 풍 (대학가요제)', '🎼 Music-festival style (University Music Festival)'],
    ['🐯 드렁큰타이거 (힙합 파이어니어)', '🐯 Drunken Tiger (Hip-hop pioneer)'],
    ['👑 BIGBANG 2010s (보이그룹)', '👑 BIGBANG 2010s (Boy group)'],
    ['👑 송가인 (정통 트로트)', '👑 Song Ga-in (Authentic Trot)'],
    ['👑 윤미래 / Tasha (R&B/랩)', '👑 Yoon Mi-rae / Tasha (R&B / Rap)'],
    ['👑 크러쉬 (R&B)', '👑 Crush (R&B)'],
    ['💃 레게톤 (Bad Bunny)', '💃 Reggaeton (Bad Bunny)'],
    ['💃 레게톤 템플릿', '💃 Reggaeton template'],
    ['💃 살사 (Salsa)', '💃 Salsa'],
    ['💎 2NE1 (걸그룹)', '💎 2NE1 (Girl group)'],
    ['💎 4세대 (NewJeans/IVE/aespa)', '💎 4th gen (NewJeans / IVE / aespa)'],
    ['💎 솔리드/듀스 (R&B/힙합)', '💎 Solid / Deux (R&B / Hip-hop)'],
    ['💎 적재 / 김필 (싱어송라이터)', '💎 Jukjae / Kim Feel (Singer-songwriter)'],
    ['💔 김광석 (포크/발라드)', '💔 Kim Kwang-seok (Folk / Ballad)'],
    ['💔 박효신/김범수 (파워 발라드)', '💔 Park Hyo-shin / Kim Bum-soo (Power Ballad)'],
    ['💔 정통 한국 발라드 (90-2000년대)', '💔 Authentic Korean Ballad (90s-2000s)'],
    ['💕 80년대 팝 발라드', '💕 80s Pop Ballad'],
    ['💕 사극 OST (전통적 감성)', '💕 Sageuk OST (traditional feel)'],
    ['💕 이수영 (감성 발라드)', '💕 Lee Soo-young (Sensitive Ballad)'],
    ['💖 S.E.S. (걸그룹 1세대)', '💖 S.E.S. (1st-gen Girl group)'],
    ['💙 모던 R&B 템플릿', '💙 Modern R&B template'],
    ['💥 3세대 (BLACKPINK/BTS)', '💥 3rd gen (BLACKPINK / BTS)'],
    ['💥 빅뱅 (보이그룹)', '💥 BIGBANG (Boy group)'],
    ['💪 MAMAMOO (걸그룹/보컬)', '💪 MAMAMOO (Girl group / Vocal)'],
    ['🔥 H.O.T. (보이그룹 1세대)', '🔥 H.O.T. (1st-gen Boy group)'],
    ['🔥 Stray Kids (보이그룹)', '🔥 Stray Kids (Boy group)'],
    ['🔥 모던 트랩 (Drake/Future)', '🔥 Modern Trap (Drake / Future)'],
    ['🔥 모던 트랩 템플릿', '🔥 Modern Trap template'],
    ['🔥 보이그룹', '🔥 Boy group'],
    ['🕹️ Chiptune (8-bit 게임)', '🕹️ Chiptune (8-bit games)'],
    ['🕺 80년대 댄스 가요', '🕺 80s Dance Pop'],
    ['🕺 룰라/R.ef/DJ DOC (댄스)', '🕺 Roo\'ra / R.ef / DJ DOC (Dance)'],
    ['🕺 세미 트로트 (영탁/임영웅)', '🕺 Semi-trot (Young Tak / Lim Young-woong)'],
    ['🖤 검정치마 (인디록)', '🖤 The Black Skirts (Indie rock)'],
    ['🤠 모던 컨트리 템플릿', '🤠 Modern Country template'],
    ['🤠 모던 컨트리 팝', '🤠 Modern Country Pop'],
    ['🥦 브로콜리너마저 (인디팝)', '🥦 Broccoli, You Too? (Indie pop)'],
    ['🧒 동요', '🧒 Children\'s Songs'],
    ['🪕 메렝게 (Merengue)', '🪕 Merengue'],
    ['🪕 보사노바 템플릿', '🪕 Bossa Nova template'],
    ['🪩 한국 디스코 가요', '🪩 Korean Disco Pop'],
    ['🌧️ 어쿠스틱 발라드 (성시경/김광석)', '🌧️ Acoustic Ballad (Sung Si-kyung / Kim Kwang-seok)'],
    ['🌶️ 라틴 트랩', '🌶️ Latin Trap'],
    ['🌸 소녀시대 (걸그룹)', '🌸 Girls\' Generation (Girl group)'],
    ['🌸 아이유 (싱어송라이터)', '🌸 IU (Singer-songwriter)'],
    ['🌹 (여자)아이들 (걸그룹)', '🌹 (G)I-DLE (Girl group)'],
    ['🌹 바이브 (감성 듀오)', '🌹 Vibe (Sensitive Duo)'],
    ['🌹 바차타 (Bachata)', '🌹 Bachata'],
    ['🌹 임영웅 (모던 세미 트로트)', '🌹 Lim Young-woong (Modern Semi-trot)'],
    ['🌿 노브레인 / 크라잉넛 (펑크/조선펑크)', '🌿 Nobrain / Crying Nut (Punk / Joseon Punk)'],
    ['🌿 한로로 / 새소년 (얼터너티브 인디)', '🌿 Hanroro / Saesoneon (Alternative Indie)'],
    ['🌃 한국 시티팝', '🌃 Korean City Pop'],
    ['🌃 다크 팝 (Billie Eilish)', '🌃 Dark Pop (Billie Eilish)'],
    ['🌍 아프로비츠 템플릿', '🌍 Afrobeats template'],
    ['🌑 드릴 (UK/Chicago Drill)', '🌑 Drill (UK / Chicago Drill)'],
    ['🌙 EXO (보이그룹)', '🌙 EXO (Boy group)'],
    ['🌙 K-R&B (딘/Crush/태연)', '🌙 K-R&B (DEAN / Crush / Taeyeon)'],
    ['🌙 딘 / DEAN (얼터너티브 R&B)', '🌙 DEAN (Alternative R&B)'],
    ['🌙 미스터리/스릴러 OST', '🌙 Mystery / Thriller OST'],
    ['🌙 성시경 (어쿠스틱 발라드)', '🌙 Sung Si-kyung (Acoustic Ballad)'],
    ['🌙 잔나비 (인디록)', '🌙 Jannabi (Indie rock)'],
    ['🇯🇵 J-Pop 템플릿', '🇯🇵 J-Pop template'],
    ['🇿🇦 Amapiano (남아공)', '🇿🇦 Amapiano (South Africa)'],
    ['☕ 10cm (어쿠스틱 듀오/솔로)', '☕ 10cm (Acoustic Duo / Solo)'],
    ['☕ Lo-Fi Hip-Hop (스터디 BGM)', '☕ Lo-Fi Hip-Hop (Study BGM)'],
    ['☕ Lo-Fi 템플릿', '☕ Lo-Fi template'],
    ['☕ 인디/시티팝 (잔나비/검정치마)', '☕ Indie / City pop (Jannabi / The Black Skirts)'],
    ['⚡ ITZY (걸그룹)', '⚡ ITZY (Girl group)'],
    ['⚡ 동방신기 (보이그룹)', '⚡ TVXQ (Boy group)'],
    ['✝️ CCM/찬양', '✝️ CCM / Worship'],
    ['✨ GFRIEND / Apink / OH MY GIRL (이노센트 걸그룹)', '✨ GFRIEND / Apink / OH MY GIRL (Innocent Girl group)'],
    ['✨ 핑클 (걸그룹 1세대)', '✨ Fin.K.L (1st-gen Girl group)'],
    ['🎀 걸그룹', '🎀 Girl group'],
    ['🎀 모던 팝 (2026)', '🎀 Modern Pop (2026)'],
    ['🎀 모던 팝 템플릿', '🎀 Modern Pop template'],
    ['🎉 EDM 빅룸 템플릿', '🎉 EDM Big Room template'],
    ['🎬 발리우드 템플릿', '🎬 Bollywood template'],
    ['🎬 시네마틱 템플릿', '🎬 Cinematic template'],
    ['🎬 아니메 오프닝 템플릿', '🎬 Anime Opening template'],
    ['🎵 SG워너비/씨야 (드라마틱 발라드)', '🎵 SG Wannabe / SeeYa (Dramatic Ballad)'],
    ['🎵 김건모 (댄스/레게)', '🎵 Kim Gun-mo (Dance / Reggae)'],
    ['🎵 신승훈/김건모 (발라드/댄스)', '🎵 Shin Seung-hun / Kim Gun-mo (Ballad / Dance)'],
    ['🎵 어반자카파 (어반 발라드)', '🎵 Urban Zakapa (Urban Ballad)'],
    ['🎵 영탁 / 장윤정 / 홍진영 (트로트 다양화)', '🎵 Young Tak / Jang Yoon-jung / Hong Jin-young (Trot diversification)'],
    ['🎵 옥상달빛 / 페퍼톤스 (감성 인디)', '🎵 Okdal / Peppertones (Sensitive Indie)'],
    ['🎵 첫사랑 / 청춘 OST', '🎵 First Love / Youth OST'],
    ['🎵 폴킴 / 김나영 / 멜로망스 (감성 보컬)', '🎵 Paul Kim / Kim Na-young / Melomance (Sensitive Vocal)'],
    ['🎵 헤이즈 (R&B 보컬)', '🎵 Heize (R&B Vocal)'],
    // Per-decade Korean templates
    ['1970년대 포크 (송창식 스타일)', '1970s Folk (Song Chang-sik style)'],
    ['1980년대 발라드 (이문세 스타일)', '1980s Ballad (Lee Mun-sae style)'],
    ['1980년대 시티팝 (빛과 소금 스타일)', '1980s City Pop (Bit-gwa Sogeum style)'],
    ['1992 서태지 풍', '1992 Seo Taiji style'],
    ['1995 김건모 풍 댄스', '1995 Kim Gun-mo style Dance'],
    ['1998 H.O.T. 풍 1세대 K-Pop', '1998 H.O.T. style 1st-gen K-Pop'],
    ['2007 동방신기 풍 2세대', '2007 TVXQ style 2nd gen'],
    ['2007 성시경 풍 어쿠스틱 발라드', '2007 Sung Si-kyung style Acoustic Ballad'],
    ['2008 소녀시대 풍 걸그룹', '2008 Girls\' Generation style Girl group'],
    ['2009 에픽하이 풍 힙합', '2009 Epik High style Hip-hop'],
    ['2016 트와이스 풍 3세대 걸그룹', '2016 TWICE style 3rd-gen Girl group'],
    ['2017 BTS 풍 3세대', '2017 BTS style 3rd gen'],
    ['2017 아이유 풍 싱어송라이터', '2017 IU style Singer-songwriter'],
    ['2017 자이언티 풍 K-R&B', '2017 Zion.T style K-R&B'],
    ['2018 Stray Kids 풍 4세대', '2018 Stray Kids style 4th gen'],
    ['2019 임영웅 풍 모던 트로트', '2019 Lim Young-woong style Modern Trot'],
    ['2019 잔나비 풍 인디 록', '2019 Jannabi style Indie Rock'],
    ['1920s 템플릿', '1920s template'],
    ['1930s 템플릿', '1930s template'],
    ['1950s 템플릿', '1950s template'],
    ['1960s 템플릿', '1960s template'],
    ['1970s 템플릿', '1970s template'],
    ['1980s 템플릿', '1980s template'],
    ['1990s 템플릿', '1990s template'],
    ['2000s 템플릿', '2000s template'],
    ['2010s 템플릿', '2010s template'],
    ['2020s 템플릿', '2020s template'],
    ['싱어송라이터', 'Singer-songwriter'],
    ['보이그룹 사운드', 'Boy-group sound'],
    ['걸그룹 사운드', 'Girl-group sound'],
    // Bilingual preset titles — strip the Korean half so EN cards
    // don't double up ("박재범 / Jay Park" → "Jay Park" etc.).
    ['박재범 / Jay Park', 'Jay Park'],
    ['빈지노 / Beenzino', 'Beenzino'],
    ['크러쉬 (R&B)', 'Crush (R&B)'],
    ['Zion.T (네오Soul)', 'Zion.T (Neo-Soul)'],
    ['쇼미더머니 / 언프리티 시대', 'Show Me the Money / Unpretty era'],
    ['소녀시대', 'Girls\' Generation'],
    ['에픽하이', 'Epik High'],
    ['대표곡 3', 'Signature 3'],
    ['대표곡 2', 'Signature 2'],
    ['대표곡', 'Signature song'],
    ['시대 · 스타일 그룹', 'Era · Style group'],
    ['전성기 · 대표곡', 'Peak · Signature'],
    ['핵심 태그', 'Core tags'],
    ['곡 구조', 'Song structure'],
    ['빛과 소금', 'Bit-gwa Sogeum'],
    ['이문세', 'Lee Mun-sae'],
    ['송창식', 'Song Chang-sik'],
    ['성시경', 'Sung Si-kyung'],
    ['김광석', 'Kim Kwang-seok'],
    ['김건모', 'Kim Gun-mo'],
    ['서태지', 'Seo Taiji'],
    ['동방신기', 'TVXQ'],
    ['트와이스', 'TWICE'],
    ['아이유', 'IU'],
    ['자이언티', 'Zion.T'],
    ['임영웅', 'Lim Young-woong'],
    ['잔나비', 'Jannabi'],
    ['브라운 아이드 소울', 'Brown Eyed Soul'],
    ['걸크러시 컨셉', 'Girl-crush concept'],
    ['미니멀한 4세대 사운드', 'Minimal 4th-gen sound'],
    ['Suno Style 프롬프트', 'Suno Style prompt'],
    // Common compound words
    ['1세대', '1st gen'], ['2세대', '2nd gen'],
    ['3세대', '3rd gen'], ['4세대', '4th gen'],
    ['년대', 's'],   // "1980년대" → "1980s"
    ['걸그룹', 'Girl group'],
    ['보이그룹', 'Boy group'],
    ['아이돌', 'Idol'],
    ['발라드', 'Ballad'],
    ['어쿠스틱', 'Acoustic'],
    ['시티팝', 'City pop'],
    ['트로트', 'Trot'],
    ['댄스', 'Dance'],
    ['힙합', 'Hip-hop'],
    ['인디', 'Indie'],
    ['싱어', 'Singer'],
    ['솔로', 'Solo'],
    ['듀오', 'Duo'],
    ['그룹', 'group'],
    ['밴드', 'Band'],
    ['크루', 'Crew'],
    ['크라이', 'Cry'],
    ['스타일', 'style'],
    ['프로듀스', 'Produced'],
    ['프로덕션', 'production'],
    ['컨셉', 'concept'],
    ['미니멀한', 'Minimal'],
    ['헤비한', 'Heavy'],
    ['소프트한', 'Soft'],
    ['모던', 'Modern'],
    ['클래식', 'Classical'],
    ['재즈', 'Jazz'],
    ['훵크', 'Funk'],
    ['편크', 'Funk'],
    ['솔', 'Soul'],
    ['일렉트로닉', 'Electronic'],
    ['일렉트로', 'Electro'],
    ['포크', 'Folk'],
    ['컨트리', 'Country'],
    ['블루스', 'Blues'],
    ['레게', 'Reggae'],
    ['라틴', 'Latin'],
    ['알앤비', 'R&B'],
    ['오케스트라', 'Orchestra'],
    ['스튜디오', 'Studio'],
    ['드라마', 'Drama'],
    ['소울', 'Soul'],
    ['풍', '-style'],
    ['템플릿', 'template'],
    ['음악', 'music'],
    ['사운드', 'sound'],
    ['세대', 'gen'],
    ['록', 'Rock'],
    ['팝', 'Pop'],
    // Catalog era-label specials
    ['현대 (Modern Korean Pop)', 'Modern (Modern Korean Pop)'],
    ['글로벌 (시대 무관)', 'Global (era-agnostic)'],
    ['(시대 미지정)', '(unspecified era)'],
    // Sheet / group names
    ['기본태그가이드', 'Core Tag Guide'],
    ['한국가요특화', 'K-Music Specifics'],
    // Category labels (tag catalog)
    ['핵심 구조 (무조건 반영)', 'Core structure (always applied)'],
    ['확장 구조 (비교적 반영)', 'Extended structure (often applied)'],
    ['핵심 구조', 'Core structure'],
    ['확장 구조', 'Extended structure'],
    ['무조건 반영', 'Always applied'],
    ['비교적 반영', 'Often applied'],
    ['잘 안 됨', 'Rarely applied'],
    // Common tag descriptions (e.ko)
    ['도입부 (8~16마디)', 'Intro (8-16 bars)'],
    ['절 - 스토리텔링 구간', 'Verse — storytelling'],
    ['후렴 직전 빌드업', 'Pre-chorus build-up'],
    ['후렴구 (가장 강력함)', 'Chorus (most powerful)'],
    ['변주 구간', 'Bridge / variation'],
    ['보컬 없는 연주 구간', 'Instrumental section (no vocals)'],
    ['후렴 후 이어지는 훅', 'Post-chorus hook'],
    ['캐치한 멜로디 라인', 'Catchy melody line'],
    ['분위기 환기, 드럼만 남는 구간', 'Mood shift — drums only'],
    ['EDM/일렉의 클라이맥스', 'EDM climax'],
    ['긴장감 고조', 'Tension build-up'],
    ['짧은 간주', 'Brief interlude'],
    ['악기 솔로', 'Instrument solo'],
    // Tips
    ['곡 시작부, 분위기 설정', 'Song opening, sets the mood'],
    ['가사로 이야기 전달', 'Tell the story through lyrics'],
    ['캐치한 훅, 반복 구간', 'Catchy hook, repeating section'],
    ['곡 중반 분위기 전환', 'Mid-song mood shift'],
    ['곡 끝맺음', 'Ending'],
    ['간주, 솔로 구간', 'Instrumental break, solo section'],
    ['후렴 에너지 유지', 'Sustains chorus energy'],
    ['기억에 남는 멜로디 구간', 'Memorable melody section'],
    ['대비 효과, 빌드업 직전', 'Contrast effect, right before the build-up'],
    ['EDM, 베이스 뮤직', 'EDM, bass music'],
    ['Drop 직전 빌드업', 'Build-up right before the drop'],
    ['섹션 사이 짧은 음악 구간', 'Short instrumental between sections'],
    ['기타/신스 솔로 구간', 'Guitar / synth solo section'],
    ['마무리', 'Outro'],
    // Single words still in data
    ['음악', 'music'], ['구간', 'section'], ['반복', 'repeat'],
    ['훅', 'hook'], ['솔로', 'solo'], ['멜로디', 'melody'],
    ['빌드업', 'build-up'], ['드럼', 'drums'], ['베이스', 'bass'],
    ['신스', 'synth'], ['기타', 'guitar'],
    // K-Music Specifics tag descriptions
    ['한글로 가사 작성', 'Write lyrics in Hangul'],
    ['영어 태그 + 한국어 장르명 병기', 'English tags + Korean genre name'],
    ['Custom Mode 사용 필수', 'Custom Mode required'],
    ['짧은 줄로 끊기', 'Break into short lines'],
    ['마침표/쉼표로 호흡 조절', 'Use periods / commas for phrasing'],
    ['로마자 표기는 발음 어색해짐', 'Romanisation makes pronunciation awkward'],
    ['인식률 향상', 'Improved recognition'],
    ['제어권 높음', 'Greater control'],
    ['한글은 음절 응축됨', 'Hangul syllables are condensed'],
    ['발음 정확도 향상', 'Improved pronunciation accuracy'],
    ['5가지 핵심 룰', '5 core rules'],
    ['발음 향상 마법 태그', 'Pronunciation booster tag'],
    ['한국어 가사 명시', 'Designates Korean lyrics'],
    ['한국어 발음 강제', 'Forces Korean pronunciation'],
    ['명확한 한국어 발음', 'Clear Korean pronunciation'],
    ['한국어로 노래', 'Sing in Korean'],
    ['원어민 한국어 보컬', 'Native Korean vocals'],
    ['자연스러운 발음', 'Natural pronunciation'],
    ['언어 명시', 'Language directive'],
    ['발음 가이드 신호', 'Pronunciation guide signal'],
    ['발음 향상 최강 태그', 'Strongest pronunciation booster'],
    ['예: Korean Ballad, Ballad', 'e.g. Korean Ballad, Ballad'],
    [', emotive storytelling', ', emotive storytelling'],
    [', authentic delivery', ', authentic delivery'],
    [', vocal layering', ', vocal layering'],
    ['Hangul lyrics in Custom Mode', 'Hangul lyrics in Custom Mode'],
    ['Simple Mode 약함', 'Weak in Simple Mode'],
    ['10음절 이내로', 'Within 10 syllables'],
    ['. , 활용', 'Use . ,'],
    // Tag table — additional Description / Category / Tip patterns
    ['K-POP 전용 powerful 태그', 'K-POP-only powerful tag'],
    ['K-POP 추천 구조', 'K-POP recommended structure'],
    ['Authentic Korean Ballad (90s-2000s)', 'Authentic Korean Ballad (90s-2000s)'],
    ['후크 비트 강조', 'Emphasise the hook beat'],
    ['랩 파트 삽입', 'Insert a rap part'],
    ['클라이맥스 build-up', 'Climax build-up'],
    ['클라이맥스 후 Outro', 'Outro after climax'],
    ['멤버 합창 effect', 'Member chorus effect'],
    ['추임새 (yeah, uh, let\'s go)', 'Ad-libs (yeah, uh, let\'s go)'],
    ['K-pop 특유의 polish', 'K-pop signature polish'],
    ['synth 스탭, 보컬 챱', 'synth stab, vocal chop'],
    ['중독적 hook', 'Addictive hook'],
    ['repeat 패턴', 'Repeat pattern'],
    ['안무 section', 'Choreography section'],
    ['핵심 Style 프롬프트', 'Core Style prompt'],
    ['← Style 프롬프트 확인', '← Check Style prompt'],
    ['Style 프롬프트', 'Style prompt'],
    ['Style 프롬프트 확인', 'Check Style prompt'],
    ['포인트 안무 비트', 'Point choreography beat'],
    ['귀를 사로잡는 시작', 'Ear-catching opening'],
    ['점진적 고조', 'Gradual build-up'],
    ['영어 한 단어 섞기 OK', 'Mix in one English word — OK'],
    ['익숙함 강화', 'Reinforces familiarity'],
    ['비트만, 가사 없음', 'Beat only, no lyrics'],
    ['emotion 폭발 후 정리', 'Cleanup after emotion peak'],
    ['70 BPM 절절 Ballad', '70 BPM heart-wrenching Ballad'],
    ['90 BPM Power Ballad', '90 BPM Power Ballad'],
    ['Idol 시그니처', 'Idol signature'],
    ['Idol 퀄리티', 'Idol quality'],
    ['랩 섹션', 'Rap section'],
    ['곡 late 폭발', 'Late-song explosion'],
    ['group sound', 'group sound'],
    ['감정 폭발', 'Emotion peak'],
    // Single words that compose the above (apply after the phrases)
    ['후크', 'hook'],
    ['비트', 'beat'],
    ['강조', 'emphasis'],
    ['삽입', 'insert'],
    ['파트', 'part'],
    ['랩', 'rap'],
    ['클라이맥스', 'climax'],
    ['멤버', 'members'],
    ['합창', 'chorus'],
    ['추임새', 'ad-libs'],
    ['특유의', 'signature'],
    ['스탭', 'stab'],
    ['챱', 'chop'],
    ['중독적', 'addictive'],
    ['패턴', 'pattern'],
    ['안무', 'choreography'],
    ['포인트', 'point'],
    ['시그니처', 'signature'],
    ['퀄리티', 'quality'],
    ['절절', 'heart-wrenching'],
    ['확인', 'check'],
    ['프롬프트', 'prompt'],
    ['전용', '-only'],
    ['추천', 'recommended'],
    ['구조', 'structure'],
    ['태그', 'tag'],
    ['섹션', 'section'],
    ['폭발', 'explosion'],
    ['사로잡는', 'captivating'],
    ['시작', 'start'],
    ['점진적', 'gradual'],
    ['고조', 'build-up'],
    ['한 단어', 'one word'],
    ['단어', 'word'],
    ['섞기', 'mix'],
    ['익숙함', 'familiarity'],
    ['강화', 'reinforcement'],
    ['가사 없음', 'no lyrics'],
    ['가사', 'lyrics'],
    ['정리', 'cleanup'],
    // Tag table — common category / description / tip patterns
    // Longer phrases first (matched before single-word fallbacks).
    ['1970년대 통기타 포크 가사 예시', '1970s Folk Guitar lyric examples'],
    ['1980년대 팝 발라드 가사 예시', '1980s Pop Ballad lyric examples'],
    ['1950~60년대 트로트 가사 예시', '1950s-60s Trot lyric examples'],
    ['1923년 뉴올리언스 재즈', '1923 New Orleans Jazz'],
    // Help-modal batch (411 fragments — 100% coverage)
    ["스타일 선택", "Pick a style"],
    ["프리셋·댄싱머신", "Presets · Dance Machine"],
    ["편집", "Edit"],
    ["Style·Lyrics·페이더", "Style · Lyrics · faders"],
    ["선택 사항", "optional"],
    ["Suno 붙여넣기", "Paste into Suno"],
    ["상단의 4단계 차트는", "The 4-step chart at the top is"],
    ["접기 / 펼치기", "Collapse / Expand"],
    ["버튼으로 숨길 수 있고 새로고침 후에도 상태가 유지됩니다.", "you can hide it with the button; the state persists across page reloads."],
    ["큰 글씨 입력칸에 곡 제목을 직접 입력. 비워두면 AI 가 작명", "Type the song title directly into the large input box. Leave it blank and the AI will name it."],
    ["AI 옵션의", "Of the AI options,"],
    ["제목", "Title"],
    ["체크박스로 자동 작명 on/off", "use the checkbox to toggle auto-naming on / off"],
    ["기본 골격", "Skeleton"],
    ["버튼: 한국 가요 표준 가사 구조 (Intro·Verse·Pre·Chorus·Bridge·Outro) 자동 삽입", "button: auto-insert the K-pop standard lyric structure (Intro · Verse · Pre · Chorus · Bridge · Outro)."],
    ["초기화", "Reset"],
    ["버튼: 제목·가사·Style 칩·슬라이더·옵션·AI 프롬프트 전체 리셋", "button: full reset of title, lyrics, Style chips, sliders, options, and AI prompt."],
    ["Suno 의", "Suno's"],
    ["에 들어갈 키워드 칩 모음 (200자 권장)", "— keyword chips that will go into this field (200 chars recommended)"],
    ["칩 추가 방법 — ⓐ 빠른 팔레트 클릭 · ⓑ 입력칸 직접 타이핑 후 Enter · ⓒ AI 생성 · ⓓ 프리셋 로드 · ⓔ 검색 · ⓕ 댄싱머신", "How to add chips — ⓐ click the quick palette · ⓑ type into the input and press Enter · ⓒ AI generate · ⓓ load a preset · ⓔ Search · ⓕ Dance Machine"],
    ["출처별 칩 색상 (테두리·텍스트):", "Chip colour by source (border · text):"],
    ["청록 = 아티스트", "Cyan = artist"],
    ["보라 = 템플릿", "Purple = template"],
    ["호박 = AI 생성", "Amber = AI-generated"],
    ["회색 = 수동", "Grey = manual"],
    ["칩 좌측 도트 (●) 색상 — Suno 적용도 (reflect)", "Chip left dot (●) colour — Suno reflect score"],
    ["녹색", "Green"],
    ["─ Suno 가 잘 적용. 핵심 anchor 태그 (장르·BPM·악기 등)", "— Suno applies it well. Core anchor tags (genre, BPM, instrument, etc.)"],
    ["노랑", "Yellow"],
    ["─ 가끔만 반영. 조합·뉘앙스 태그", "— sometimes applied. Combination / nuance tags"],
    ["빨강", "Red"],
    ["─ 잘 안 반영. 칩이 살짝 흐려져 표시 (시각 페이드)", "— rarely applied. The chip is slightly dimmed (visual fade)"],
    ["─ 카탈로그에 데이터 없음 (AI 가 만든 novel 조합 등)", "— no catalog data (AI-generated novel combos, etc.)"],
    ["마우스 오버 시 툴팁에 출처 + 적용도 한국어 설명 표시", "Hover for a tooltip showing source + Korean adoption-level description"],
    ["자동 정렬 — Suno 적용도 우선", "Auto-sort — Suno reflect score first"],
    [": 칩은 🟢 → 🟡 → ⚪ → 🔴 순으로 안정 정렬됩니다. Suno 의 200자 토큰 한도에서 잘릴 때", ": chips are stably sorted 🟢 → 🟡 → ⚪ → 🔴. When the 200-char token limit truncates Style,"],
    ["가장 잘 적용되는 태그가 살아남도록", "so the best-applied tags survive,"],
    ["핵심 신호를 앞쪽에 모음. 🔴 태그는 뒤로 밀려나 우선순위 절감.", "the core signals get pushed to the front. 🔴 tags drift to the tail and lose priority."],
    ["각 칩의 × 로 개별 삭제 — 삭제 후에도 자동 재정렬됨", "Delete chips individually with × — auto-sort re-applies after each deletion"],
    ["버튼으로 콤마 결합된 최종 텍스트를 클립보드에", "button — copies the comma-joined final text to the clipboard"],
    ["💾 프리셋으로 저장", "💾 Save as preset"],
    ["버튼으로 현재 조합을 저장됨 탭에 보관", "button — stores the current combination in the Saved tab"],
    ["에 들어갈 가사 + 섹션 태그", "— lyrics + section tags that go into this field"],
    ["상단 구조 칩 클릭으로 섹션 삽입 —", "Click a structure chip at the top to insert a section —"],
    ["섹션별 음악 지시 포함", "Include per-section music cues"],
    ["옵션 켜면 AI 가", "When the option is on, the AI"],
    ["식으로 음악 지시 영문 삽입", "inserts English music cues in that format"],
    ["하단 카운터: 섹션 / 줄 / 글자 수 실시간 표시", "Bottom counter: live sections / lines / character count"],
    ["세 모델 중 선택 (탭으로 전환). 모델 라인업: ⭐ Sonnet 4.6 / Haiku 4.5 · ⭐ GPT-5.4 mini / GPT-4.1 mini · ⭐ Gemini 3.5 Flash / Gemini 2.5 Flash — 별표는 가사 품질 우선 추천", "Pick one of three models (toggle by tab). Lineup: ⭐ Sonnet 4.6 / Haiku 4.5 · ⭐ GPT-5.4 mini / GPT-4.1 mini · ⭐ Gemini 3.5 Flash / Gemini 2.5 Flash — stars mark lyric-quality picks"],
    ["자연어 프롬프트 입력 예시:", "Natural-language prompt examples:"],
    ["\"1980 년대 신스웨이브 발라드, 첫사랑 회상\"", "\"1980s synthwave ballad, first-love reminiscence\""],
    ["\"K-Pop 댄스, 여름밤 파티, 영문 50%\"", "\"K-Pop dance, summer-night party, EN 50%\""],
    ["\"Coldplay 스타일 어쿠스틱 + 스트링 빌드\"", "\"Coldplay-style acoustic + string build\""],
    ["체크박스로 AI 가 채울 필드 선택 —", "Use checkboxes to choose which fields the AI fills —"],
    ["🎺 연주곡 (Instrumental) 체크박스", "🎺 Instrumental checkbox"],
    ["— 가사 없는 연주곡 모드.", "— lyric-less instrumental mode."],
    ["켜면 Style 칩에", "When enabled, in Style chips"],
    ["자동 삽입 + Lyrics 채우기는 ON 으로 유지 + 가사 textarea 자동 비움", "is auto-inserted + Lyrics-fill stays ON + the lyrics textarea is auto-emptied"],
    ["AI 는 sung/rap 라인 대신", "Instead of sung / rap lines, the AI writes"],
    ["섹션 로드맵", "a section roadmap"],
    ["(예:", "(e.g."],
    ["무성 마커) 만 작성", "silent markers) only"],
    ["3-4분 트랙 보장", "Guarantees a 3-4 min track"],
    ["— 7-9 섹션, 마디 합계 80-120 bars 강제. Style 에 \"extended arrangement\" 길이 힌트 자동 추가", "— forces 7-9 sections, 80-120 bars total. \"extended arrangement\" length hint is auto-added to Style"],
    ["금지: 가짜 보컬 (\"la la la\", \"ooh\"), sung 단어 (\"I\", \"you\", \"사랑\"), 빈약한 브래킷", "Forbidden: fake vocals (\"la la la\", \"ooh\"), sung words (\"I\", \"you\", \"love\"), thin brackets"],
    ["제목 언어 드롭다운", "Title-language dropdown"],
    ["(가사 언어 페이더 따름) ·", "(follows the lyric-language fader) ·"],
    ["Latin·다국어", "Latin · multilingual"],
    [". 가사와 무관하게 제목만 별도 언어로 강제 가능. 연주곡 모드에서도 유효", ". Forces only the title into another language regardless of the lyrics. Also valid in instrumental mode."],
    ["프리셋 보호 중", "Preset protected"],
    ["배지 — 프리셋 로드 시 Excel 원본 Style 이 덮어써지지 않도록 잠금. 클릭으로 해제 시 AI 가 Style 도 새로 작성", "badge — locked when a preset is loaded so the Excel original Style is not overwritten. Click to unlock and the AI will rewrite Style too."],
    ["우측 미러: 현재 페이더 설정 (한글%·균형%·보컬%) 한눈에 확인", "Right mirror: current fader settings (KR% · Balance% · Vocal%) at a glance"],
    ["생성 시 우측 사이드바 상태표시줄에 진행 메시지 출력", "On generation, progress messages appear on the right-sidebar status bar"],
    ["중지", "Stop"],
    ["버튼 — 생성 중 빨간 outline 으로 강조. 진행 중인 요청을 즉시 취소", "button — highlighted in red outline during generation. Cancels the in-flight request immediately."],
    ["분류 → 시대 → 그룹 → 프리셋", "Category → Era → Group → Preset"],
    ["4단계 드롭다운으로 빌더 안에서 바로 프리셋 검색·선택 가능", "Four-step dropdowns let you search / pick a preset inside the Builder."],
    ["Style 칩이 비어 있고 아직 프리셋이 로드되지 않은 상태에서만 표시됩니다 — 칩이 1 개라도 들어오면 자동으로 숨어요", "Visible only when the Style chip stack is empty AND no preset has been loaded yet — auto-hides as soon as a single chip arrives."],
    ["좌측의", "From the left-side"],
    ["프리셋 · 댄싱머신 · 검색", "Presets · Dance Machine · Search"],
    ["탭에서 빌더로 전송하면 칩이 채워져 자동으로 숨겨짐", "tabs, sending to Builder fills the chips and auto-hides the picker."],
    ["다시 보이게 하려면", "To show it again,"],
    ["버튼으로 빌더를 리셋", "use the button to reset the Builder"],
    ["프리셋 선택 후 곡 구조·페이더·옵션까지 마쳤다면 제어 패널 하단의", "Once you've picked a preset and finished song-structure / faders / options, in the Controls panel,"],
    ["▶ 빌더에 로드", "▶ Load to Builder"],
    ["버튼으로 통합 적용", "the button applies everything at once"],
    ["현재 빌더에 로드된 프리셋의 메타 정보 표시: 시대·전성기·대표곡 (3 변형)·핵심 태그·곡 구조·저작권 안내", "Shows meta for the preset currently loaded in the Builder: era · peak · signature songs (3 variants) · core tags · song structure · copyright notice"],
    ["아티스트 프리셋은", "Artist presets:"],
    ["3가지 변형 중 선택 가능 (메타 카드 하단의 변형 칩)", "pick one of three variants (variant chips at the bottom of the meta card)"],
    ["로드된 프리셋이 없으면 사용 안내 메시지 표시", "If no preset is loaded, a usage hint is shown"],
    ["가사 생성을 미세 조정하는 DAW 스타일 페이더와 옵션:", "DAW-style faders and options that fine-tune lyric generation:"],
    ["가사 언어 페이더", "Lyric-language fader"],
    ["─ 0 = 한글 100% · 50 = 한·영 혼합 · 100 = 영문 100%", "— 0 = Korean 100% · 50 = KR + EN mixed · 100 = English 100%"],
    ["시적 비유 페이더", "Poetic-metaphor fader"],
    ["─ 0 = 직설적 · 50 = 균형 · 100 = 시적·은유 풍부", "— 0 = direct · 50 = balanced · 100 = metaphor-heavy"],
    ["보컬 ↔ 랩 페이더", "Vocal ↔ Rap fader"],
    ["─ 0 = 순수 보컬 · 50 = 혼합 (K-힙합) · 100 = 순수 랩", "— 0 = pure vocal · 50 = mixed (K-hip-hop) · 100 = pure rap"],
    ["BPM 자동 감지 표시", "Auto-detect & show BPM"],
    ["─ Style 텍스트에서 BPM 추출 표시", "— extracts BPM from the Style text and shows it"],
    ["식 영문 음악 지시 자동 삽입", "auto-inserts English music cues in this format"],
    ["콜 앤 리스폰스", "Call & Response"],
    ["─ Lead↔Crowd 교차 구조. 켜면", "— alternating Lead ↔ Crowd structure. When enabled,"],
    ["선택 가능", "becomes selectable"],
    ["─ 메인 보컬 위 layered 화음. 켜면", "— layered harmonies on top of the lead vocal. When enabled,"],
    ["편곡 스타일 옵션: K-Pop 화음 · 아이돌 떼창 · 스타디움 록 · 가스펠 · EDM 페스티벌 · J-Pop · 펑크 갱", "Arrangement style options: K-Pop harmonies · Idol chant · Stadium Rock · Gospel · EDM Festival · J-Pop · Punk gang"],
    ["제어 패널 하단의 시안 글로우 버튼", "The cyan-glow button at the bottom of the Controls panel"],
    [". 클릭 한 번에", ". With a single click,"],
    ["프리셋 Style + 곡 구조 + 페이더·옵션·편곡 키워드", "preset Style + song structure + fader / option / arrangement keywords"],
    ["가 모두 빌더의 Style·Lyrics 영역으로 자동 적용", "all auto-apply to the Builder's Style / Lyrics areas"],
    ["검색", "Search"],
    // Builder palette guide (current shape — 6 tabs)
    ["6 탭:", "6 tabs:"],
    ["🎸 장르", "🎸 Genre"],
    ["🎭 분위기", "🎭 Mood"],
    ["🥁 악기", "🥁 Instrument"],
    ["🎤 보컬", "🎤 Vocal"],
    ["⏱ 템포", "⏱ Tempo"],
    ["🔍 검색", "🔍 Search"],
    ["각 항목 클릭으로 Style 칩 즉시 추가 (반영도 🟢 → 🟡 → 기타 순 정렬, 칩 추가 시 한글→영문 자동 변환)", "Click any item to add a Style chip instantly (sorted by reflect 🟢 → 🟡 → other, Korean→English auto-translated at chip-add time)"],
    ["반영도 색상 범례 — 🟢 무조건 / 🟡 비교적 / 🔴 잘 안됨", "Reflect-score legend — 🟢 always / 🟡 often / 🔴 rarely"],
    ["좌측 패널에", "In the left panel,"],
    ["앨범 컨셉", "album concept"],
    ["입력 ─ 예:", "enter — e.g."],
    ["\"도시 청춘의 사계절 — 봄에 만나 겨울에 헤어진 사랑의 12 장면\"", "\"Four seasons of city youth — 12 scenes of a love that began in spring and ended in winter\""],
    ["분류 · 시대 · 스타일 그룹 · 레퍼런스 프리셋", "Category · Era · Style group · Reference preset"],
    ["선택 (선택사항)", "select (optional)"],
    ["현재 빌더 선택 가져오기", "Pull current Builder selection"],
    ["버튼 ─ 빌더에서 고른 프리셋을 그대로 앨범에 적용", "button — applies the preset picked in the Builder directly to the album"],
    ["다중 선택 (예: 멜랑콜릭 · 업비트 · 에테리얼)", "multi-select (e.g. melancholic · upbeat · ethereal)"],
    ["앨범 흐름 (Arc)", "Album arc"],
    ["선택 ─ 감정 여정 · 스토리 아크 · 테마 통일 · 버라이어티 · 사계절 · 하루의 흐름", "pick — emotional journey · story arc · thematic · variety · four seasons · day cycle"],
    ["─ 앨범 전체 한·영 비율", "— album-wide KR / EN ratio"],
    ["🎵 앨범 기획 생성 (12곡)", "🎵 Generate 12-track album"],
    ["→ AI 가 앨범 제목 · 컨셉 요약 · 12 개 트랙 (제목·무드·BPM·Style·hook) 생성", "→ AI generates the album title · concept summary · 12 tracks (title · mood · BPM · Style · hook)"],
    ["우측에 트랙리스트 카드 12 장 표시", "12 tracklist cards appear on the right"],
    ["🎚️ 가사 생성 옵션", "🎚️ Lyric-generation options"],
    ["펼침 ─ 한·영 / 비유 / 보컬·랩 / 음악 지시 / 콜앤리스폰스 / 화음·코러스 / 편곡 스타일", "expanded — KR / EN, metaphor, vocal / rap, music cues, call & response, harmonies, arrangement style"],
    ["개별 트랙", "Individual track"],
    ["📝 12곡 가사 일괄 생성", "📝 Generate lyrics for all 12"],
    ["각 트랙 카드 복사 버튼 —", "Each track card has copy buttons —"],
    ["제목 / Style / 가사 / 전체", "Title / Style / Lyrics / All"],
    ["(Suno Custom Mode 3 필드 분리 붙여넣기)", "(for separate pasting into the 3 Suno Custom Mode fields)"],
    ["🔄 다시 기획", "🔄 Re-plan"],
    ["─ 같은 컨셉으로 재생성", "— regenerate with the same concept"],
    ["💾 앨범 승인 · 저장", "💾 Approve & save"],
    ["─ localStorage 보관 (좌측 하단 저장된 앨범 리스트에서 다시 불러올 수 있음)", "— stored in localStorage (loadable later from the Saved-Albums list at the bottom left)"],
    ["📤 JSON 내보내기", "📤 Export JSON"],
    ["🗑️ 전체 초기화", "🗑️ Reset all"],
    ["11 개 패밀리 필터: 하우스 (30) · 테크노 (30) · 트랜스 (20) · D&amp;B (20) · 하드 (15) · 베이스 (20) · 디스코 (15) · 라틴 (15) · 아프로 (15) · 실험 (10) · 모던 (10)", "11 family filters: House (30) · Techno (30) · Trance (20) · D&B (20) · Hard (15) · Bass (20) · Disco (15) · Latin (15) · Afro (15) · Experimental (10) · Modern (10)"],
    ["검색: 한글·영문·BPM·설명", "Search: KR · EN · BPM · description"],
    ["각 카드 정보: 패밀리 라벨 · BPM · 한국어 이름 · 영문 이름 · 간단 설명 · Suno Style 프롬프트", "Each card: family label · BPM · Korean name · English name · short description · Suno Style prompt"],
    ["카드 클릭 시 우측 시드로 자동 로드", "Click a card to auto-load it into the right-hand seed"],
    ["8 카테고리 탭: 드럼·리듬 · 베이스 · 신스·리드·패드 · 보컬 · 이펙트·텍스처 · 구조·드랍 · 무드 · BPM 힌트", "8 category tabs: Drums · Rhythm · Bass · Synth · Lead · Pad · Vocal · Effects · Texture · Structure · Drop · Mood · BPM hint"],
    ["각 태그 핀: 영문 태그 + 한국어 설명, 클릭으로 토글 선택", "Each tag pin: English tag + Korean description, click to toggle selection"],
    ["베이스 시드 (스타일 카드에서 자동 채워짐, 직접 편집 가능)", "Base seed (auto-filled from a style card, editable)"],
    ["최종 조립된 Style 텍스트 실시간 미리보기 (중복 자동 제거)", "Live preview of the composed Style text (auto-deduped)"],
    ["▶ 빌더로 보내기", "▶ Send to Builder"],
    ["각 아티스트 카드는 시그니처 곡 외에", "Beyond the signature song, each artist card"],
    ["다른 두 곡의 실제 대표 스타일", "shows the actual representative styles of two more songs"],
    ["까지 펼쳐서 보여줍니다. 같은 아티스트의 발라드와 댄스 곡을 동시에 비교 / 선택할 수 있어요.", ". You can compare / pick the same artist's ballad and dance song side-by-side."],
    ["예)", "e.g."],
    ["각 곡마다 라벨 (대표곡 / 대표곡 2 / 대표곡 3), 곡명, 풀 Style 텍스트, 구조 표시", "Each song has a label (Signature / Signature 2 / Signature 3), song name, full Style text, and structure"],
    ["곡별 개별", "per-song"],
    ["버튼", "button"],
    ["총 202 아티스트 × 3 =", "202 artists × 3 ="],
    ["606 개의 실제 대표곡 Suno Style 프롬프트", "606 actual signature-song Suno Style prompts"],
    ["(1920년대 재즈부터 2020년대 K-pop·Afrobeats 까지)", "(from 1920s jazz to 2020s K-pop / Afrobeats)"],
    ["Suno AI 한국어 가이드 v8 의 모든 태그 카탈로그", "Every tag in the Suno AI Korean Guide v8 catalog"],
    ["필터: 한국 / POP · 시트별 · 필드 (Style·Lyrics·Style/Lyrics·Exclude)", "Filters: KR / POP · sheet · field (Style · Lyrics · Style/Lyrics · Exclude)"],
    ["반영도 색상 — 🟢 무조건 / 🟡 비교적 / 🔴 잘 안됨", "Reflect colour — 🟢 always / 🟡 often / 🔴 rarely"],
    ["각 행에", "Each row's"],
    ["버튼으로 즉시 Style 칩 또는 Lyrics 구조에 삽입", "button inserts directly into Style chips or Lyrics structure"],
    ["Excel 가이드 v8 원문을 시트별로 그룹화한 챕터 인덱스", "Chapter index grouping the Excel Guide v8 original by sheet"],
    ["좌측 인덱스 → 우측에 표 형식으로 챕터 내용 표시", "Left index → right pane shows chapter content as a table"],
    ["빌더에서", "From the Builder,"],
    ["누른 항목 보관", "items you saved"],
    ["📤 JSON 내보내기 · 📥 가져오기 · 전체 삭제", "📤 Export JSON · 📥 Import · Clear all"],
    ["디자인 컨셉", "Design concept"],
    ["— Sonic Syntax (DAW / IDE 스타일). 4 액센트 컬러:", "— Sonic Syntax (DAW / IDE style). Four accent colours:"],
    ["시안 = VU 미터·CTA", "Cyan = VU meters · CTA"],
    ["스카이 = 주요 액션", "Sky = primary actions"],
    ["퍼플 = 창의 모디파이어", "Purple = creative modifiers"],
    ["앰버 = 워닝·메타", "Amber = warnings · meta"],
    ["폰트", "Font"],
    ["— Paperozi (페이퍼로지) 단일 폰트 9 웨이트 (100~900). 한글·영문·숫자 모두", "— Paperozi (single font, 9 weights 100-900). Korean · English · numerals all"],
    ["— 기본. Sonic Syntax 의 원본 deep blue surface + sky-blue primary", "— default. Sonic Syntax original deep-blue surface + sky-blue primary"],
    ["— 차가운 수트 톤 (Linear · Vercel 분위기). 중간 명도 차콜 #1a1d24 + periwinkle #6e7bdc primary + 민트 #67e8c5 액센트. 다크 / 라이트의 중간 색감", "— cold suit tone (Linear · Vercel vibe). Mid-brightness charcoal #1a1d24 + periwinkle #6e7bdc primary + mint #67e8c5 accent. Mid-palette between dark and light."],
    ["☀ 라이트", "☀ Light"],
    ["— 부드러운 슬레이트 배경 + 진한 sky-blue. 밝은 작업 환경용", "— soft slate background + strong sky-blue. For bright workspaces."],
    ["선택은 localStorage", "Choice is in localStorage"],
    ["에 저장 — 다음 방문에도 유지", "— persists across visits"],
    ["Graphite 테마 focus ring 강화 — 입력 포커스 시 더 진한 periwinkle 글로우", "Graphite theme strengthened focus ring — stronger periwinkle glow on input focus"],
    ["목적", "Purpose"],
    ["— 화면 좌측 절반에 SU-Note, 우측 절반에 Suno.com 을 동시 띄워 한눈에 작업", "— place SU-Note on the screen's left half and Suno.com on the right half for at-a-glance work"],
    ["분할 모드 슬라이드 스위치", "Split-mode slide switch"],
    ["— 켜면 사이드바 168px 로 축소, 패널/탑바/워크플로우 차트가 컴팩트 레이아웃으로 전환", "— when on, sidebar shrinks to 168px, panels / topbar / workflow chart switch to compact layout"],
    ["워크플로우 차트 자동 이동", "Workflow chart auto-relocation"],
    ["— 분할 ON 시 빌더 본문의 4 단계 차트가 사이드바 안의 컴팩트 세로 스트립으로 자동 이동. OFF 로 돌리면 원래 위치로 복귀", "— with split ON, the 4-step chart in the builder body auto-moves into a compact vertical strip inside the sidebar. Turning split OFF restores its original position."],
    ["Suno 열기 버튼", "Open Suno button"],
    ["— 화면 우측 절반에 popup 으로 Suno.com 띄움. 이미 열린 창이 있으면 focus 만 전환 (중복 안 열림). 위치는", "— opens Suno.com as a popup on the right half of the screen. If a window is already open, just refocuses (no duplicates). Position is"],
    ["분할 모드 자체도", "Split mode itself is also"],
    ["에 저장 — 다음 방문에 자동 적용", "— persists across visits"],
    ["크로스오리진 제약", "Cross-origin restriction"],
    ["— 브라우저 보안상 SU-Note 가 Suno 의 Style/Lyrics 입력란에 직접 붙여넣을 수 없습니다.", "— for browser-security reasons, SU-Note cannot paste directly into Suno's Style / Lyrics inputs."],
    ["→ Suno 창에서", "→ in the Suno window,"],
    ["가 유일한 방법", "is the only way"],
    ["햄버거 메뉴", "Hamburger menu"],
    ["— 탑바 좌측 ☰ 아이콘. 사이드바가 화면 왼쪽에서 드로어처럼 슬라이드 인. 백드롭 탭 /", "— topbar's left ☰ icon. The sidebar slides in like a drawer from the left. Backdrop tap /"],
    ["/ 메뉴 항목 탭으로 자동 닫힘", "/ menu-item tap closes it automatically"],
    ["레이아웃 압축", "Layout compression"],
    ["— 12-column 그리드 → 단일 컬럼 (≤900px). 탑바의 통계 텍스트 (\"Suno V5.5 · 648 태그...\") 자동 숨김", "— 12-column grid → single column (≤900px). The topbar stats text (\"Suno V5.5 · 648 tags...\") auto-hides."],
    ["터치 친화", "Touch-friendly"],
    ["(≤640px) — 버튼·입력 최소 높이 40px. 워크플로우 카드 세로 정렬. 모달 96vw 로 확장", "(≤640px) — minimum button / input height 40px. Workflow cards stack vertically. Modals expand to 96vw."],
    ["전체 편집 가능 — 모바일에서도 프리셋 로드·페이더 조정·AI 생성·복사 흐름 모두 작동", "Full editing available — preset load, fader adjust, AI generation, and copy flows all work on mobile too."],
    ["강조 버튼", "Highlight button"],
    ["─ 시안 글로우로 핵심 액션 강조", "— cyan glow highlights primary actions"],
    ["📋 복사 버튼", "📋 Copy buttons"],
    ["(Style 복사 · Lyrics 복사) — cyan-accent 테두리 + 텍스트 → 워크플로우 종착점이 한눈에 보이게", "(Copy Style · Copy Lyrics) — cyan-accent border + text → the workflow endpoint is visible at a glance."],
    ["AI 중지 버튼", "AI Stop button"],
    ["— 생성 중일 때 빨간 outlined 컨트롤로 승격. ghost 처럼 흐리지 않음", "— promoted to a red outlined control during generation. Not dimmed like a ghost button."],
    ["사이드바 메뉴 폰트", "Sidebar menu font"],
    ["— 13px (분할 모드 12px) 로 상향. 작은 캡션·뱃지도 모두 11~12px 이상으로 가독성 확보", "— bumped to 13px (12px in split mode). Small captions / badges all at 11-12px+ for readability."],
    ["글래스 패널", "Glass panels"],
    ["— backdrop-blur 로 깊이감, 오버레이 그라디언트로 시각적 입체감", "— backdrop-blur gives depth, overlay gradients add visual dimensionality."],
    ["Suno 의 Style 필드는 영문 음악 용어만 인식합니다. 한국어·아티스트명·언어 지시가 섞이면 Suno 의 토큰화가 깨지므로, SU-Note 는", "Suno's Style field only recognises English music terms. Korean text · artist names · language directives mixed in break Suno's tokenisation, so SU-Note"],
    ["모든 Style 칩 진입 경로", "every Style-chip entry path"],
    ["(프리셋 로드 · AI 출력 · 수동 입력 · 팔레트 · 댄싱 머신) 에서 자동으로 정제합니다.", "(preset load · AI output · manual input · palette · Dance Machine) automatically sanitises."],
    ["매핑되지 않은 한글은 모두 제거 (잔여 한글 0건 보장)", "All unmapped Korean is removed (zero Korean residue guaranteed)"],
    ["대표곡 변형 606 곡 + Excel 가이드 템플릿 + 댄스 200 스타일에서 모든 실명 자동 제거", "All real names auto-removed from 606 signature variants + Excel guide templates + 200 dance styles"],
    ["예시 치환:", "Example substitutions:"],
    ["/ 등", "/ etc."],
    ["총", "Total"],
    ["적용 (250+ 인명 → 역할 라벨, 소유격·접미 패턴까지 정리)", "applied (250+ names → role labels, plus possessive / suffix patterns)"],
    ["아티스트 카드의 라벨 (예: BLACKPINK · BTS · Adele) 은 그대로 유지", "Artist-card labels (e.g. BLACKPINK · BTS · Adele) stay intact"],
    ["— 어디까지나 Style 텍스트 안에 들어가는 인명만 제거", "— only names embedded inside the Style text are removed"],
    ["가사 언어는", "Lyric language is"],
    ["가 결정합니다. Style 에 들어가는 언어 지시는 노이즈이므로 모두 제거:", "decides it. Language directives in Style are noise, so they're all removed:"],
    ["→ 모두 빈 문자열", "→ all to empty strings"],
    ["가사 한·영 비율은 우측 제어 패널의", "The lyric KR / EN ratio is set in the right Controls panel's"],
    ["로만 조정 → AI 가 가사 자체를 해당 언어로 작성", "only — the AI writes the lyrics in that language."],
    ["AI 생성 · 프리셋 로드 · 팔레트 클릭 · 기본 골격 삽입 모든 경로에서", "On every path — AI generation, preset load, palette click, skeleton insertion —"],
    ["헤더 앞에 빈 줄 1줄 자동 보장", "one blank line is guaranteed before every header."],
    ["3 줄 이상 연속 빈 줄은 1 줄로 정리 (멱등 정규화)", "3+ consecutive blank lines are collapsed to 1 (idempotent normalisation)"],
    ["가사가 시각적으로 블록 단위로 구분되어 가독성·편집 편의 ↑", "Lyrics visually split into blocks, improving readability and editing ↑"],
    ["AI 가 자주 만들던 중복 패턴 — 앞에", "AI-generated duplicate patterns — front-loading"],
    ["박고 꼬리에", "then tail-restating"],
    ["같은 재진술 — 을 자동 dedup", "— are auto-deduped."],
    ["중복 시대 토큰 (decade · year · range) 은 첫 것만 유지", "Duplicate era tokens (decade · year · range) — only the first is kept"],
    ["중복 장르 lineage (K-pop / J-pop / Korean idol group 등 동의 그룹) 도 첫 것만 유지", "Duplicate genre lineages (synonym groups like K-pop / J-pop / Korean idol group) — only the first is kept"],
    ["Filler 꼬리 패턴 (", "Filler tail patterns ("],
    ["등) 통째로 drop", "etc.) are dropped entirely"],
    ["AI 생성·검색 결과·프리셋 로드 모든 경로에서 적용 → 200자 token budget 효율 사용", "Applied on every path (AI generation, search results, preset load) → efficient use of the 200-char token budget"],
    ["로드된 칩은 카탈로그의", "Loaded chips match the catalog's"],
    ["와 매칭돼 자동 stable 정렬: 🟢 (잘 됨) → 🟡 (가끔만) → ⚪ (데이터 없음) → 🔴 (잘 안 됨)", "and are auto-sorted stably: 🟢 (reliable) → 🟡 (sometimes) → ⚪ (no data) → 🔴 (rarely)"],
    ["200자 token 한도에서 잘릴 때 핵심 anchor 태그가 살아남도록 우선순위 강제", "Forces priority so core anchor tags survive truncation at the 200-char token limit"],
    ["같은 적용도 안에선 추가된 순서 보존 (stable sort)", "Within the same reflect class, insertion order is preserved (stable sort)"],
    ["각 칩 좌측 ● 도트 색상으로 적용도 시각화 → 마우스 오버 시 한국어 설명", "Each chip's left ● dot colour visualises the reflect score — hover for the Korean description"],
    ["🔴 칩은 살짝 흐려져 (opacity 0.7) 우선순위가 낮음을 표시. 사용자가 의도적으로 두면 그대로 유지", "🔴 chips are slightly dimmed (opacity 0.7) to show low priority. They stay intact if you deliberately keep them."],
    ["★ 모든 정제는", "★ All sanitisation runs"],
    ["실시간 런타임", "live at runtime"],
    ["으로 동작하므로 향후 Excel 가이드가 갱신되어 인명·한국어가 새로 들어와도 자동 처리됩니다.", "— so future Excel-guide updates with new names / Korean strings get auto-handled."],
    ["핵심 — 모든 작업은 브라우저 localStorage 에만 자동 저장됩니다.", "Core — every action is auto-saved only to the browser's localStorage."],
    ["쿠키 및 사이트 데이터 삭제·시크릿 모드 종료·프로필 재설정 시", "When you clear cookies & site data, end an incognito session, or reset your profile,"],
    ["모두 사라집니다", "everything disappears"],
    [". 정기적인 JSON 내보내기로 백업하는 것을 강력히 권장합니다.", ". Regular JSON exports for backup are strongly recommended."],
    ["회색", "Grey"],
    ["에 저장돼 다음 열기 때 같은 자리로 복귀", "is stored and re-opens in the same spot next time"],
    ["빌더 프리셋 배열 — 제목·Style·가사·칩·페이더값·제어판 옵션·variantIndex", "Builder preset array — title · Style · lyrics · chips · fader values · control-panel options · variantIndex"],
    ["저장된 앨범 배열 — 12 트랙 + 전체 폼 상태 (formState)", "Saved-album array — 12 tracks + full form state (formState)"],
    ["암호화된 API 키 (AES-GCM 256bit · 디바이스 키)", "Encrypted API key (AES-GCM 256-bit · device key)"],
    ["라이트 / 다크 모드 선택", "Light / Dark mode choice"],
    ["헤더 워크플로우 차트 접힘 상태", "Header workflow-chart collapsed state"],
    ["📤 JSON 내보내기 · 💾 파일 버튼은 사용자의 다운로드 폴더에 다음 구조로 파일을 저장합니다 (Chromium 계열은 슬래시 경로를 인식해 하위 폴더 자동 생성, Firefox/Safari 는 underscore 로 평탄화):", "📤 Export JSON · 💾 File buttons save files to your Downloads folder with the following structure (Chromium-based browsers recognise slashed paths and auto-create sub-folders; Firefox / Safari flatten with underscores):"],
    ["저장됨 탭 → 📥 가져오기", "Saved tab → 📥 Import"],
    ["─ 프리셋 JSON 파일을 다시 로드. id + name+style 키로 중복 자동 제거.", "— reloads preset JSON files. Duplicates removed via id + name + style key."],
    ["앨범 탭 → 저장된 앨범 패널 → 📥 가져오기", "Album tab → Saved-Albums panel → 📥 Import"],
    ["─ 앨범 JSON (단일 객체 또는 배열) 로드. name + savedAt 으로 중복 제거.", "— loads album JSON (single object or array). Duplicates removed via name + savedAt."],
    ["전체 삭제", "Clear all"],
    ["─ 프리셋·앨범 각 패널의 🗑️ 버튼으로 일괄 정리.", "— bulk-clear via each panel's 🗑️ button."],
    ["마음에 드는 프리셋을 만들면 즉시", "When you make a preset you like, immediately"],
    ["💾 파일", "💾 File"],
    ["버튼으로 개별 저장", "use the button to save individually"],
    ["앨범 완성 후", "After finishing an album,"],
    ["로 album.json + 12 트랙 .txt 받기", "to receive album.json + 12 track .txt files"],
    ["USB · Dropbox · iCloud · Google Drive 등에", "to USB / Dropbox / iCloud / Google Drive,"],
    ["폴더를 주기적 복사", "periodically copy the folder"],
    ["새 PC·브라우저로 옮길 땐 같은 도메인에서 📥 가져오기", "When moving to a new PC / browser, use 📥 Import on the same domain"],
    ["별도 암호 입력 없음 — 디바이스 키가 자동으로 관리. 다른 PC 로 옮기려면 새 PC 에서 키를 다시 입력하면 됨", "No separate passphrase — the device key is managed automatically. To move to another PC, just re-enter the keys on the new PC."],
    ["앱 첫 실행 시", "On first app launch,"],
    ["WebCrypto API 가 무작위 AES-GCM 256bit 디바이스 키", "the WebCrypto API generates a random AES-GCM 256-bit device key"],
    ["를 자동 생성 →", "automatically →"],
    ["에 저장", "stored in"],
    ["각 API 키는 고유 IV(96bit) 로 암호화되어", "Each API key is encrypted with a unique IV (96-bit) and"],
    ["안에 보관 → localStorage 에만 저장 · 서버 전송 0건", "stored in → only in localStorage · zero server transmission"],
    ["새 기기로 이전하려면 새 기기 설정 화면에서 API 키를 다시 입력 (디바이스 키는 기기별 격리)", "To migrate to a new device, re-enter API keys on the new device's Settings screen (device key is per-device isolated)."],
    ["전체 정보 초기화 (Purge All Data)", "Purge all data"],
    ["─ 설정 모달 하단 빨강 버튼. localStorage 의 디바이스 키·API 키·메타 모두 삭제 후 새 디바이스 키 자동 생성", "— red button at the bottom of the Settings modal. Deletes device key / API keys / meta from localStorage, then auto-generates a new device key."],
    ["이 매뉴얼 열기", "Open this manual"],
    ["모달 / 모바일 사이드바 드로어 닫기", "Close the modal / mobile sidebar drawer"],
    ["강력 새로고침 — 캐시 클리어", "Hard reload — clear cache"],
    ["워크플로우", "Workflow"],
    ["상단 차트의", "The top chart's"],
    ["버튼 ─ localStorage", "button — localStorage"],
    ["로 상태 유지. 분할 모드 ON 시 자동으로 사이드바 안 컴팩트 스트립으로 이동", "preserves state. With split mode ON, it auto-moves into a compact strip inside the sidebar."],
    ["테마 (3 단)", "Theme (3-way)"],
    ["좌측 사이드바 하단 세그먼티드 컨트롤 — 🌙 다크 / ◐ Graphite / ☀ 라이트. localStorage", "Sidebar bottom segmented control — 🌙 Dark / ◐ Graphite / ☀ Light. localStorage"],
    ["분할 모드", "Split mode"],
    ["좌측 사이드바 하단 토글 → 우측 절반에 Suno 띄우기용 컴팩트 레이아웃. localStorage", "Sidebar bottom toggle → compact layout for placing Suno on the right half. localStorage"],
    ["Suno 열기", "Open Suno"],
    ["좌측 사이드바 \"Suno 열기\" 버튼 — 분할 모드 시 우측 절반 popup, 비분할 시 새 탭. 창 위치", "Sidebar \"Open Suno\" button — in split mode it pops up on the right half; otherwise a new tab. Window position"],
    ["에 기억", "is remembered in"],
    ["모바일 드로어", "Mobile drawer"],
    ["화면 폭 ≤900px 에서 탑바 좌측 ☰ 아이콘으로 사이드바 열기/닫기", "Below 900px width, use the topbar ☰ icon to open / close the sidebar"],
    ["저작권 안내", "Copyright notice"],
    ["아티스트 카드 상단·푸터·아티스트 탭에 4 곳 명시 ─ 아티스트명은 스타일 분류 라벨일 뿐 Suno 프롬프트에 포함되지 않음", "Stated in 4 places — top of artist cards, footer, and the Artists tab — artist names are style-classification labels only and are NOT included in the Suno prompt."],
    ["주요 마일스톤 모음. 현재 버전:", "Major milestones. Current version:"],
    ["★ 버전은 마이너 패치까지 매번 표기하진 않습니다 — 사용자가 체감 가능한 큰 변경 단위로 묶어 정리. 사이드바 좌상단", "★ Not every minor patch gets a version bump — versions group user-facing big changes. The top-left sidebar"],
    ["배지 클릭으로 이 섹션에 바로 접근 가능.", "badge click jumps directly to this section."],
    ["🎯 Suno 적용도 우선 + UX 폴리시", "🎯 Reflect-score priority + UX polish"],
    ["현재", "current"],
    ["칩 Suno 적용도 (🟢🟡🔴⚪)", "Chip Suno reflect (🟢🟡🔴⚪)"],
    ["자동 정렬", "auto-sort"],
    ["+ 좌측 도트 색상 — 200자 한도에서 핵심 anchor 가 살아남도록 우선순위 강제", "+ left dot colour — forces priority so core anchors survive the 200-char limit"],
    ["팔레트 (장르·분위기·악기·보컬·템포·검색) 태그에도 동일 도트 적용 → 추가 전 적용도 미리 확인", "Same dot applied to palette tags (Genre / Mood / Instrument / Vocal / Tempo / Search) → check reflect before adding"],
    ["시작점 picker", "Starting-point picker"],
    ["복귀", "restored"],
    ["— 빌더 우측 상단. 칩이 비어 있을 때만 자동 표시, 칩이 들어오면 자동 숨김", "— top-right of Builder. Auto-shown only when chips are empty, auto-hidden when chips arrive"],
    ["\"빌더에 로드\" 듀얼 모드 — 프리셋 있으면 통합 적용, 없으면 제어 옵션만 기존 칩에 머지", "\"Load to Builder\" dual mode — with a preset, applies everything; otherwise merges only control options into existing chips"],
    ["사이드바 탭 직접 클릭 시 본문 자동 초기화 (프로그램적 setTab 은 보존)", "Direct sidebar-tab click clears body content (programmatic setTab preserved)"],
    ["해외 아티스트", "Foreign artists"],
    ["한글 음역 검색", "Hangul-transliteration search"],
    ["지원 (콜드플레이 / 비틀즈 / 빌리아일리시 등)", "supported (Coldplay / The Beatles / Billie Eilish etc.)"],
    ["Style 중복 era / genre 꼬리 태그 자동 dedup (\"early-2020s K-pop production\" 같은 재진술 제거)", "Style auto-dedups duplicate era / genre tail tags (removes restatements like \"early-2020s K-pop production\")"],
    ["🔍 AI 검색 + 웹 검색 grounding", "🔍 AI Search + web-search grounding"],
    ["새", "New"],
    ["🔍 검색", "🔍 Search"],
    ["사이드바 탭 — 200 큐레이션 밖의 모든 아티스트·노래 발견", "sidebar tab — discover every artist / song outside the 200 curated presets"],
    ["Claude / GPT / Gemini provider 별 네이티브 웹 검색 도구 —", "Native web-search tools per Claude / GPT / Gemini provider —"],
    ["grounding", "grounding"],
    ["웹 검색", "Web search"],
    ["옵션 체크박스", "option checkbox"],
    ["+ 실시간 비용 안내 (provider 별 단가 표시)", "+ live cost hint (per-provider pricing)"],
    ["아티스트 정보 + 대표곡 5-8개 자동 정리 → Suno-ready Style 그대로 빌더 로드", "Auto-summarises artist info + 5-8 signature songs → drops the Suno-ready Style straight into the Builder"],
    ["검색 결과는 자동 저장 안 함 (사용자가 명시적으로 Style 패널의 💾 사용)", "Search results aren't auto-saved (use the Style panel's 💾 explicitly)"],
    ["🎺 Instrumental 모드 + 제목 언어", "🎺 Instrumental mode + Title language"],
    ["🎺 연주곡", "🎺 Instrumental"],
    ["체크박스 — 가사 없이 [Section: 음악 큐] +", "checkbox — without lyrics, only [Section: music cue] +"],
    ["마커만으로 instrumental 트랙 생성", "markers to make instrumental tracks"],
    ["7-9 섹션 + 80-120 마디 강제로 3-4분 트랙 길이 보장 (빈 가사가 90초 루프 되는 문제 해결)", "Forces 7-9 sections + 80-120 bars to guarantee a 3-4 min track (fixes empty-lyrics 90-second loop issue)"],
    ["제목 언어", "Title language"],
    ["별도 선택 — Auto / 한국어 / English / 日本語 / Latin·다국어. 가사 언어와 무관하게 제목만 강제", "separate pick — Auto / Korean / English / 日本語 / Latin · multilingual. Forces only the title language regardless of lyric language."],
    ["AI 시스템 프롬프트에", "Adds a"],
    ["중복 금지", "no-duplication"],
    ["룰 추가 (slot order + filler 꼬리 제거)", "rule to the AI system prompt (slot order + filler-tail removal)"],
    ["🎨 테마 시스템 + 분할 모드 + 모바일", "🎨 Theme system + Split mode + Mobile"],
    ["Graphite 테마", "Graphite theme"],
    ["추가 — Linear / Vercel 톤. 다크 / Graphite / 라이트 3 단 세그먼티드 컨트롤", "added — Linear / Vercel tone. 3-way Dark / Graphite / Light segmented control"],
    ["— 사이드바 168px 컴팩트, Suno 우측 절반 자동 popup, 창 위치 기억", "— sidebar 168px compact, Suno auto-popup on right half, window position remembered"],
    ["분할 ON 시 워크플로우 차트 사이드바로 자동 이동", "With split ON, the workflow chart auto-moves into the sidebar"],
    ["(≤900px) — 햄버거 메뉴, 40px 터치 타겟, 단일 컬럼", "(≤900px) — hamburger menu, 40px touch targets, single column"],
    ["사이드바 폰트 크기 상향, 캡션·뱃지 가독성 개선", "Sidebar font size bumped, caption / badge readability improved"],
    ["🔐 Passphrase-free Vault + 모델 큐레이션", "🔐 Passphrase-free Vault + Model curation"],
    ["WebCrypto 디바이스 키 자동 생성 — passphrase 입력 없이 즉시 사용", "WebCrypto device key auto-generated — usable instantly with no passphrase"],
    ["큐레이션 6 AI 모델 라인업 — Sonnet 4.6 / Haiku 4.5 / GPT-5.4 mini / GPT-4.1 mini / Gemini 3.5 Flash / Gemini 2.5 Flash", "Curated lineup of 6 AI models — Sonnet 4.6 / Haiku 4.5 / GPT-5.4 mini / GPT-4.1 mini / Gemini 3.5 Flash / Gemini 2.5 Flash"],
    ["가사 품질 우선 ⭐ 추천 표시", "Lyric-quality ⭐ recommendations marked"],
    ["localStorage 데이터 손실 주의 백업 경고 (3 곳 배치)", "Backup warnings about localStorage data loss (placed in 3 spots)"],
    ["빨강 에러 토스트 + AI 중지 버튼 강조", "Red error toasts + emphasised AI Stop button"],
    ["cyan-accent 복사 버튼 강조 (워크플로우 종착점 인지)", "Cyan-accent copy buttons emphasised (recognising the workflow endpoint)"],
    ["🌍 200 아티스트 + Paperozi + Sanitization", "🌍 200 artists + Paperozi + sanitisation"],
    ["200 mainstream 아티스트 완성 (Björk → The Police 등 대중 친화)", "Hit 200 mainstream artists (Björk → The Police etc., audience-friendly)"],
    ["4-단계 beginner 워크플로우 차트", "4-step beginner workflow chart"],
    ["Paperozi (Paperlogy) 통합 단일 폰트 (9 weight)", "Unified Paperozi (Paperlogy) single font (9 weights)"],
    ["3-layer Sanitization Pipeline — 한국어 → 영문 치환 / 250+ 인명 → 역할 라벨 / 언어 지시 제거", "3-layer sanitisation pipeline — KR → EN substitution / 250+ names → role labels / language directives removed"],
    ["250+ 인명 패턴", "250+ name patterns"],
    ["사용법 가이드 모달 (manual-grade)", "User-guide modal (manual-grade)"],
    ["🎚️ Sonic Syntax + Dancing Machine", "🎚️ Sonic Syntax + Dancing Machine"],
    ["DAW 다크 모드 디자인 시스템 (sky-blue primary, cyan-accent meters, purple secondary)", "DAW dark-mode design system (sky-blue primary, cyan-accent meters, purple secondary)"],
    ["각 아티스트 3-variant 프리셋 (Signature / Ballad / Anthem) → 200 × 3 = 600 곡", "Per-artist 3-variant presets (Signature / Ballad / Anthem) → 200 × 3 = 600 songs"],
    ["Dancing Machine", "Dancing Machine"],
    ["— 200 댄스 스타일 가이드 + 8 카테고리 × 210 댄스 전용 태그 조합기", "— 200-style dance guide + 8 categories × 210 dance-specific tag composer"],
    ["시안 글로우 CTA 버튼 (▶ 빌더에 로드)", "Cyan-glow CTA button (▶ Load to Builder)"],
    ["✨ SU-Note 리브랜딩 + UI 재설계", "✨ SU-Note rebrand + UI redesign"],
    ["SU-Note (수-노트) 브랜딩 — 이전 Sunote / GPT PARK 에서 진화", "SU-Note branding — evolved from earlier Sunote / GPT PARK"],
    ["라이트 / 다크 모드 토글 (localStorage 영속)", "Light / Dark mode toggle (localStorage-persistent)"],
    ["좌측 사이드바 + 메인 hero 레이아웃", "Left sidebar + main hero layout"],
    ["디자인 토큰 통합 (radius scale, color tokens)", "Unified design tokens (radius scale, color tokens)"],
    ["글래스 모피즘 패널 + 그라디언트", "Glass-morphism panels + gradients"],
    ["💿 Mix Console + 12-곡 앨범 기획", "💿 Mix Console + 12-track album planner"],
    ["Mix Console — 페이더 기반 가사 옵션 통합", "Mix Console — unified fader-based lyric options"],
    ["💿 12-곡 앨범 자동 기획·생성 (곡당 distinct style)", "💿 12-track album auto-plan / generate (distinct style per track)"],
    ["콜앤리스폰스 / 화음·코러스 + 보컬 편곡 스타일 (K-Pop / 아이돌 / 스타디움 록 / 가스펠 / EDM / J-Pop / 펑크 갱)", "Call & Response / Harmonies + Vocal-arrangement styles (K-Pop / Idol / Stadium Rock / Gospel / EDM / J-Pop / Punk gang)"],
    ["저작권 안내 4 곳 배치", "Copyright notice placed in 4 spots"],
    ["Tolerant JSON parser (AI 출력의 일반적 JSON foible 자동 복구)", "Tolerant JSON parser (auto-recovers from common AI-output JSON foibles)"],
    ["🎙️ Suno v8 적응 + 페이더 슬라이더", "🎙️ Suno v8 adoption + fader sliders"],
    ["한·영 가사 비율 페이더 (0 = 한글 100% · 50 = 혼합 · 100 = 영문 100%)", "KR / EN lyric ratio fader (0 = KR 100% · 50 = mixed · 100 = EN 100%)"],
    ["🎭 시적 비유 강도 슬라이더", "🎭 Poetic-metaphor intensity slider"],
    ["🎤 보컬↔랩 비율 슬라이더", "🎤 Vocal ↔ Rap ratio slider"],
    ["섹션 내 음악 큐 자동 삽입 (", "Auto-injection of music cues inside sections ("],
    ["Excel 원본 Style 보호 잠금 (🔒 프리셋 보호 중 배지)", "Excel-original Style protection lock (🔒 Preset Protected badge)"],
    ["🌱 Genesis", "🌱 Genesis"],
    ["1,127 Suno 태그 카탈로그 + 261 큐레이션 템플릿 + 200 아티스트", "1,127 Suno-tag catalog + 261 curated templates + 200 artists"],
    ["한국 가요 / POP 분류 시스템", "Korean-pop / Global-pop classification system"],
    ["Claude / GPT / Gemini 3 provider AI 연동", "Claude / GPT / Gemini — 3-provider AI integration"],
    ["WebCrypto AES-GCM 256bit 로컬 API 키 vault", "WebCrypto AES-GCM 256-bit local API-key vault"],
    ["SPA 정적 호스팅 (Vercel 배포)", "Static SPA hosting (Vercel deploy)"],
    ["Downloads/\n└── suno_prompt_manager/\n    ├── preset/\n    │   ├── all_presets_<ISO-ts>.json    ← 📤 JSON 내보내기 (전체)\n    │   └── <프리셋명>.json              ← 💾 파일 (카드별)\n    │\n    └── <앨범 제목>/\n        ├── album.json                    ← 전체 구조 JSON\n        ├── 01_<트랙 제목>.txt            ← 트랙별 Style+구조+가사\n        ├── 02_<트랙 제목>.txt\n        └── ... (총 12 .txt)", "Downloads/\n└── suno_prompt_manager/\n    ├── preset/\n    │   ├── all_presets_<ISO-ts>.json    ← 📤 Export JSON (all)\n    │   └── <preset-name>.json           ← 💾 File (per card)\n    │\n    └── <album-title>/\n        ├── album.json                    ← full structure JSON\n        ├── 01_<track-title>.txt          ← per-track Style + structure + lyrics\n        ├── 02_<track-title>.txt\n        └── ... (12 .txt total)"],
    ["로 브라우저에 저장", "is stored in the browser"],
    ["안에 보관 →", "stored inside →"],
    ["localStorage 에만 저장 · 서버 전송 0건", "stored only in localStorage · zero server transmission"],
    ["다음 실행부터 디바이스 키가 자동 로드되어", "From the next launch the device key auto-loads, so"],
    ["별도 암호 입력 없이 즉시 사용 가능", "you can use it immediately without entering a passphrase"],
    ["— 200 댄스 스타일 가이드 + 8 카테고리 × 210 태그 조합기", "— 200-style dance guide + 8 categories × 210 tag composer"],
    ["이 도구는 Suno AI 와 무관한", "This tool is"],
    ["비공식 보조 도구", "an unofficial helper"],
    ["입니다. 아티스트명은 음악 스타일 분류 참고용이며 어떠한 저작권도 침해하지 않습니다. 생성된 음악의 권리는 Suno 의 이용약관에 따릅니다.", ", unrelated to Suno AI. Artist names are reference labels for music-style classification and do not infringe any copyright. Rights to generated music follow Suno's terms of service."],
    ["제작 —", "Made by —"],
    ["메시지", "message"],
    ["Downloads/\n└── suno_prompt_manager/\n    ├── preset/\n    │   ├── all_presets_&lt;ISO-ts&gt;.json    ← 📤 JSON 내보내기 (전체)\n    │   └── &lt;프리셋명&gt;.json              ← 💾 파일 (카드별)\n    │\n    └── &lt;앨범 제목&gt;/\n        ├── album.json                    ← 전체 구조 JSON\n        ├── 01_&lt;트랙 제목&gt;.txt            ← 트랙별 Style+구조+가사\n        ├── 02_&lt;트랙 제목&gt;.txt\n        └── ... (총 12 .txt)", "Downloads/\n└── suno_prompt_manager/\n    ├── preset/\n    │   ├── all_presets_&lt;ISO-ts&gt;.json    ← 📤 Export JSON (all)\n    │   └── &lt;preset-name&gt;.json          ← 💾 File (per card)\n    │\n    └── &lt;album-title&gt;/\n        ├── album.json                    ← full structure JSON\n        ├── 01_&lt;track-title&gt;.txt         ← per-track Style + structure + lyrics\n        ├── 02_&lt;track-title&gt;.txt\n        └── ... (12 .txt total)"],
    // Guide-tab batch 2
    ['장르별 적정 BPM 범위', 'Recommended BPM range per genre'],
    ['장르별 적정 BPM', 'recommended BPM per genre'],
    ['적정 BPM 범위', 'recommended BPM range'],
    ['적정 BPM', 'recommended BPM'],
    ['적정', 'recommended'],
    ['BPM 범위', 'BPM range'],
    ['감성 인디 붐, 스트리밍 시대', 'Sensitive-indie boom, streaming era'],
    ['감성 인디', 'sensitive indie'],
    ['감성', 'sensitive'],
    ['붐', 'boom'],
    ['스트리밍 시대', 'streaming era'],
    ['스트리밍', 'streaming'],
    ['한드/한영 OST 전성기', 'K-drama / English K-pop OST golden era'],
    ['한드/한영 OST', 'K-drama / Eng K-pop OST'],
    ['한드', 'K-drama'],
    ['한영', 'Korean-English'],
    ['미스/미스터트롯 신드롬', 'Miss / Mister Trot syndrome'],
    ['미스터트롯', 'Mister Trot'],
    ['신드롬', 'syndrome'],
    ['복사 가능한 표준 템플릿', 'Copy-paste-ready standard template'],
    ['복사 가능한', 'copy-paste-ready'],
    ['복사 가능', 'copyable'],
    ['복사', 'copy'],
    ['가능한', 'available'],
    ['표준 템플릿', 'standard template'],
    ['2026년 글로벌 스트리밍 데이터 기준 인기 장르', 'Most-popular genres per 2026 global streaming data'],
    ['2026년 글로벌 스트리밍 데이터', '2026 global streaming data'],
    ['글로벌 스트리밍 데이터', 'global streaming data'],
    ['데이터', 'data'],
    ['기준', 'based on'],
    ['일본 음악', 'Japanese music'],
    ['일본 대중음악과 애니메이션 OST', 'Japanese popular music and anime OST'],
    ['일본 대중음악', 'Japanese popular music'],
    ['대중음악', 'popular music'],
    ['애니메이션 OST', 'anime OST'],
    ['애니메이션', 'anime'],
    ['인도 음악', 'Indian music'],
    ['발리우드와 인도 전통 음악', 'Bollywood and Indian traditional music'],
    ['인도 전통 음악', 'Indian traditional music'],
    ['브라질 음악', 'Brazilian music'],
    ['브라질 음악의 다양성', 'Diversity of Brazilian music'],
    ['의 다양성', '\'s diversity'],
    ['다양성', 'diversity'],
    ['멕시코 음악', 'Mexican music'],
    ['마리아치와 모던 멕시칸', 'Mariachi and modern Mexican'],
    ['모던 멕시칸', 'modern Mexican'],
    ['멕시칸', 'Mexican'],
    ['아일랜드, 중동, 남아공 등', 'Ireland, Middle East, South Africa, etc.'],
    ['특수 용도 음악', 'Special-use music'],
    ['특수 용도', 'special-use'],
    ['용도', 'use'],
    ['잘 작동하는 패턴 vs 안 되는 것', 'Patterns that work vs ones that don\'t'],
    ['잘 작동하는 패턴', 'patterns that work'],
    ['작동하는 패턴', 'working pattern'],
    ['vs 안 되는 것', 'vs what doesn\'t'],
    ['안 되는 것', 'what doesn\'t work'],
    ['지역별 핵심 악기 카탈로그', 'Regional core-instrument catalog'],
    ['지역별 핵심 악기', 'regional core instruments'],
    ['핵심 악기', 'core instruments'],
    ['악기 카탈로그', 'instrument catalog'],
    ['카탈로그', 'catalog'],
    ['지역별', 'regional'],
    ['20세기 초반부터 2020년대까지 각 시대 정의 장르', 'Era-defining genres from the early 20th century to the 2020s'],
    ['20세기 초반부터 2020년대까지', 'from the early 20th century to the 2020s'],
    ['20세기 초반부터', 'from the early 20th century'],
    ['20세기 초반', 'early 20th century'],
    ['20세기', '20th century'],
    ['초반부터', 'from the early'],
    ['2020년대까지', 'to the 2020s'],
    ['각 시대 정의 장르', 'era-defining genres'],
    ['각 시대', 'each era'],
    ['각', 'each'],
    ['시대 정의 장르', 'era-defining genres'],
    ['재즈의 탄생과 라디오 보급', 'Birth of jazz and the spread of radio'],
    ['재즈의 탄생', 'birth of jazz'],
    ['의 탄생', '\'s birth'],
    ['탄생', 'birth'],
    ['빅밴드 전성기와 델타 블루스', 'Big-band golden era and Delta Blues'],
    ['빅밴드 전성기와', 'big-band golden era and'],
    ['재즈 발전과 전후 낭만', 'Jazz develops and post-war romance'],
    ['재즈 발전과', 'Jazz develops and'],
    ['전후', 'post-war'],
    ['발전과', 'develops and'],
    ['한계점과 주의사항', 'Limits and caveats'],
    ['한계점과', 'limits and'],
    ['limits과 caveats', 'limits and caveats'],
    ['2020s - Current Era (현재)', '2020s - Current Era (Now)'],
    ['(현재)', '(Now)'],
    ['현재', 'Now'],
    ['2010년대 한국 인디 / 감성 음악 (아이유/10cm/볼빨간사춘기)', '2010s Korean Indie / Sensitive music (IU / 10cm / Bolbbalgan4)'],
    ['2010년대 한국 인디', '2010s Korean Indie'],
    ['2010년대 후반 트로트 부흥 (송가인/임영웅)', 'Late-2010s Trot Revival (Song Ga-in / Lim Young-woong)'],
    ['2010년대 후반', 'Late 2010s'],
    ['J-POP / J-ROCK / ANIME (일본 음악)', 'J-POP / J-ROCK / ANIME (Japanese music)'],
    ['INDIAN / BOLLYWOOD (인도 음악)', 'INDIAN / BOLLYWOOD (Indian music)'],
    ['BRAZILIAN (브라질 음악)', 'BRAZILIAN (Brazilian music)'],
    ['MEXICAN (멕시코 음악)', 'MEXICAN (Mexican music)'],
    ['기타 월드 뮤직', 'Other world music'],
    // Guide-tab batch (section banners + headings)
    ['세계인기장르', 'World popular genres'],
    ['시대별세계인기장르', 'World popular genres by era'],
    ['Sheet3_세계인기장르', 'Sheet3 World popular genres'],
    ['Sheet4_시대별세계인기장르', 'Sheet4 World popular genres by era'],
    ['구조 태그', 'Structure tags'],
    ['장르 태그', 'Genre tags'],
    ['템포 태그', 'Tempo tags'],
    ['보컬 태그', 'Vocal tags'],
    ['악기 태그', 'Instrument tags'],
    ['분위기/에너지 태그', 'Mood / energy tags'],
    ['음향 효과 태그', 'Sound-effects tags'],
    ['가사 프롬프트 팁', 'Lyric-prompt tips'],
    ['음악 구조/작곡', 'Music structure / composition'],
    ['Best Practices & Common Mistakes', 'Best Practices & Common Mistakes'],
    ['필드 사용 구분', 'Field-usage distinction'],
    ['한국 음악 공통 원칙', 'Korean-music common rules'],
    ['한국어 가사 작성 실전 팁', 'Korean-lyric writing tips'],
    ['한국 가요 장르별 BPM 가이드', 'Korean-pop genre BPM guide'],
    ['한국 가요에서 잘 안 되는 것들', 'Things that don\'t work well in Korean pop'],
    ['시대별 한국 가요 흐름 개요', 'Korean-pop flow by era — overview'],
    ['곡의 섹션을 정의하는 가장 강력한 태그. Lyrics 필드에 입력', 'The most powerful tags that define a song\'s sections. Enter in the Lyrics field.'],
    ['Style 필드에 입력 - 곡 전체 분위기 결정', 'Enter in the Style field — sets the song\'s overall mood.'],
    ['템포와 그루브 패턴 지정. BPM 정확한 락은 불가능', 'Specifies tempo and groove pattern. BPM cannot be locked exactly.'],
    ['보컬 캐릭터 제어 - Style은 전반, Lyrics는 섹션별', 'Controls vocal character — Style for the whole song, Lyrics per section.'],
    ['악기 지정 - 2~4개로 제한해야 효과적', 'Designate instruments — limit to 2-4 for best effect.'],
    ['곡의 감정적 캐릭터와 강도 결정', 'Sets the song\'s emotional character and intensity.'],
    ['가사 박스에 위치 지정해서 넣는 게 핵심', 'Place these in the Lyrics box at the exact position.'],
    ['가사 작성과 관련된 특수 태그/팁', 'Special tags / tips related to lyric writing.'],
    ['음악 이론 기반 태그', 'Music-theory-based tags.'],
    ['핵심 공식과 실수 방지', 'Core formulas and mistakes to avoid.'],
    ['어떤 태그를 어디에 넣을지 명확히', 'Decide clearly which tags go where.'],
    ['모든 한국 음악에 적용되는 핵심 규칙', 'Core rules that apply to all Korean music.'],
    ['이미자, 남인수, 현인 스타일', 'Lee Mi-ja, Nam In-su, Hyun In style.'],
    ['한국 재즈 가요 시대', 'The Korean jazz-pop era.'],
    ['한국 록의 시작점', 'The starting point of Korean rock.'],
    ['명동 쉘부르 시대, 통기타 시대', 'Myeong-dong Chebourg era, acoustic-guitar era.'],
    ['아파트, 제3한강교, 빙글빙글', 'Apateu, 3rd-Han-River Bridge, Binggeul-Binggeul.'],
    ['아파트, 샴푸의 요정 - 도시적 사운드', 'Apateu, Shampoo Fairy — urban sound.'],
    ['광화문 연가, 가로수 그늘 아래 서면', 'Gwanghwamun Yeon-ga, Standing under the row of trees.'],
    ['리듬 속의 그 춤을, 어젯밤 이야기', 'That Dance in the Rhythm, Last Night\'s Story.'],
    ['행진, 어쩌다 마주친 그대 - 한국 록 황금기', 'March, Eojjeoda Majuchin Geudae — Korean rock golden age.'],
    ['신사동 그 사람, 다 함께 차차차', 'Sinsa-dong Geu Saram, Da Hamkke Cha-cha-cha.'],
    ['시대별 악기/녹음 특징 비교', 'Per-era instrument / recording-characteristic comparison.'],
    ['시대 키워드 반영도', 'Era-keyword adoption rate.'],
    ['시대에 맞는 어휘와 스타일', 'Era-appropriate vocabulary and style.'],
    ['복사해서 바로 사용 가능한 템플릿', 'Templates that can be copied and used immediately.'],
    ['잘 안 되는 것과 효과적 트릭', 'What doesn\'t work + effective tricks.'],
    ['시대/장르별 적정 BPM', 'Recommended BPM by era / genre.'],
    ['서태지 혁명, 발라드 황금기, 댄스 가요 다양화', 'Seo Taiji revolution, ballad golden age, dance-pop diversification.'],
    ['발라드 르네상스 2.0', 'Ballad renaissance 2.0.'],
    ['인디 씬 황금기, 홍대 라이브', 'Indie-scene golden age, Hongdae live.'],
    ['한국 힙합 주류 진입', 'Korean hip-hop enters the mainstream.'],
    ['K-Pop 글로벌 정점, BTS 세계 정복', 'K-Pop global peak, BTS conquers the world.'],
    ['Lyrical Prompt Tips (가사 프롬프트 팁)', 'Lyrical Prompt Tips'],
    ['Musical Structure & Composition (음악 구조/작곡)', 'Musical Structure & Composition'],
    ['Style Field vs Lyrics Field (필드 사용 구분)', 'Style Field vs Lyrics Field'],
    ['1950년대 재즈 가요 (패티김/현인 스타일)', '1950s Jazz K-pop (Patti Kim / Hyun In style)'],
    ['1970년대 통기타 포크 (송창식/양희은/김민기)', '1970s Acoustic-Guitar Folk (Song Chang-sik / Yang Hee-eun / Kim Min-ki)'],
    ['70-80년대 디스코 가요 (윤수일/혜은이)', '70s-80s Disco K-pop (Yoon Soo-il / Hye Eun-i)'],
    ['1980년대 한국 시티팝 (윤수일/빛과 소금/김현철)', '1980s Korean City Pop (Yoon Soo-il / Bit-gwa Sogeum / Kim Hyun-chul)'],
    ['1980년대 팝 발라드 (이문세/이영훈)', '1980s Pop Ballad (Lee Mun-sae / Lee Young-hoon)'],
    ['1980년대 댄스 가요 (김완선/소방차/박남정)', '1980s Dance K-pop (Kim Wan-sun / Sobangcha / Park Nam-jung)'],
    ['1980년대 한국 록 (들국화/송골매/시나위)', '1980s Korean Rock (Deulgukhwa / Songgolmae / Sinawe)'],
    ['1980년대 후반 트로트 부흥기 (주현미/현철/태진아)', 'Late-1980s Trot Revival (Joo Hyun-mi / Hyun Chul / Tae Jin-ah)'],
    ['시대별 핵심 차이점 비교표', 'Per-era key-difference comparison'],
    ['시대 키워드 효과성', 'Era-keyword effectiveness'],
    ['시대별 가사 작성 팁', 'Per-era lyric-writing tips'],
    ['시대별 통합 골든 템플릿', 'Per-era unified golden template'],
    ['90년대 이전 가요 주의사항', 'Pre-1990s K-pop caveats'],
    ['주의사항', 'caveats'],
    ['1990년대 한국 가요 (가요 르네상스)', '1990s Korean Pop (K-pop renaissance)'],
    ['가요 르네상스', 'K-pop renaissance'],
    ['르네상스', 'renaissance'],
    ['2000년대 한국 발라드 / R&B (성시경/박효신/휘성/거미)', '2000s Korean Ballad / R&B (Sung Si-kyung / Park Hyo-shin / Wheesung / Gummy)'],
    ['2000년대 한국 인디 / 홍대 음악 (장기하/브로콜리너마저/검정치마)', '2000s Korean Indie / Hongdae music (Jang Kiha / Broccoli, You Too? / The Black Skirts)'],
    ['홍대 음악', 'Hongdae music'],
    ['홍대', 'Hongdae'],
    ['2000년대 한국 힙합 (에픽하이/드렁큰타이거/다이나믹듀오)', '2000s Korean Hip-hop (Epik High / Drunken Tiger / Dynamic Duo)'],
    ['2010년대 3세대 K-Pop (BTS/EXO/TWICE/Red Velvet/MAMAMOO)', '2010s 3rd-gen K-Pop (BTS / EXO / TWICE / Red Velvet / MAMAMOO)'],
    ['2010년대 OST 골든 에이지 (드라마/영화)', '2010s OST Golden Age (Drama / Film)'],
    ['OST 골든 에이지', 'OST Golden Age'],
    ['골든 에이지', 'Golden Age'],
    ['드라마/영화', 'Drama / Film'],
    ['영화', 'film'],
    ['시대별 통합 골든 템플릿 (1990s ~ 2010s)', 'Per-era unified golden template (1990s ~ 2010s)'],
    ['2026 글로벌 인기 장르 TOP 9 (개요)', '2026 Global Top-9 Popular Genres (Overview)'],
    ['2026 글로벌 인기 장르 TOP 9', '2026 Global Top-9 Popular Genres'],
    ['글로벌 인기 장르', 'Global popular genres'],
    ['개요', 'Overview'],
    ['OTHER WORLD MUSIC (기타 월드 뮤직)', 'OTHER WORLD MUSIC'],
    ['기타 월드 뮤직', 'Other world music'],
    ['월드 뮤직', 'World music'],
    ['뮤직', 'music'],
    ['특수 카테고리 (게임/시네마틱/앰비언트/시즌)', 'Special categories (Game / Cinematic / Ambient / Season)'],
    ['특수 카테고리', 'Special categories'],
    ['카테고리', 'category'],
    ['게임', 'Game'],
    ['게임/시네마틱/앰비언트/시즌', 'Game / Cinematic / Ambient / Season'],
    ['시즌', 'Season'],
    ['글로벌 장르 핵심 인사이트', 'Global genre core insights'],
    ['인사이트', 'insight'],
    ['글로벌 장르', 'Global genres'],
    ['글로벌 장르 BPM 빠른 참고표', 'Global-genre BPM quick reference'],
    ['BPM 빠른 참고표', 'BPM quick reference'],
    ['빠른 참고표', 'quick reference'],
    ['참고표', 'reference table'],
    ['참고', 'reference'],
    ['글로벌 시그니처 악기 사전', 'Global signature-instrument dictionary'],
    ['시그니처 악기 사전', 'signature-instrument dictionary'],
    ['악기 사전', 'instrument dictionary'],
    ['사전', 'dictionary'],
    ['글로벌 장르 통합 골든 템플릿', 'Global-genre unified golden template'],
    ['시대별 세계 음악 흐름 개요', 'Per-era world-music flow — overview'],
    ['세계 음악 흐름', 'world-music flow'],
    ['세계 음악', 'world music'],
    ['세계', 'world'],
    ['음악 흐름', 'music flow'],
    ['흐름 개요', 'flow — overview'],
    ['시대별 핵심 키워드 효과성', 'Per-era core-keyword effectiveness'],
    ['핵심 키워드 효과성', 'core-keyword effectiveness'],
    ['효과성', 'effectiveness'],
    ['정확한 연도 + 장르 조합의 힘', 'Power of exact year + genre combination'],
    ['연도 + 장르 조합의 힘', 'year + genre combination power'],
    ['조합의 힘', 'combination power'],
    ['힘', 'power'],
    ['잘 안 되는 시대 표현', 'Era expressions that don\'t work well'],
    ['시대 표현', 'era expressions'],
    ['시대별 BPM 빠른 참고표', 'Per-era BPM quick reference'],
    ['시대별 대표 아티스트 영감 키워드', 'Per-era signature-artist inspiration keywords'],
    ['대표 아티스트 영감 키워드', 'signature-artist inspiration keywords'],
    ['아티스트 영감 키워드', 'artist inspiration keywords'],
    ['영감 키워드', 'inspiration keywords'],
    ['시대별 가사 어휘/주제 가이드', 'Per-era lyric vocabulary / theme guide'],
    ['가사 어휘/주제 가이드', 'lyric vocabulary / theme guide'],
    ['가사 어휘', 'lyric vocabulary'],
    ['어휘/주제', 'vocabulary / theme'],
    ['주제 가이드', 'theme guide'],
    ['핵심 규칙', 'core rules'],
    ['규칙', 'rules'],
    ['한국 힙합과 랩', 'Korean hip-hop and rap'],
    ['한국 힙합', 'Korean Hip-hop'],
    ['어린이 노래와 찬양곡', 'Children\'s songs and praise songs'],
    ['어린이 노래', 'children\'s songs'],
    ['어린이 노래와', 'children\'s songs and'],
    ['찬양곡', 'praise songs'],
    ['어린이', 'child'],
    ['잘 부르게 만드는 가사 작성법', 'How to write singable lyrics'],
    ['잘 부르게 만드는', 'singable'],
    ['가사 작성법', 'lyric-writing method'],
    ['작성법', 'writing method'],
    ['주의해야 할 한계점', 'Limits to be aware of'],
    ['주의해야 할', 'to be aware of'],
    ['한계점', 'limits'],
    ['1950~80년대 한국 가요 흐름', 'Korean-pop flow 1950s-1980s'],
    ['디지털 사운드, MTV, 신스팝의 폭발', 'Digital sound, MTV, synth-pop explosion'],
    ['디지털 사운드', 'digital sound'],
    ['디스코, 펑크, 펑크록, 프록의 시대', 'Disco, funk, punk-rock, prog-rock era'],
    ['EDM 정점, 트랩 부상, 인디 폴드', 'EDM peak, trap rises, indie folds'],
    ['폴드', 'folds'],
    ['TikTok 시대, 글로벌화, 하이퍼팝', 'TikTok era, globalisation, hyperpop'],
    ['특정 연도 + 장르가 가장 강력함', 'Specific year + genre is most powerful'],
    ['한 단어로 시대 잡기', 'Catch an era with one word'],
    ['한 단어로', 'with one word'],
    ['잡기', 'catch'],
    ['비교적 잘 작동하는 인플루언스 표현', 'Influence expressions that work reasonably well'],
    ['비교적 잘 작동하는', 'reasonably well-working'],
    ['인플루언스', 'influence'],
    ['시대에 맞는 가사 주제와 어휘', 'Era-appropriate lyric themes and vocabulary'],
    ['가사 주제와 어휘', 'lyric themes and vocabulary'],
    ['6레이어 공식 적용 예시', '6-layer formula application examples'],
    ['6레이어 공식', '6-layer formula'],
    ['레이어 공식', 'layer formula'],
    ['적용 예시', 'application examples'],
    ['입력', 'enter'],
    ['결정', 'decide'],
    ['정의', 'definition'],
    ['배경', 'background'],
    ['정복', 'conquest'],
    ['진입', 'entry'],
    ['폴드', 'fold'],
    ['Dog요', 'overview'],
    ['개요', 'overview'],
    ['4Doglimit to', 'limit to 4'],
    ['효과', 'effect'],
    ['올림', 'up'],
    ['어쩌다 마주친 그대', 'Eojjeoda Majuchin Geudae'],
    ['어쩌다', 'by chance'],
    ['마주친', 'met'],
    ['그대', 'you'],
    ['행진', 'march'],
    ['신사동 그 사람', 'Sinsa-dong Geu Saram'],
    ['신사동', 'Sinsa-dong'],
    ['그 사람', 'that person'],
    ['다 함께 차차차', 'Da Hamkke Cha-cha-cha'],
    ['다 함께', 'all together'],
    ['차차차', 'cha-cha-cha'],
    ['어젯밤 이야기', 'Last Night\'s Story'],
    ['어젯밤', 'last night'],
    ['리듬 속의 그 춤을', 'That Dance in the Rhythm'],
    ['리듬 속의', 'within rhythm'],
    ['속의', 'within'],
    ['그 춤을', 'that dance'],
    ['춤', 'dance'],
    ['광화문 연가', 'Gwanghwamun Yeon-ga'],
    ['광화문', 'Gwanghwamun'],
    ['연가', 'Yeon-ga'],
    ['가로수 그늘 아래 서면', 'Standing under the row of trees'],
    ['가로수', 'row of trees'],
    ['그늘 아래', 'under the shade'],
    ['그늘', 'shade'],
    ['아래', 'under'],
    ['서면', 'standing'],
    ['아파트', 'Apateu'],
    ['샴푸의 요정', 'Shampoo Fairy'],
    ['샴푸', 'shampoo'],
    ['요정', 'fairy'],
    ['제3한강교', '3rd Han-River Bridge'],
    ['빙글빙글', 'Binggeul-Binggeul'],
    ['명동 쉘부르', 'Myeong-dong Chebourg'],
    ['명동', 'Myeong-dong'],
    ['쉘부르', 'Chebourg'],
    ['통기타 시대', 'Acoustic-guitar era'],
    ['재즈 가요 시대', 'Jazz K-pop era'],
    ['19Late-80s', 'Late 1980s'],
    ['시대 시작', 'era start'],
    // Tag-tab batch 9 (auto-batch)
    ['120 BPM 펀자비 방그라', '120 BPM Punjabi Bhangra'],
    ['펀자비 방그라', 'Punjabi Bhangra'],
    ['펀자비', 'Punjabi'],
    ['방그라', 'Bhangra'],
    ['펀자비 드럼', 'Punjabi drums'],
    ['100 BPM 보사노바', '100 BPM Bossa Nova'],
    ['보사노바', 'Bossa Nova'],
    ['130 BPM 바일레 펑크', '130 BPM Baile Funk'],
    ['바일레 펑크', 'Baile Funk'],
    ['바일레', 'Baile'],
    ['100 BPM 삼바', '100 BPM Samba'],
    ['삼바', 'Samba'],
    ['120 BPM 마리아치', '120 BPM Mariachi'],
    ['마리아치', 'Mariachi'],
    ['110 BPM 코리도 툼바도', '110 BPM Corrido Tumbado'],
    ['코리도 툼바도', 'Corrido Tumbado'],
    ['코리도', 'Corrido'],
    ['툼바도', 'Tumbado'],
    ['105 BPM 콰이토', '105 BPM Kwaito'],
    ['콰이토', 'Kwaito'],
    ['110 BPM 아랍 팝', '110 BPM Arabic Pop'],
    ['아랍 팝', 'Arabic Pop'],
    ['아랍', 'Arabic'],
    ['120 BPM 플라멩코', '120 BPM Flamenco'],
    ['플라멩코', 'Flamenco'],
    ['110 BPM 트레일러', '110 BPM trailer'],
    ['트레일러', 'trailer'],
    ['예: Latin Trap, K-R&B 식', 'e.g. Latin Trap / K-R&B style'],
    ['시대성 강화', 'Era reinforcement'],
    ['시대성', 'era-specificity'],
    ['강화', 'reinforcement'],
    ['지역 정체성 강화', 'Regional-identity reinforcement'],
    ['지역 정체성', 'regional identity'],
    ['정체성', 'identity'],
    ['지역', 'regional'],
    ['언어 출력 통제', 'Language-output control'],
    ['언어 출력', 'language output'],
    ['출력', 'output'],
    ['통제', 'control'],
    ['V5도 정확 락 불가', 'V5 also can\'t lock exactly'],
    ['V5도', 'V5 also'],
    ['정확 락', 'exact lock'],
    ['혼탁한 결과', 'Muddy result'],
    ['혼탁한', 'muddy'],
    ['슬로우 그루브', 'Slow groove'],
    ['슬로우', 'Slow'],
    ['하이햇 빠름', 'Hi-hat fast'],
    ['하이햇', 'Hi-hat'],
    ['미디엄 템포', 'Medium tempo'],
    ['미디엄', 'Medium'],
    ['다양한 범위', 'Various range'],
    ['다양한', 'various'],
    ['다양', 'diverse'],
    ['미드템포 바운스', 'Mid-tempo bounce'],
    ['미드템포', 'mid-tempo'],
    ['바운스', 'bounce'],
    ['미드', 'mid'],
    ['익스트림', 'Extreme'],
    ['빠르고 에너지틱', 'Fast and energetic'],
    ['에너지틱', 'energetic'],
    ['슬로우 블루스', 'Slow Blues'],
    ['인도 손드럼', 'Indian hand drums'],
    ['손드럼', 'hand drums'],
    ['손', 'hand'],
    ['남인도 현악기', 'South Indian strings'],
    ['남인도', 'South Indian'],
    ['일본 큰북', 'Japanese big drum'],
    ['큰북', 'big drum'],
    ['큰', 'big'],
    ['일본 거문고', 'Japanese geomungo'],
    ['거문고', 'Geomungo'],
    ['일본 대나무 피리', 'Japanese bamboo flute'],
    ['대나무 피리', 'bamboo flute'],
    ['대나무', 'bamboo'],
    ['피리', 'flute'],
    ['중국 2현 바이올린', 'Chinese 2-string violin'],
    ['2현', '2-string'],
    ['중국 거문고', 'Chinese guqin'],
    ['중국 류트', 'Chinese pipa'],
    ['류트', 'lute'],
    ['한국 거문고', 'Korean geomungo'],
    ['플라멩코/라틴', 'Flamenco / Latin'],
    ['플라멩코 박스 드럼', 'Flamenco cajón'],
    ['박스 드럼', 'cajón'],
    ['박스', 'box'],
    ['삼바 시그니처', 'Samba signature'],
    ['삼바 드럼', 'Samba drums'],
    ['삼바 베이스 드럼', 'Samba bass drum'],
    ['마리아치 베이스', 'Mariachi bass'],
    ['마리아치 기타', 'Mariachi guitar'],
    ['노르테뇨 12현', 'Norteño 12-string'],
    ['12현', '12-string'],
    ['아랍 류트', 'Arabic oud'],
    ['아랍 거문고', 'Arabic qanun'],
    ['아일랜드 피리', 'Irish whistle'],
    ['아일랜드', 'Irish'],
    ['V5+에서 가장 잘 작동', 'Works best in V5+'],
    ['V5+에서 가장 잘', 'best in V5+'],
    ['가장 잘 작동', 'works best'],
    ['재즈 시대 시작, 라디오 보급', 'Start of the Jazz era, radio spreads'],
    ['재즈 시대 시작', 'start of the Jazz era'],
    ['재즈 시대', 'Jazz era'],
    ['재즈', 'Jazz'],
    ['시작', 'start'],
    ['라디오 보급', 'radio spreads'],
    ['라디오', 'radio'],
    ['보급', 'spread'],
    ['빅밴드 전성기, 대공황 시대', 'Big-band peak, Great Depression era'],
    ['빅밴드 전성기', 'Big-band peak'],
    ['대공황 시대', 'Great Depression era'],
    ['대공황', 'Great Depression'],
    ['재즈 발전, 전쟁 후 낭만', 'Jazz develops, post-war romance'],
    ['재즈 발전', 'Jazz develops'],
    ['발전', 'develops'],
    ['전쟁 후 낭만', 'post-war romance'],
    ['전쟁 후', 'post-war'],
    ['록앤롤 탄생, 청년문화 시작', 'Rock-and-Roll born, youth culture begins'],
    ['록앤롤 탄생', 'Rock-and-Roll born'],
    ['록앤롤', 'Rock and Roll'],
    ['탄생', 'born'],
    ['청년문화 시작', 'youth culture begins'],
    ['청년문화', 'youth culture'],
    ['청년', 'youth'],
    ['문화', 'culture'],
    ['비틀즈, 사회 혁명', 'The Beatles, social revolution'],
    ['사회 혁명', 'social revolution'],
    ['사회', 'social'],
    ['혁명', 'revolution'],
    ['댄스/디스코 폭발, 다양화', 'Dance / disco explosion, diversification'],
    ['댄스/디스코', 'Dance / Disco'],
    ['폭발', 'explosion'],
    ['다양화', 'diversification'],
    ['얼터너티브 부상, 힙합 주류화', 'Alternative rises, hip-hop goes mainstream'],
    ['얼터너티브 부상', 'alternative rises'],
    ['힙합 주류화', 'hip-hop goes mainstream'],
    ['주류화', 'going mainstream'],
    ['주류', 'mainstream'],
    ['TikTok 시대, 글로벌화', 'TikTok era, globalisation'],
    ['TikTok 시대', 'TikTok era'],
    ['글로벌화', 'globalisation'],
    ['110 BPM 딕시랜드', '110 BPM Dixieland'],
    ['딕시랜드', 'Dixieland'],
    ['100 BPM 래그타임', '100 BPM Ragtime'],
    ['래그타임', 'Ragtime'],
    ['105 BPM 보드빌', '105 BPM Vaudeville'],
    ['보드빌', 'Vaudeville'],
    ['뉴욕 송라이팅 거리', 'New York songwriting district'],
    ['송라이팅 거리', 'songwriting district'],
    ['송라이팅', 'songwriting'],
    ['거리', 'street'],
    ['80 BPM 델타 블루스', '80 BPM Delta Blues'],
    ['델타 블루스', 'Delta Blues'],
    ['델타', 'Delta'],
    ['댄스홀 분위기', 'Dancehall atmosphere'],
    ['댄스홀', 'Dancehall'],
    ['델타 블루스 분위기', 'Delta Blues atmosphere'],
    ['140 BPM 점프 블루스', '140 BPM Jump Blues'],
    ['점프 블루스', 'Jump Blues'],
    ['80 BPM 크루너', '80 BPM Crooner'],
    ['크루너', 'Crooner'],
    ['40년대 인기 곡', '40s popular songs'],
    ['인기 곡', 'popular songs'],
    ['인기', 'popular'],
    ['120 BPM 록앤롤', '120 BPM Rock and Roll'],
    ['90 BPM 두왑', '90 BPM Doo-Wop'],
    ['두왑', 'Doo-Wop'],
    ['110 BPM 혼키통크', '110 BPM Honky-tonk'],
    ['혼키통크', 'Honky-tonk'],
    ['130 BPM 로커빌리', '130 BPM Rockabilly'],
    ['로커빌리', 'Rockabilly'],
    ['로커빌리 시그니처', 'Rockabilly signature'],
    ['50년대 청년문화', '50s youth culture'],
    ['로커빌리 베이스', 'Rockabilly bass'],
    ['130 BPM 영국 침공', '130 BPM British Invasion'],
    ['영국 침공', 'British Invasion'],
    ['침공', 'invasion'],
    ['130 BPM 서프록', '130 BPM Surf Rock'],
    ['서프록', 'Surf Rock'],
    ['서프', 'Surf'],
    ['비틀즈/리버풀 사운드', 'Beatles / Liverpool sound'],
    ['비틀즈/리버풀', 'Beatles / Liverpool'],
    ['리버풀', 'Liverpool'],
    ['디트로이트 소울', 'Detroit Soul'],
    ['디트로이트', 'Detroit'],
    ['뉴욕 포크 본거지', 'New York folk heartland'],
    ['뉴욕 포크', 'New York folk'],
    ['뉴욕', 'New York'],
    ['본거지', 'heartland'],
    ['105 BPM 펑크', '105 BPM Funk'],
    ['120 BPM 스타디움 록', '120 BPM Stadium Rock'],
    ['스타디움 록', 'Stadium Rock'],
    ['스타디움', 'Stadium'],
    ['180 BPM 펑크록', '180 BPM Punk Rock'],
    ['펑크록', 'Punk Rock'],
    ['복합 BPM 프록', 'Variable BPM Prog Rock'],
    ['복합 BPM', 'variable BPM'],
    ['복합', 'variable'],
    ['프록', 'Prog Rock'],
    ['100 BPM 요트 록', '100 BPM Yacht Rock'],
    ['요트 록', 'Yacht Rock'],
    ['요트', 'Yacht'],
    ['펑크 시그니처', 'Funk signature'],
    ['펑크 핵심 영향', 'Core funk influence'],
    ['핵심 영향', 'core influence'],
    ['130 BPM 뉴웨이브', '130 BPM New Wave'],
    ['뉴웨이브', 'New Wave'],
    ['140 BPM 헤어메탈', '140 BPM Hair Metal'],
    ['헤어메탈', 'Hair Metal'],
    ['헤어', 'Hair'],
    ['95 BPM 올드스쿨 힙합', '95 BPM Old-school Hip-hop'],
    ['올드스쿨 힙합', 'Old-school Hip-hop'],
    ['올드스쿨', 'Old-school'],
    ['75 BPM 콰이엇 스톰', '75 BPM Quiet Storm'],
    ['콰이엇 스톰', 'Quiet Storm'],
    ['콰이엇', 'Quiet'],
    ['스톰', 'Storm'],
    ['헤어메탈 본거지', 'Hair-metal heartland'],
    ['135 BPM 유로댄스', '135 BPM Eurodance'],
    ['유로댄스', 'Eurodance'],
    ['유로', 'Euro'],
    ['100 BPM 얼터록', '100 BPM Alt-rock'],
    ['얼터록', 'Alt-rock'],
    ['얼터', 'Alt'],
    ['그런지 본거지', 'Grunge heartland'],
    ['그런지', 'Grunge'],
    ['브릿팝 본거지', 'Britpop heartland'],
    ['브릿팝 시대 슬로건', 'Britpop-era slogan'],
    ['브릿팝', 'Britpop'],
    ['슬로건', 'slogan'],
    ['그런지 패션', 'Grunge fashion'],
    ['패션', 'fashion'],
    ['160 BPM 팝펑크', '160 BPM Pop-punk'],
    ['팝펑크', 'Pop-punk'],
    ['100 BPM 뉴메탈', '100 BPM Nu-metal'],
    ['뉴메탈', 'Nu-metal'],
    ['95 BPM 블링 R&B', '95 BPM Bling R&B'],
    ['블링 R&B', 'Bling R&B'],
    ['블링', 'Bling'],
    ['120 BPM 일렉트로클래시', '120 BPM Electroclash'],
    ['일렉트로클래시', 'Electroclash'],
    ['2000년대 초반', 'early 2000s'],
    ['초반', 'early'],
    ['팝펑크 페스티벌', 'Pop-punk festival'],
    ['2000년대 인기 차트', '2000s chart hits'],
    ['인기 차트', 'chart hits'],
    ['차트', 'chart'],
    ['50년대 록앤롤', '50s Rock and Roll'],
    ['느린 두왑', 'Slow Doo-Wop'],
    ['느린', 'slow'],
    ['펑크 그루브', 'Funk groove'],
    ['빠른 펑크', 'Fast Punk'],
    ['빠른', 'fast'],
    ['올드스쿨', 'Old-school'],
    ['팝펑크 빠름', 'Pop-punk fast'],
    ['베드룸 팝', 'Bedroom Pop'],
    ['베드룸', 'Bedroom'],
    ['크루너', 'Crooner'],
    ['로커빌리 시초', 'Rockabilly inception'],
    ['시초', 'inception'],
    ['서프 하모니', 'Surf harmony'],
    ['암울한 시대 정서', 'Bleak era mood'],
    ['암울한', 'bleak'],
    ['히피 시대 정서', 'Hippie-era mood'],
    ['히피', 'Hippie'],
    ['히피 시대', 'Hippie era'],
    ['다양한 정서', 'Various moods'],
    ['밀레니얼 정서', 'Millennial mood'],
    ['밀레니얼', 'Millennial'],
    ['시대 정서', 'era mood'],
    // Tag-tab batch 8 (auto-batch)
    ['808s, 하이햇', '808s, hi-hat'],
    ['Boom bap, 샘플링', 'Boom bap, sampling'],
    ['샘플링', 'sampling'],
    ['이난영, 남인수, 현인, 패티김', 'Lee Nan-young, Nam In-su, Hyun In, Patti Kim'],
    ['이미자, 펄시스터즈, 신중현', 'Lee Mi-ja, Pearl Sisters, Shin Jung-hyun'],
    ['송창식, 양희은, 김민기, 나훈아, 남진', 'Song Chang-sik, Yang Hee-eun, Kim Min-ki, Na Hoon-a, Nam Jin'],
    ['윤수일, 혜은이, 산울림', 'Yoon Soo-il, Hye Eun-i, Sanullim'],
    ['이문세, 조용필, 김완선, 들국화, 빛과 소금', 'Lee Mun-sae, Cho Yong-pil, Kim Wan-sun, Deulgukhwa, Bit-gwa Sogeum'],
    ['저질 라디오 톤', 'Low-quality radio tone'],
    ['저질', 'Low-quality'],
    ['아날로그 테이프 톤', 'Analog tape tone'],
    ['아날로그 테이프', 'Analog tape'],
    ['50년대 가요 특징', '50s K-pop characteristics'],
    ['신중현 시그니처 사운드', 'Shin Jung-hyun signature sound'],
    ['저비용 록', 'Low-budget rock'],
    ['저비용', 'low-budget'],
    ['80 BPM 가요제 스타일', '80 BPM Music-Festival style'],
    ['가요제 스타일', 'Music-Festival style'],
    ['가요제', 'Music Festival'],
    ['진솔한 보컬', 'Sincere vocals'],
    ['진솔한', 'sincere'],
    ['진솔', 'sincere'],
    ['120 BPM 디스코 가요', '120 BPM disco K-pop'],
    ['디스코 가요', 'disco K-pop'],
    ['가요', 'K-pop'],
    ['한국적 디스코', 'Korean disco'],
    ['한국적', 'Korean'],
    ['시티팝 뿌리', 'City-pop roots'],
    ['뿌리', 'roots'],
    ['브래스 스탭', 'Brass stabs'],
    ['브래스', 'Brass'],
    ['김완선 스타일', 'Kim Wan-sun style'],
    ['김완선', 'Kim Wan-sun'],
    ['115 BPM 트로트 부흥기', '115 BPM Trot revival era'],
    ['트로트 부흥기', 'Trot revival era'],
    ['부흥기', 'revival era'],
    ['하이브리드 베이스', 'Hybrid bass'],
    ['하이브리드', 'hybrid'],
    ['대표 드럼머신', 'Signature drum machine'],
    ['대표', 'signature'],
    ['벨팅 창법', 'Belting vocal style'],
    ['벨팅', 'Belting'],
    ['광택감 있는 80년대', 'Polished 80s'],
    ['광택감 있는', 'polished'],
    ['있는', 'with'],
    ['시대 구분 매우 효과적', 'Era separation is very effective'],
    ['시대 구분', 'era separation'],
    ['옛 매체 톤', 'Old-media tone'],
    ['옛 매체', 'old media'],
    ['매체', 'media'],
    ['옛', 'old'],
    ['시대 + 컨텍스트', 'Era + context'],
    ['컨텍스트', 'context'],
    ['연도 특정', 'Year specification'],
    ['필터링 가능성', 'Filtering possibility'],
    ['필터링', 'filtering'],
    ['가능성', 'possibility'],
    ['회사별 톤 불가', 'Per-label tone not possible'],
    ['회사별', 'per label'],
    ['회사', 'label'],
    ['옛 가요 어휘', 'Old K-pop vocabulary'],
    ['어휘', 'vocabulary'],
    ['시대 배경', 'Era background'],
    ['배경', 'background'],
    ['옛 가사 분위기', 'Old-lyric atmosphere'],
    ['옛 가사', 'old lyrics'],
    ['시대 어긋남', 'Era mismatch'],
    ['어긋남', 'mismatch'],
    ['시대감 깨짐', 'Period feel broken'],
    ['깨짐', 'broken'],
    ['진솔한 가사', 'Sincere lyrics'],
    ['포크 표준 구조', 'Folk standard structure'],
    ['시티팝 표준 구조', 'City-pop standard structure'],
    ['발라드 표준 구조', 'Ballad standard structure'],
    ['표준 구조', 'standard structure'],
    ['표준', 'standard'],
    ['V5도 약간 스테레오감 섞임', 'Even V5 has slight stereo blend'],
    ['V5도 약간', 'V5 also slightly'],
    ['스테레오감', 'stereo feel'],
    ['표면적으로만 적용', 'Surface-level only application'],
    ['표면적으로만', 'surface-level only'],
    ['표면적', 'surface-level'],
    ['적용', 'application'],
    ['마이크별 톤 불가', 'Per-mic tone not possible'],
    ['마이크별', 'per mic'],
    ['불가', 'not possible'],
    ['반복으로 강조', 'Emphasis via repetition'],
    ['반복으로', 'via repetition'],
    ['반복', 'repetition'],
    ['시대감 살리기', 'Evoke period feel'],
    ['현대적 요소 차단', 'Block modern elements'],
    ['현대적 요소', 'modern elements'],
    ['현대적', 'modern'],
    ['차분한 트로트', 'Calm Trot'],
    ['차분한', 'calm'],
    ['느리고 진솔', 'Slow and sincere'],
    ['흥겨운 디스코', 'Lively disco'],
    ['흥겨운', 'lively'],
    ['70 BPM 자작 발라드', '70 BPM self-composed ballad'],
    ['자작 발라드', 'self-composed ballad'],
    ['자작', 'self-composed'],
    ['솔리드/듀스 시그니처', 'Solid / Deux signature'],
    ['솔리드/듀스', 'Solid / Deux'],
    ['솔리드', 'Solid'],
    ['듀스', 'Deux'],
    ['신승훈/이승환 풍', 'Shin Seung-hun / Lee Seung-hwan style'],
    ['신승훈/이승환', 'Shin Seung-hun / Lee Seung-hwan'],
    ['이승환', 'Lee Seung-hwan'],
    ['115 BPM 핑클', '115 BPM Fin.K.L'],
    ['핑클', 'Fin.K.L'],
    ['105 BPM 젝키', '105 BPM Sechs Kies'],
    ['젝키', 'Sechs Kies'],
    ['안전한 시대 표현', 'Safe era expression'],
    ['안전한', 'safe'],
    ['시스템 정의', 'System definition'],
    ['시스템', 'system'],
    ['105 BPM 빅뱅', '105 BPM BIGBANG'],
    ['빅뱅', 'BIGBANG'],
    ['110 BPM 슈퍼주니어', '110 BPM Super Junior'],
    ['슈퍼주니어', 'Super Junior'],
    ['130 BPM 원더걸스 레트로', '130 BPM Wonder Girls retro'],
    ['원더걸스', 'Wonder Girls'],
    ['130 BPM 카라', '130 BPM KARA'],
    ['카라', 'KARA'],
    ['글로벌 진출', 'Global expansion'],
    ['진출', 'expansion'],
    ['소녀시대 전성기', 'Girls\' Generation peak'],
    ['전성기', 'peak'],
    ['75 BPM 이수영', '75 BPM Lee Soo-young'],
    ['이수영', 'Lee Soo-young'],
    ['80 BPM 바이브', '80 BPM Vibe'],
    ['바이브', 'Vibe'],
    ['100 BPM 장기하', '100 BPM Jang Kiha'],
    ['장기하', 'Jang Kiha'],
    ['90 BPM 브로콜리너마저', '90 BPM Broccoli, You Too?'],
    ['브로콜리너마저', 'Broccoli, You Too?'],
    ['115 BPM 검정치마', '115 BPM The Black Skirts'],
    ['검정치마', 'The Black Skirts'],
    ['120 BPM 자우림', '120 BPM Jaurim'],
    ['자우림', 'Jaurim'],
    ['170 BPM 조선펑크', '170 BPM Joseon Punk'],
    ['조선펑크', 'Joseon Punk'],
    ['95 BPM 드렁큰타이거', '95 BPM Drunken Tiger'],
    ['드렁큰타이거', 'Drunken Tiger'],
    ['90 BPM 다이나믹듀오', '90 BPM Dynamic Duo'],
    ['다이나믹듀오', 'Dynamic Duo'],
    ['95 BPM 윤미래', '95 BPM Yoon Mi-rae'],
    ['윤미래', 'Yoon Mi-rae'],
    ['90 BPM 대중 힙합', '90 BPM mainstream Hip-hop'],
    ['대중 힙합', 'mainstream Hip-hop'],
    ['대중', 'mainstream'],
    ['120 BPM 레드벨벳', '120 BPM Red Velvet'],
    ['레드벨벳', 'Red Velvet'],
    ['110 BPM 마마무', '110 BPM MAMAMOO'],
    ['마마무', 'MAMAMOO'],
    ['125 BPM 청순 걸그룹', '125 BPM Pure-style girl group'],
    ['청순 걸그룹', 'pure-style girl group'],
    ['청순', 'pure-style'],
    ['90 BPM 헤이즈', '90 BPM Heize'],
    ['헤이즈', 'Heize'],
    ['85 BPM 어반자카파', '85 BPM Urban Zakapa'],
    ['어반자카파', 'Urban Zakapa'],
    ['110 BPM 알트 인디', '110 BPM alt-indie'],
    ['알트 인디', 'alt-indie'],
    ['알트', 'alt'],
    ['80 BPM 폴킴', '80 BPM Paul Kim'],
    ['폴킴', 'Paul Kim'],
    ['85 BPM 적재', '85 BPM Jukjae'],
    ['적재', 'Jukjae'],
    ['75 BPM 사극 OST', '75 BPM Sageuk OST'],
    ['사극 OST', 'Sageuk OST'],
    ['사극', 'Sageuk'],
    ['130 BPM 스트레이키즈', '130 BPM Stray Kids'],
    ['스트레이키즈', 'Stray Kids'],
    ['110 BPM (여자)아이들', '110 BPM (G)I-DLE'],
    ['(여자)아이들', '(G)I-DLE'],
    ['여자아이들', 'G-IDLE'],
    ['2018-2019 태동기', '2018-2019 inception era'],
    ['태동기', 'inception era'],
    ['태동', 'inception'],
    ['하드한 사운드', 'Hard sound'],
    ['하드한', 'hard'],
    ['110 BPM 송가인', '110 BPM Song Ga-in'],
    ['송가인', 'Song Ga-in'],
    ['120 BPM 트로트 부흥기', '120 BPM Trot revival era'],
    ['미스/미스터 트롯', 'Miss / Mister Trot'],
    ['미스', 'Miss'],
    ['미스터', 'Mister'],
    ['트롯', 'Trot'],
    ['신중현 풍', 'Shin Jung-hyun style'],
    ['신중현', 'Shin Jung-hyun'],
    ['디스코 가요', 'Disco K-pop'],
    ['도시적 가요', 'Urban K-pop'],
    ['김완선 시대', 'Kim Wan-sun era'],
    ['신승훈/김건모 발라드', 'Shin Seung-hun / Kim Gun-mo ballad'],
    ['신승훈/김건모', 'Shin Seung-hun / Kim Gun-mo'],
    ['신승훈', 'Shin Seung-hun'],
    ['룰라/R.ef', 'Roo\'ra / R.ef'],
    ['룰라', 'Roo\'ra'],
    ['성시경/박효신', 'Sung Si-kyung / Park Hyo-shin'],
    ['박효신', 'Park Hyo-shin'],
    ['장기하/검정치마', 'Jang Kiha / The Black Skirts'],
    ['에픽하이/다이나믹듀오', 'Epik High / Dynamic Duo'],
    ['임영웅/송가인', 'Lim Young-woong / Song Ga-in'],
    ['V5+에서 가장 효과적', 'Most effective in V5+'],
    ['V5+에서', 'in V5+'],
    ['전 세계 - 끊임없이 진화', 'Worldwide — constantly evolving'],
    ['전 세계', 'worldwide'],
    ['전 세계 폭발적 성장', 'Explosive worldwide growth'],
    ['폭발적 성장', 'explosive growth'],
    ['성장', 'growth'],
    ['아시아, 전 세계', 'Asia, worldwide'],
    ['전 세계 + 콘텐츠 시장', 'Worldwide + content market'],
    ['콘텐츠 시장', 'content market'],
    ['콘텐츠', 'content'],
    ['시장', 'market'],
    ['95 BPM 다크 팝', '95 BPM Dark Pop'],
    ['다크 팝', 'Dark Pop'],
    ['다크', 'Dark'],
    ['140 BPM 드릴', '140 BPM Drill'],
    ['드릴', 'Drill'],
    ['트랩의 핵심', 'Trap core'],
    ['트랩 하이햇', 'Trap hi-hat'],
    ['붐백 샘플링', 'Boom-bap sampling'],
    ['붐백', 'Boom bap'],
    ['다크 트랩 분위기', 'Dark Trap atmosphere'],
    ['다크 트랩', 'Dark Trap'],
    ['드릴 베이스 시그니처', 'Drill bass signature'],
    ['드릴 베이스', 'Drill bass'],
    ['드릴 하이햇 패턴', 'Drill hi-hat pattern'],
    ['드릴 하이햇', 'Drill hi-hat'],
    ['95 BPM 레게톤', '95 BPM Reggaeton'],
    ['레게톤', 'Reggaeton'],
    ['130 BPM 바차타', '130 BPM Bachata'],
    ['바차타', 'Bachata'],
    ['120 BPM 메렝게', '120 BPM Merengue'],
    ['메렝게', 'Merengue'],
    ['레게톤의 핵심 리듬', 'Core reggaeton rhythm'],
    ['의 핵심 리듬', '\'s core rhythm'],
    ['핵심 리듬', 'core rhythm'],
    ['3-2 또는 2-3 싱코페이션', '3-2 or 2-3 syncopation'],
    ['또는', 'or'],
    ['메렝게/노르테뇨', 'Merengue / Norteño'],
    ['노르테뇨', 'Norteño'],
    ['126 BPM 테크하우스', '126 BPM Tech House'],
    ['테크하우스', 'Tech House'],
    ['138 BPM 프로그레시브 트랜스', '138 BPM Progressive Trance'],
    ['프로그레시브 트랜스', 'Progressive Trance'],
    ['프로그레시브', 'Progressive'],
    ['드롭 사이 정리', 'Cleanup between drops'],
    ['드롭 사이', 'between drops'],
    ['사이', 'between'],
    ['EDM 신스의 핵심', 'Core EDM synth'],
    ['의 핵심', '\'s core'],
    ['112 BPM 아마피아노', '112 BPM Amapiano'],
    ['아마피아노', 'Amapiano'],
    ['110 BPM 전통 아프로비트', '110 BPM traditional Afrobeat'],
    ['전통 아프로비트', 'traditional Afrobeat'],
    ['아프로비트', 'Afrobeat'],
    ['아마피아노 시그니처', 'Amapiano signature'],
    ['85 BPM 아웃로 컨트리', '85 BPM Outlaw Country'],
    ['아웃로 컨트리', 'Outlaw Country'],
    ['아웃로', 'Outlaw'],
    ['컨트리 기타 톤', 'Country guitar tone'],
    ['컨트리', 'Country'],
    ['남부 가창', 'Southern singing'],
    ['남부', 'Southern'],
    ['120 BPM 포스트-펑크', '120 BPM Post-punk'],
    ['포스트-펑크', 'Post-punk'],
    ['110 BPM 하드 록', '110 BPM Hard Rock'],
    ['하드 록', 'Hard Rock'],
    ['하드', 'Hard'],
    ['145 BPM 메탈코어', '145 BPM Metalcore'],
    ['메탈코어', 'Metalcore'],
    ['메탈코어 시그니처', 'Metalcore signature'],
    ['메탈 기타 톤', 'Metal guitar tone'],
    ['메탈 기타', 'Metal guitar'],
    ['아이언메이든 스타일', 'Iron Maiden style'],
    ['아이언메이든', 'Iron Maiden'],
    ['95 BPM 드림 팝', '95 BPM Dream Pop'],
    ['드림 팝', 'Dream Pop'],
    ['드림', 'Dream'],
    ['95 BPM 스무스 재즈', '95 BPM Smooth Jazz'],
    ['스무스 재즈', 'Smooth Jazz'],
    ['스무스', 'Smooth'],
    ['85 BPM 네오소울', '85 BPM Neo-Soul'],
    ['네오소울', 'Neo-Soul'],
    ['네오', 'Neo'],
    ['175 BPM 아니메 오프닝', '175 BPM Anime opening'],
    ['아니메 오프닝', 'Anime opening'],
    ['아니메', 'Anime'],
    ['오프닝', 'opening'],
    ['75 BPM 아니메 엔딩', '75 BPM Anime ending'],
    ['아니메 엔딩', 'Anime ending'],
    ['80 BPM 지브리 풍', '80 BPM Ghibli style'],
    ['지브리', 'Ghibli'],
    ['130 BPM 발리우드', '130 BPM Bollywood'],
    ['발리우드', 'Bollywood'],
    // Tag-tab batch 7 (auto-batch)
    ['~아~ 같은 표현', 'Expressions like \'~ah~\''],
    ['Chopped 샘플, 드럼', 'Chopped samples, drums'],
    ['샘플', 'samples'],
    ['싱코페이션, 베이스 헤비', 'Syncopation, bass-heavy'],
    ['싱코페이션', 'Syncopation'],
    ['디스토션, 강력함', 'Distortion, powerful'],
    ['강력함', 'powerfulness'],
    ['V5에서 가장 효과적', 'Most effective in V5'],
    ['V5에서 가장', 'most effective in V5'],
    ['가장 효과적', 'most effective'],
    ['가장', 'most'],
    ['효과적', 'effective'],
    ['5개 이상은 혼란 야기', '5+ causes confusion'],
    ['5개 이상은', '5+ causes'],
    ['이상은', 'and above'],
    ['야기', 'causes'],
    ['1980s Synthwave 식', '1980s Synthwave style'],
    ['식', 'style'],
    ['간결성이 핵심', 'Brevity is key'],
    ['간결성이', 'brevity is'],
    ['간결성', 'brevity'],
    ['재사용 가능한 패턴 만들기', 'Build reusable patterns'],
    ['재사용 가능한 패턴', 'reusable patterns'],
    ['재사용 가능한', 'reusable'],
    ['재사용', 'reuse'],
    ['만들기', 'build'],
    ['장르 1-2개, 악기 2-3개, 무드 1-2개로 제한', 'Limit to 1-2 genres, 2-3 instruments, 1-2 moods'],
    ['로 제한', 'limit to'],
    ['제한', 'limit'],
    ['항상 섹션 태그 포함', 'Always include section tags'],
    ['항상', 'always'],
    ['포함', 'include'],
    ['원하는 것을 묘사, 원치 않는 것을 명령 X', 'Describe what you want; don\'t command what you don\'t'],
    ['원하는 것을 묘사', 'describe what you want'],
    ['원치 않는 것을 명령 X', 'don\'t command what you don\'t'],
    ['원하는', 'wanted'],
    ['원치 않는', 'unwanted'],
    ['것을', 'thing'],
    ['묘사', 'describe'],
    ['명령', 'command'],
    ['쉼표 구분 키워드가 훨씬 효과적', 'Comma-separated keywords work far better'],
    ['쉼표 구분 키워드가', 'comma-separated keywords are'],
    ['구분 키워드', 'separator keyword'],
    ['구분', 'separation'],
    ['더 정확해짐', 'Becomes more accurate'],
    ['더', 'more'],
    ['향상됨', 'Improved'],
    ['더 잘 작동', 'Works better'],
    ['더 잘', 'better'],
    ['잘', 'well'],
    ['여전히 불가능 (107.553 BPM 같은)', 'Still impossible (e.g. 107.553 BPM)'],
    ['여전히', 'still'],
    ['불가능', 'impossible'],
    ['곡 전체 장르 지정', 'Whole-song genre spec'],
    ['곡 전체', 'whole song'],
    ['전체', 'whole'],
    ['곡 전체 분위기', 'Whole-song mood'],
    ['곡 전체 보컬 캐릭터', 'Whole-song vocal character'],
    ['주요 악기 지정', 'Designate primary instruments'],
    ['주요', 'primary'],
    ['악기 지정', 'instrument spec'],
    ['섹션 구분', 'Section separation'],
    ['섹션마다 다른 창법', 'Different vocal style per section'],
    ['섹션마다', 'per section'],
    ['다른', 'different'],
    ['위치 지정 필요', 'Position must be specified'],
    ['위치 지정', 'position spec'],
    ['필요', 'needed'],
    ['추임새 위치', 'Ad-libs position'],
    ['정확한 타이밍 지정', 'Exact timing spec'],
    ['타이밍 지정', 'timing spec'],
    ['타이밍', 'timing'],
    ['특정 요소 차단 - V5+에서 효과적', 'Block specific elements — works in V5+'],
    ['특정 요소 차단', 'block specific elements'],
    ['요소 차단', 'element block'],
    ['차단', 'block'],
    ['가장 자연스러운 한국어 발음', 'Most natural Korean pronunciation'],
    ['자연스러운 한국어 발음', 'natural Korean pronunciation'],
    ['한국어 발음', 'Korean pronunciation'],
    ['발음', 'pronunciation'],
    ['미국식 억양 살짝 섞임', 'Slight American accent mixed in'],
    ['미국식 억양', 'American accent'],
    ['미국식', 'American'],
    ['억양', 'accent'],
    ['살짝', 'slightly'],
    ['섞임', 'mixed'],
    ['발음 부자연스러움', 'Unnatural pronunciation'],
    ['부자연스러움', 'unnaturalness'],
    ['부자연스러운', 'unnatural'],
    ['감정 폭발 후 정리', 'Cleanup after emotion peak'],
    ['발라드 기본 BPM', 'Default Ballad BPM'],
    ['기본 BPM', 'default BPM'],
    ['기본', 'default'],
    ['연약함 표현', 'Expression of fragility'],
    ['연약함', 'fragility'],
    ['연약', 'fragile'],
    ['한국 발라드 시그니처지만 작동 X', 'Korean-ballad signature but doesn\'t work'],
    ['시그니처지만', 'signature but'],
    ['잔잔히 시작', 'Quiet start'],
    ['잔잔히', 'quietly'],
    ['잔잔', 'quiet'],
    ['익숙한 패턴', 'Familiar pattern'],
    ['익숙한', 'familiar'],
    ['최고조 감정', 'Peak emotion'],
    ['최고조', 'peak'],
    ['110 BPM 정통 트로트', '110 BPM authentic Trot'],
    ['정통 트로트', 'authentic Trot'],
    ['정통', 'authentic'],
    ['영어+한국어 병기', 'English + Korean side-by-side'],
    ['영어+한국어', 'English + Korean'],
    ['병기', 'side-by-side'],
    ['완벽하진 않지만 시도', 'Not perfect but worth trying'],
    ['완벽하진 않지만', 'not perfect but'],
    ['완벽하진', 'perfect-ish'],
    ['완벽한', 'perfect'],
    ['완벽', 'perfect'],
    ['시도', 'try'],
    ['영어 번역해도 거의 작동 안 함', 'Translation to English still hardly works'],
    ['영어 번역해도', 'even translated to English'],
    ['번역해도', 'even translated'],
    ['번역', 'translation'],
    ['트로트 태그로 일부 반영', 'Partially reflected via Trot tag'],
    ['트로트 태그로', 'via Trot tag'],
    ['일부 반영', 'partially reflected'],
    ['꺾기 효과 보완', 'Compensate for kkokji effect'],
    ['꺾기 효과', 'kkokji effect'],
    ['꺾기', 'kkokji'],
    ['보완', 'compensation'],
    ['트로트 특유 호흡', 'Trot signature breathing'],
    ['특유 호흡', 'signature breathing'],
    ['특유', 'signature'],
    ['한글은 음절이 빨리 차므로', 'Hangul syllables fill quickly, so'],
    ['음절이 빨리 차므로', 'syllables fill quickly, so'],
    ['음절이 빨리 차', 'syllables fill quickly'],
    ['빨리', 'quickly'],
    ['차므로', 'fill, so'],
    ['한국 랩의 특징', 'Korean rap characteristics'],
    ['의 특징', 'characteristics'],
    ['특징', 'characteristic'],
    ['완벽하진 않음', 'Not perfect'],
    ['않음', 'not'],
    ['밝은 장조', 'Bright major key'],
    ['밝은', 'bright'],
    ['72 BPM 찬양', '72 BPM praise'],
    ['찬양', 'praise'],
    ['발음 뭉개짐', 'Pronunciation smudges'],
    ['뭉개짐', 'smudges'],
    ['발음 명확', 'Pronunciation clear'],
    ['명확', 'clear'],
    ['어려운 발음 보완', 'Compensates for hard pronunciation'],
    ['어려운 발음', 'hard pronunciation'],
    ['어려운', 'hard'],
    ['연음 정확도', 'Liaison accuracy'],
    ['연음', 'liaison'],
    ['자연스럽게 섞임', 'Mixes in naturally'],
    ['자연스럽게', 'naturally'],
    ['자연스러운', 'natural'],
    ['발음 이상해질 수 있음', 'Pronunciation may become odd'],
    ['이상해질 수 있음', 'may become odd'],
    ['이상해질', 'become odd'],
    ['짧은 영어 단어 OK', 'Short English word OK'],
    ['짧은 영어 단어', 'short English word'],
    ['짧은', 'short'],
    ['감탄사로 자연스럽게', 'Naturally as interjections'],
    ['감탄사로', 'as interjections'],
    ['감탄사', 'interjection'],
    ['예: 보고싶어 매일 너만', 'e.g. \'I miss you, only you every day\''],
    ['예: 보고 싶어. 너무나도. 매일 밤.', 'e.g. \'I miss you. So much. Every night.\''],
    ['느리고 절절', 'Slow and heart-wrenching'],
    ['느리고', 'slow and'],
    ['자연스러운 워킹 템포', 'Natural walking tempo'],
    ['워킹 템포', 'walking tempo'],
    ['워킹', 'walking'],
    ['그루브감', 'Groove feel'],
    ['신나는 트로트 빠름', 'Exciting fast Trot'],
    ['신나는', 'exciting'],
    ['빠름', 'fast'],
    ['페스티벌형', 'Festival-style'],
    ['밝고 신나게', 'Bright and exciting'],
    ['신나게', 'excitingly'],
    ['필터링되거나 무시', 'Filtered or ignored'],
    ['트로트 태그로 일부', 'Partly via Trot tag'],
    ['거의 불가능', 'Almost impossible'],
    ['시도는 가능, 약함', 'Can try, but weak'],
    ['시도는 가능', 'can try'],
    ['약함', 'weak'],
    ['BPM처럼 정확히 안 됨', 'Not as exact as BPM'],
    ['BPM처럼', 'like BPM'],
    ['정확히 안 됨', 'not exactly applied'],
    ['처럼', 'like'],
    // Tag-tab batch 6 (auto-batch)
    ['멜로디 중심', 'Melody-driven'],
    ['중심', '-driven'],
    ['브레이크댄스 시대', 'Breakdance era'],
    ['브레이크댄스', 'Breakdance'],
    ['떨림창법', 'Vibrato vocal style'],
    ['떨림', 'Vibrato'],
    ['모노, 빈티지', 'Mono, vintage'],
    ['모노', 'Mono'],
    ['강한 비브라토', 'Strong vibrato'],
    ['강한', 'Strong'],
    ['비브라토', 'vibrato'],
    ['모노~초기 스테레오', 'Mono to early stereo'],
    ['초기 스테레오', 'early stereo'],
    ['초기', 'early'],
    ['순수한 톤', 'Pure tone'],
    ['순수한', 'pure'],
    ['순수', 'purity'],
    ['신나는 톤', 'Exciting tone'],
    ['파워풀 톤', 'Powerful tone'],
    ['복고풍', 'Retro style'],
    ['복고', 'Retro'],
    ['디지털 이전 시대', 'Pre-digital era'],
    ['이전 시대', 'previous era'],
    ['이전', 'previous'],
    ['특정 연도', 'Specific year'],
    ['특정 한국 가수명', 'Specific Korean singer name'],
    ['한국 가수명', 'Korean singer name'],
    ['가수명', 'singer name'],
    ['가수', 'singer'],
    ['주크박스 시대', 'Jukebox era'],
    ['주크박스', 'Jukebox'],
    ['선 레코드 시대', 'Sun Records era'],
    ['선 레코드', 'Sun Records'],
    ['그리저 문화', 'Greaser culture'],
    ['그리저', 'Greaser'],
    ['소다 파운틴', 'Soda fountain'],
    ['머지 비트', 'Merseybeat'],
    ['머지', 'Mersey'],
    ['사랑의 여름 1967', 'Summer of Love 1967'],
    ['사랑의 여름', 'Summer of Love'],
    ['그리니치 빌리지', 'Greenwich Village'],
    ['로렐 캐년', 'Laurel Canyon'],
    ['팔리아멘트 펑카델릭', 'Parliament Funkadelic'],
    ['린드럼 머신', 'LinnDrum machine'],
    ['머신', 'machine'],
    ['선셋 스트립 (LA)', 'Sunset Strip (LA)'],
    ['선셋 스트립', 'Sunset Strip'],
    ['맨체스터 사운드', 'Manchester sound'],
    ['맨체스터', 'Manchester'],
    ['쿨 브리타니아', 'Cool Britannia'],
    ['쿨', 'Cool'],
    ['브리타니아', 'Britannia'],
    ['플란넬 셔츠 (그런지)', 'Flannel shirts (Grunge)'],
    ['플란넬 셔츠', 'Flannel shirts'],
    ['플란넬', 'Flannel'],
    ['셔츠', 'shirts'],
    ['워프드 투어 시대', 'Warped Tour era'],
    ['워프드 투어', 'Warped Tour'],
    ['워프드', 'Warped'],
    ['투어', 'Tour'],
    ['맥스 마틴 프로듀스', 'Max Martin produced'],
    ['맥스 마틴', 'Max Martin'],
    ['팀발랜드 풍', 'Timbaland-style'],
    ['팀발랜드', 'Timbaland'],
    ['투모로우랜드', 'Tomorrowland'],
    ['텀블러 세대', 'Tumblr generation'],
    ['텀블러', 'Tumblr'],
    ['사운드클라우드 미학', 'SoundCloud aesthetic'],
    ['사운드클라우드', 'SoundCloud'],
    ['메트로 부민', 'Metro Boomin'],
    ['특정 연도 신스팝', 'Specific year synth-pop'],
    ['특정 연도 펑크', 'Specific year Funk'],
    ['특정 연도 사이키델릭', 'Specific year Psychedelic'],
    ['특정 연도 브릿팝', 'Specific year Britpop'],
    ['브릿팝', 'Britpop'],
    ['특정 연도 디스코', 'Specific year Disco'],
    ['특정 연도 모타운', 'Specific year Motown'],
    ['특정 연도 크렁크', 'Specific year Crunk'],
    ['특정 연도 EDM', 'Specific year EDM'],
    ['신스팝', 'synth-pop'],
    ['모노 녹음', 'Mono recording'],
    ['선 레코드 사운드', 'Sun Records sound'],
    ['모노 믹스', 'Mono mix'],
    ['모타운 베이스 톤', 'Motown bass tone'],
    ['테이프 새튜레이션', 'Tape saturation'],
    ['새튜레이션', 'saturation'],
    ['디지털 차가움', 'Digital coldness'],
    ['차가움', 'coldness'],
    ['강한 컴프레션', 'Strong compression'],
    ['컴프레션', 'compression'],
    ['프로툴 광택', 'Pro Tools polish'],
    ['프로툴', 'Pro Tools'],
    ['음량 전쟁', 'Loudness war'],
    ['음량', 'loudness'],
    ['전쟁', 'war'],
    ['스트리밍 최적화', 'Streaming optimisation'],
    ['스트리밍', 'Streaming'],
    ['멈블 보컬', 'Mumble vocals'],
    ['멈블', 'Mumble'],
    ['저음 강조 믹스', 'Bass-emphasis mix'],
    ['저음 강조', 'bass emphasis'],
    ['저음', 'bass'],
    ['강조', 'emphasis'],
    ['스트리밍 라우드', 'Streaming loudness'],
    ['극히 specific 한 매칭', 'Extremely specific matching'],
    ['극히', 'extremely'],
    ['매칭', 'matching'],
    ['특정 레이블 톤', 'Specific label tone'],
    ['레이블', 'label'],
    ['믹싱 장비 톤', 'Mixing-gear tone'],
    ['장비', 'gear'],
    ['개인 톤 재현', 'Personal tone reproduction'],
    ['재현', 'reproduction'],
    ['루이 암스트롱 풍', 'Louis Armstrong style'],
    ['루이 암스트롱', 'Louis Armstrong'],
    ['로버트 존슨 풍', 'Robert Johnson style'],
    ['로버트 존슨', 'Robert Johnson'],
    ['시나트라 풍', 'Sinatra style'],
    ['시나트라', 'Sinatra'],
    ['초기 엘비스 에너지', 'Early Elvis energy'],
    ['초기 엘비스', 'early Elvis'],
    ['에너지', 'energy'],
    ['행크 윌리엄스 풍', 'Hank Williams style'],
    ['행크 윌리엄스', 'Hank Williams'],
    ['비틀즈 풍', 'Beatles style'],
    ['비틀즈', 'The Beatles'],
    ['밥 딜런 풍', 'Bob Dylan style'],
    ['밥 딜런', 'Bob Dylan'],
    ['비치보이스 풍', 'Beach Boys style'],
    ['비치보이스', 'Beach Boys'],
    ['제임스 브라운 추임새', 'James Brown ad-libs'],
    ['제임스 브라운', 'James Brown'],
    ['비지스 가성', 'Bee Gees falsetto'],
    ['비지스', 'Bee Gees'],
    ['마돈나 풍', 'Madonna style'],
    ['마돈나', 'Madonna'],
    ['기묘한 이야기 분위기', 'Stranger Things atmosphere'],
    ['기묘한 이야기', 'Stranger Things'],
    ['기묘한', 'strange'],
    ['이야기', 'story'],
    ['커트 코베인 에너지', 'Kurt Cobain energy'],
    ['커트 코베인', 'Kurt Cobain'],
    ['린킨파크 에너지', 'Linkin Park energy'],
    ['린킨파크', 'Linkin Park'],
    ['맥스 마틴 풍', 'Max Martin style'],
    ['빌리 아일리시 미학', 'Billie Eilish aesthetic'],
    ['빌리 아일리시', 'Billie Eilish'],
    ['버나 보이 크로스오버', 'Burna Boy crossover'],
    ['버나 보이', 'Burna Boy'],
    ['크로스오버', 'crossover'],
    ['재즈, 댄스, 금주법, 도시화', 'Jazz, dance, Prohibition, urbanisation'],
    ['금주법', 'Prohibition'],
    ['도시화', 'urbanisation'],
    ['전쟁, 그리움, 낭만, 집에 보내는 편지', 'War, longing, romance, letters home'],
    ['전쟁', 'war'],
    ['그리움', 'longing'],
    ['낭만', 'romance'],
    ['집에 보내는 편지', 'letters home'],
    ['편지', 'letter'],
    ['청춘, 사랑, 자동차, 학교, 댄스파티', 'Youth, love, cars, school, dance parties'],
    ['청춘', 'youth'],
    ['사랑', 'love'],
    ['자동차', 'car'],
    ['학교', 'school'],
    ['댄스파티', 'dance party'],
    ['평화, 사랑, 반전, 자유, 사회변혁', 'Peace, love, anti-war, freedom, social change'],
    ['평화', 'peace'],
    ['반전', 'anti-war'],
    ['자유', 'freedom'],
    ['사회변혁', 'social change'],
    ['디스코 댄스, 자아 발견, 분노, 시국', 'Disco dance, self-discovery, anger, social commentary'],
    ['자아 발견', 'self-discovery'],
    ['자아', 'self'],
    ['발견', 'discovery'],
    ['분노', 'anger'],
    ['시국', 'social commentary'],
    ['욕망, 부, 사이버 미래, 사랑', 'Desire, wealth, cyber future, love'],
    ['욕망', 'desire'],
    ['부', 'wealth'],
    ['사이버 미래', 'cyber future'],
    ['사이버', 'cyber'],
    ['미래', 'future'],
    ['소외, 분노, 진정성, 도시 빈민', 'Alienation, anger, authenticity, urban poverty'],
    ['소외', 'alienation'],
    ['진정성', 'authenticity'],
    ['도시 빈민', 'urban poverty'],
    ['빈민', 'poverty'],
    ['클럽, 자신감, 인터넷, 셀럽 문화', 'Club, confidence, Internet, celebrity culture'],
    ['자신감', 'confidence'],
    ['인터넷', 'Internet'],
    ['셀럽', 'celebrity'],
    ['셀럽 문화', 'celebrity culture'],
    ['소셜미디어, 자존감, 우울, 페스티벌', 'Social media, self-esteem, depression, festivals'],
    ['소셜미디어', 'social media'],
    ['자존감', 'self-esteem'],
    ['우울', 'depression'],
    ['가끔만 작동', 'Works only sometimes'],
    ['가끔만', 'only sometimes'],
    ['거의 작동 안 함 - AI 자체 판단', 'Hardly works — AI self-judgement'],
    ['AI 자체 판단', 'AI self-judgement'],
    ['자체 판단', 'self-judgement'],
    ['판단', 'judgement'],
    ['복고풍, 네온 분위기', 'Retro style, neon atmosphere'],
    ['네온 분위기', 'neon atmosphere'],
    ['네온', 'neon'],
    ['반복적, 어두운 분위기', 'Repetitive, dark atmosphere'],
    ['반복적', 'repetitive'],
    ['힙합/인디 색채', 'Hip-hop / indie palette'],
    ['색채', 'palette'],
    // Tag-tab batch 5 (auto-batch)
    ['캐치한, 접근성 높음', 'Catchy, high accessibility'],
    ['캐치한', 'catchy'],
    ['접근성 높음', 'high accessibility'],
    ['높음', 'high'],
    ['밝고 멜로딕', 'Bright and melodic'],
    ['밝고', 'bright'],
    ['업템포, 파티', 'Up-tempo, party'],
    ['업템포', 'up-tempo'],
    ['파티', 'party'],
    ['즉흥 연주, 스윙', 'Improvised performance, Swing'],
    ['즉흥 연주', 'improvised performance'],
    ['즉흥', 'improvised'],
    ['연주', 'performance'],
    ['12마디, 감성적', '12 bars, sensitive'],
    ['12마디', '12 bars'],
    ['부드럽고 로맨틱', 'Smooth and romantic'],
    ['부드럽고', 'smooth and'],
    ['아토스피어릭', 'Atmospheric'],
    ['이펙트 헤비', 'Effect-heavy'],
    ['이펙트', 'effect'],
    ['도시적, 펑키', 'Urban, funky'],
    ['도시적', 'urban'],
    ['밴조, 빠른 피킹', 'Banjo, fast picking'],
    ['빠른 피킹', 'fast picking'],
    ['피킹', 'picking'],
    ['어쿠스틱, 내러티브', 'Acoustic, narrative'],
    ['내러티브', 'narrative'],
    ['뎀보우 리듬', 'Dembow rhythm'],
    ['뎀보우', 'Dembow'],
    ['딥 베이스, 피아노', 'Deep bass, piano'],
    ['딥 베이스', 'Deep bass'],
    ['딥', 'Deep'],
    ['시네마틱, 웅장', 'Cinematic, grand'],
    ['시네마틱', 'Cinematic'],
    ['웅장, 파워풀', 'Grand, powerful'],
    ['웅장', 'Grand'],
    ['파워풀', 'powerful'],
    ['정확도 크게 향상 - 1985 Synthwave 식으로', 'Significantly improved accuracy — like \'1985 Synthwave\''],
    ['크게 향상', 'significantly improved'],
    ['크게', 'significantly'],
    ['결과가 들쭉날쭉', 'Results are inconsistent'],
    ['결과', 'result'],
    ['들쭉날쭉', 'inconsistent'],
    ['필터링되거나 무시됨', 'Filtered out or ignored'],
    ['필터링됨', 'Filtered'],
    ['무시됨', 'Ignored'],
    ['거의 무시됨', 'Mostly ignored'],
    ['거의 작동 안 함', 'Hardly works'],
    ['거의', 'mostly'],
    ['작동 안 함', 'doesn\'t work'],
    ['결과 혼탁해질 수 있음 - 1~2개 권장', 'Results may become muddy — 1-2 recommended'],
    ['혼탁해질 수 있음', 'may become muddy'],
    ['혼탁', 'muddy'],
    ['하우스, 디스코', 'House, Disco'],
    ['하우스', 'House'],
    ['트랩, 덥스텝', 'Trap, Dubstep'],
    ['트랩', 'Trap'],
    ['덥스텝', 'Dubstep'],
    ['드럼앤베이스', 'Drum & Bass'],
    ['발라드, 칠', 'Ballad, Chill'],
    ['칠', 'Chill'],
    ['리듬감 있게 느리게', 'Rhythmically slow'],
    ['리듬감 있게', 'rhythmically'],
    ['메트로놈 락은 아님 - 가이드 역할', 'Not a metronome lock — guideline only'],
    ['메트로놈 락', 'metronome lock'],
    ['메트로놈', 'metronome'],
    ['락', 'lock'],
    ['락은 아님', 'is not a lock'],
    ['역할', 'role'],
    ['메트로놈처럼 작동 안 함. 107.553 같은 비정수 생성', 'Does not work like a metronome. Generates non-integer values like 107.553.'],
    ['메트로놈처럼', 'metronome-like'],
    ['비정수', 'non-integer'],
    ['생성', 'generation'],
    ['템포 변화 어려움', 'Tempo change is hard'],
    ['어려움', 'hard'],
    ['Male Vocal과 동일 효과', 'Same effect as Male Vocal'],
    ['Female Vocal과 동일 효과', 'Same effect as Female Vocal'],
    ['동일 효과', 'same effect'],
    ['동일', 'same'],
    ['동요, 어린이 캐릭터', 'Children\'s song, child character'],
    ['어린이 캐릭터', 'child character'],
    ['어린이', 'child'],
    ['캐릭터', 'character'],
    ['스토리, 내레이션', 'Story, narration'],
    ['스토리', 'story'],
    ['내레이션', 'narration'],
    ['힙합, 트랩', 'Hip-hop, Trap'],
    ['시낭송, 내레이션', 'Poetry reading, narration'],
    ['시낭송', 'poetry reading'],
    ['가스펠, 엄숙한 곡', 'Gospel, solemn songs'],
    ['엄숙한 곡', 'solemn songs'],
    ['팝, 뮤지컬, 후렴 폭발', 'Pop, musical, chorus explosion'],
    ['팝', 'Pop'],
    ['뮤지컬', 'musical'],
    ['오페라, 심포닉 메탈', 'Opera, Symphonic Metal'],
    ['심포닉 메탈', 'Symphonic Metal'],
    ['심포닉', 'Symphonic'],
    ['팝, R&B, 가스펠', 'Pop, R&B, Gospel'],
    ['가스펠', 'Gospel'],
    ['동시 가창 X, 교대로 부름 (90%)', 'No simultaneous singing, alternating delivery (90%)'],
    ['동시 가창', 'simultaneous singing'],
    ['동시', 'simultaneous'],
    ['가창', 'singing'],
    ['교대로 부름', 'alternating delivery'],
    ['교대로', 'alternating'],
    ['부름', 'delivery'],
    ['발라드, 자장가', 'Ballad, lullaby'],
    ['자장가', 'lullaby'],
    ['안센, 록', 'Anthem, Rock'],
    ['안센', 'Anthem'],
    ['고백 발라드', 'Confession ballad'],
    ['고백', 'confession'],
    ['메탈, 펑크', 'Metal, Punk'],
    ['메탈', 'Metal'],
    ['팝, 파티 곡', 'Pop, party songs'],
    ['파티 곡', 'party songs'],
    ['모던 팝, 트랩', 'Modern Pop, Trap'],
    ['발라드, 앰비언트', 'Ballad, Ambient'],
    ['앰비언트', 'Ambient'],
    ['일렉트로닉, 신스웨이브', 'Electronic, Synthwave'],
    ['신스웨이브', 'Synthwave'],
    ['빈티지, 전환', 'Vintage, transitional'],
    ['전환', 'transition'],
    ['덥, 실험적', 'Dub, experimental'],
    ['덥', 'Dub'],
    ['실험적', 'experimental'],
    ['잘 안 나오거나 약하게만 반영', 'Rarely surfaces, only weakly applied'],
    ['잘 안 나오거나', 'rarely surfaces'],
    ['약하게만 반영', 'only weakly applied'],
    ['약하게만', 'only weakly'],
    ['약하게', 'weakly'],
    ['재즈 즉흥 - 일관성 부족', 'Jazz improvisation — lacks consistency'],
    ['재즈 즉흥', 'Jazz improvisation'],
    ['일관성 부족', 'lacks consistency'],
    ['일관성', 'consistency'],
    ['부족', 'lacking'],
    ['Advanced Options의 Exclude 필드 사용 권장', 'Use the Exclude field in Advanced Options'],
    ['Advanced Options', 'Advanced Options'],
    ['필드 사용 권장', 'field usage recommended'],
    ['록, 펑크', 'Rock, Punk'],
    ['가스펠, 블루스, 록', 'Gospel, Blues, Rock'],
    ['블루스', 'Blues'],
    ['신스웨이브, 레트로', 'Synthwave, retro'],
    ['레트로', 'retro'],
    ['펑크, 일렉트로닉', 'Funk, Electronic'],
    ['앰비언트, 뉴에이지', 'Ambient, New Age'],
    ['뉴에이지', 'New Age'],
    ['바로크, 클래식', 'Baroque, Classical'],
    ['바로크', 'Baroque'],
    ['록, 메탈, 그런지', 'Rock, Metal, Grunge'],
    ['그런지', 'Grunge'],
    ['모든 장르', 'All genres'],
    ['모든', 'all'],
    ['펑크, 디스코', 'Funk, Disco'],
    ['재즈, 락어빌리', 'Jazz, Rockabilly'],
    ['락어빌리', 'Rockabilly'],
    ['클래식, 앰비언트', 'Classical, Ambient'],
    ['클래식, 뉴에이지', 'Classical, New Age'],
    ['컨트리, 포크, 블루그래스', 'Country, Folk, Bluegrass'],
    ['블루그래스', 'Bluegrass'],
    ['포크, 블루그래스', 'Folk, Bluegrass'],
    ['월드, 사이키델릭', 'World, Psychedelic'],
    ['월드', 'World'],
    ['사이키델릭', 'Psychedelic'],
    ['힙합, 트랩, R&B', 'Hip-hop, Trap, R&B'],
    ['하우스, 테크노', 'House, Techno'],
    ['테크노', 'Techno'],
    ['에픽, 시네마틱', 'Epic, cinematic'],
    ['에픽', 'Epic'],
    ['팝, 가스펠', 'Pop, Gospel'],
    ['펑크, 소울, 팝', 'Funk, Soul, Pop'],
    ['재즈, 스카, 펑크', 'Jazz, Ska, Funk'],
    ['스카', 'Ska'],
    ['클래식, 시네마틱', 'Classical, cinematic'],
    ['포크, 폴카, 트로트', 'Folk, Polka, Trot'],
    ['폴카', 'Polka'],
    ['EDM, 팝, 신스웨이브', 'EDM, Pop, Synthwave'],
    ['신스웨이브, 트랜스', 'Synthwave, Trance'],
    ['애시드 하우스, 테크노', 'Acid House, Techno'],
    ['애시드 하우스', 'Acid House'],
    ['애시드', 'Acid'],
    ['시네마틱, 클래식', 'Cinematic, classical'],
    ['발라드, 시네마틱', 'Ballad, cinematic'],
    ['에픽, 종교적', 'Epic, religious'],
    ['종교적', 'religious'],
    ['혼란 발생, 일부만 반영 - 2~4개로 제한', 'Causes confusion, only partially applied — limit to 2-4'],
    ['혼란 발생', 'causes confusion'],
    ['혼란', 'confusion'],
    ['발생', 'occurrence'],
    ['일부만 반영', 'only partially applied'],
    ['일부만', 'only partially'],
    ['일부', 'part'],
    ['일반적 톤만 반영', 'Only general tone applied'],
    ['일반적 톤', 'general tone'],
    ['일반적', 'general'],
    ['앤섬, 동기부여', 'Anthem, motivational'],
    ['앤섬', 'Anthem'],
    ['동기부여', 'motivational'],
    ['메탈, 인더스트리얼', 'Metal, Industrial'],
    ['신스웨이브, 발라드', 'Synthwave, Ballad'],
    ['슈게이즈, 앰비언트', 'Shoegaze, Ambient'],
    ['슈게이즈', 'Shoegaze'],
    ['시네마틱, 게이밍', 'Cinematic, gaming'],
    ['게이밍', 'gaming'],
    ['러브송, R&B', 'Love song, R&B'],
    ['러브송', 'love song'],
    ['호러, 앰비언트', 'Horror, Ambient'],
    ['호러', 'Horror'],
    ['스포츠, 피날레', 'Sports, finale'],
    ['스포츠', 'Sports'],
    ['피날레', 'finale'],
    ['스릴러 스코어', 'Thriller score'],
    ['스릴러', 'Thriller'],
    ['스코어', 'score'],
    ['필름 누아르', 'Film noir'],
    ['필름', 'Film'],
    ['누아르', 'noir'],
    ['팝, 파티곡', 'Pop, party songs'],
    ['파티곡', 'party songs'],
    ['장례식, 드라마', 'Funeral, drama'],
    ['장례식', 'funeral'],
    ['명상, 뉴에이지', 'Meditation, New Age'],
    ['명상', 'meditation'],
    ['키즈 음악, 코미디', 'Kids music, comedy'],
    ['키즈 음악', 'kids music'],
    ['키즈', 'kids'],
    ['코미디', 'comedy'],
    ['EDM, 록, 워크아웃', 'EDM, Rock, workout'],
    ['워크아웃', 'workout'],
    ['Lo-fi, 앰비언트', 'Lo-fi, Ambient'],
    ['록, 메탈', 'Rock, Metal'],
    ['앰비언트, 발라드', 'Ambient, Ballad'],
    ['빌드업, 버스', 'Build-up, drop'],
    ['버스', 'drop'],
    ['펑크, 메탈', 'Funk, Metal'],
    ['펑크, 차고', 'Punk, garage'],
    ['차고', 'garage'],
    ['오케스트라, 앰비언트', 'Orchestra, Ambient'],
    ['미니멀리스트, 어쿠스틱', 'Minimalist, acoustic'],
    ['미니멀리스트', 'Minimalist'],
    ['Lo-fi, 레트로', 'Lo-fi, retro'],
    ['앰비언트, 포스트록', 'Ambient, post-rock'],
    ['포스트록', 'post-rock'],
    ['포스트', 'post'],
    ['커머셜, 팝', 'Commercial, Pop'],
    ['커머셜', 'Commercial'],
    ['서로 상쇄됨', 'Cancel each other out'],
    ['서로', 'each other'],
    ['상쇄됨', 'cancelled'],
    ['해석 불가', 'Cannot interpret'],
    ['해석', 'interpret'],
    ['불가', 'impossible'],
    ['라이브 녹음, 엔딩', 'Live recording, ending'],
    ['엔딩', 'ending'],
    ['스포츠, 축하', 'Sports, celebration'],
    ['축하', 'celebration'],
    ['리드믹, 가스펠', 'Rhythmic, Gospel'],
    ['리드믹', 'Rhythmic'],
    ['드라마틱 정지', 'Dramatic pause'],
    ['정지', 'pause'],
    ['무드, 대기', 'Mood, atmosphere'],
    ['대기', 'atmosphere'],
    ['드라마틱, 어두운', 'Dramatic, dark'],
    ['어두운', 'dark'],
    ['황량한, 으스스', 'Bleak, eerie'],
    ['황량한', 'bleak'],
    ['으스스', 'eerie'],
    ['휴식, 트로피컬', 'Relaxation, tropical'],
    ['휴식', 'relaxation'],
    ['트로피컬', 'Tropical'],
    ['아늑한, 어쿠스틱', 'Cozy, acoustic'],
    ['아늑한', 'cozy'],
    ['자연, 평온', 'Nature, calm'],
    ['자연', 'nature'],
    ['평온', 'calm'],
    ['귀여운, 가벼운', 'Cute, light'],
    ['귀여운', 'cute'],
    ['경쾌, 포크', 'Lively, Folk'],
    ['경쾌', 'lively'],
    ['내러티브, 모던', 'Narrative, modern'],
    ['라디오, 전환', 'Radio, transition'],
    ['알림, 크리스마스', 'Notification, Christmas'],
    ['알림', 'notification'],
    ['크리스마스', 'Christmas'],
    ['불안정', 'Unstable'],
    ['실제 필터 우회 효과 없음', 'No actual filter-bypass effect'],
    ['실제', 'actual'],
    ['우회', 'bypass'],
    ['효과 없음', 'no effect'],
    ['없음', 'none'],
    ['마법 스위치 아님 - 가사에 직접 써야', 'Not a magic switch — must be written into the lyrics'],
    ['마법 스위치 아님', 'not a magic switch'],
    ['마법', 'magic'],
    ['스위치', 'switch'],
    ['아님', 'not'],
    ['직접 써야', 'must be written'],
    ['직접', 'directly'],
    ['써야', 'must write'],
    ['구조 정확히 인식', 'Structure recognised exactly'],
    ['정확히', 'exactly'],
    ['인식', 'recognition'],
    ['보컬 추임새로 잘 들어감', 'Fits well as vocal ad-libs'],
    ['추임새로', 'as ad-libs'],
    ['잘 들어감', 'fits well'],
    ['박자 의도 표현 가능', 'Can express time-signature intent'],
    ['의도', 'intent'],
    ['가능', 'possible'],
    ['자연스러운 호흡 유도', 'Induces natural phrasing'],
    ['자연스러운', 'natural'],
    ['유도', 'induce'],
    ['말하듯 전달', 'Spoken-style delivery'],
    ['말하듯', 'spoken-style'],
    ['음악이 숨쉬는 공간', 'Music breathing room'],
    ['숨쉬는', 'breathing'],
    ['공간', 'room'],
    ['섹션별 감정 변화', 'Per-section emotional change'],
    ['종종 발음 이상하게 처리', 'Pronunciation often handled oddly'],
    ['종종', 'often'],
    ['이상하게', 'oddly'],
    ['처리', 'handling'],
    ['효과 미미', 'Minimal effect'],
    ['미미', 'minimal'],
    ['부분적 반영', 'Partial reflection'],
    ['부분적', 'partial'],
    ['동양적, 블루스', 'Eastern, Blues'],
    ['동양적', 'Eastern'],
    ['텍스처에 영향', 'Affects the texture'],
    ['텍스처에', 'to the texture'],
    ['인식 안 됨', 'Not recognised'],
    ['시도 가능하나 결과 불안정', 'Worth trying, but results unstable'],
    ['시도 가능하나', 'worth trying, but'],
    ['매우 어려움', 'Very hard'],
    ['4-7개 디스크립터가 스위트 스팟', '4-7 descriptors is the sweet spot'],
    ['디스크립터', 'descriptor'],
    ['스위트 스팟', 'sweet spot'],
    ['도시적', 'urban'],
    // Tag-tab batch 4 (auto-batch)
    ['특정 LP 음반 톤', 'Specific LP record tone'],
    ['LP 음반', 'LP record'],
    ['음반', 'record'],
    ['음반 회사', 'record label'],
    ['한국 음반 회사 사운드', 'Korean record-label sound'],
    ['시대감 살리는 표현', 'Period-evoking expression'],
    ['시대감', 'period feel'],
    ['살리는', 'evoking'],
    ['시대적 상황', 'Era-specific context'],
    ['상황', 'context'],
    ['서정적 소재', 'Lyrical subject'],
    ['서정적', 'lyrical'],
    ['소재', 'subject matter'],
    ['현대어', 'Modern Korean'],
    ['현대식 영어 믹스', 'Modern English mix'],
    ['현대식', 'modern'],
    ['현대', 'modern'],
    ['현대어 사용 금지', 'Avoid modern Korean'],
    ['사용 금지', 'do not use'],
    ['금지', 'forbidden'],
    ['바람이 부는 날이면 / 그대 생각이 나요 / 지나간 그 시절이 / 가슴에 남아있어요', 'On windy days / I think of you / Those past days / linger in my heart'],
    ['가로등 불빛 사이로 / 그대 모습이 스쳐가요 / 이 거리 끝에 서서 / 오늘도 그댈 생각해요', 'Through the streetlight glow / your shadow passes / Standing at the end of this street / I think of you again today'],
    ['명확한 조합 지정', 'Clear combination spec'],
    ['명확한', 'clear'],
    ['조합 지정', 'combination spec'],
    ['한류 K-Pop', 'Hallyu K-Pop'],
    ['한류', 'Hallyu'],
    ['맥시멀리스트 컨셉', 'Maximalist concept'],
    ['맥시멀리스트', 'maximalist'],
    ['자체 프로듀싱 아이돌', 'Self-producing idols'],
    ['자체 프로듀싱', 'self-producing'],
    ['자체', 'self'],
    ['프로듀싱', 'producing'],
    ['가장 보편적', 'Most universal'],
    ['보편적', 'universal'],
    ['끊임없이 진화', 'constantly evolving'],
    ['끊임없이', 'constantly'],
    ['진화', 'evolving'],
    ['글로벌 영향력 확대', 'Expanding global influence'],
    ['영향력', 'influence'],
    ['확대', 'expansion'],
    ['페스티벌 문화', 'Festival culture'],
    ['문화', 'culture'],
    ['한류 지속 확대', 'Continued Hallyu expansion'],
    ['지속', 'continued'],
    ['모던 컨트리 부상', 'Modern country rising'],
    ['부상', 'rising'],
    ['인디/얼터너티브 부활', 'Indie / alternative revival'],
    ['얼터너티브', 'alternative'],
    ['부활', 'revival'],
    ['트랩 시그니처 베이스', 'Trap signature bass'],
    ['빠른 하이햇', 'Fast hi-hat'],
    ['잘게 자른 샘플', 'Finely-chopped samples'],
    ['잘게 자른', 'finely chopped'],
    ['미끄러지는 808', 'Sliding 808'],
    ['미끄러지는', 'sliding'],
    ['스킵 하이햇', 'Skip hi-hat'],
    ['레게톤 비트', 'Reggaeton beat'],
    ['살사/라틴 백본', 'Salsa / Latin backbone'],
    ['백본', 'backbone'],
    ['스패니쉬 기타', 'Spanish guitar'],
    ['스패니쉬', 'Spanish'],
    ['반도네온 (탱고)', 'Bandoneon (Tango)'],
    ['반도네온', 'Bandoneon'],
    ['탱고', 'Tango'],
    ['베이스 드롭', 'Bass drop'],
    ['드롭', 'drop'],
    ['와블 베이스', 'Wobble bass'],
    ['와블', 'Wobble'],
    ['리스 베이스', 'Reese bass'],
    ['리스', 'Reese'],
    ['플럭 신스', 'Pluck synth'],
    ['플럭', 'Pluck'],
    ['로그 드럼', 'Log drums'],
    ['요루바어 보컬', 'Yoruba-language vocals'],
    ['요루바어', 'Yoruba'],
    ['페달 스틸 기타', 'Pedal-steel guitar'],
    ['페달 스틸', 'Pedal steel'],
    ['페달', 'Pedal'],
    ['슬라이드 기타', 'Slide guitar'],
    ['슬라이드', 'Slide'],
    ['스토리텔링 가사', 'Storytelling lyrics'],
    ['스토리텔링', 'storytelling'],
    ['바이올린 (피들)', 'Violin (Fiddle)'],
    ['피들 (바이올린)', 'Fiddle (Violin)'],
    ['피들', 'Fiddle'],
    ['쳐깅 기타', 'Chugging guitar'],
    ['쳐깅', 'Chugging'],
    ['갤로핑 리듬', 'Galloping rhythm'],
    ['갤로핑', 'Galloping'],
    ['타블라 드럼', 'Tabla drums'],
    ['탄푸라 드론', 'Tanpura drone'],
    ['드론', 'drone'],
    ['복잡한 융합 장르', 'Complex fusion genre'],
    ['복잡한', 'complex'],
    ['융합 장르', 'fusion genre'],
    ['융합', 'fusion'],
    ['타블라', 'Tabla'],
    ['탄푸라', 'Tanpura'],
    ['비나', 'Veena'],
    ['샤미센', 'Shamisen'],
    ['고토', 'Koto'],
    ['샤쿠하치', 'Shakuhachi'],
    ['구정', 'Guzheng'],
    ['비파', 'Pipa'],
    ['가야금', 'Gayageum'],
    ['장구', 'Janggu'],
    ['콩가', 'Conga'],
    ['봉고', 'Bongo'],
    ['카혼', 'Cajón'],
    ['구이라', 'Güira'],
    ['쿠이카', 'Cuíca'],
    ['탐보림', 'Tamborim'],
    ['수르도', 'Surdo'],
    ['비우엘라', 'Vihuela'],
    ['바호 섹스토', 'Bajo sexto'],
    ['젬베', 'Djembe'],
    ['코라', 'Kora'],
    ['우드', 'Oud'],
    ['카눈', 'Qanun'],
    ['틴 휘슬', 'Tin whistle'],
    ['보드란', 'Bodhrán'],
    ['광란의 20년대', 'Roaring 20s'],
    ['광란의', 'Roaring'],
    ['주류 밀매점', 'Speakeasy'],
    ['주류', 'liquor'],
    ['밀매점', 'smuggling shop'],
    ['셸락 음반 사운드', 'Shellac record sound'],
    ['틴 팬 앨리', 'Tin Pan Alley'],
    ['글렌 밀러 빅밴드 풍', 'Glenn Miller big-band style'],
    ['글렌 밀러', 'Glenn Miller'],
    ['린디홉 시대', 'Lindy Hop era'],
    ['린디홉', 'Lindy Hop'],
    ['미시시피 시골', 'Mississippi countryside'],
    ['미시시피', 'Mississippi'],
    ['시골', 'countryside'],
    ['찰리 파커 풍', 'Charlie Parker style'],
    ['찰리 파커', 'Charlie Parker'],
    ['서퍼 클럽', 'Supper club'],
    ['서퍼', 'supper'],
    // Tag-tab batch 3 (auto-batch)
    ['필터된 보컬', 'Filtered vocals'],
    ['필터된', 'filtered'],
    ['그로울/스크림', 'Growl / scream'],
    ['그로울', 'growl'],
    ['스크림', 'scream'],
    ['스캣 창법', 'Scat vocal style'],
    ['스캣', 'Scat'],
    ['일렉트릭 피아노', 'Electric piano'],
    ['일렉트릭', 'Electric'],
    ['로즈 피아노', 'Rhodes piano'],
    ['로즈', 'Rhodes'],
    ['월리처', 'Wurlitzer'],
    ['무그 신스', 'Moog synth'],
    ['무그', 'Moog'],
    ['신스 패드', 'Synth pad'],
    ['하프시코드', 'Harpsichord'],
    ['일렉트릭 기타', 'Electric guitar'],
    ['바이올린', 'Violin'],
    ['현악기 앙상블', 'Strings ensemble'],
    ['앙상블', 'ensemble'],
    ['첼로', 'Cello'],
    ['현악 4중주', 'String quartet'],
    ['현악', 'Strings'],
    ['하프', 'Harp'],
    ['우쿨렐레', 'Ukulele'],
    ['밴조', 'Banjo'],
    ['만돌린', 'Mandolin'],
    ['시타르', 'Sitar'],
    ['전자 드럼', 'Electronic drums'],
    ['롤랜드 909', 'Roland 909'],
    ['롤랜드', 'Roland'],
    ['브러시 드럼', 'Brush drums'],
    ['브러시', 'Brush'],
    ['탬버린', 'Tambourine'],
    ['재즈 색소폰', 'Jazz saxophone'],
    ['색소폰', 'Saxophone'],
    ['브라스 섹션', 'Brass section'],
    ['브라스', 'Brass'],
    ['트롬본', 'Trombone'],
    ['프렌치 호른', 'French horn'],
    ['플루트', 'Flute'],
    ['하모니카', 'Harmonica'],
    ['리드 신스', 'Lead synth'],
    ['슈퍼소우', 'Supersaw'],
    ['풀 오케스트라', 'Full orchestra'],
    ['팀파니', 'Timpani'],
    ['합창단 보컬', 'Choir vocals'],
    ['합창단', 'Choir'],
    ['매우 specific 모델명', 'Very specific model name'],
    ['모델명', 'model name'],
    ['믹싱 기술 용어', 'Mixing technical term'],
    ['기술 용어', 'technical term'],
    ['기술', 'tech'],
    ['용어', 'term'],
    ['긍정적, 영감 주는', 'Positive, inspiring'],
    ['긍정적', 'positive'],
    ['영감 주는', 'inspiring'],
    ['우울한, 회상적인', 'Melancholic, reflective'],
    ['회상적인', 'reflective'],
    ['회상적', 'reflective'],
    ['음울한, 불길한', 'Gloomy, ominous'],
    ['음울한', 'gloomy'],
    ['불길한', 'ominous'],
    ['향수, 회고적', 'Nostalgia, retrospective'],
    ['회고적', 'retrospective'],
    ['몽환적, 흐릿한', 'Dreamy, hazy'],
    ['흐릿한', 'hazy'],
    ['웅장한, 영웅적', 'Grand, heroic'],
    ['웅장한', 'Grand'],
    ['영웅적', 'heroic'],
    ['로맨틱한', 'Romantic'],
    ['로맨틱', 'Romantic'],
    ['으스스한', 'Eerie'],
    ['쓰면서 단', 'Bitter while writing'],
    ['개 소리', 'Dog sounds'],
    ['개', 'Dog'],
    ['새 비명', 'Bird scream'],
    ['비명', 'scream'],
    ['검열음', 'Censored sound'],
    ['검열', 'censor'],
    ['명시적 콘텐츠', 'Explicit content'],
    ['명시적', 'explicit'],
    ['콘텐츠', 'content'],
    ['한 줄을 짧게', 'Keep line short'],
    ['짧은 정적', 'Short silence'],
    ['잠시 멈춤', 'Brief pause'],
    ['잠시', 'brief'],
    ['멈춤', 'pause'],
    ['특정 운율 패턴 강제', 'Force a specific rhyme pattern'],
    ['운율', 'rhyme'],
    ['운율 패턴', 'rhyme pattern'],
    ['한국어 중 영어 단어 발음', 'English-word pronunciation inside Korean'],
    ['장조', 'Major key'],
    ['교회 선법', 'Church modes'],
    ['교회', 'church'],
    ['선법', 'modes'],
    ['특정 코드 진행', 'Specific chord progression'],
    ['코드 진행', 'chord progression'],
    ['진행', 'progression'],
    ['무조성/12음 기법', 'Atonal / 12-tone technique'],
    ['무조성', 'Atonal'],
    ['12음 기법', '12-tone technique'],
    ['기법', 'technique'],
    ['중요 태그를 첫 20-30단어에', 'Place key tags in the first 20-30 words'],
    ['중요 태그', 'key tags'],
    ['중요', 'important'],
    ['산문 대신 키워드', 'Use keywords instead of prose'],
    ['산문', 'prose'],
    ['대신', 'instead of'],
    ['개인 라이브러리 구축', 'Build a personal library'],
    ['라이브러리 구축', 'library build'],
    ['라이브러리', 'library'],
    ['개인', 'personal'],
    ['구축', 'build'],
    ['구조태그를 Style에, 장르를 Lyrics에', 'Structure tags in Style, genre in Lyrics'],
    ['문장형 설명', 'Sentence-style description'],
    ['문장형', 'sentence-style'],
    ['문장', 'sentence'],
    ['설명', 'description'],
    ['정확한 템포 지정', 'Exact tempo spec'],
    ['템포 지정', 'tempo spec'],
    ['지정', 'spec'],
    ['최신 버전', 'Latest version'],
    ['최신', 'latest'],
    ['버전', 'version'],
    ['무료 플랜', 'Free plan'],
    ['무료', 'free'],
    ['플랜', 'plan'],
    ['구버전', 'Older version'],
    ['구', 'old'],
    ['신스 스탭, 보컬 찹', 'Synth stabs, vocal chops'],
    ['찹', 'chop'],
    ['클라이맥스 후 마무리', 'Outro after climax'],
    ['피아노 도입', 'Piano intro'],
    ['도입', 'intro'],
    ['스트링 추가', 'Strings added'],
    ['스트링', 'Strings'],
    ['추가', 'added'],
    ['점층적 고조', 'Gradual build-up'],
    ['점층적', 'gradual'],
    ['후렴 폭발 창법', 'Chorus-explosion vocal style'],
    ['후렴 폭발', 'chorus explosion'],
    ['절절한 감정', 'Heart-wrenching emotion'],
    ['절절한', 'heart-wrenching'],
    ['감성적', 'sensitive'],
    ['마지막 후렴 반음 올림', 'Final chorus — half-step up'],
    ['마지막 후렴', 'final chorus'],
    ['반음 올림', 'half-step up'],
    ['반음', 'half-step'],
    ['올림', 'up'],
    ['절절한 후렴', 'Heart-wrenching chorus'],
    ['스트링 폭발 직전', 'Right before strings explode'],
    ['트럼펫/색소폰', 'Trumpet / saxophone'],
    ['통통 튀는 박자', 'Bouncy time'],
    ['통통 튀는', 'bouncy'],
    ['한 맺힌 절절함', 'Han-laden depth (절절함)'],
    ['한 맺힌', 'han-laden'],
    ['절절함', 'heart-wrenching feel'],
    ['한국 고유 창법', 'Korean signature vocal style'],
    ['고유', 'signature'],
    ['트로트 특유 정서', 'Trot signature feel'],
    ['특유 정서', 'signature feel'],
    ['정서', 'feel'],
    ['~아~ 같은 표현', 'Expressions like \'~아~\''],
    ['같은 표현', 'such expressions'],
    ['같은', 'such'],
    ['명시적 랩 태그', 'Explicit rap tag'],
    ['오토튠 후렴', 'Auto-tune chorus'],
    ['실로폰', 'Xylophone'],
    ['따라부르기 좋은', 'Singable / catchy'],
    ['따라부르기', 'sing-along'],
    ['예: 사랑해 (사랑해)', 'e.g. "Saranghae" (saranghae)'],
    ['예: 꽃이 핀다 (꼬치 핀다)', 'e.g. "Kkochi pinda" (kkochi pinda)'],
    ['예: 너는 my baby', 'e.g. \'You\\\'re my baby\''],
    ['쉼표 적게', 'Few commas'],
    ['쉼표', 'comma'],
    ['적게', 'few'],
    ['마침표, 줄바꿈 많이', 'Periods, lots of line breaks'],
    ['마침표', 'period'],
    ['줄바꿈', 'line breaks'],
    ['많이', 'many'],
    ['경상도/전라도 사투리', 'Gyeongsang / Jeolla dialect'],
    ['사투리', 'dialect'],
    ['트로트, 신중현 사이키델릭 록', 'Trot, Shin Jung-hyun Psychedelic Rock'],
    ['통기타 포크, 트로트', 'Folk-guitar Folk, Trot'],
    ['디스코, 가요제 그룹사운드', 'Disco, Music-Festival group sound'],
    ['가요제 그룹사운드', 'Music-Festival group sound'],
    ['그룹사운드', 'group sound'],
    ['그룹', 'group'],
    ['라디오 음질', 'Radio sound quality'],
    ['음질', 'sound quality'],
    ['빅밴드 편곡', 'Big-band arrangement'],
    ['편곡', 'arrangement'],
    ['세련된 보컬', 'Refined vocals'],
    ['세련된', 'refined'],
    ['극장식 전달', 'Theatrical delivery'],
    ['극장식', 'theatrical'],
    ['전달', 'delivery'],
    ['무도장 분위기', 'Ballroom atmosphere'],
    ['무도장', 'ballroom'],
    ['퍼즈 기타', 'Fuzz guitar'],
    ['퍼즈', 'Fuzz'],
    ['해먼드 오르간', 'Hammond organ'],
    ['해먼드', 'Hammond'],
    ['공간감 가득', 'Spacious'],
    ['가득', 'full'],
    ['진공관 앰프', 'Tube amp'],
    ['진공관', 'tube'],
    ['앰프', 'amp'],
    ['통기타 핑거링', 'Acoustic-guitar fingerpicking'],
    ['통기타', 'Acoustic guitar'],
    ['핑거링', 'fingerpicking'],
    ['따뜻한 탬버린', 'Warm tambourine'],
    ['명동 쉘부르 분위기', 'Myeong-dong Chebourg atmosphere'],
    ['디스코 스트링', 'Disco strings'],
    ['한국식 디스코 뉘앙스', 'Korean-style disco nuance'],
    ['뉘앙스', 'nuance'],
    ['게이트 리버브 스네어', 'Gated-reverb snare'],
    ['게이트', 'gated'],
    ['색소폰 솔로', 'Saxophone solo'],
    ['풍성한 스트링', 'Rich strings'],
    // Tag-tab batch 2 (auto-batch)
    ['트로트 비교적', 'Trot — often applied'],
    ['인더스트리얼 일렉트로닉', 'Industrial Electronic'],
    ['인더스트리얼', 'Industrial'],
    ['헤비 베이스 일렉', 'Heavy bass Electronic'],
    ['헤비 메탈', 'Heavy Metal'],
    ['헤비 록', 'Heavy Rock'],
    ['헤비', 'Heavy'],
    ['저음질 따뜻함', 'Lo-fi warmth'],
    ['저음질', 'Lo-fi'],
    ['리듬 앤 블루스', 'Rhythm and Blues'],
    ['그루브 기반', 'Groove-based'],
    ['기반', 'based'],
    ['빠르고 공격적', 'Fast and aggressive'],
    ['시애틀 사운드', 'Seattle sound'],
    ['시애틀', 'Seattle'],
    ['신디사이저 팝', 'Synthesizer Pop'],
    ['신디사이저', 'Synthesizer'],
    ['클럽 지향 팝', 'Club-oriented Pop'],
    ['클럽 지향', 'Club-oriented'],
    ['지향', '-oriented'],
    ['접근성 좋은 재즈', 'Accessible Jazz'],
    ['접근성 좋은', 'Accessible'],
    ['접근성', 'accessibility'],
    ['좋은', 'good'],
    ['침실 팝', 'Bedroom Pop'],
    ['침실', 'Bedroom'],
    ['몽환적 록', 'Dreamy Rock'],
    ['몽환적', 'Dreamy'],
    ['라틴 어반', 'Latin Urban'],
    ['어반', 'Urban'],
    ['쿠바 댄스', 'Cuban Dance'],
    ['쿠바', 'Cuban'],
    ['시대 + 장르 결합', 'Era + genre combo'],
    ['매우 niche 서브장르', 'Very niche sub-genre'],
    ['서브장르', 'sub-genre'],
    ['서브', 'sub-'],
    ['특정 아티스트명', 'Specific artist name'],
    ['아티스트명', 'artist name'],
    ['복수 장르 결합', 'Multiple-genre combo'],
    ['복수', 'multiple'],
    ['결합', 'combination'],
    ['브레이크비트', 'Breakbeat'],
    ['스윙 리듬', 'Swing rhythm'],
    ['스윙', 'Swing'],
    ['중간 템포', 'Mid tempo'],
    ['중간', 'Mid'],
    ['추진력 있는', 'Driving'],
    ['추진력', 'drive'],
    ['빠르게', 'Fast'],
    ['매우 빠르게', 'Very fast'],
    ['걷는 속도', 'Walking pace'],
    ['걷는', 'walking'],
    ['속도', 'speed'],
    ['박자 변경', 'Time-signature change'],
    ['변경', 'change'],
    ['곡 중간 템포 변화', 'Mid-song tempo change'],
    ['곡 중간', 'Mid-song'],
    ['곡', 'Song'],
    ['성인 내레이터', 'Adult narrator'],
    ['성인', 'adult'],
    ['내레이터', 'narrator'],
    ['말하듯이', 'Spoken-style'],
    ['속삭이듯', 'Whispered'],
    ['속삭이는 보컬', 'Whispering vocals'],
    ['속삭이는', 'whispering'],
    ['속삭임', 'whisper'],
    ['가성', 'Falsetto'],
    ['파워풀한 지속음', 'Powerful sustained tone'],
    ['파워풀한', 'Powerful'],
    ['지속음', 'sustained tone'],
    ['부드러운 친밀 창법', 'Smooth intimate vocal style'],
    ['친밀 창법', 'intimate vocal style'],
    ['친밀한', 'Intimate'],
    ['친밀', 'intimate'],
    ['오페라 창법', 'Opera vocal style'],
    ['오페라', 'Opera'],
    ['하모니', 'Harmony'],
    ['강력한', 'Powerful'],
    ['관능적인', 'Sensual'],
    ['관능적', 'sensual'],
    ['우울한', 'Melancholic'],
    ['기쁜', 'Joyful'],
    ['반항적인', 'Rebellious'],
    ['반항적', 'rebellious'],
    ['보코더', 'Vocoder'],
    ['100 BPM 베드룸 팝', '100 BPM Bedroom Pop'],
    ['110 BPM 트로피컬 하우스', '110 BPM Tropical House'],
    ['140 BPM 멈블 랩', '140 BPM Mumble Rap'],
    ['160 BPM 하이퍼팝', '160 BPM Hyperpop'],
    ['110 BPM 글로벌 아프로비츠', '110 BPM Global Afrobeats'],
    ['85 BPM Lo-fi 부흥', '85 BPM Lo-fi revival'],
    ['130 BPM 드리프트 펑크', '130 BPM Drift phonk'],
    ['130 BPM 1938 스윙', '130 BPM 1938 Swing'],
    ['130 BPM 1956 록앤롤', '130 BPM 1956 Rock-and-Roll'],
    ['110 BPM 1967 사이키델릭', '110 BPM 1967 Psychedelic'],
    ['110 BPM 1993 그런지', '110 BPM 1993 Grunge'],
    ['160 BPM 2003 팝펑크', '160 BPM 2003 Pop-punk'],
    ['95 BPM 2023 다크 팝', '95 BPM 2023 Dark Pop'],
    ['2010년대 인디 미학', '2010s Indie aesthetic'],
    ['2020년대 정의 키워드', '2020s defining keyword'],
    ['미학', 'aesthetic'],
    ['정의 키워드', 'defining keyword'],
    ['정의', 'definition'],
    ['종말기', 'end era'],
    ['정점', 'peak'],
    ['크렁크 정점', 'Crunk peak'],
    ['크렁크', 'Crunk'],
    ['EDM 정점 시기', 'EDM peak period'],
    ['시기', 'period'],
    ['트랩 시그니처 프로듀서', 'Trap signature producer'],
    ['프로듀서', 'producer'],
    ['하이퍼팝 시그니처', 'Hyperpop signature'],
    ['하이퍼팝', 'Hyperpop'],
    ['드리프트 펑크', 'Drift phonk'],
    ['드리프트', 'drift'],
    ['아프로비츠', 'Afrobeats'],
    ['부흥', 'revival'],
    ['1980s Synth-Pop보다 훨씬 정확', 'Far more precise than 1980s Synth-Pop'],
    ['훨씬', 'far more'],
    ['펑크 황금기 정확히 지정', 'Funk golden age — exact spec'],
    ['황금기', 'golden age'],
    ['우드스톡 직전 사이키델릭', 'Pre-Woodstock Psychedelic'],
    ['우드스톡', 'Woodstock'],
    ['직전', 'right before'],
    ['디스코 종말기', 'End of disco era'],
    ['모타운 황금기', 'Motown golden age'],
    ['모타운', 'Motown'],
    ['단일 채널 녹음', 'Single-channel recording'],
    ['단일 채널', 'single channel'],
    ['채널', 'channel'],
    ['셸락 디스크 특유 노이즈', 'Shellac-disc characteristic noise'],
    ['셸락 디스크', 'Shellac disc'],
    ['셸락', 'shellac'],
    ['디스크', 'disc'],
    ['특유 노이즈', 'characteristic noise'],
    ['노이즈', 'noise'],
    ['카본 마이크 톤', 'Carbon-mic tone'],
    ['카본 마이크', 'Carbon mic'],
    ['카본', 'Carbon'],
    ['마이크', 'mic'],
    ['50년대 후반 스테레오', 'Late-50s stereo'],
    ['스테레오', 'stereo'],
    ['슬랩백 에코', 'Slap-back echo'],
    ['슬랩백', 'Slap-back'],
    ['에코', 'echo'],
    ['엘비스 시대 톤', 'Elvis-era tone'],
    ['엘비스', 'Elvis'],
    ['시대 톤', 'era tone'],
    ['60년대 라디오 믹스', '60s radio mix'],
    ['라디오 믹스', 'radio mix'],
    ['믹스', 'mix'],
    ['James Jamerson 톤', 'James Jamerson tone'],
    ['70년대 아날로그 톤', '70s analog tone'],
    ['테이프 압축감', 'Tape compression'],
    ['압축감', 'compression'],
    ['특정 콘솔 톤 안됨', 'Specific console tone — doesn\'t work'],
    ['특정 콘솔', 'specific console'],
    ['콘솔 톤', 'console tone'],
    ['콘솔', 'console'],
    ['안됨', 'doesn\'t work'],
    ['80년대 신스 톤', '80s synth tone'],
    ['80년대 디지털 톤', '80s digital tone'],
    ['90년대 라우드', '90s loudness'],
    ['라우드', 'loudness'],
    ['2000년대 폴리시드', '2000s polished'],
    ['폴리시드', 'polished'],
    ['과도한 컴프', 'Excessive compression'],
    ['과도한', 'Excessive'],
    ['컴프', 'compression'],
    ['2010년대 클럽 톤', '2010s club tone'],
    ['클럽 톤', 'club tone'],
    ['소리 작게 마스터링', 'Quiet-mastered'],
    ['작게', 'quietly'],
    ['마스터링', 'mastering'],
    ['2020년대 톤', '2020s tone'],
    ['플랫폼 최적화', 'Platform optimisation'],
    ['플랫폼', 'platform'],
    ['최적화', 'optimisation'],
    ['1920s 일반 재즈는 OK', '1920s general Jazz is OK'],
    ['일반 비밥만 반영', 'Only general bebop reflected'],
    ['일반', 'general'],
    ['비밥', 'Bebop'],
    ['비밥 재즈', 'Bebop Jazz'],
    ['빅밴드 시대', 'Big-band era'],
    ['빅밴드', 'Big band'],
    ['뉴올리언스 재즈', 'New Orleans Jazz'],
    ['뉴올리언스', 'New Orleans'],
    ['황홀한', 'Ecstatic'],
    ['승리한, 성공한', 'Victorious, successful'],
    ['승리한', 'victorious'],
    ['성공한', 'successful'],
    ['불안한, 긴장된', 'Anxious, tense'],
    ['불안한', 'anxious'],
    ['긴장된', 'tense'],
    ['신비로운, 호기심', 'Mystical, curious'],
    ['호기심', 'curiosity'],
    ['행복한, 축하하는', 'Happy, celebratory'],
    ['행복한', 'happy'],
    ['축하하는', 'celebratory'],
    ['진지한, 엄숙한', 'Serious, solemn'],
    ['진지한', 'serious'],
    ['엄숙한', 'solemn'],
    ['강렬한, 드라마틱', 'Intense, dramatic'],
    ['강렬한', 'intense'],
    ['드라마틱', 'dramatic'],
    ['평화로운, 고요한', 'Peaceful, tranquil'],
    ['평화로운', 'peaceful'],
    ['고요한', 'tranquil'],
    ['장난스러운', 'Playful'],
    ['친밀한, 가까운', 'Intimate, close'],
    ['가까운', 'close'],
    ['최대 강도', 'Maximum intensity'],
    ['최대', 'max'],
    ['강도', 'intensity'],
    ['중간 강도', 'Medium intensity'],
    ['폭발적', 'Explosive'],
    ['증가하는', 'Increasing'],
    ['편안한', 'Comfortable'],
    ['광적인, 빠른', 'Frantic, fast'],
    ['광적인', 'frantic'],
    ['일정한', 'Constant'],
    ['따뜻한, 저하된', 'Warm, lo-fi'],
    ['저하된', 'lo-fi'],
    ['거친, 왜곡된', 'Raw, distorted'],
    ['왜곡된', 'distorted'],
    ['미가공, 라이브', 'Unprocessed, live'],
    ['미가공', 'unprocessed'],
    ['풍성한, 풍부한', 'Rich, abundant'],
    ['풍부한', 'abundant'],
    ['미니멀한, 빈', 'Minimal, empty'],
    ['미니멀한', 'Minimal'],
    ['빈', 'empty'],
    ['테이프 따뜻함', 'Tape warmth'],
    ['따뜻함', 'warmth'],
    ['타이트, 임팩트', 'Tight, impactful'],
    ['타이트', 'tight'],
    ['임팩트', 'impact'],
    ['풍부한 중저음', 'Rich mid-lows'],
    ['중저음', 'mid-lows'],
    ['향상된 고음', 'Enhanced highs'],
    ['향상된', 'enhanced'],
    ['고음', 'highs'],
    ['프로페셔널 믹스', 'Professional mix'],
    ['프로페셔널', 'professional'],
    ['모순 조합', 'Contradictory combo'],
    ['모순', 'contradictory'],
    ['극단적 추상 표현', 'Extremely abstract expression'],
    ['극단적', 'extreme'],
    ['추상 표현', 'abstract expression'],
    ['추상', 'abstract'],
    ['표현', 'expression'],
    ['환호', 'Cheer'],
    ['박수', 'Applause'],
    ['완전한 정적', 'Complete silence'],
    ['완전한', 'complete'],
    ['정적', 'silence'],
    ['볼륨 감소', 'Volume decrease'],
    ['볼륨', 'volume'],
    ['감소', 'decrease'],
    ['갑작스러운 종료', 'Sudden end'],
    ['갑작스러운', 'sudden'],
    ['종료', 'end'],
    ['빗소리', 'Rain sounds'],
    ['천둥 소리', 'Thunder'],
    ['천둥', 'thunder'],
    ['바람 소리', 'Wind sounds'],
    ['바람', 'wind'],
    ['바다 파도', 'Ocean waves'],
    ['바다', 'ocean'],
    ['파도', 'waves'],
    ['새소리', 'Bird sounds'],
    ['새', 'birds'],
    ['캠프파이어', 'Campfire'],
    ['숲 소리', 'Forest sounds'],
    ['숲', 'forest'],
    ['한숨', 'Sigh'],
    ['키득거림', 'Giggle'],
    ['가벼운 웃음', 'Light laughter'],
    ['가벼운', 'light'],
    ['웃음', 'laughter'],
    ['전화벨', 'Phone ring'],
    ['전화', 'phone'],
    ['전자음', 'Electronic sound'],
    ['벨소리', 'Ringtone'],
    ['벨', 'bell'],
    // Tag-tab pattern coverage (auto-batch, longest-first)
    ['120 BPM, 90 BPM 등', '120 BPM, 90 BPM etc.'],
    ['뽕끼', 'ppong (Trot feel)'],
    ['한국 힙합', 'Korean Hip-hop'],
    ['동요', 'Children\'s songs'],
    ['(무조건)', '(always)'],
    ['(비교적)', '(often)'],
    ['(잘 안 됨)', '(rarely)'],
    ['(시도 가능)', '(worth trying)'],
    ['(중요!)', '(important!)'],
    ['(Advanced)', '(Advanced)'],
    ['(✅ 권장)', '(✅ recommended)'],
    ['(❌ 피하기)', '(❌ avoid)'],
    ['필수 태그', 'essential tags'],
    ['특화 태그', 'specialised tags'],
    ['보완책', 'compensation'],
    ['개선점', 'improvements'],
    ['V5 한계', 'V5 limits'],
    ['V5 개선점', 'V5 improvements'],
    ['Lyrics 필드', 'Lyrics field'],
    ['Exclude 필드', 'Exclude field'],
    ['Style 필드', 'Style field'],
    ['버전별 한국어 능력', 'Korean ability by version'],
    ['한국 랩 특화 팁', 'Korean rap tips'],
    ['동요 특화 태그', 'Children\'s-song tags'],
    ['3) 영어 단어 처리', '3) English-word handling'],
    ['4) 호흡 조절 부호', '4) Phrasing punctuation'],
    ['BPM 범위', 'BPM range'],
    ['시대별 흐름', 'Era-by-era flow'],
    ['시대별 BPM', 'BPM by era'],
    ['시대적 어휘', 'Era vocabulary'],
    ['올드 트로트 특화 태그', 'Old Trot tags'],
    ['재즈 가요 핵심 태그', 'Jazz K-pop core tags'],
    ['한국 디스코 핵심 태그', 'Korean Disco core tags'],
    ['한국 시티팝 핵심 태그', 'Korean City-pop core tags'],
    ['TOP 9 순위', 'TOP 9 ranking'],
    ['아프로 핵심 태그', 'Afro core tags'],
    ['록/메탈 핵심 태그', 'Rock / Metal core tags'],
    ['인도 음악 핵심 악기', 'Indian music core instruments'],
    ['아시아 - 인도', 'Asia – India'],
    ['아시아 - 일본', 'Asia – Japan'],
    ['아시아 - 중국', 'Asia – China'],
    ['아시아 - 한국', 'Asia – Korea'],
    ['라틴/스페인', 'Latin / Spain'],
    ['멕시코', 'Mexico'],
    ['중동', 'Middle East'],
    ['아일랜드/켈틱', 'Ireland / Celtic'],
    ['미국 컨트리', 'American Country'],
    ['범용 글로벌 공식', 'Universal global formula'],
    ['🔴 너무 정확한 연도+장르', '🔴 Too-specific year + genre'],
    ['✅ 잘 통하는 공식', '✅ Working formula'],
    ['❌ 피해야 할 실수 #1', '❌ Mistake to avoid #1'],
    ['❌ 피해야 할 실수 #2', '❌ Mistake to avoid #2'],
    ['❌ 피해야 할 실수 #3', '❌ Mistake to avoid #3'],
    ['❌ 피해야 할 실수 #4', '❌ Mistake to avoid #4'],
    ['❌ 피해야 할 실수 #5', '❌ Mistake to avoid #5'],
    ['❌ 피해야 할 실수 #6', '❌ Mistake to avoid #6'],
    ['핵심 팁', 'Core tip'],
    ['그루브 패턴', 'Groove pattern'],
    ['상대적 속도', 'Relative tempo'],
    ['클래식 템포', 'Classical tempo'],
    ['성별', 'Gender'],
    ['연령', 'Age'],
    ['창법', 'Vocal style'],
    ['감정 톤', 'Emotional tone'],
    ['건반', 'Keyboards'],
    ['현악기', 'Strings'],
    ['관악기', 'Winds'],
    ['드럼/퍼커션', 'Drums / Percussion'],
    ['퍼커션', 'percussion'],
    ['전자/신스', 'Electronic / synth'],
    ['오케스트라', 'Orchestra'],
    ['무드', 'Mood'],
    ['에너지', 'Energy'],
    ['텍스처/프로덕션', 'Texture / production'],
    ['인간 소리', 'Human sounds'],
    ['음악 효과', 'Music effects'],
    ['환경음', 'Ambient sounds'],
    ['기계음', 'Machine sounds'],
    ['동물', 'Animals'],
    ['필터', 'Filter'],
    ['특수 태그', 'Special tags'],
    ['키', 'Key'],
    ['모드', 'Mode'],
    ['코드', 'Chord'],
    ['대위법', 'Counterpoint'],
    ['페이드 효과', 'Fade effect'],
    ['웅장한 마무리', 'Grand outro'],
    ['후렴 변주', 'Chorus variation'],
    ['조성 변화', 'Key change'],
    ['템포 변화', 'Tempo change'],
    ['악기 변화', 'Instrument change'],
    ['리듬 변화', 'Rhythm change'],
    ['분위기 변화', 'Mood change'],
    ['음역 변화', 'Range change'],
    ['음색 변화', 'Timbre change'],
    ['스피드 변화', 'Speed change'],
    ['강약 변화', 'Dynamic change'],
    ['드럼 변화', 'Drum change'],
    ['멜로디 변화', 'Melody change'],
    ['코드 변화', 'Chord change'],
    ['패턴 변화', 'Pattern change'],
    ['악기 추가', 'Instrument added'],
    ['악기 제거', 'Instrument removed'],
    ['브레이크다운', 'Breakdown'],
    ['빌드업', 'Build-up'],
    ['후렴부', 'Chorus section'],
    ['절부', 'Verse section'],
    ['도입부', 'Intro'],
    ['종결부', 'Outro'],
    ['간주부', 'Interlude'],
    ['브리지부', 'Bridge'],
    ['아웃트로', 'Outro'],
    ['인트로', 'Intro'],
    ['브리지', 'Bridge'],
    ['프리코러스', 'Pre-chorus'],
    ['포스트코러스', 'Post-chorus'],
    ['훅', 'Hook'],
    ['벌스', 'Verse'],
    ['코러스', 'Chorus'],
    ['스튜디오 녹음', 'Studio recording'],
    ['라이브 녹음', 'Live recording'],
    ['스튜디오', 'Studio'],
    ['라이브', 'Live'],
    ['녹음', 'Recording'],
    ['믹싱', 'Mixing'],
    ['마스터링', 'Mastering'],
    ['아날로그', 'Analog'],
    ['디지털 녹음', 'Digital recording'],
    ['디지털', 'Digital'],
    ['아날로그 녹음', 'Analog recording'],
    ['테이프 녹음', 'Tape recording'],
    ['테이프', 'Tape'],
    ['비닐 녹음', 'Vinyl recording'],
    ['비닐', 'Vinyl'],
    ['스튜디오 분위기', 'Studio atmosphere'],
    ['라이브 분위기', 'Live atmosphere'],
    ['클럽 분위기', 'Club atmosphere'],
    ['축제 분위기', 'Festival atmosphere'],
    ['파티 분위기', 'Party atmosphere'],
    ['로맨틱 분위기', 'Romantic atmosphere'],
    ['어두운 분위기', 'Dark atmosphere'],
    ['밝은 분위기', 'Bright atmosphere'],
    ['우울한 분위기', 'Melancholic atmosphere'],
    ['희망적 분위기', 'Hopeful atmosphere'],
    ['긴장된 분위기', 'Tense atmosphere'],
    ['이완된 분위기', 'Relaxed atmosphere'],
    ['미스터리한 분위기', 'Mysterious atmosphere'],
    ['환상적 분위기', 'Fantastical atmosphere'],
    ['서사적 분위기', 'Epic atmosphere'],
    ['회고적 분위기', 'Nostalgic atmosphere'],
    ['일상적 분위기', 'Everyday atmosphere'],
    ['도시적 분위기', 'Urban atmosphere'],
    ['자연적 분위기', 'Natural atmosphere'],
    ['사이키델릭 분위기', 'Psychedelic atmosphere'],
    ['미래적 분위기', 'Futuristic atmosphere'],
    ['빈티지 분위기', 'Vintage atmosphere'],
    ['모던 분위기', 'Modern atmosphere'],
    ['전통적 분위기', 'Traditional atmosphere'],
    ['분위기', 'Mood'],
    ['느낌', 'feel'],
    ['느낌적', 'feel-like'],
    ['기분', 'vibe'],
    ['그루브', 'groove'],
    ['리듬감', 'rhythmic sense'],
    ['박력', 'force'],
    ['긴장감', 'tension'],
    ['이완감', 'relaxation'],
    ['공간감', 'spaciousness'],
    ['질감', 'texture'],
    ['색감', 'color'],
    ['입체감', 'depth'],
    ['동작감', 'movement'],
    ['템포감', 'tempo feel'],
    ['속도감', 'speed feel'],
    ['힘', 'power'],
    ['무게감', 'heaviness'],
    ['부드러움', 'smoothness'],
    ['거칠음', 'roughness'],
    ['깔끔함', 'cleanness'],
    ['정제됨', 'polish'],
    ['자연스러움', 'naturalness'],
    ['인위적', 'artificial'],
    ['기계적', 'mechanical'],
    ['자연적', 'natural'],
    ['정확한', 'exact'],
    ['정확한 BPM', 'exact BPM'],
    ['정확한 곡 길이', 'exact song length'],
    ['정확한 키', 'exact key'],
    ['정확한 시대', 'exact era'],
    ['정확한 장르', 'exact genre'],
    ['정확한 분위기', 'exact mood'],
    ['너무 정확한', 'too specific'],
    ['너무', 'too'],
    ['정확', 'exact'],
    ['연도+장르', 'year + genre'],
    ['연도', 'year'],
    ['장르', 'genre'],
    ['범위', 'range'],
    ['흐름', 'flow'],
    ['권장', 'recommended'],
    ['피하기', 'avoid'],
    ['범용', 'universal'],
    ['개선점', 'improvements'],
    ['한계', 'limits'],
    ['능력', 'ability'],
    ['버전별', 'by version'],
    ['시대별', 'by era'],
    ['효과적', 'effective'],
    ['실수', 'mistake'],
    ['피해야 할', 'to avoid'],
    ['필수', 'essential'],
    ['특화', 'specialised'],
    ['공식', 'formula'],
    ['통하는', 'working'],
    ['순위', 'ranking'],
    ['올드', 'Old'],
    ['올드 트로트', 'Old Trot'],
    ['재즈 가요', 'Jazz K-pop'],
    ['한국 디스코', 'Korean Disco'],
    ['한국 시티팝', 'Korean City-pop'],
    ['한국 발라드', 'Korean Ballad'],
    ['한국 록', 'Korean Rock'],
    ['한국 팝', 'Korean Pop'],
    ['한국 재즈', 'Korean Jazz'],
    ['한국 트로트', 'Korean Trot'],
    ['한국 랩', 'Korean rap'],
    ['한국어', 'Korean'],
    ['한국', 'Korea'],
    ['미국', 'America'],
    ['영국', 'UK'],
    ['일본', 'Japan'],
    ['중국', 'China'],
    ['인도', 'India'],
    ['스페인', 'Spain'],
    ['프랑스', 'France'],
    ['독일', 'Germany'],
    ['이탈리아', 'Italy'],
    ['러시아', 'Russia'],
    ['브라질', 'Brazil'],
    ['아르헨티나', 'Argentina'],
    ['멕시코', 'Mexico'],
    ['자메이카', 'Jamaica'],
    ['나이지리아', 'Nigeria'],
    ['가나', 'Ghana'],
    ['남아공', 'South Africa'],
    ['앙골라', 'Angola'],
    ['탄자니아', 'Tanzania'],
    ['콩고', 'Congo'],
    ['코트디부아르', 'Côte d\'Ivoire'],
    ['동아프리카', 'East Africa'],
    ['서아프리카', 'West Africa'],
    ['북아프리카', 'North Africa'],
    ['남아메리카', 'South America'],
    ['북아메리카', 'North America'],
    ['중앙아메리카', 'Central America'],
    ['아시아', 'Asia'],
    ['아프리카', 'Africa'],
    ['라틴아메리카', 'Latin America'],
    ['유럽', 'Europe'],
    ['동유럽', 'Eastern Europe'],
    ['서유럽', 'Western Europe'],
    ['북유럽', 'Nordic'],
    ['남유럽', 'Southern Europe'],
    ['중동', 'Middle East'],
    ['호주', 'Australia'],
    ['뉴질랜드', 'New Zealand'],
    ['아일랜드', 'Ireland'],
    ['켈틱', 'Celtic'],
    ['스코틀랜드', 'Scotland'],
    ['아일랜드/켈틱', 'Ireland / Celtic'],
    ['악기', 'instrument'],
    ['음악', 'music'],
    ['소리', 'sound'],
    ['음', 'tone'],
    ['음색', 'timbre'],
    ['음향', 'audio'],
    ['효과음', 'sound effect'],
    ['효과', 'effect'],
    ['페이드', 'fade'],
    ['페이드인', 'fade-in'],
    ['페이드아웃', 'fade-out'],
    ['페이드아웃 효과', 'Fade-out effect'],
    ['페이드인 효과', 'Fade-in effect'],
    ['리버브 효과', 'Reverb effect'],
    ['딜레이 효과', 'Delay effect'],
    ['코러스 효과', 'Chorus effect'],
    ['디스토션 효과', 'Distortion effect'],
    ['필터 효과', 'Filter effect'],
    ['이큐 효과', 'EQ effect'],
    ['리버브', 'Reverb'],
    ['딜레이', 'Delay'],
    ['이큐', 'EQ'],
    ['컴프레서', 'Compressor'],
    ['리미터', 'Limiter'],
    ['이펙터', 'Effector'],
    ['플랜저', 'Flanger'],
    ['페이저', 'Phaser'],
    ['워-와', 'Wah-wah'],
    ['조성', 'tonality'],
    ['변주', 'variation'],
    ['변화', 'change'],
    ['변형', 'variant'],
    ['변동', 'variation'],
    ['변환', 'conversion'],
    ['전조', 'modulation'],
    ['화성', 'harmony'],
    ['화음', 'harmony'],
    ['불협화음', 'dissonance'],
    ['협화음', 'consonance'],
    ['대위', 'counterpoint'],
    ['멜로디', 'melody'],
    ['선율', 'melody'],
    ['리듬', 'rhythm'],
    ['박자', 'time'],
    ['템포', 'tempo'],
    ['키', 'key'],
    ['모드', 'mode'],
    ['음계', 'scale'],
    ['음정', 'interval'],
    ['음역', 'range'],
    ['화성진행', 'harmonic progression'],
    ['진행', 'progression'],
    ['코드 진행', 'chord progression'],
    ['음역', 'range'],
    // 162 dance-tag KO entries (auto-batch)
    ['그라울 베이스 (브로스텝)', 'Growl bass (brostep)'],
    ['리스 베이스 (D&B 표준)', 'Reese bass (D&B standard)'],
    ['디스토션 베이스', 'Distortion bass'],
    ['플럭드 베이스', 'Plucked bass'],
    ['펑크 베이스', 'Funk bass'],
    ['스로빙 베이스 (펄스 베이스)', 'Throbbing bass (pulse bass)'],
    ['펄세이팅 베이스', 'Pulsating bass'],
    ['바운시 플럭드 베이스 (퓨처 하우스)', 'Bouncy plucked bass (future house)'],
    ['컴프레스드 베이스', 'Compressed bass'],
    ['빈 베이스 (루마니안 미니멀)', 'Empty bass (Romanian minimal)'],
    ['멜로딕 베이스라인', 'Melodic bassline'],
    ['드라이빙 베이스라인', 'Driving bassline'],
    ['퍼커시브 베이스 (테크 하우스)', 'Percussive bass (tech house)'],
    ['서브 베이스 주파수', 'Sub-bass frequency'],
    ['무거운 808 서브베이스 (트랩)', 'Heavy 808 sub-bass (trap)'],
    ['디튠 베이스', 'Detuned bass'],
    ['수퍼소우 리드 (빅룸/트랜스)', 'Supersaw lead (big-room / trance)'],
    ['유포릭 리드', 'Euphoric lead'],
    ['피아노 스탭 (하우스)', 'Piano stabs (house)'],
    ['레이브 스탭', 'Rave stabs'],
    ['코드 스탭', 'Chord stabs'],
    ['아르페지오 패턴', 'Arpeggio pattern'],
    ['플럭드 신스', 'Plucked synth'],
    ['디튠 리드 (하드스타일)', 'Detuned lead (hardstyle)'],
    ['스크리밍 신스 리드', 'Screaming synth lead'],
    ['빈티지 블립 신스', 'Vintage bleep synth'],
    ['칩튠 리드', 'Chiptune lead'],
    ['에어리 패드', 'Airy pad'],
    ['러시한 패드', 'Rushed pad'],
    ['앰비언트 패드', 'Ambient pad'],
    ['드리미 패드', 'Dreamy pad'],
    ['딥 스페이스 패드', 'Deep space pad'],
    ['따뜻한 아날로그 패드', 'Warm analog pad'],
    ['폴리포닉 신스', 'Polyphonic synth'],
    ['모듈러 신스', 'Modular synth'],
    ['스타카토 신스', 'Staccato synth'],
    ['애시드 리드', 'Acid lead'],
    ['트랜스 리드', 'Trance lead'],
    ['소우투스 리드', 'Sawtooth lead'],
    ['FM 벨 신스', 'FM bell synth'],
    ['퓨처 베이스 코드 (수퍼소우 스택)', 'Future-bass chords (supersaw stack)'],
    ['서브베이스 + 코드 스택', 'Sub-bass + chord stack'],
    ['챱드 보컬 샘플', 'Chopped vocal sample'],
    ['다이바 보컬 (소울/하우스)', 'Diva vocals (soul / house)'],
    ['소울풀 여성 보컬', 'Soulful female vocals'],
    ['소울풀 남성 보컬', 'Soulful male vocals'],
    ['가스펠 영향 보컬', 'Gospel-influenced vocals'],
    ['에테리얼 여성 보컬', 'Ethereal female vocals'],
    ['브레시 여성 보컬', 'Breathy female vocals'],
    ['보코더 보컬', 'Vocoder vocals'],
    ['토크박스 보컬', 'Talkbox vocals'],
    ['로보틱 보컬', 'Robotic vocals'],
    ['처프드 보컬 (UK 개러지)', 'Chopped vocals (UK garage)'],
    ['MC 보컬', 'MC vocals'],
    ['샤우티드 보컬', 'Shouted vocals'],
    ['스페인어 랩', 'Spanish rap'],
    ['자메이카 패트와 보컬 (덥/레게)', 'Jamaican Patois vocals (dub / reggae)'],
    ['아프리카 보컬 (요루바/스와힐리)', 'African vocals (Yoruba / Swahili)'],
    ['크라우드 챈트 (페스티벌)', 'Crowd chant (festival)'],
    ['애드리브 (Hey, Oh)', 'Ad-libs (Hey, Oh)'],
    ['산스크리트 보컬 샘플 (사이트랜스)', 'Sanskrit vocal sample (psy-trance)'],
    ['오페라 소프라노 (트랜스 앤섬)', 'Opera soprano (trance anthem)'],
    ['스피치 샘플 (정치/연설)', 'Speech samples (political / speech)'],
    ['필름 다이얼로그 샘플', 'Film dialogue samples'],
    ['토킹 보컬 (Dub Poetry)', 'Talking vocals (Dub Poetry)'],
    ['앙골라 보컬 (Kuduro)', 'Angolan vocals (Kuduro)'],
    ['아카펠라 후크', 'A cappella hook'],
    ['필터링된 보컬 (디스코 컷)', 'Filtered vocal (disco cut)'],
    ['우주 신스 빔', 'Cosmic synth beam'],
    ['화이트 노이즈 라이저', 'White-noise riser'],
    ['스윕 노이즈', 'Sweep noise'],
    ['리버스 신스 (서스펜스)', 'Reverse synth (suspense)'],
    ['리버스 시밤', 'Reverse cymbal'],
    ['게이트 리버브 스네어 (80s)', 'Gated-reverb snare (80s)'],
    ['롱 리버브 테일', 'Long reverb tail'],
    ['아날로그 테이프 워밍', 'Analog tape warmth'],
    ['디지털 사이드체인 펌핑', 'Digital sidechain pumping'],
    ['덕킹 컴프레션', 'Ducking compression'],
    ['디스토션 (오버드라이브)', 'Distortion (overdrive)'],
    ['비트크러시 효과', 'Bit-crush effect'],
    ['필터 스윕 (로우/하이패스)', 'Filter sweep (low / high-pass)'],
    ['로파이 텍스처 (테이프 노이즈)', 'Lo-fi texture (tape noise)'],
    ['비닐 크랙클', 'Vinyl crackle'],
    ['플라스틱 클릭 (글리치)', 'Plastic clicks (glitch)'],
    ['쉐이커/탬버린 퍼커션', 'Shaker / tambourine percussion'],
    ['폴리리듬 카우벨', 'Polyrhythmic cowbell'],
    ['스트로보 글리치 (라이저)', 'Strobe glitch (riser)'],
    ['타임 스트레치 보컬', 'Time-stretched vocal'],
    ['3D 패닝 (인이어/이머시브)', '3D panning (in-ear / immersive)'],
    ['도플러 효과 (인터스텔라)', 'Doppler effect (interstellar)'],
    ['폴리오 사운드 (실생활 노이즈)', 'Foley sound (real-life noise)'],
    ['랜덤 글리치 (아방가르드)', 'Random glitches (avant-garde)'],
    ['브레이크다운 (보컬 + 드럼 빠짐)', 'Breakdown (vocals + drums drop out)'],
    ['빌드업 (snare roll + 라이저)', 'Build-up (snare roll + riser)'],
    ['드랍 (메인 베이스 + 강력한 비트)', 'Drop (main bass + powerful beat)'],
    ['페스티벌 드랍 (큰 신스 리드)', 'Festival drop (big synth lead)'],
    ['덥스텝 드랍 (월블 베이스)', 'Dubstep drop (wobble bass)'],
    ['트랩 드랍 (808 + 하이햇)', 'Trap drop (808 + hi-hat)'],
    ['리피티션 빌드 (반복 + 가속)', 'Repetition build (repeat + accelerate)'],
    ['긴 빌드 (트랜스 스타일)', 'Long build (trance style)'],
    ['미니멀 인트로 (페이드인)', 'Minimal intro (fade-in)'],
    ['DJ 친화적 인트로 (블렌딩)', 'DJ-friendly intro (for blending)'],
    ['미니멀 아웃트로', 'Minimal outro'],
    ['백스핀 페이드아웃', 'Backspin fade-out'],
    ['진보적 변화 (deep house, techno)', 'Progressive change (deep house, techno)'],
    ['4×4 페이즈 구조', '4×4 phrase structure'],
    ['32마디 페이즈 (트랜스)', '32-bar phrase (trance)'],
    ['16마디 페이즈 (하우스)', '16-bar phrase (house)'],
    ['8마디 페이즈 (하드 댄스)', '8-bar phrase (hard dance)'],
    ['16마디 빌드', '16-bar build'],
    ['32마디 빌드 (긴 트랜스)', '32-bar build (long trance)'],
    ['페스티벌 빌드 (3단)', 'Festival build (3-stage)'],
    ['듀얼 드랍 (트윈 후크)', 'Dual drop (twin hook)'],
    ['스위치업 (베이스 교체)', 'Switch-up (bass swap)'],
    ['키 체인지 (감정 상승)', 'Key change (emotional lift)'],
    ['템포 체인지 (역동성)', 'Tempo change (dynamic)'],
    ['리듬 모듈레이션', 'Rhythm modulation'],
    ['스토리텔링 구조 (5단 빌드)', 'Storytelling structure (5-stage build)'],
    ['프로그레시브 빌드 (점진적 누적)', 'Progressive build (gradual accumulation)'],
    ['팬텀 드랍 (드랍이 사라짐)', 'Phantom drop (drop fades out)'],
    ['페이크 드랍 (예상 깨기)', 'Fake drop (expectation-breaking)'],
    ['스위치 드랍 (장르 전환)', 'Switch drop (genre change)'],
    ['디머지드 드랍 (서서히)', 'Demerged drop (gradual)'],
    ['어택 드랍 (즉시 폭발)', 'Attack drop (instant burst)'],
    ['브레이크 (드럼만, 빌드 직전)', 'Break (drums only, right before build)'],
    ['싱코페이션 (엇박자)', 'Syncopation (off-beat)'],
    ['폴리리듬 (다중 리듬)', 'Polyrhythm (multiple rhythms)'],
    ['어두운/딥 분위기', 'Dark / deep vibe'],
    ['밝은/유포릭 분위기', 'Bright / euphoric vibe'],
    ['환각적/사이키델릭', 'Trippy / psychedelic'],
    ['미래적/SF', 'Futuristic / sci-fi'],
    ['부족적/영적', 'Tribal / spiritual'],
    ['로맨틱/감성적', 'Romantic / sensitive'],
    ['공격적/강력한', 'Aggressive / powerful'],
    ['미니멀/스파스', 'Minimal / sparse'],
    ['풍성한/맥시멀', 'Rich / maximal'],
    ['드리미/몽환적', 'Dreamy / ethereal'],
    ['나이트라이프/클럽', 'Nightlife / club'],
    ['페스티벌/메인스테이지', 'Festival / main-stage'],
    ['언더그라운드/웨어하우스', 'Underground / warehouse'],
    ['거친/원초적', 'Raw / primal'],
    ['정교한/세련된', 'Polished / refined'],
    ['축제/카니발', 'Festival / carnival'],
    ['의식/리츄얼', 'Ritual'],
    ['코스믹/공간감', 'Cosmic / spacious'],
    ['향수/노스탤지어', 'Nostalgia'],
    ['저녁/일몰', 'Evening / sunset'],
    ['새벽/심야', 'Dawn / late-night'],
    ['열대/비치', 'Tropical / beach'],
    ['도시/메가시티', 'Urban / megacity'],
    ['미적/세련', 'Aesthetic / refined'],
    ['60-90 BPM (다운템포)', '60-90 BPM (downtempo)'],
    ['100-110 BPM (디스코·라틴)', '100-110 BPM (Disco · Latin)'],
    ['118-128 BPM (하우스·테크 하우스)', '118-128 BPM (House · Tech House)'],
    ['120-128 BPM (퓨처 하우스·트로피컬)', '120-128 BPM (Future House · Tropical)'],
    ['122-130 BPM (테크노 표준)', '122-130 BPM (Techno standard)'],
    ['128-145 BPM (트랜스 스탠다드)', '128-145 BPM (Trance standard)'],
    ['130-140 BPM (하드 트랜스·하드스타일)', '130-140 BPM (Hard Trance · Hardstyle)'],
    ['140-150 BPM (덥스텝 절반)', '140-150 BPM (Dubstep half-time)'],
    ['150-160 BPM (사이트랜스·하드코어)', '150-160 BPM (Psytrance · Hardcore)'],
    ['160-175 BPM (정글·D&B 절반)', '160-175 BPM (Jungle · D&B half-time)'],
    ['170-180 BPM (D&B/Drumfunk)', '170-180 BPM (D&B / Drumfunk)'],
    ['180-200+ BPM (스피드코어/테러)', '180-200+ BPM (Speedcore / Terror)'],
    // 170 remaining dance-style descriptions (auto-batch)
    ['기계적·반복적 4/4 그루브 + 합성기 사운드. 디트로이트 발 글로벌 댄스 장르.', 'Mechanical / repetitive 4/4 groove + synthesizer sound — global dance genre born in Detroit.'],
    ['극도로 미니멀한 요소 + 깊은 베이스 + 앰비언트 패드. 베를린 클럽 사운드.', 'Extremely minimal elements + deep bass + ambient pads — Berlin club sound.'],
    ['303 스퀠치 + 하드 킥. 언더그라운드 일루걸 레이브 사운드.', '303 squelch + hard kick — underground illegal rave sound.'],
    ['산업소음·기계적 비트 + 어둡고 강력한 사운드. Berghain 스타일.', 'Industrial noise / mechanical beat + dark powerful sound — Berghain style.'],
    ['공격적이고 빠른 킥 + 디스토션 베이스. 2020년대 클럽 부흥.', 'Aggressive fast kick + distortion bass — 2020s club revival.'],
    ['테크노의 발상지. 기계적 신스 + 반복적 비트 + 도시적 내러티브.', 'Birthplace of techno — mechanical synths + repetitive beats + urban narrative.'],
    ['베를린 언더그라운드 클럽 스타일. 다크하고 길게 빌드업되는 그루브.', 'Berlin underground club style — dark groove with long build-ups.'],
    ['감성적·시네마틱 멜로디 + 딥 베이스. Tale of Us·Innellea 스타일.', 'Emotive / cinematic melody + deep bass — Tale of Us / Innellea style.'],
    ['미묘한 킥 + 깊은 우주 패드. 명상적·내성적 사운드스케이프.', 'Subtle kick + deep cosmic pads — meditative / introspective soundscape.'],
    ['덥 레게의 공간감 + 테크노 비트. Basic Channel·Rhythm & Sound 스타일.', 'Dub-reggae spaciousness + techno beat — Basic Channel / Rhythm & Sound style.'],
    ['빈티지 영국 80년대 후반 스타일. 단조롭고 따뜻한 신스 블립.', 'Vintage late-80s UK style — monochrome warm synth blips.'],
    ['독일·네덜란드 하드 테크노. 매우 빠르고 공격적인 루프와 디스토션.', 'German / Dutch hard techno — very fast aggressive loops + distortion.'],
    ['빈티지 카세트 톤 + 거친 텍스처. 비닐 노이즈와 따뜻한 아날로그.', 'Vintage cassette tone + raw textures — vinyl noise + warm analog.'],
    ['원초적이고 가공되지 않은 사운드. 디스토션·노이즈가 그대로 드러나는 트랙.', 'Primal, unprocessed sound — distortion / noise laid bare.'],
    ['마이크로 디테일 + 미세한 변화가 핵심. Romanian minimal DJ·Romanian minimal DJ 스타일.', 'Micro details + subtle changes are the core — Romanian minimal DJ style.'],
    ['영국 버밍엄 출신 다크 테크노. Surgeon·Regis 스타일의 차가운 사운드.', 'Dark techno from Birmingham, UK — cold Surgeon / Regis sound.'],
    ['테크노 + 트랜스의 융합. 강한 베이스라인 + 감정적 신스 빌드.', 'Techno + trance fusion — strong bassline + emotional synth builds.'],
    ['긴 빌드 + 점진적 변화. 깊고 감성적인 댄스플로어 여정.', 'Long builds + gradual change — deep, emotional dance-floor journey.'],
    ['퍼커시브한 트라이벌 요소 + 하드한 킥. Ben Sims·Adam Beyer 스타일.', 'Percussive tribal elements + hard kick — Ben Sims / Adam Beyer style.'],
    ['영국식 테크노. 어둡고 메탈릭한 사운드 + 펑키한 그루브.', 'UK-style techno — dark metallic sound + funky groove.'],
    ['최면적·반복적 루프 + 점진적 빌드. Donato Dozzy·Function 스타일.', 'Hypnotic / repetitive loops + gradual build — Donato Dozzy / Function style.'],
    ['실험적·로파이 하우스. 이상한 샘플과 잘못된 듯한 미적 감각.', 'Experimental lo-fi house — strange samples + \'wrong-on-purpose\' aesthetic.'],
    ['프랑스·동유럽 무허가 레이브 사운드. 매우 빠른 BPM + 정신없는 에너지.', 'French / Eastern-European illegal rave sound — very fast BPM + frantic energy.'],
    ['극단적으로 강렬하고 광적인 테크노. 페스티벌 메인 스테이지 광기.', 'Extremely intense, maniacal techno — festival main-stage madness.'],
    ['평소보다 느린 BPM + 무거운 분위기. the techno DJ·the techno DJ 스타일.', 'Slower-than-usual BPM + heavy atmosphere — techno-DJ style.'],
    ['디지털 글리치·에러 + 부서진 비트. Autechre·Atom™ 스타일의 실험적 사운드.', 'Digital glitch / errors + broken beats — experimental Autechre / Atom™ sound.'],
    ['부족 드럼 + 4/4 그루브. 깊고 영적인 댄스플로어 의식.', 'Tribal drums + 4/4 groove — deep spiritual dance-floor ritual.'],
    ['디트로이트 + 블립 테크노 융합. 따뜻한 빈티지 신스 + 도시적 멜랑콜리.', 'Detroit + bleep-techno fusion — warm vintage synths + urban melancholy.'],
    ['minimal-techno pioneer 영향. 미니멀하지만 깊고 환각적인 텍스처.', 'Minimal-techno-pioneer influenced — minimal yet deep, trippy textures.'],
    ['디트로이트 테크노 음악의 정치적·블랙 영적 흐름. the Detroit techno pioneer·the techno pioneer 스타일.', 'Detroit techno\'s political / Black spiritual current — Detroit-techno-pioneer style.'],
    ['감정적 멜로디 + 거대한 빌드와 드랍. 정서적 댄스 에픽.', 'Emotional melody + huge builds & drops — emotive dance epic.'],
    ['환희에 찬 멜로디 + 거대한 빌드. Armin van Buuren·Above & Beyond 스타일.', 'Euphoric melody + huge builds — Armin van Buuren / Above & Beyond style.'],
    ['빠른 비트 + 사이키델릭 레이어. 인도·이스라엘 출신 영적 댄스 음악.', 'Fast beats + psychedelic layers — spiritual dance music from India / Israel.'],
    ['사이트랜스의 원형. 동양 멜로디 + 산스크리트 보컬 샘플 + 환각적 여정.', 'Goa-trance roots — Eastern melodies + Sanskrit vocal samples + trippy journey.'],
    ['여성 보컬의 감동적 후크 + 거대한 신스. 가장 팝적인 트랜스 형태.', 'Emotional female vocal hook + huge synths — the most pop-friendly form of trance.'],
    ['공격적인 킥 + 신스 + 강렬한 빌드. 90년대 후반 독일·네덜란드 스타일.', 'Aggressive kicks + synths + intense builds — late-90s German / Dutch style.'],
    ['303 스퀠치 베이스가 핵심인 트랜스. Hardfloor·Union Jack 스타일.', 'Trance built around 303 squelch bass — Hardfloor / Union Jack style.'],
    ['긴 빌드 + 점진적 변화. 미니멀하지만 감정적인 트랜스 변주.', 'Long builds + gradual change — minimal yet emotional trance variant.'],
    ['몽환적이고 부드러운 트랜스. Robert Miles·Children 스타일.', 'Dreamy soft trance — Robert Miles / \'Children\' style.'],
    ['현대적인 트랜스 부흥. 슬랩 베이스 + 멜로딕 후크의 융합.', 'Modern trance revival — slap bass + melodic hooks fused.'],
    ['하우스의 그루브 + 트랜스의 멜로딕 빌드. 클럽 친화적 하이브리드.', 'House groove + trance melodic build — club-friendly hybrid.'],
    ['클래식 트랜스 앤섬. 거대한 멜로디 + 모두가 따라부를 후크.', 'Classic trance anthem — huge melody + crowd-singalong hook.'],
    ['이비자 발레아릭의 햇볕 그루브 + 트랜스. 휴양지 일몰 사운드.', 'Ibiza Balearic sunny groove + trance — resort-sunset sound.'],
    ['부족 드럼 + 사이트랜스 융합. 영적·의식적 댄스 사운드.', 'Tribal drums + psy-trance fusion — spiritual / ritualistic dance sound.'],
    ['매우 빠르고 에너지 넘치는 페스티벌 트랜스. 큰 빌드와 카타르시스.', 'Very fast, energetic festival trance — huge builds + catharsis.'],
    ['현대적 프로덕션 + 트랜스 정서. 슬랩 베이스 + 보컬 챱.', 'Modern production + trance sentiment — slap bass + vocal chops.'],
    ['유럽 메인스트림 트랜스. 명확하고 캐치한 보컬 후크가 특징.', 'European mainstream trance — clear catchy vocal hooks.'],
    ['풀 오케스트라 + 트랜스. 시네마틱하고 영웅적인 사운드.', 'Full orchestra + trance — cinematic, heroic sound.'],
    ['빅룸 EDM + 트랜스의 융합. 거대한 페스티벌 메인스테이지 사운드.', 'Big-room EDM + trance fusion — huge festival main-stage sound.'],
    ['앰비언트 + 사이트랜스. 명상적·내성적인 다운템포 사이키델릭.', 'Ambient + psy-trance — meditative / introspective downtempo psychedelic.'],
    ['매우 빠른 브레이크 + 무거운 베이스. UK 90년대 정글의 진화형.', 'Very fast breaks + heavy bass — evolution of 90s UK jungle.'],
    ['부드러운 멜로딕 D&B. 소울풀 보컬과 영롱한 패드가 특징.', 'Smooth melodic D&B — soulful vocals + shimmering pads.'],
    ['극도로 정밀한 디자인의 베이스 + 어두운 분위기. neurofunk artist·neurofunk artist 스타일.', 'Extremely precise bass design + dark mood — neurofunk-artist style.'],
    ['파티 분위기 + 바운시한 베이스. MC 보컬과 캐치한 후크.', 'Party vibe + bouncy bass — MC vocals + catchy hooks.'],
    ['광활한 공간감 + 명상적 패드. atmospheric D&B label·Good Looking Records 스타일.', 'Vast spaciousness + meditative pads — atmospheric D&B label / Good Looking Records style.'],
    ['D&B의 원형. 레게·라가 영향 + 거친 amen 브레이크 + 베이스라인.', 'D&B roots — reggae / ragga influence + raw Amen break + bassline.'],
    ['D&B의 빠른 베이스 + 덥스텝의 절반 템포 그루브. 하이브리드 댄스.', 'D&B fast bass + dubstep half-tempo groove — hybrid dance.'],
    ['테크노 영향의 차갑고 미래적인 D&B. techstep artist·techstep artist 스타일.', 'Techno-influenced cold futuristic D&B — techstep-artist style.'],
    ['매우 어둡고 공격적인 D&B. 디스토션·노이즈 가득한 사운드.', 'Very dark aggressive D&B — distortion / noise everywhere.'],
    ['부드럽고 멜로딕한 D&B의 표준. 라이브 드럼·재즈 영향.', 'Standard smooth melodic D&B — live drums + jazz influence.'],
    ['브라질 삼바 리듬 + 베이스. Brazilian D&B DJ·Brazilian D&B DJ 스타일.', 'Brazilian samba rhythm + bass — Brazilian-D&B-DJ style.'],
    ['드럼은 170+ BPM이지만 절반 템포로 들리는 하이브리드 트랩 영향 D&B.', 'Drums at 170+ BPM but heard half-time — hybrid trap-influenced D&B.'],
    ['극도로 미니멀한 D&B. minimal D&B·precision D&B 스타일.', 'Extremely minimal D&B — minimal / precision D&B style.'],
    ['정글에 강한 자메이카 레게·라가 보컬. 댄스홀 영향 강한 90년대 클래식.', 'Jungle with strong Jamaican reggae / ragga vocals — dancehall-heavy 90s classic.'],
    ['극도로 정밀하게 편집된 amen 브레이크 중심의 실험적 D&B.', 'Experimental D&B built on extremely precise Amen-break edits.'],
    ['D&B + 하드코어 테크노 융합. 매우 공격적인 디스토션 사운드.', 'D&B + hardcore-techno fusion — very aggressive distortion sound.'],
    ['광적으로 편집된 amen + 하드코어 + IDM 융합. breakcore artist 스타일.', 'Frantically edited Amen + hardcore + IDM fusion — breakcore-artist style.'],
    ['시카고 풋워크의 빠른 비트 + D&B 베이스. footwork producer·Chicago footwork producer 영향.', 'Chicago footwork fast beats + D&B bass — footwork-producer influence.'],
    ['두뇌적이고 정교한 D&B. 90년대 후반 atmospheric D&B label 영향.', 'Cerebral, intricate D&B — late-90s atmospheric-D&B-label influence.'],
    ['UK 펑키 하우스의 그루브 + D&B 베이스. 아프로 영향이 강한 하이브리드.', 'UK funky-house groove + D&B bass — Afro-influenced hybrid.'],
    ['디스토션 킥 + 리버스 베이스 + 멜로딕 신스. 네덜란드 페스티벌 사운드.', 'Distortion kick + reverse bass + melodic synths — Dutch festival sound.'],
    ['극도로 빠르고 강력한 디스토션 킥. 90년대 네덜란드·이탈리아 출신.', 'Extremely fast powerful distortion kick — 90s Dutch / Italian.'],
    ['네덜란드 로테르담 출신 하드코어. 매우 빠르고 거친 킥과 신스.', 'Hardcore from Rotterdam, NL — very fast, raw kicks + synths.'],
    ['하드코어 비트 + 해피·캐치한 멜로디. 90년대 영국 레이브 클래식.', 'Hardcore beats + happy / catchy melodies — 90s UK rave classic.'],
    ['영국 하드코어. 트랜스 + 댄스 보컬 + 빠른 킥의 융합.', 'UK hardcore — trance + dance vocals + fast kicks fused.'],
    ['극도로 빠른 프랑스식 하드코어. frenchcore producer·frenchcore producer 스타일.', 'Extremely fast French hardcore — frenchcore-producer style.'],
    ['가장 빠른 하드코어. BPM이 일반 음악의 영역을 초월.', 'The fastest hardcore — BPM beyond normal music.'],
    ['공포·증오를 표현하는 극단적 하드코어. 어둡고 폭력적인 사운드.', 'Extreme hardcore expressing fear / hatred — dark, violent sound.'],
    ['감정적·환희에 찬 멜로디 중심 하드스타일. Headhunterz·Atmozfears 스타일.', 'Hardstyle centered on emotional / euphoric melody — Headhunterz / Atmozfears style.'],
    ['날것·공격적인 하드스타일. Radical Redemption·D-Block & S-te-Fan 스타일.', 'Raw aggressive hardstyle — Radical Redemption / D-Block & S-te-Fan style.'],
    ['네덜란드 출신. 강한 4/4 킥 + 단순한 신스 후크. 점프 댄스.', 'From the Netherlands — strong 4/4 kick + simple synth hook — jump dance.'],
    ['스페인·영국 하드 댄스 스타일. 빠른 비트 + 멜로딕 신스.', 'Spanish / UK hard-dance style — fast beats + melodic synths.'],
    ['하드 트랜스 + 하드스타일 + 댄스의 종합. UK Hard House.', 'Hard-trance + hardstyle + dance combined — UK Hard House.'],
    ['가장 친숙한 형태의 하드스타일. 페스티벌 메인스테이지 친화적.', 'The most accessible form of hardstyle — festival-main-stage-friendly.'],
    ['인더스트리얼 + 하드코어. 어둡고 기계적이며 디스토션 가득한 사운드.', 'Industrial + hardcore — dark, mechanical, distortion-heavy sound.'],
    ['하프 타임 그루브 + 무거운 웜블 베이스. 영국 출신 베이스 음악의 핵심.', 'Half-time groove + heavy wobble bass — the core of UK bass music.'],
    ['미국식 덥스텝. Skrillex의 시그니처 사운드. 강렬한 신스·그라울.', 'US-style dubstep — Skrillex signature — intense synth growls.'],
    ['미니멀하지만 무거운 덥스텝 서브장르. 반복적인 트리플렛 베이스.', 'Minimal but heavy dubstep subgenre — repetitive triplet bass.'],
    ['느리고 어두운 덥스텝. 우주적 신스 + 무거운 서브베이스.', 'Slow dark dubstep — cosmic synths + heavy sub-bass.'],
    ['꿈결 같은 코드 + 보컬 챱 + 스내피 스네어. future-bass producer·melodic dubstep producer 스타일.', 'Dreamy chords + vocal chops + snappy snare — future-bass / melodic-dubstep style.'],
    ['힙합 트랩의 비트 구조 + EDM 신스·드랍. RL Grime·Baauer 스타일.', 'Hip-hop trap beat + EDM synth drops — RL Grime / Baauer style.'],
    ['퓨처 베이스 + 트랩 융합. 멜로딕한 드랍과 신디 풍부한 사운드.', 'Future-bass + trap fusion — melodic drops + rich synth sound.'],
    ['트랩 + 덥스텝 + 메탈 융합. trap producer·hybrid trap producer·tearout producer 스타일.', 'Trap + dubstep + metal fusion — hybrid / tearout producer style.'],
    ['멤피스 랩 + 펑크 + 로파이 융합. 카우벨과 칠 분위기의 차량음악.', 'Memphis rap + funk + lo-fi fusion — cowbell + chill driving music.'],
    ['러시아·터키 출신 강력한 폰크. 드리프트 영상에 자주 사용.', 'Powerful phonk from Russia / Turkey — common in drift videos.'],
    ['펑키한 글리치 + 힙합 비트. glitch-hop producer·Edit·glitch-hop producer 스타일.', 'Funky glitch + hip-hop beats — glitch-hop / Edit producer style.'],
    ['비뚤어지고 불안정한 신스 + 비정형 그루브. wonky producer·wonky producer.', 'Wonky, unstable synths + irregular groove — wonky-producer style.'],
    ['D&B 템포에 트랩 그루브. halftime collective·halftime artist 스타일.', 'Trap groove at D&B tempo — halftime collective / artist style.'],
    ['트랩 + 덥스텝 융합. 무거운 드랍과 트랩의 후크 결합.', 'Trap + dubstep fusion — heavy drops + trap hooks combined.'],
    ['트랩 비트 + R&B·소울 보컬. Bryson Tiller·6lack 스타일.', 'Trap beats + R&B / soul vocals — Bryson Tiller / 6lack style.'],
    ['멜로딕한 퓨처 베이스 변형. 풍부한 화성과 컬러풀한 사운드 디자인.', 'Melodic future-bass variant — rich harmonies + colourful sound design.'],
    ['감성적 멜로디 + 덥스텝 드랍. melodic dubstep producer·melodic dubstep producer 스타일.', 'Emotional melody + dubstep drops — melodic-dubstep producer style.'],
    ['베이스 중심 댄스 음악의 종합 카테고리. 강력한 서브베이스 + 댄스 비트.', 'Bass-centric dance music catch-all — powerful sub-bass + dance beats.'],
    ['매우 공격적이고 거친 덥스텝. tearout producer·tearout producer 스타일.', 'Very aggressive raw dubstep — tearout-producer style.'],
    ['UK 개러지의 그루브 + 베이스 중심. 베이스라인의 진화형.', 'UK garage groove + bass-centric — evolution of bassline.'],
    ['현대적 디스코 부흥. 글리터링 신스 + 부드러운 베이스 + 댄스플로어 그루브.', 'Modern disco revival — glittering synths + smooth bass + dance-floor groove.'],
    ['오리지널 70년대 댄스음악. 4/4 킥 + 스트링 + 디스코 펑크 보컬.', 'Original 70s dance music — 4/4 kick + strings + disco-funk vocals.'],
    ['80년대 이탈리아식 디스코. 신디·드럼머신·향수 가득한 멜로디.', '80s Italian-style disco — synths + drum machines + nostalgic melodies.'],
    ['우주적 신스 + 디스코 그루브. 70-80년대 코스믹 사운드.', 'Cosmic synths + disco groove — 70s-80s cosmic sound.'],
    ['북유럽식 부드러운 디스코. Scandinavian-disco·Scandinavian-disco 스타일. 우아하고 미니멀.', 'Smooth Nordic disco — Scandinavian-disco style — elegant and minimal.'],
    ['폴란드식 댄스 팝. 캐치한 후렴 + 신디 + 90년대 향수.', 'Polish-style dance pop — catchy chorus + synths + 90s nostalgia.'],
    ['이탈리아·우주 디스코. 환각적 신스 + 더블린 그루브.', 'Italian / cosmic disco — trippy synths + dub-leaning groove.'],
    ['80년대 디스코·펑크의 부드러운 진화. 슬랩 베이스 + 신스 + 소울 보컬.', 'Smooth 80s disco / funk evolution — slap bass + synths + soul vocals.'],
    ['30년대 스윙 + 일렉트로니카. electro-swing band·electro-swing producer 스타일.', '30s swing + electronica — electro-swing band / producer style.'],
    ['80년대 일본 시티팝 샘플 + 펑크. Vaporwave 진화형.', '80s Japanese city-pop samples + funk — vaporwave evolution.'],
    ['부드럽고 멜로딕한 디스코. 라이브 베이스·기타·소울 보컬.', 'Smooth melodic disco — live bass / guitar / soul vocals.'],
    ['디스코 + 펑크의 직접적 융합. Chic·Earth Wind & Fire 스타일.', 'Direct disco + funk fusion — Chic / Earth Wind & Fire style.'],
    ['필터링된 디스코 샘플 + 컷팅 베이스. French house duo·Stardust·Modjo 사운드.', 'Filtered disco samples + cutting bass — French house duo / Stardust / Modjo sound.'],
    ['클래식 디스코 트랙을 클럽용으로 재편집. Balearic DJ·disco-edit 스타일.', 'Classic disco tracks re-edited for clubs — Balearic-DJ / disco-edit style.'],
    ['현대적 프로덕션 + 70-80년대 디스코·펑크 정서. ·Anderson.Paak.', 'Modern production + 70s-80s disco / funk feel — Anderson.Paak.'],
    ['라틴아메리카 댄스음악의 글로벌 스타. Dembow 패턴 + 스페인어 랩·보컬.', 'Global star of Latin-American dance music — Dembow pattern + Spanish rap / vocals.'],
    ['하우스 + 레게톤 융합. the moombahton pioneer 발명. 트로피컬한 댄스 사운드.', 'House + reggaeton fusion — invented by the moombahton pioneer — tropical dance sound.'],
    ['80년대 뉴욕 라티노 댄스. 일렉트로 비트 + 라틴 멜로디.', '80s New York Latino dance — electro beats + Latin melodies.'],
    ['전통 쿰비아 + 일렉트로닉. 콜롬비아·아르헨티나 모던 사운드.', 'Traditional cumbia + electronic — modern Colombian / Argentine sound.'],
    ['도미니카 바차타 + 일렉트로닉. 로맨틱한 라틴 댄스.', 'Dominican bachata + electronic — romantic Latin dance.'],
    ['트리니다드·카니발 음악. 빠른 리듬 + 스틸드럼 + 축제 분위기.', 'Trinidad / Carnival music — fast rhythms + steel drums + festival vibe.'],
    ['자메이카 댄스음악. 리듬믹한 후크 + MC 보컬 + 카리브해 그루브.', 'Jamaican dance music — rhythmic hooks + MC vocals + Caribbean groove.'],
    ['열대 리듬 + 베이스 음악. 다국적 카리브·라틴 융합.', 'Tropical rhythms + bass music — multinational Caribbean / Latin fusion.'],
    ['맘보 리듬 + 일렉트로닉 비트. 살사·일렉트로 융합.', 'Mambo rhythm + electronic beats — salsa / electro fusion.'],
    ['트랩 비트 + 스페인어 랩. the reggaeton vocalist·the Latin trap vocalist 스타일.', 'Trap beats + Spanish rap — reggaeton / Latin-trap vocalist style.'],
    ['브라질 파벨라 출신 댄스. Tamborzão 리듬 + 빠른 BPM.', 'Dance from the Brazilian favelas — Tamborzão rhythm + fast BPM.'],
    ['감성적·로맨틱한 레게톤. the bachata vocalist·the reggaeton vocalist 발라드 스타일.', 'Sensitive / romantic reggaeton — bachata / reggaeton-vocalist ballad style.'],
    ['클럽용 강력한 레게톤 변종. 그라인딩 댄스용 비트.', 'Powerful club-ready reggaeton variant — grinding-dance beats.'],
    ['전통 살사 + 일렉트로닉 댄스 비트. 라틴 클럽 모던 사운드.', 'Traditional salsa + electronic dance beats — modern Latin-club sound.'],
    ['베네수엘라 카라카스 출신 하드 댄스 음악. 빠른 비트와 강력한 퍼커션.', 'Hard dance music from Caracas, Venezuela — fast beats + powerful percussion.'],
    ['서아프리카 모던 팝. the Afrobeats vocalist·the Afrobeats vocalist·Davido가 글로벌화한 사운드.', 'Modern West-African pop — globalised by Afrobeats vocalists / Davido.'],
    ['남아공 출신 부드러운 재즈 + 딥 하우스 융합. 로그드럼 베이스가 트레이드마크.', 'South-African smooth jazz + deep-house fusion — log-drum bass is the trademark.'],
    ['남아공 더반 출신 하드한 미니멀 댄스음악. 가공되지 않은 거친 사운드.', 'Hard minimal dance music from Durban, SA — raw unprocessed sound.'],
    ['앙골라 댄스음악. 빠른 비트와 카니발 분위기의 활기찬 사운드.', 'Angolan dance music — fast beats + lively carnival vibe.'],
    ['가나·나이지리아 클래식 댄스음악. 기타 밴드 + 신나는 비트.', 'Classic dance music from Ghana / Nigeria — guitar bands + exciting beats.'],
    ['가나 출신 댄스음악·댄스. 캐치한 후크와 활기찬 비트.', 'Dance music / dance from Ghana — catchy hooks + lively beats.'],
    ['하우스 + 아프리카 퍼커션. afro-house DJ·afro-house DJ 스타일.', 'House + African percussion — afro-house DJ style.'],
    ['테크노 + 아프로 퍼커션. 깊고 부족적인 클럽 사운드.', 'Techno + Afro percussion — deep tribal club sound.'],
    ['영국 출신 아프로 영향 댄스. 부드러운 퍼커션 + 베이스라인.', 'UK-based Afro-influenced dance — smooth percussion + bassline.'],
    ['동아프리카 탄자니아 출신 힙합·R&B·아프로팝 융합.', 'East-African (Tanzania) hip-hop / R&B / Afropop fusion.'],
    ['코트디부아르 출신 댄스음악. 활기찬 비트와 댄스 무브.', 'Dance music from Côte d\'Ivoire — lively beats + dance moves.'],
    ['콩고 출신 댄스음악. 부드러운 기타와 신나는 리듬.', 'Dance music from the Congo — smooth guitars + exciting rhythms.'],
    ['탄자니아 다레살람 출신 극도로 빠른 댄스음악. 미래적 사운드.', 'Extremely fast dance music from Dar es Salaam, Tanzania — futuristic sound.'],
    ['남아공 림포포 출신. 매우 빠른 마림바 + 댄스음악 퓨전.', 'From Limpopo, South Africa — very fast marimba + dance-music fusion.'],
    ['Fela Kuti가 창시한 아프로비트. 재즈 + 펑크 + 서아프리카 음악 융합.', 'Afrobeat founded by Fela Kuti — jazz + funk + West-African fusion.'],
    ['Chemical Brothers·Prodigy·Fatboy Slim 스타일. 큰 브레이크 + 록 에너지.', 'Chemical Brothers / Prodigy / Fatboy Slim style — big breaks + rock energy.'],
    ['브리스톨 사운드. 힙합 비트 + 영화적 분위기. Massive Attack·Portishead.', 'Bristol sound — hip-hop beats + cinematic vibe — Massive Attack / Portishead.'],
    ['펑키한 브레이크 + 오래된 학파 샘플 + 레이브 시그널. 댄스 브레이크의 원형.', 'Funky breaks + old-school samples + rave signals — the original dance-break.'],
    ['마이애미 출신 브레이크비트. 펑키하고 베이스 가득한 사운드.', 'Breakbeat from Miami — funky bass-heavy sound.'],
    ['2000년대 초 영국 브레이크비트 진화. 더 모던하고 일렉트로닉.', 'Early-2000s UK breakbeat evolution — more modern, electronic.'],
    ['두뇌적 일렉트로닉. Aphex Twin·Autechre·Squarepusher 스타일.', 'Cerebral electronic — Aphex Twin / Autechre / Squarepusher style.'],
    ['디지털 글리치·에러를 음악적 요소로 사용. 실험적·아방가르드.', 'Digital glitches / errors used as musical elements — experimental / avant-garde.'],
    ['극단적 글리치 + 빠른 비트 + 카오틱 신스. 디지털 디지인의 혼란.', 'Extreme glitch + fast beats + chaotic synths — digital-design chaos.'],
    ['앰비언트 텍스처 + 미묘한 댄스 비트. 명상적이고 영적인 댄스.', 'Ambient texture + subtle dance beats — meditative, spiritual dance.'],
    ['포크 음악 + 일렉트로닉 댄스 융합. Bon Iver·Fyfe·Owl City.', 'Folk + electronic dance fusion — Bon Iver / Fyfe / Owl City.'],
    ['극단적이고 캐치한 디지털 팝. the producer·the hyperpop vocalist·hyperpop duo 스타일.', 'Extreme catchy digital pop — hyperpop producer / vocalist style.'],
    ['하이퍼팝의 기초. the producer·PC Music producer 스타일의 빛나고 캐치한 사운드.', 'The foundation of hyperpop — bright catchy PC Music-producer sound.'],
    ['80년대 일본 시티팝·라운지 음악 슬로우드·챱드. 인터넷 미학.', '80s Japanese city-pop / lounge slowed + chopped — Internet aesthetic.'],
    ['80년대 영화 사운드트랙 영향. 네온 신스 + 시네마틱 무드.', '80s film-soundtrack influence — neon synths + cinematic mood.'],
    ['느린 일렉트로닉 + 향수 가득한 신스. chillwave artist·chillwave artist 스타일.', 'Slow electronic + nostalgic synths — chillwave-artist style.'],
    ['느리고 어두운 일렉트로닉. 오컬트 분위기 + 슬로우드 보컬.', 'Slow dark electronic — occult vibe + slowed vocals.'],
    ['2010년대 초 인터넷 미학. 수중 신스 + 비비드한 비트.', 'Early-2010s Internet aesthetic — underwater synths + vivid beats.'],
    ['EDM producer·the producer 스타일. 어두운 신스 + 90년대 레이브 영향.', 'EDM-producer style — dark synths + 90s rave influence.'],
    ['90년대 유럽 댄스음악의 황금기. 캐치한 후크 + 신스 멜로디.', 'Golden age of 90s European dance music — catchy hooks + synth melodies.'],
    ['페스티벌 메인스테이지 사운드의 정점. 거대한 신스 리드 + 천둥 같은 드랍.', 'Pinnacle of festival-main-stage sound — huge synth leads + thunderous drops.'],
    // Dance machine category tabs (exact match — appear in screenshot)
    ['드럼·리듬', 'Drums · Rhythm'],
    ['신스·리드·패드', 'Synth · Lead · Pad'],
    ['이펙트·텍스처', 'Effects · Texture'],
    ['구조·드랍', 'Structure · Drop'],
    ['무드·분위기', 'Mood · Vibe'],
    ['BPM 힌트', 'BPM hint'],
    ['BPM 힌트 (참고)', 'BPM hint (reference)'],
    ['보컬', 'Vocal'],
    // ────────────────────────────────────────────────────────────────
    // DANCE MACHINE — 200 style descs + 210 tag KOs
    // ────────────────────────────────────────────────────────────────
    // Drum / beat KOs
    ['기본 4박 댄스 킥', 'Basic 4/4 dance kick'],
    ['무거운 4박 킥', 'Heavy 4/4 kick'],
    ['오프비트 하이햇', 'Off-beat hi-hat'],
    ['열린 하이햇', 'Open hi-hat'],
    ['2·4박 클랩', 'Beat 2 & 4 clap'],
    ['909 킥 (테크노 표준)', '909 kick (techno standard)'],
    ['808 킥 (서브 베이스)', '808 kick (sub bass)'],
    ['디스토션 킥 (하드코어/스타일)', 'Distortion kick (hardcore / -style)'],
    ['리버스 베이스 킥 (하드스타일)', 'Reverse bass kick (hardstyle)'],
    ['롤링 드럼 브레이크', 'Rolling drum break'],
    ['아멘 브레이크 (정글/D&B)', 'Amen break (Jungle / D&B)'],
    ['브레이크비트 드럼', 'Breakbeat drums'],
    ['2-step 스킵 리듬', '2-step skip rhythm'],
    ['셔플 하이햇', 'Shuffle hi-hat'],
    ['스윙 16분음표', 'Swing 16th notes'],
    ['스내피 스네어', 'Snappy snare'],
    ['스네어 롤 (빌드업)', 'Snare roll (build-up)'],
    ['클랩 + 스네어 레이어', 'Clap + snare layer'],
    ['크리스피 스네어', 'Crispy snare'],
    ['트리플렛 하이햇 (풋워크/트랩)', 'Triplet hi-hat (footwork / trap)'],
    ['하프 타임 드럼 (덥스텝)', 'Half-time drums (dubstep)'],
    ['뎀보우 리듬 (레게톤)', 'Dembow rhythm (reggaeton)'],
    ['탐보르장 패턴 (브라질 펑크)', 'Tamborzão pattern (Brazilian funk)'],
    ['폴리리듬 퍼커션', 'Polyrhythmic percussion'],
    ['트라이벌 드럼', 'Tribal drums'],
    ['로그 드럼 베이스 (아마피아노)', 'Log-drum bass (Amapiano)'],
    ['토킹 드럼 (아프로비츠)', 'Talking drum (Afrobeats)'],
    ['챱드 카우벨 (폰크)', 'Chopped cowbell (phonk)'],
    ['재킹 비트 (시카고 하우스)', 'Jacking beat (Chicago house)'],
    ['시퀀셜 드럼 패턴', 'Sequential drum pattern'],
    ['머신 펑크 그루브', 'Machine funk groove'],
    ['정글 브레이크 (라가)', 'Jungle break (Ragga)'],
    ['저지 클럽 킥', 'Jersey-club kick'],
    ['풋워크 트리플렛', 'Footwork triplets'],
    // Bass KOs
    ['깊은 서브 베이스', 'Deep sub-bass'],
    ['따뜻한 서브 베이스', 'Warm sub-bass'],
    ['롤링 서브 베이스', 'Rolling sub-bass'],
    ['303 애시드 베이스', '303 acid bass'],
    ['꽥꽥대는 303', 'Squelching 303'],
    ['웜블 베이스 (덥스텝)', 'Wobble bass (dubstep)'],
    // Selected 200 dance style descs (most-visible from House family)
    ['클래식한 4/4 킥 + 오프비트 하이햇 + 피아노 스탭 + 소울풀 보컬의 원형 댄스음악.',
     'Classic 4/4 kick + off-beat hi-hat + piano stabs + soulful vocals — the archetypal dance music.'],
    ['깊고 따뜻한 베이스 + 잔잔한 키 + 부드러운 보컬. 라운지·심야 클럽 무드.',
     'Deep warm bass + mellow keys + smooth vocals — lounge / late-night club mood.'],
    ['미니멀 테크노 그루브 + 하우스 보컬 챱. 펑키 베이스라인 + 로보틱 요소.',
     'Minimal techno groove + house vocal chops. Funky bassline + robotic elements.'],
    ['Roland TB-303 스퀠치 베이스가 핵심. 환각적·언더그라운드 웨어하우스 사운드.',
     'Roland TB-303 squelch bass is the core. Trippy / underground warehouse sound.'],
    ['스킵피 셔플 비트 + 베이스 스탭 + 처프드 보컬. 뉴저지·뉴욕 클래식 사운드.',
     'Skippy shuffle beats + bass stabs + chopped vocals — NJ / NYC classic sound.'],
    ['하우스 음악의 발상지. Roland 808/909 드럼머신 + 디스코 영향 + 잭킹 그루브.',
     'Birthplace of house music. Roland 808/909 drum machines + disco influence + jacking groove.'],
    ['스킵 2-step 리듬 + 베이스라인 + 보컬 챱. 런던 클럽 90년대 후반 사운드.',
     'Skip 2-step rhythm + bassline + vocal chops — late-90s London club sound.'],
    ['바운시한 베이스 드랍 + 하모닉 신스 + 팝 요소. 페스티벌 친화적.',
     'Bouncy bass drop + harmonic synth + pop elements — festival-friendly.'],
    ['더러운 웜블 베이스 + 리드미컬한 드랍. 클럽 댄스플로어 흔드는 사운드.',
     'Dirty wobble bass + rhythmic drops — dance-floor-shaking club sound.'],
    ['스틸 드럼 + 마림바 + 비치 무드. 카리브해 휴양지 분위기의 느긋한 하우스.',
     'Steel drums + marimba + beach mood — laid-back Caribbean-resort house.'],
    ['퍼커션 롤 + 살사·맘보 후크 + 햇볕 무드. 라티노 댄스플로어 사운드.',
     'Percussion rolls + salsa/mambo hooks + sunny mood — Latino dance-floor sound.'],
    ['민속·아프리카 드럼 + 깊은 그루브. 부족 의식 같은 리드미컬한 댄스.',
     'Folk / African drums + deep groove — tribal-ritual-style rhythmic dance.'],
    ['비닐 텍스처 + 거친 샘플 + 빈티지 룸 사운드. 90년대 카세트 톤.',
     'Vinyl texture + raw samples + vintage room sound — 90s cassette tone.'],
    ['마이크로 멜로디 + 깊은 비트 + 스파스한 어레인지. 정제된 클럽 사운드.',
     'Micro melodies + deep beats + sparse arrangements — refined club sound.'],
    ['이탈리아 90년대 피아노 하우스. 댄스플로어 다이바 보컬 + 휘파람 신스.',
     '90s Italian piano house. Dance-floor diva vocals + whistle synth.'],
    ['펑크 베이스라인 + 디스코 컷팅 기타. 그루비하고 신나는 댄스플로어 사운드.',
     'Funk bassline + disco cutting guitar — groovy, exciting dance-floor sound.'],
    ['가스펠·소울 보컬 + 풍성한 라이브 악기. 따뜻하고 영적인 그루브.',
     'Gospel / soul vocals + rich live instrumentation — warm, spiritual groove.'],
    ['클래식 디스코 샘플 + 4/4 펌프. 글래머러스한 70년대 향수.',
     'Classic disco samples + 4/4 pump — glamorous 70s nostalgia.'],
    ['테크 하우스 + 딥 하우스의 융합. 미니멀하지만 그루비한 클럽 사운드.',
     'Tech-house + deep-house fusion — minimal yet groovy club sound.'],
    ['디스코 샘플의 필터 스윕 + 컷팅 베이스. French house duo·Stardust 사운드.',
     'Filter-swept disco samples + cutting bass — French house duo / Stardust sound.'],
    ['극도로 미니멀한 클릭+컷 사운드. 베를린 미니멀 씬의 정수.',
     'Extremely minimal click+cut sound — essence of the Berlin minimal scene.'],
    ['빠른 베이스 드랍 + 처프드 보컬. 90년대 영국 언더그라운드 클럽.',
     'Fast bass drops + chopped vocals — 90s UK underground club.'],
    ['공격적인 슬랩 베이스 + 깔끔한 멜로딕 후크. 2020년대 EDM 트렌드.',
     'Aggressive slap bass + clean melodic hook — 2020s EDM trend.'],
    ['환상적 퓨처 베이스 + 2-step 리듬 + 신비로운 보컬 텍스처.',
     'Fantastical future bass + 2-step rhythm + mystical vocal textures.'],
    ['엇박자 스텝 리듬 + 베이스라인 + 부드러운 보컬. 90년대 후반 영국.',
     'Off-beat step rhythm + bassline + smooth vocals — late-90s UK.'],
    ['미들 톤의 그르렁거리는 베이스 + 컷팅 코드. 브라질 출신 멜로딕 EDM.',
     'Mid-tone growling bass + cutting chords — Brazilian melodic EDM.'],
    ['네덜란드식 빅룸 사운드. 공격적 리드 + 호각·트럼펫 후크.',
     'Dutch-style big-room sound — aggressive leads + whistle / trumpet hooks.'],
    ['사이드체인 펌핑 베이스 + 강력한 4/4 킥. 휴양지·페스티벌 사운드.',
     'Side-chain pumping bass + strong 4/4 kick — resort / festival sound.'],
    ['디스토션 신스 리드 + 다이내믹 드랍. 2000년대 후반 EDM 황금기.',
     'Distortion synth lead + dynamic drops — late-2000s EDM golden age.'],
    ['튀는 일렉트로 비트 + 디지털 신스 + 하이 옥테인 드랍. 클럽 뱅어.',
     'Bouncy electro beat + digital synth + high-octane drops — club banger.'],
    // Common dance-music single words (after the phrases above)
    ['스탭', 'stabs'],
    ['스퀠치', 'squelch'],
    ['스킵피', 'skippy'],
    ['셔플', 'shuffle'],
    ['처프드', 'chopped'],
    ['챱드', 'chopped'],
    ['컷팅', 'cutting'],
    ['컷', 'cut'],
    ['챱', 'chop'],
    ['잭킹', 'jacking'],
    ['웜블', 'wobble'],
    ['로보틱', 'robotic'],
    ['로보트', 'robot'],
    ['미니멀', 'minimal'],
    ['미니멀한', 'minimal'],
    ['미니멀하지만', 'minimal yet'],
    ['그루비', 'groovy'],
    ['그루비한', 'groovy'],
    ['그루비하고', 'groovy and'],
    ['그루브', 'groove'],
    ['리듬', 'rhythm'],
    ['리듬', 'rhythm'],
    ['리드미컬한', 'rhythmic'],
    ['리드미컬', 'rhythmic'],
    ['바운시한', 'bouncy'],
    ['튀는', 'bouncy'],
    ['공격적인', 'aggressive'],
    ['공격적', 'aggressive'],
    ['공격적 리드', 'aggressive lead'],
    ['깔끔한', 'clean'],
    ['깔끔하고', 'clean and'],
    ['더러운', 'dirty'],
    ['풍성한', 'rich'],
    ['신비로운', 'mystical'],
    ['환상적', 'fantastical'],
    ['환각적', 'trippy'],
    ['환각적·언더그라운드', 'trippy / underground'],
    ['언더그라운드', 'underground'],
    ['웨어하우스', 'warehouse'],
    ['댄스플로어', 'dance floor'],
    ['클럽', 'club'],
    ['클럽 사운드', 'club sound'],
    ['페스티벌', 'festival'],
    ['페스티벌 친화적', 'festival-friendly'],
    ['친화적', '-friendly'],
    ['휴양지', 'resort'],
    ['휴양지·페스티벌', 'resort / festival'],
    ['휴양지·페스티벌 사운드', 'resort / festival sound'],
    ['카리브해', 'Caribbean'],
    ['카리브해 휴양지', 'Caribbean resort'],
    ['비치', 'beach'],
    ['비치 무드', 'beach mood'],
    ['햇볕', 'sunny'],
    ['햇볕 무드', 'sunny mood'],
    ['라티노', 'Latino'],
    ['라티노 댄스플로어', 'Latino dance floor'],
    ['부족', 'tribal'],
    ['부족 의식', 'tribal ritual'],
    ['민속', 'folk'],
    ['민속·아프리카', 'folk / African'],
    ['아프리카', 'African'],
    ['카세트', 'cassette'],
    ['카세트 톤', 'cassette tone'],
    ['비닐', 'vinyl'],
    ['비닐 텍스처', 'vinyl texture'],
    ['거친', 'raw'],
    ['거친 샘플', 'raw samples'],
    ['빈티지', 'vintage'],
    ['빈티지 룸', 'vintage room'],
    ['룸 사운드', 'room sound'],
    ['뉴저지', 'New Jersey'],
    ['뉴저지·뉴욕', 'NJ / NYC'],
    ['뉴욕', 'New York'],
    ['시카고', 'Chicago'],
    ['베를린', 'Berlin'],
    ['베를린 미니멀 씬', 'Berlin minimal scene'],
    ['씬의 정수', 'scene essence'],
    ['이탈리아', 'Italian'],
    ['이탈리아 90년대', '90s Italian'],
    ['90년대 피아노 하우스', '90s piano house'],
    ['댄스플로어 다이바', 'dance-floor diva'],
    ['다이바', 'diva'],
    ['휘파람', 'whistle'],
    ['휘파람 신스', 'whistle synth'],
    ['신나는', 'exciting'],
    ['그루비하고 신나는', 'groovy and exciting'],
    ['디스코 컷팅 기타', 'disco cutting guitar'],
    ['디스코 영향', 'disco influence'],
    ['디스코 샘플', 'disco samples'],
    ['클래식 디스코 샘플', 'classic disco samples'],
    ['글래머러스', 'glamorous'],
    ['글래머러스한', 'glamorous'],
    ['향수', 'nostalgia'],
    ['70년대 향수', '70s nostalgia'],
    ['가스펠·소울', 'gospel / soul'],
    ['풍성한 라이브 악기', 'rich live instrumentation'],
    ['따뜻하고 영적인', 'warm and spiritual'],
    ['영적인', 'spiritual'],
    ['느긋한 하우스', 'laid-back house'],
    ['스틸 드럼', 'steel drums'],
    ['마림바', 'marimba'],
    ['살사·맘보', 'salsa / mambo'],
    ['살사', 'Salsa'],
    ['맘보', 'Mambo'],
    ['깊은 그루브', 'deep groove'],
    ['후크', 'hook'],
    ['스파스한', 'sparse'],
    ['어레인지', 'arrangement'],
    ['스파스한 어레인지', 'sparse arrangement'],
    ['마이크로 멜로디', 'micro melodies'],
    ['정제된', 'refined'],
    ['정제된 클럽 사운드', 'refined club sound'],
    ['프랑스', 'French'],
    ['French house duo', 'French house duo'],
    ['Stardust 사운드', 'Stardust sound'],
    ['극도로', 'extremely'],
    ['극도로 미니멀한', 'extremely minimal'],
    ['클릭+컷', 'click+cut'],
    ['90년대 영국', '90s UK'],
    ['90년대 영국 언더그라운드 클럽', '90s UK underground club'],
    ['빠른 베이스 드랍', 'fast bass drops'],
    ['처프드 보컬', 'chopped vocals'],
    ['슬랩 베이스', 'slap bass'],
    ['공격적인 슬랩 베이스', 'aggressive slap bass'],
    ['멜로딕 후크', 'melodic hook'],
    ['깔끔한 멜로딕 후크', 'clean melodic hook'],
    ['2020년대 EDM 트렌드', '2020s EDM trend'],
    ['퓨처 베이스', 'future bass'],
    ['환상적 퓨처 베이스', 'fantastical future bass'],
    ['2-step 리듬', '2-step rhythm'],
    ['신비로운 보컬 텍스처', 'mystical vocal textures'],
    ['엇박자', 'off-beat'],
    ['엇박자 스텝 리듬', 'off-beat step rhythm'],
    ['스텝 리듬', 'step rhythm'],
    ['90년대 후반 영국', 'late-90s UK'],
    ['미들 톤', 'mid-tone'],
    ['미들 톤의 그르렁거리는 베이스', 'mid-tone growling bass'],
    ['그르렁거리는', 'growling'],
    ['컷팅 코드', 'cutting chords'],
    ['브라질', 'Brazilian'],
    ['브라질 출신', 'Brazilian'],
    ['멜로딕 EDM', 'melodic EDM'],
    ['멜로딕', 'melodic'],
    ['네덜란드식', 'Dutch'],
    ['네덜란드식 빅룸', 'Dutch big-room'],
    ['빅룸 사운드', 'big-room sound'],
    ['호각', 'whistle'],
    ['호각·트럼펫', 'whistle / trumpet'],
    ['호각·트럼펫 후크', 'whistle / trumpet hooks'],
    ['트럼펫', 'trumpet'],
    ['사이드체인', 'side-chain'],
    ['사이드체인 펌핑 베이스', 'side-chain pumping bass'],
    ['펌핑', 'pumping'],
    ['강력한 4/4 킥', 'strong 4/4 kick'],
    ['디스토션 신스 리드', 'distortion synth lead'],
    ['디스토션', 'distortion'],
    ['디스토션 신스', 'distortion synth'],
    ['신스 리드', 'synth lead'],
    ['다이내믹 드랍', 'dynamic drops'],
    ['다이내믹', 'dynamic'],
    ['2000년대 후반', 'late 2000s'],
    ['EDM 황금기', 'EDM golden age'],
    ['황금기', 'golden age'],
    ['일렉트로 비트', 'electro beat'],
    ['일렉트로', 'electro'],
    ['디지털 신스', 'digital synth'],
    ['디지털', 'digital'],
    ['하이 옥테인', 'high-octane'],
    ['하이 옥테인 드랍', 'high-octane drops'],
    ['클럽 뱅어', 'club banger'],
    ['뱅어', 'banger'],
    ['튀는 일렉트로 비트', 'bouncy electro beat'],
    ['랜덤', 'random'],
    ['댄스음악', 'dance music'],
    ['원형', 'archetype'],
    ['원형 댄스음악', 'archetypal dance music'],
    ['소울풀', 'soulful'],
    ['소울풀 보컬', 'soulful vocals'],
    ['피아노 스탭', 'piano stabs'],
    ['피아노', 'piano'],
    ['오프비트', 'off-beat'],
    ['클래식한', 'classic'],
    ['깊고 따뜻한', 'deep and warm'],
    ['잔잔한', 'mellow'],
    ['잔잔한 키', 'mellow keys'],
    ['키', 'keys'],
    ['부드러운 보컬', 'smooth vocals'],
    ['라운지', 'lounge'],
    ['라운지·심야', 'lounge / late-night'],
    ['심야', 'late-night'],
    ['심야 클럽 무드', 'late-night club mood'],
    ['클럽 무드', 'club mood'],
    ['하우스 보컬 챱', 'house vocal chops'],
    ['보컬 챱', 'vocal chops'],
    ['펑키', 'funky'],
    ['펑키 베이스라인', 'funky bassline'],
    ['베이스라인', 'bassline'],
    ['로보틱 요소', 'robotic elements'],
    ['요소', 'element'],
    ['요소들', 'elements'],
    ['핵심', 'core'],
    ['스킵 2-step', 'skip 2-step'],
    ['바운시', 'bouncy'],
    ['바운시한 베이스 드랍', 'bouncy bass drop'],
    ['하모닉 신스', 'harmonic synth'],
    ['하모닉', 'harmonic'],
    ['팝 요소', 'pop elements'],
    ['리드미컬한 드랍', 'rhythmic drops'],
    ['댄스플로어 흔드는 사운드', 'dance-floor-shaking sound'],
    ['흔드는', 'shaking'],
    ['댄스플로어 흔드는', 'dance-floor-shaking'],
    // Dance machine BPM hint patterns
    ['~110 BPM (다운템포)', '~110 BPM (downtempo)'],
    ['110-125 (트로피컬·디스코)', '110-125 (Tropical / Disco)'],
    ['125-135 (하우스·테크노)', '125-135 (House / Techno)'],
    ['135-145 (트랜스·하드)', '135-145 (Trance / Hard)'],
    ['145-160 (하드스타일·해피하드)', '145-160 (Hardstyle / Happy Hardcore)'],
    ['160-200+ (D&B·하드코어)', '160-200+ (D&B / Hardcore)'],
    ['다운템포', 'downtempo'],
    ['트로피컬', 'Tropical'],
    ['하드스타일', 'Hardstyle'],
    ['해피하드', 'Happy Hardcore'],
    ['하드코어', 'Hardcore'],
    ['트랜스', 'Trance'],
    // Reflect status badges
    ['🟢 무조건 반영 키워드', '🟢 Always-applied keyword'],
    ['🟢 무조건 반영', '🟢 Always applied'],
    ['🟡 비교적 반영', '🟡 Often applied'],
    ['🟡 부분 반영', '🟡 Partial reflection'],
    ['🔴 잘 안 됨', '🔴 Rarely applied'],
    // Reflect numbered cards
    ['🟢 잘 작동하는 공식 #1', '🟢 Working formula #1'],
    ['🟢 잘 작동하는 공식 #2', '🟢 Working formula #2'],
    ['🟢 잘 작동하는 공식 #3', '🟢 Working formula #3'],
    ['🟢 잘 작동하는 공식 #4', '🟢 Working formula #4'],
    ['🟢 효과적 트릭 #1', '🟢 Effective trick #1'],
    ['🟢 효과적 트릭 #2', '🟢 Effective trick #2'],
    ['🟢 효과적 트릭 #3', '🟢 Effective trick #3'],
    ['🟢 효과적 트릭 #4', '🟢 Effective trick #4'],
    ['🟢 효과적 트릭 #5', '🟢 Effective trick #5'],
    ['🔴 잘 안 되는 것 #1', "🔴 What doesn't work #1"],
    ['🔴 잘 안 되는 것 #2', "🔴 What doesn't work #2"],
    ['🔴 잘 안 되는 것 #3', "🔴 What doesn't work #3"],
    ['🔴 잘 안 되는 것 #4', "🔴 What doesn't work #4"],
    ['🔴 잘 안 되는 것 #5', "🔴 What doesn't work #5"],
    ['🔴 매우 specific 연주자', '🔴 Very specific performer'],
    ['🔴 특정 녹음 장비', '🔴 Specific recording gear'],
    ['🔴 특정 음반 회사', '🔴 Specific record label'],
    ['🔴 혼합 시대 융합', '🔴 Cross-era fusion'],
    // Era-specific lyric / production category buckets (catch-all)
    ['1920s 가사 주제', '1920s lyric themes'],
    ['1930s 가사 주제', '1930s lyric themes'],
    ['1940s 가사 주제', '1940s lyric themes'],
    ['1950s 가사 주제', '1950s lyric themes'],
    ['1960s 가사 주제', '1960s lyric themes'],
    ['1970s 가사 주제', '1970s lyric themes'],
    ['1980s 가사 주제', '1980s lyric themes'],
    ['1990s 가사 주제', '1990s lyric themes'],
    ['2000s 가사 주제', '2000s lyric themes'],
    ['2010s 가사 주제', '2010s lyric themes'],
    ['2020s 가사 주제', '2020s lyric themes'],
    ['1920s-40s 프로덕션', '1920s-40s production'],
    ['1950s 프로덕션', '1950s production'],
    ['1960s 프로덕션', '1960s production'],
    ['1970s 프로덕션', '1970s production'],
    ['1980s 프로덕션', '1980s production'],
    ['1990s 프로덕션', '1990s production'],
    ['2000s 프로덕션', '2000s production'],
    ['2010s 프로덕션', '2010s production'],
    ['1970s 말', 'Late 1970s'],
    ['1970s 초', 'Early 1970s'],
    ['1980s 말', 'Late 1980s'],
    ['1980s 초', 'Early 1980s'],
    ['1세대 K-Pop 핵심 태그', '1st-gen K-Pop core tags'],
    ['2000s 핵심 태그', '2000s core tags'],
    ['2010s 핵심 태그', '2010s core tags'],
    ['1) 음절 길이 조절', '1) Syllable length control'],
    ['2) 발음 가이드 활용', '2) Pronunciation guide usage'],
    // Common sample-prefix lines ("예: ...")
    ['예: (oh yeah), (hey!)', 'e.g. (oh yeah), (hey!)'],
    ['예: 120 BPM', 'e.g. 120 BPM'],
    ['예: 1980s, 1970s', 'e.g. 1980s, 1970s'],
    ['예: Female Vocal, breathy', 'e.g. Female Vocal, breathy'],
    ['예: K-Pop, Synthwave', 'e.g. K-Pop, Synthwave'],
    ['예: Korean Ballad, 발라드', 'e.g. Korean Ballad, ballad'],
    ['예: Nostalgic, Dark', 'e.g. Nostalgic, Dark'],
    ['예: Oh~ 보고 싶어', 'e.g. Oh~ I miss you'],
    ['예: Piano, Strings', 'e.g. Piano, Strings'],
    ['예: Polished, Lo-fi', 'e.g. Polished, Lo-fi'],
    ['예: Sounds like IU', 'e.g. Sounds like IU'],
    ['예: [Rain], [Applause]', 'e.g. [Rain], [Applause]'],
    ['예: [Soft] 그 후 [Powerful]', 'e.g. [Soft] then [Powerful]'],
    ['예: [Verse], [Chorus]', 'e.g. [Verse], [Chorus]'],
    ['예: [Whisper] 그 후 [Belting]', 'e.g. [Whisper] then [Belting]'],
    ['예: drums, autotune', 'e.g. drums, autotune'],
    ['예: 가사 도중 [Guitar solo begins]', 'e.g. mid-lyric [Guitar solo begins]'],
    ['예: 꽃이 핀다 (꼬치 핀다)', 'e.g. "꽃이 핀다" (꼬치 핀다)'],
    ['예: 너는 my baby', 'e.g. 너는 my baby'],
    ['예: 사랑해 (사랑해)', 'e.g. 사랑해 (사랑해)'],
    // Description / tip samples (≤40 chars)
    ['Mono sound 완벽 재현', 'Perfect mono-sound reproduction'],
    ['Neve 콘솔', 'Neve console'],
    ['Oh, Baby, Hey 같은 짧은 단어', 'Short words like Oh, Baby, Hey'],
    ['PC Music 풍', 'PC Music style'],
    ['Sounds like Drake 등', 'Sounds like Drake etc.'],
    ['TB-303 사운드', 'TB-303 sound'],
    ['TR-808 드럼', 'TR-808 drums'],
    ['TikTok 바이럴', 'TikTok viral'],
    ['TikTok, 정신건강, 진정성, 다양성', 'TikTok, mental health, authenticity, diversity'],
    ['Verse/Chorus 없이 가사만', 'Lyrics only, no Verse/Chorus'],
    ['Witch House, Drone Doom 등', 'Witch House, Drone Doom etc.'],
    ['Y2K 시대', 'Y2K era'],
    ['YouTube/SNS 배경음악', 'YouTube / SNS background music'],
    ['[Verse 1], [Chorus] 정확 위치', '[Verse 1], [Chorus] exact placement'],
    ['[Vulnerable], [Powerful] 등', '[Vulnerable], [Powerful] etc.'],
    ['bad song 같은 부정 표현', 'Negative phrasing like "bad song"'],
    ['modern production, digital, autotune 차단', 'Block modern production, digital, autotune'],
    ['vinyl crackle 정확 재현', 'Vinyl crackle exact reproduction'],
    // Common short ko descriptions
    ['아날로그 따뜻함', 'Analog warmth'],
    ['아날로그 매체', 'Analog medium'],
    ['아날로그 신스', 'Analog synth'],
    ['아르페지오', 'Arpeggio'],
    ['아르페지오 신스', 'Arpeggio synth'],
    ['아메리칸 블루스', 'American Blues'],
    ['아비치 풍', 'Avicii style'],
    ['아이돌 시스템 탄생', 'Birth of the idol system'],
    ['아코디언', 'Accordion'],
    ['악기 2-3개로 제한', 'Limit to 2-3 instruments'],
    ['악기 과부하', 'Instrument overload'],
    ['안무 구간', 'Choreography section'],
    ['안무 구간 (보컬 없이 비트만)', 'Choreography section (beat only, no vocals)'],
    ['애시드 베이스', 'Acid bass'],
    ['애팔래치아 컨트리', 'Appalachian Country'],
    ['야마하 DX7', 'Yamaha DX7'],
    ['야마하 DX7 신스', 'Yamaha DX7 synth'],
    ['어두운 트랩', 'Dark trap'],
    ['어린이 보컬', "Children's vocals"],
    ['어쿠스틱 기타', 'Acoustic guitar'],
    ['어쿠스틱 드럼', 'Acoustic drums'],
    ['어쿠스틱 피아노', 'Acoustic piano'],
    ['얼후', 'Erhu'],
    ['업라이트 베이스', 'Upright bass'],
    ['여성 가수 (대체 표현)', 'Female singer (alt phrasing)'],
    ['여성 보컬', 'Female vocals'],
    ['여운 남기는 마무리', 'Lingering ending'],
    ['연도와 장르 결합', 'Combine year + genre'],
    ['연약한', 'Fragile'],
    ['영어 랩보다 짧게', 'Shorter than English rap'],
    ['영화 사운드트랙', 'Film soundtrack'],
    ['예고편 음악', 'Trailer music'],
    ['옛 가수 떨림창법', 'Old-singer vibrato style'],
    ['옛날 녹음 질감', 'Old recording texture'],
    ['오늘도 너를 생각하며 창밖을...', 'Thinking of you again today, looking out the window...'],
    ['오늘도 너를 생각해 / 창밖을 바라보네', 'Thinking of you today / Gazing out the window'],
    ['오르간', 'Organ'],
    ['오케스트라 현악', 'Orchestral strings'],
    ['오토튠', 'Auto-tune'],
    ['오토튠 제외', 'Exclude auto-tune'],
    // Common short tips / descriptors
    ['깨끗한 톤', 'Clean tone'],
    ['깨끗한, 선명한', 'Clean, vivid'],
    ['꺾기 창법', 'Kkokji vocal bend'],
    ['꺾기, 한, 추임새', 'Kkokji, Han, Ad-libs'],
    ['꺾기/한 정서', 'Kkokji / Han feel'],
    ['꺾기/한의 정서', 'Kkokji / Han emotion'],
    ['꿈결같은 팝', 'Dreamlike pop'],
    ['나이지리아 퓨전', 'Nigerian fusion'],
    ['남부 억양', 'Southern accent'],
    ['남성 가수 (대체 표현)', 'Male singer (alt phrasing)'],
    ['남성 보컬', 'Male vocals'],
    ['남아공 하우스', 'South African house'],
    ['낮은 강도', 'Low intensity'],
    ['내러티브 절', 'Narrative verse'],
    ['내레이션 섹션', 'Narration section'],
    ['내슈빌 프로덕션', 'Nashville production'],
    ['내슈빌-트랩 융합', 'Nashville-trap fusion'],
    ['네온 빛', 'Neon glow'],
    ['뉴욕 디스코 클럽', 'New York disco club'],
    ['뉴욕 펑크 본거지', 'NYC punk birthplace'],
    ['뉴잭스윙 영향', 'New Jack Swing influence'],
    ['느긋한', 'Relaxed'],
    ['느긋한, 편안한', 'Relaxed, comfortable'],
    ['느리게', 'Slow'],
    ['느린 템포', 'Slow tempo'],
    ['느린 템포 (발라드 필수)', 'Slow tempo (ballad essential)'],
    ['늑대 울음', 'Wolf howl'],
    ['님 떠난 그 자리에 / 홀로 남은 이 마음 / 달빛도 흐려져 / 눈물만 흐르네', 'Where you left / This heart alone / Even moonlight blurs / Only tears flow'],
    ['다르부카', 'Darbuka'],
    ['다이코', 'Taiko'],
    ['단조', 'Minor key'],
    ['당시 압반/믹싱 색깔', 'Period pressing / mix colour'],
    ['대공황, 희망, 노동, 떠나간 연인', 'Great Depression, hope, labour, lost love'],
    ['대기적인', 'Atmospheric'],
    ['대략적 BPM 범위', 'Approximate BPM range'],
    ['대위법/푸가', 'Counterpoint / fugue'],
    ['대중 음악', 'Pop music'],
    ['더블 베이스 드럼', 'Double bass drum'],
    ['도시 소음', 'City noise'],
    ['도입부 (8~16마디)', 'Intro (8-16 bars)'],
    ['돌 드럼', 'Stone drum'],
    ['돌라크', 'Dholak'],
    ['듀얼 기타 하모니', 'Dual-guitar harmony'],
    ['듀엣', 'Duet'],
    ['드럼 키트', 'Drum kit'],
    ['드럼머신', 'Drum machine'],
    ['드롭 직전 빌드업', 'Build-up right before the drop'],
    ['디스코 기본 비트', 'Basic disco beat'],
    ['기타론', 'Guitarrón'],
    ['긴장감 고조', 'Tension build-up'],
    // Decade-tagged tag values
    ['1950-60s 트로트', '1950s-60s Trot'],
    ['1950년대', '1950s'],
    ['1960s 사이키델릭', '1960s Psychedelic'],
    ['1960년대', '1960s'],
    ['1970s 디스코', '1970s Disco'],
    ['1970s 포크', '1970s Folk'],
    ['1980s 댄스', '1980s Dance'],
    ['1980s 발라드', '1980s Ballad'],
    ['1980s 시티팝', '1980s City Pop'],
    ['1990s 댄스', '1990s Dance'],
    ['1990s 발라드', '1990s Ballad'],
    ['2000s 2세대 K-Pop', '2000s 2nd-gen K-Pop'],
    ['2000s 발라드', '2000s Ballad'],
    ['2000s 인디', '2000s Indie'],
    ['2000s 힙합', '2000s Hip-hop'],
    ['2010s 3세대 K-Pop', '2010s 3rd-gen K-Pop'],
    ['2010s 4세대 K-Pop', '2010s 4th-gen K-Pop'],
    ['2010s 인디/감성', '2010s Indie / Sensitive'],
    ['2010s 후반 트로트', 'Late-2010s Trot'],
    ['2010s 힙합', '2010s Hip-hop'],
    ['50-60년대 트로트', '50s-60s Trot'],
    ['60년대 사이키델릭', '60s Psychedelic'],
    ['70년대 포크', '70s Folk'],
    ['70년대 후반 디스코', 'Late-70s Disco'],
    ['80년대 댄스', '80s Dance'],
    ['80년대 발라드', '80s Ballad'],
    ['80년대 시티팝', '80s City Pop'],
    ['80년대 후반 트로트', 'Late-80s Trot'],
    // Rank lines (1위 .. 9위)
    ['1위: Pop', 'Rank 1: Pop'],
    ['2위: Hip-Hop/Rap', 'Rank 2: Hip-Hop / Rap'],
    ['3위: Latin (Reggaeton)', 'Rank 3: Latin (Reggaeton)'],
    ['4위: EDM/Electronic', 'Rank 4: EDM / Electronic'],
    ['5위: Afrobeats', 'Rank 5: Afrobeats'],
    ['6위: K-Pop', 'Rank 6: K-Pop'],
    ['7위: Country', 'Rank 7: Country'],
    ['8위: Rock', 'Rank 8: Rock'],
    ['9위: Indie/Lo-fi', 'Rank 9: Indie / Lo-fi'],
    // K-pop tempos
    ['K-pop 댄스', 'K-pop Dance'],
    ['K-pop 미디엄', 'K-pop Medium'],
    ['6 레이어 공식', '6-layer formula'],
    ['복사용', 'For copying'],
    ['키보드', 'keyboard'],
    ['연음 표기', 'Liaison notation'],
    // KO description entries from the data — common short ones
    ['1920s 즉시 호출', '1920s instant invoke'],
    ['1930-40s 즉시 호출', '1930s-40s instant invoke'],
    ['1940s 즉시 호출', '1940s instant invoke'],
    ['1950s 즉시 호출', '1950s instant invoke'],
    ['1960s 즉시 호출', '1960s instant invoke'],
    ['1970s 디스코 호출', '1970s Disco invoke'],
    ['1980s 즉시 호출', '1980s instant invoke'],
    ['1990s 즉시 호출', '1990s instant invoke'],
    ['2000s 즉시 호출', '2000s instant invoke'],
    ['2010s EDM 호출', '2010s EDM invoke'],
    ['2020s 즉시 호출', '2020s instant invoke'],
    ['1세대 K-Pop', '1st-gen K-Pop'],
    ['2세대 K-Pop', '2nd-gen K-Pop'],
    ['3세대 K-Pop', '3rd-gen K-Pop'],
    ['4세대 K-Pop', '4th-gen K-Pop'],
    ['1998년 아이돌 팝', '1998 idol pop'],
    ['2008년 아이돌 팝', '2008 idol pop'],
    ['2017년 아이돌 팝', '2017 idol pop'],
    ['2015-2019 글로벌 K-Pop', '2015-2019 global K-Pop'],
    ['30B+ 글로벌 스트림', '30B+ global streams'],
    ['3:30 등 정확 지정', 'Exact spec like 3:30'],
    ['4/4 댄스 비트', '4/4 dance beat'],
    ['4/4 박자 일렉트로닉', '4/4 electronic time'],
    ['4도 화성/클러스터', '4th harmony / cluster'],
    ['4트랙 녹음', '4-track recording'],
    ['5음계', 'Pentatonic'],
    ['700% 성장률 (vs 2024)', '700% growth rate (vs 2024)'],
    ['70~120 BPM (옛 가요)', '70-120 BPM (old K-pop)'],
    ['75~85 BPM (하프타임)', '75-85 BPM (half-time)'],
    ['80년대 영감 신스', '80s-inspired synth'],
    ['80년대 파워 보컬', '80s power vocal'],
    ['90~140 BPM (트랩 하프타임)', '90-140 BPM (trap half-time)'],
    ['90년대 중반 프로덕션', 'Mid-90s production'],
    ['90년대 한국 가요 시대 키워드', '90s Korean-pop era keyword'],
    ['90년대 후반 메이저 레이블 아이돌', 'Late-90s major-label idol'],
    ['90년대 힙합 스타일', '90s hip-hop style'],
    ['130~140 BPM (하프타임)', '130-140 BPM (half-time)'],
    ['137.5 같은 소수점 BPM', 'Decimal BPM like 137.5'],
    ['140 BPM (하프타임)', '140 BPM (half-time)'],
    ['15개 이상 태그', '15+ tags'],
    ['10음절 내외로', 'Around 10 syllables'],
    [', 활용', ', usage'],
    ['. , 활용', 'Use . ,'],
    ['. 으로 호흡 조절', 'Phrasing with periods'],
    ['ASMR 영향', 'ASMR influence'],
    ['Dr. Dre 프로덕션', 'Dr. Dre production'],
    ['EDM 광택', 'EDM polish'],
    ['EDM-트랩 융합', 'EDM-trap fusion'],
    ['EDM/일렉의 클라이맥스', 'EDM / Electronic climax'],
    ['K-pop 특유의 광택감', 'K-pop signature polish'],
    ['Korean traditional 태그', 'Korean traditional tag'],
    ['Kygo 풍', 'Kygo style'],
    ['LFO 베이스', 'LFO bass'],
    ['LP 스크래치', 'LP scratch'],
    ['LP 잡음', 'LP noise'],
    ['LinnDrum 등', 'LinnDrum etc.'],
    ['Lo-fi 4트랙', 'Lo-fi 4-track'],
    ['MTV TRL 시대', 'MTV TRL era'],
    ['MTV 시대', 'MTV era'],
    ['1960년대 아나운서 톤', '1960s announcer tone'],
    ['1970년대 초중반', 'Early-to-mid 1970s'],
    ['1970년대 후반~80년대 초', 'Late 1970s — early 1980s'],
    ['1970년대 후반', 'Late 1970s'],
    ['1980년대 중후반', 'Mid-to-late 1980s'],
    ['1990s 후반 1세대 K-Pop', 'Late-1990s 1st-gen K-Pop'],
    ['2개 이상 장르 결합', 'Combine 2+ genres'],
    ['3개 이상 장르 결합', 'Combine 3+ genres'],
    ['5개 이상 악기 동시 지정', 'Specify 5+ instruments simultaneously'],
    ['Kkokji / 꺾기 표현', 'Kkokji / vocal bending expression'],
    ['Voice 변화 (섹션별)', 'Voice change (per section)'],
    ['Niche 마이크로 장르', 'Niche micro genres'],
    ['Sun Records, Motown, Stax 등', 'Sun Records, Motown, Stax etc.'],
    ['Sounds like Adele 등', 'Sounds like Adele etc.'],
    ['Sounds like IU 등', 'Sounds like IU etc.'],
    ['Lee Moon-sae 등', 'Lee Mun-sae etc.'],
    ['Cho Yong-pil style 등', 'Cho Yong-pil style etc.'],
    ['Neve 1073, Pultec EQ 등', 'Neve 1073, Pultec EQ etc.'],
    ['Charlie Parker 톤 정확히', 'Charlie Parker tone exactly'],
    ['Korean Trot / 트로트', 'Korean Trot'],
    ['지구레코드, 오아시스 사운드', 'Jigu Records, Oasis Sound'],
    ['연도+장르', 'year + genre'],
    ['연대 + 장르', 'era + genre'],
    ['시대 + 장르 + 악기 조합', 'era + genre + instrument combo'],
    ['시대 고유 마이크 톤', 'era-specific mic tone'],
    ['시대 어휘 사용', 'use era vocabulary'],
    ['시대 맞는 BPM', 'era-appropriate BPM'],
    ['시대에 맞는 BPM', 'era-appropriate BPM'],
    ['지역명 + 장르', 'regional name + genre'],
    ['Era 키워드', 'Era keyword'],
    ['Genre 태그', 'Genre tag'],
    ['Mood 태그', 'Mood tag'],
    ['Production 키워드', 'Production keyword'],
    ['Style 필드', 'Style field'],
    ['Exclude 필드 활용', 'Use the Exclude field'],
    ['GMIV 포뮬러', 'GMIV formula'],
    ['Suno V3 이하', 'Suno V3 or lower'],
    ['BPM (대략)', 'BPM (approx.)'],
    ['BPM 정확 락', 'Exact BPM lock'],
    ['BPM 락', 'BPM lock'],
    ['정확한 BPM 락', 'Exact BPM lock'],
    ['정확한 LP 잡음', 'Exact LP noise'],
    ['정확한 곡 길이', 'Exact song length'],
    ['Verse 패턴', 'Verse pattern'],
    ['[I-V-vi-IV] 등', '[I-V-vi-IV] etc.'],
    ['[1980s Synthwave] 등 연도+장르', '[1980s Synthwave] etc. year+genre'],
    ['[127 BPM] 정확 지정', '[127 BPM] exact spec'],
    ['[Rap] 태그 절마다 명시', 'Mark [Rap] in each verse'],
    ['가능: 1~2 단어만', 'Possible: 1-2 words only'],
    ['1~2 단어만', '1-2 words only'],
    ['1~2 단어', '1-2 words'],
    ['외국어 한 단어만 강제', 'Force one foreign word only'],
    ['외국어 한 단어만', 'one foreign word only'],
    ['영어 단어 1~2개 섞기', 'Mix 1-2 English words'],
    ['영어 단어 과다 사용', 'Excessive English words'],
    ['영어 태그 + 한국어 장르명 병기', 'English tags + Korean genre name'],
    ['영어 단어', 'English word(s)'],
    ['한국어 장르명 병기', 'Korean genre name alongside'],
    ['한국어 장르명', 'Korean genre name'],
    ['한국어 사투리', 'Korean dialect'],
    ['한국어 시대별 발음', 'Korean era-specific pronunciation'],
    ['한국 전통 가창 기법', 'Korean traditional vocal technique'],
    ['표준 한국식 꺾기', 'Standard Korean-style bending'],
    ['판소리/국악 발성', 'Pansori / Gugak vocalisation'],
    ['트로트 뽕끼', 'Trot ppong (signature feel)'],
    ['특정 LP 마스터링 톤', 'Specific LP mastering tone'],
    ['특정 가수 모창', 'Specific-singer impersonation'],
    ['특정 아티스트 모창', 'Specific-artist impersonation'],
    ['감정 파싱 향상', 'Improved emotion parsing'],
    ['괄호 안 ad-libs', 'Ad-libs inside parens'],
    ['괄호로 발음 표기', 'Mark pronunciation in parens'],
    ['좋은 예 (짧게 끊기)', 'Good example (short breaks)'],
    ['나쁜 예 (긴 줄)', 'Bad example (long line)'],
    ['좋은 예', 'Good example'],
    ['나쁜 예', 'Bad example'],
    ['모순 태그 조합', 'Contradictory tag combo'],
    ['문자적 해석 기대', 'Expect literal interpretation'],
    ['긴 산문 설명', 'Long prose description'],
    ['긴 영어 문장', 'Long English sentence'],
    ['어색: 긴 영어 문장', 'Awkward: long English sentence'],
    ['추천 방식', 'Recommended approach'],
    ['빈티지 키워드 반복', 'Repeat vintage keywords'],
    ['시그니처 악기 명시', 'Designate signature instrument'],
    ['악기 (전반적)', 'Instrument (overall)'],
    ['전반적 vocal 톤', 'Overall vocal tone'],
    ['보컬 톤', 'Vocal tone'],
    ['녹음 질감', 'Recording texture'],
    ['느린 부분 (발라드용)', 'Slow part (for ballads)'],
    ['느린 부분', 'Slow part'],
    ['빠른 부분', 'Fast part'],
    ['짧은 줄로 끊기', 'Break into short lines'],
    ['짧은 줄바꿈', 'Short line breaks'],
    ['줄바꿈으로 박자 표현', 'Express beat with line breaks'],
    ['가사 줄 길이 짧게', 'Short lyric line length'],
    ['가사 내 감정 태그', 'Emotion tag inside lyrics'],
    ['가사의 모음 늘림', 'Extend vowels in lyrics'],
    ['감탄사 활용', 'Use interjections'],
    ['마침표 활용', 'Use periods'],
    ['마침표/쉼표로 호흡 조절', 'Period/comma phrasing'],
    ['쉼표로 구분된 키워드', 'Comma-separated keywords'],
    ['섹션 인식 편집', 'Section-aware editing'],
    ['섹션 태그 위치 배치', 'Position section tags'],
    ['섹션별 감정 태그', 'Per-section emotion tag'],
    ['구조 태그 무시', 'Ignore structure tags'],
    ['구조 패턴', 'Structure pattern'],
    ['구조 태그', 'Structure tag'],
    ['태그 과부하', 'Tag overload'],
    ['태그 위치 오류', 'Tag position error'],
    ['제외 명령 작동', 'Exclude command works'],
    ['제외할 요소', 'Elements to exclude'],
    ['인라인 효과', 'Inline effects'],
    ['성공 프롬프트 저장', 'Save successful prompts'],
    ['완벽한 모노 사운드', 'Perfect mono sound'],
    ['김건모 Style 프롬프트', 'Kim Gun-mo Style prompt'],
    ['신승훈 Style 프롬프트', 'Shin Seung-hun Style prompt'],
    ['SNS / 셀카 / DM', 'SNS / selfie / DM'],
    ['다방 / 전철 / 통금 / 야간 통행', 'Dabang / subway / curfew / night pass'],
    ['라디오 / 별빛 / 달빛', 'Radio / starlight / moonlight'],
    ['내 사랑 그대 / 님이여 / 그 시절', '"my love" / "my dear" / "those days"'],
    ['핵심 태그', 'core tags'],
    ['핵심 룰', 'core rule'],
    ['확장 태그', 'extended tags'],
    ['가사 주제', 'lyric themes'],
    ['가사 예시', 'lyric examples'],
    ['가사 시대 키워드', 'era lyric keywords'],
    ['공동 원칙', 'common rules'],
    ['트로트 부흥', 'Trot revival'],
    ['트로트 다양화', 'Trot diversification'],
    ['시대 BPM', 'era BPM'],
    ['시대 보컬', 'era vocals'],
    ['시대 사운드', 'era sound'],
    ['아이돌 팝', 'idol pop'],
    ['메이저 레이블 아이돌', 'major-label idol'],
    ['옛 가요', 'old K-pop'],
    ['파워 보컬', 'power vocals'],
    ['음절 길이 조절', 'syllable length control'],
    ['음절 길이', 'syllable length'],
    ['호흡 조절', 'phrasing control'],
    ['단일 강력 키워드', 'single powerful keyword'],
    ['강력한 연도 조합', 'strong year combinations'],
    ['글로벌 스트림', 'global streams'],
    ['아나운서 톤', 'announcer tone'],
    ['전통적 감성', 'traditional feel'],
    ['감정 절정', 'emotional climax'],
    ['절정 직전', 'right before climax'],
    ['빌드업 직전', 'right before build-up'],
    ['트랩 하프타임', 'trap half-time'],
    ['하프타임', 'half-time'],
    // Word-level fallbacks (apply after the phrases above)
    ['프로덕션', 'production'],
    ['키워드', 'keyword'],
    ['예시', 'example'],
    ['주제', 'theme'],
    ['호출', 'invoke'],
    ['활용', 'usage'],
    ['적용', 'application'],
    ['조절', 'control'],
    ['녹음', 'recording'],
    ['박자', 'time'],
    ['음계', 'scale'],
    ['화성', 'harmony'],
    ['클러스터', 'cluster'],
    ['파워', 'power'],
    ['글로벌', 'global'],
    ['스트림', 'stream'],
    ['성장률', 'growth rate'],
    ['중반', 'mid-'],
    ['후반', 'late'],
    ['초', 'early'],
    ['말', 'late'],
    ['광택감', 'polish'],
    ['광택', 'polish'],
    ['영향', 'influence'],
    ['영감', '-inspired'],
    ['스크래치', 'scratch'],
    ['잡음', 'noise'],
    ['시대', 'era'],
    ['메이저 레이블', 'major label'],
    ['빅룸', 'big-room'],
    ['소수점', 'decimal'],
    ['옛날', 'old'],
    ['따뜻한', 'warm'],
    ['차가운', 'cold'],
    ['부드러운', 'smooth'],
    ['거친', 'rough'],
    ['깊은', 'deep'],
    ['높은', 'high'],
    ['낮은', 'low'],
    ['느린', 'slow'],
    ['빠른', 'fast'],
    ['강한', 'strong'],
    ['약한', 'weak'],
    ['단일', 'single'],
    ['강력', 'powerful'],
    ['연도', 'year'],
    ['조합', 'combination'],
    ['오디오 신호', 'audio signal'],
    ['신호', 'signal'],
    ['일반 가요', 'general K-pop'],
    ['일반', 'general'],
    ['특수 효과', 'special effects'],
    ['특수', 'special'],
    ['효과', 'effect'],
    ['전형적', 'typical'],
    ['전형', 'archetype'],
    ['추상', 'abstract'],
    ['구체적', 'concrete'],
    ['직설적', 'direct'],
    ['은유적', 'metaphorical'],
    ['암시', 'allusion'],
    ['비유', 'metaphor'],
    ['상징', 'symbol'],
    ['감정', 'emotion'],
    ['절정', 'climax'],
    ['원칙', 'principles'],
    ['음절', 'syllable'],
    ['길이', 'length'],
    ['호흡', 'breathing'],
    ['로마자 표기', 'Romanisation'],
    ['로마자', 'Romanisation'],
    ['표기', 'notation'],
    ['어색해짐', 'becomes awkward'],
    ['어색', 'awkward'],
    ['인식률', 'recognition rate'],
    ['제어권', 'control level'],
    ['응축됨', 'condensed'],
    ['응축', 'condensation'],
    ['정확도', 'accuracy'],
    ['언어 명시', 'language directive'],
    ['언어 강제', 'forced language'],
    ['언어', 'language'],
    ['명시', 'directive'],
    ['강제', 'forced'],
    ['최강', 'strongest'],
    ['약함', 'weak'],
    ['최약', 'weakest'],
    ['가이드 신호', 'guide signal'],
    ['가이드', 'guide'],
    ['전통적', 'traditional'],
    ['전통', 'tradition'],
    ['반응', 'response'],
    ['반복', 'repeat'],
    ['일렉트로닉', 'Electronic'],
    ['일렉', 'Electric'],
    ['디스코', 'Disco'],
    ['90년대', '90s'],
    ['80년대', '80s'],
    ['70년대', '70s'],
    ['60년대', '60s'],
    ['50년대', '50s'],
    ['40년대', '40s'],
    ['30년대', '30s'],
    ['20년대', '20s'],
    ['년대', 's'],
    ['년 ', ' '],
    // Korean artists / acts often appearing in subtitles
    ['박재범', 'Park Jae-bum'], ['지코', 'Zico'], ['딘', 'DEAN'],
    ['크러쉬', 'Crush'], ['빈지노', 'Beenzino'], ['10cm', '10cm'],
    ['볼빨간사춘기', 'Bolbbalgan4'],
    ['쇼미더머니', 'Show Me the Money'], ['언프리티 시대', 'Unpretty era'],
    ['시대', 'era'],
    // K-pop genre subtitle phrases
    ['한국 Hip-hop', 'Korean Hip-hop'],
    ['한국 Indie', 'Korean Indie'],
    ['감성 music', 'feels music'],
    ['네오Soul', 'Neo-Soul'],
    ['감성', 'sensitive'],
    ['로파이', 'Lo-fi'],
    // Dance card / composer phrases
    ['스타일', 'style'],
    // ── Style-group dropdown labels (data/data.js → section_short) ───────────
    // Strip redundant Korean parentheticals from primarily-English titles
    // and translate the Korean-only / mixed entries used in Builder &
    // Album style-group pickers.
    ['1920s - Jazz Age (재즈 시대)', '1920s - Jazz Age'],
    ['1950s - Rock & Roll Birth (록앤롤 탄생)', '1950s - Rock & Roll Birth'],
    ['1950~60년대 정통 트로트 (올드 트로트)', '1950s-60s Classic Trot (Old Trot)'],
    ['1970s - Diversification Era (다양화 시대)', '1970s - Diversification Era'],
    ['1980s - MTV Era (MTV 시대)', '1980s - MTV Era'],
    ['1990s - Alternative Boom (얼터너티브 폭발)', '1990s - Alternative Boom'],
    ['1990년대 후반 1세대 K-Pop (H.O.T./S.E.S./핑클/젝키)', 'Late-90s 1st-gen K-Pop (H.O.T. / S.E.S. / Fin.K.L / Sechs Kies)'],
    ['2000s - Digital Revolution (디지털 혁명)', '2000s - Digital Revolution'],
    ['2000년대 2세대 K-Pop (동방신기/빅뱅/소녀시대)', '2000s 2nd-gen K-Pop (TVXQ / BIGBANG / Girls’ Generation)'],
    ['2010s - Streaming Era (스트리밍 시대)', '2010s - Streaming Era'],
    ['2010년대 한국 힙합 / R&B (지코/박재범/자이언티/딘)', '2010s K-Hip-hop / R&B (Zico / Jay Park / Zion.T / DEAN)'],
    ['2010년대 후반 4세대 K-Pop 태동 (스트레이키즈/ITZY/(여자)아이들)', 'Late-2010s 4th-gen K-Pop emerges (Stray Kids / ITZY / (G)I-DLE)'],
    ['2020s - Current Era (현재)', '2020s - Current Era'],
    ['60-70년대 사이키델릭 록 (신중현 스타일)', '60s-70s Psychedelic Rock (Shin Jung-hyun style)'],
    ['AFROBEATS (아프로비츠)', 'AFROBEATS'],
    ['COUNTRY (컨트리)', 'COUNTRY'],
    ['EDM / ELECTRONIC (일렉트로닉 댄스)', 'EDM / ELECTRONIC'],
    ['HIP-HOP / RAP (힙합/랩)', 'HIP-HOP / RAP'],
    ['INDIE / LO-FI (인디/로파이)', 'INDIE / LO-FI'],
    ['K-POP (현대 케이팝)', 'K-POP (Modern K-pop)'],
    ['K-R&B / K-인디 / 시티팝', 'K-R&B / K-Indie / City Pop'],
    ['K-힙합 / 한국 랩', 'K-Hip-hop / Korean Rap'],
    ['LATIN (라틴 음악)', 'LATIN'],
    ['POP (글로벌 팝)', 'POP (Global Pop)'],
    ['ROCK (록)', 'ROCK'],
    ['동요 / CCM', 'Children’s Song / CCM'],
    ['발라드 (Ballad)', 'Ballad'],
    ['트로트 (Trot)', 'Trot'],
    // Era special-case labels emitted by eraLabel()
    ['현대 (Modern Korean Pop)', 'Modern Korean Pop'],
    ['글로벌 (시대 무관)', 'Global (era-agnostic)'],
    ['(시대 미지정)', '(Unspecified)'],
  ];
  function tdx(input) {
    if (input == null) return input;
    const lang = (typeof window !== 'undefined' && window.SU_LANG) ? window.SU_LANG() : 'ko';
    if (lang !== 'en') return input;
    let s = String(input);
    // Always match longest keys first so multi-word entries swap
    // whole before any shorter word-level rule mutates the string
    // mid-flight. Cache the sorted order once.
    if (!tdx._sorted) {
      tdx._sorted = TDX_MAP.slice().sort((a, b) => b[0].length - a[0].length);
    }
    const ordered = tdx._sorted;
    for (let i = 0; i < ordered.length; i++) {
      const [k, v] = ordered[i];
      if (s.indexOf(k) >= 0) s = s.split(k).join(v);
    }
    return s;
  }
  function toast(msg, ms = 1600) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.remove('error');
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), ms);
  }
  // Red-tinted variant for prerequisite failures / blocked actions
  function toastError(msg, ms = 2800) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show', 'error');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show', 'error'), ms);
  }
  function copyText(text) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => toast(tx('toast.copied', '복사됨')));
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast(tx('toast.copied', '복사됨')); } finally { ta.remove(); }
    }
  }
  // ─── File-system save helpers ────────────────────────────────────
  // The browser sandbox can only trigger downloads. We DO control the
  // file name though — including subdirectories. Chromium browsers
  // honour slashes in the `download` attribute and create matching
  // folders inside the user's Downloads/ root. Firefox / Safari fall
  // back to flattening the slashes into the filename.
  //
  // Layout:
  //   Downloads/suno_prompt_manager/
  //     preset/
  //       all_presets_<timestamp>.json   ← bulk export
  //       <preset name>.json             ← per-card export
  //     <album title>/
  //       album.json                     ← full album JSON
  //       01_<track title>.txt           ← per-track style+lyrics
  //       02_<track title>.txt
  //       …
  const APP_DIR = 'suno_prompt_manager';
  function safeFilename(s, fallback = 'untitled') {
    return String(s || fallback)
      .replace(/[\\/:*?"<>|]/g, '')      // illegal filename characters
      .replace(/\s+/g, '_')               // spaces → underscore
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80) || fallback;
  }
  function downloadBlob(blob, relativePath) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = relativePath;       // path with slashes — Chromium honours
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  function downloadText(text, mime, relativePath) {
    downloadBlob(new Blob([text], { type: mime }), relativePath);
  }
  function downloadJSON(obj, relativePath) {
    downloadText(JSON.stringify(obj, null, 2), 'application/json', relativePath);
  }

  function loadPresets() {
    try { return JSON.parse(localStorage.getItem('suno_presets') || '[]'); }
    catch { return []; }
  }
  function savePresets() {
    localStorage.setItem('suno_presets', JSON.stringify(state.presets));
  }
  function debounce(fn, ms = 200) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function detectBPM(text) {
    const m = String(text).match(/\b(\d{2,3})\s*BPM\b/i);
    return m ? parseInt(m[1], 10) : null;
  }

  // Normalize lyrics so every [Section] tag is preceded by EXACTLY ONE
  // blank line — Suno still parses it, and the layout reads as visually
  // distinct verse/chorus/bridge blocks. Idempotent.
  function normalizeLyrics(text) {
    if (!text) return '';
    // strip trailing whitespace per line
    let lines = String(text).replace(/\r\n/g, '\n').split('\n').map(l => l.replace(/[\t ]+$/g, ''));
    // collapse 3+ consecutive blanks to one blank
    const out = [];
    let blankRun = 0;
    for (const l of lines) {
      if (l.trim() === '') {
        blankRun++;
        if (blankRun <= 1) out.push('');
      } else {
        blankRun = 0;
        out.push(l);
      }
    }
    // ensure each [Section] header (a line that is just bracketed text)
    // is preceded by a blank line, unless it's at the very top
    const fixed = [];
    const isSectionHeader = (s) => /^\s*\[[^\]]+\]\s*$/.test(s);
    for (let i = 0; i < out.length; i++) {
      const line = out[i];
      if (isSectionHeader(line) && fixed.length > 0) {
        // remove any trailing blanks then add ONE blank
        while (fixed.length && fixed[fixed.length - 1].trim() === '') fixed.pop();
        fixed.push('');
      }
      fixed.push(line);
    }
    // trim leading + trailing blanks
    while (fixed.length && fixed[0].trim() === '') fixed.shift();
    while (fixed.length && fixed[fixed.length - 1].trim() === '') fixed.pop();
    return fixed.join('\n');
  }

  // Suno Style 프롬프트는 영문이어야 한다. 한국어가 섞이면 Suno 의 영문
  // 인지 토큰화가 깨지므로 익숙한 한국어 음악 용어는 영문으로 치환하고,
  // 남은 한글 글자는 제거한다. PRESETS 생성·칩 추가·AI 응답·수동 입력
  // 모든 경로에서 호출되어 Style 칩이 영문만 유지되도록 한다.
  // Order matters: longer / more specific patterns must come FIRST so
  // they don't get partially eaten by the shorter ones below.
  const KO_STYLE_MAP = [
    // Multi-word phrases first so they win over single-word rules below
    [/올드\s*트로트/g, 'old-school Trot'],
    [/한국\s*힙합/g, 'Korean hip-hop'],
    [/한국\s*인디/g, 'Korean indie'],
    [/한국\s*가요/g, 'Korean pop'],
    [/한국\s*락|한국\s*록/g, 'Korean rock'],
    [/한국\s*R&B/g, 'Korean R&B'],
    [/시티\s*팝/g, 'city pop'],
    [/걸\s*그룹/g, 'girl group'],
    [/보이\s*그룹/g, 'boy group'],
    [/코드\s*진행/g, 'chord progression'],
    [/정확\s*락/g, 'exact lock'],
    [/사용\s*필수/g, 'required'],
    // Tempo / energy modifiers commonly tacked onto genre names (e.g.
    // "K-pop 미디엄", "K-pop 댄스", "Korean ballad 슬로우")
    [/미디엄|미드템포|미드\s*템포/g, 'midtempo'],
    [/패스트|빠른|빠름/g, 'fast'],
    [/슬로우|느린|느림/g, 'slow'],
    [/업\s*템포|업템포/g, 'uptempo'],
    [/다운\s*템포|다운템포/g, 'downtempo'],
    [/하드|강한|쎈/g, 'hard'],
    [/소프트|부드러운/g, 'soft'],
    [/딥|깊은/g, 'deep'],
    [/하이|높은/g, 'high'],
    [/로우|낮은/g, 'low'],
    [/댄스(?!홀)/g, 'dance'],   // "댄스" → "dance", but skip "댄스홀"
    [/댄스홀/g, 'dancehall'],
    [/정통/g, 'traditional'],
    [/모던/g, 'modern'],
    // Era / decade suffix: "1980년대" → "1980s"
    [/(\d{2,4})\s*년대/g, '$1s'],
    [/년대|연도/g, ''],
    // Filler particles that show up at the end of catalog rows (drop
    // them entirely — they're not tags, just Korean discourse markers)
    [/\s*등(?:\s|$|,)/g, ' '],
    [/\s*이하/g, ''],
    [/\s*이상/g, ''],
    // Korean trailing nouns that mean the row is a guide label, not a
    // tag. Strip the noun so what remains is the actual English token.
    [/\s*키워드/g, ''],
    [/\s*표현/g, ''],
    [/\s*패턴/g, ''],
    [/\s*풍(?:\s|$|,)/g, '-style '],
    // Korean-only descriptor → English equivalents
    [/트로트/g, 'Trot'],
    [/발라드/g, 'ballad'],
    [/통기타/g, 'acoustic guitar folk'],
    [/동요/g, 'children song'],
    [/아이돌/g, 'idol'],
    [/그룹/g, 'group'],
    [/혼성/g, 'mixed'],
    [/남성|남자/g, 'male'],
    [/여성|여자/g, 'female'],
    [/한글/g, 'Korean'],
    [/한국어/g, 'Korean'],
    [/한국/g, 'Korean'],
    [/일본어|일본/g, 'Japanese'],
    [/중국어|중국/g, 'Chinese'],
    [/세션/g, 'session'],
    [/연주/g, 'instrumental'],
    [/녹음/g, 'recording'],
    [/창법/g, 'vocal style'],
    [/가창/g, 'vocal'],
    [/호흡/g, 'breath'],
    [/박자/g, 'beat'],
    [/리듬/g, 'rhythm'],
    [/멜로디/g, 'melody'],
    [/화음/g, 'harmony'],
    [/코드/g, 'chord'],
    [/진행/g, 'progression'],
  ];
  function sanitizeStyleTag(s) {
    if (!s) return '';
    let out = String(s);
    for (const [pat, rep] of KO_STYLE_MAP) out = out.replace(pat, rep);
    out = out.replace(/[가-힣ㄱ-ㅎㅏ-ㅣ]+/g, '')
             .replace(/\s{2,}/g, ' ')
             .replace(/\s*,\s*,/g, ',')
             .trim();
    out = out.replace(/^[,\-\s]+|[,\-\s]+$/g, '');
    return out;
  }
  // Artist · band · producer names that occasionally leak into Suno Style
  // prompts (mostly via Excel-derived templates). Stripped at runtime so
  // the Style field stays generic. Longest-first so multi-word patterns
  // beat their substrings. Replacements lean toward role descriptions
  // ("the producer", "the vocalist") so the prompt remains grammatical.
  const ARTIST_NAME_RULES = [
    [/\bGlenn\s+Miller(?:\s+style)?(?:\s+influence)?/gi, 'big-band swing'],
    [/\bRobert\s+Johnson(?:\s+influence)?/gi, 'delta-blues pioneer'],
    [/\bCharlie\s+Parker(?:\s+virtuosity)?/gi, 'bebop virtuoso'],
    [/\bLouis\s+Jordan(?:\s+influence)?/gi, 'jump-blues'],
    [/\bFrank\s+Sinatra(?:\s+style)?/gi, 'crooner standard'],
    [/\bHank\s+Williams(?:\s+style)?/gi, 'honky-tonk'],
    [/\bBob\s+Dylan(?:\s+influence)?/gi, 'folk-rock vocalist'],
    [/\bJames\s+Brown(?:\s+grunts)?(?:\s+and\s+exclamations)?/gi, 'funk grunts and exclamations'],
    [/\bJames\s+Brown(?:[- ]style)?/gi, 'funk vocalist'],
    [/\bMadonna(?:\s+influence)?/gi, 'dance-pop diva'],
    [/\bKurt\s+Cobain(?:\s+energy)?/gi, 'grunge-vocal energy'],
    [/\bMax\s+Martin(?:\s+production)?/gi, 'Swedish pop production'],
    [/\bLinkin\s+Park(?:\s+energy)?/gi, 'nu-metal energy'],
    [/\bAvicii(?:\s+style)?/gi, 'EDM-anthem style'],
    [/\bDr\.?\s+Dre(?:\s+production)?/gi, 'G-Funk production'],
    [/\bBillie\s+Eilish(?:\s+aesthetic)?/gi, 'dark bedroom-pop aesthetic'],
    [/\bWillie\s+Nelson(?:\s+influence)?/gi, 'outlaw country'],
    [/\bJoe\s+Hisaishi(?:\s+influence)?/gi, 'cinematic Japanese composer'],
    [/\bScott\s+Joplin(?:\s+influence)?/gi, 'ragtime pioneer'],
    [/\bSister\s+Rosetta\s+Tharpe(?:\s+influence)?/gi, 'gospel-blues pioneer'],
    [/\bJames\s+Jamerson\b/gi, 'Motown bassist'],
    [/\bB\.?\s*B\.?\s+King(?:\s+influence)?/gi, 'electric-blues pioneer'],
    [/\bTimbaland(?:\s+influence)?/gi, 'futuristic R&B production'],
    [/'Bobby!'\s+call-?outs/gi, 'call-out shouts'],
  ];

  // Language directives are not music descriptors — the lyrics decide
  // language. Strip them from any Style string.
  const LANG_PHRASE_RULES = [
    [/,?\s*\b(?:vocals?|sung|rapped)\s+in\s+(?:Korean|English|Japanese|Spanish|Portuguese|Mandarin|Chinese|French|German|Italian|Tagalog|Pidgin(?:[- ]English)?|Lingala|Swahili|Tsonga|Yoruba|Patois|Patwa)\b/gi, ''],
    [/\b(?:in|with)\s+(?:Korean|English|Japanese|Spanish|Portuguese|Mandarin|Chinese|French|German|Italian|Tagalog|Pidgin(?:[- ]English)?|Lingala|Swahili|Tsonga|Yoruba|Patois|Patwa)\b/gi, ''],
    [/\b(?:Korean|English|Japanese|Spanish|Portuguese|Mandarin|Chinese|French|German|Italian|Tagalog|Pidgin|Lingala|Swahili|Tsonga|Yoruba|Patois|Patwa)\s+lyrics\b/gi, ''],
    [/\bsinging\s+in\s+(?:Korean|English|Japanese|Spanish|Portuguese|Mandarin|Chinese|French|German|Italian)\b/gi, ''],
    [/\b(?:bilingual|natural\s+codeswitching|Spanglish|codeswitching|Korean\s+pronunciation)\b/gi, ''],
  ];
  function stripLanguagePhrases(s) {
    if (!s) return '';
    let out = String(s);
    for (const [pat, rep] of LANG_PHRASE_RULES) out = out.replace(pat, rep);
    return out;
  }
  function stripArtistNames(s) {
    if (!s) return '';
    let out = String(s);
    for (const [pat, rep] of ARTIST_NAME_RULES) out = out.replace(pat, rep);
    return out;
  }

  // Sanitize a full comma-separated Style string in one shot —
  // strip language directives + artist names + Korean characters,
  // then pass through dedupRedundantStyleTags to collapse the
  // "era / genre / scene" double-stating that AI generation tends
  // to add at the tail.
  function sanitizeStyleString(s) {
    const cleaned = stripArtistNames(stripLanguagePhrases(String(s || '')));
    const tags = cleaned
      .split(',')
      .map(part => sanitizeStyleTag(part.trim()))
      .filter(Boolean);
    return dedupRedundantStyleTags(tags).join(', ');
  }

  // ─── Style-tag redundancy dedup ───────────────────────────────────────
  // AI-generated Style strings often restate era/genre/scene at the head
  // AND the tail (e.g. "2022 4th gen K-pop, …, early-2020s K-pop
  // production"). Suno's tokenizer treats those as duplicate weighted
  // signals; the second one wastes ~30-60 chars of the ~200-char budget
  // and skews the result. This pass:
  //   1. Drops "filler era" phrases that almost always restate the lead
  //      tag (e.g. "early-2020s X production", "global X dominance era",
  //      "X-era sound").
  //   2. Keeps only the FIRST era token; later era tokens are dropped.
  //   3. Keeps only the FIRST K-pop / J-pop / etc. genre lineage marker;
  //      later synonyms (Korean idol pop, K-pop scene, K-pop production)
  //      are dropped.
  const FILLER_TAIL_PATTERNS = [
    /^(?:early-?|mid-?|late-?)?\d{4}s\s+[A-Za-z][\w\s-]*\s+(?:production|sound|era|scene|wave|dominance|movement)$/i,
    /^(?:global|worldwide|international|domestic|underground|mainstream)\s+[A-Za-z][\w\s-]*\s+(?:dominance|era|scene|movement|wave)$/i,
    /^[A-Za-z][\w\s-]*\s+(?:dominance era|production era|scene era|hit era|golden era)$/i,
    /^(?:peak|height|rise|emergence|breakthrough)\s+of\s+/i,
  ];
  const ERA_TOKEN_RE = /\b(?:(?:early|mid|late)[-\s]?)?(?:19|20)\d{0,2}0s|\b\d{4}\b|\b\d{4}-\d{4}\b/i;
  const GENRE_LINEAGE_RE = /\b(K-?pop|J-?pop|C-?pop|Mando[- ]?pop|Canto[- ]?pop|Latin[- ]?pop|Afro[- ]?pop|Korean idol|Korean girl group|Korean boy group)\b/i;
  function dedupRedundantStyleTags(tags) {
    let seenEra = false;
    let seenGenreLineage = null;
    const out = [];
    for (const tag of tags) {
      if (!tag) continue;
      // Filler tail phrases — drop wholesale
      if (FILLER_TAIL_PATTERNS.some(p => p.test(tag))) continue;
      // Era dedup — keep first era-token-bearing tag, drop later ones
      // (unless this tag's era token is more specific than the first one)
      if (ERA_TOKEN_RE.test(tag)) {
        if (seenEra) continue;
        seenEra = true;
      }
      // Genre lineage dedup — K-pop family etc. Keep first lineage tag,
      // drop later tags that introduce the SAME lineage family. Tags
      // without the lineage family pass through (so "garage-influenced
      // beat" or "EDM drops" coexist with "K-pop").
      const m = tag.match(GENRE_LINEAGE_RE);
      if (m) {
        const family = m[0].toLowerCase().replace(/[-\s]/g, '');
        if (seenGenreLineage && seenGenreLineage === family) continue;
        if (!seenGenreLineage) seenGenreLineage = family;
      }
      out.push(tag);
    }
    return out;
  }

  // -------- Derived indices --------
  const byChapter = new Map();
  DATA.entries.forEach(e => {
    if (!byChapter.has(e.chapter)) byChapter.set(e.chapter, []);
    byChapter.get(e.chapter).push(e);
  });

  // Tag → reflect lookup, used to colour-code and sort chips loaded
  // into the builder. Each catalog entry's `.tag` may carry variants
  // separated by " / " — we register every variant so chip matching
  // can land on either form.
  //
  // Sort order: green (most reliable) → yellow → unknown → red.
  // Red sinks to the back so the 200-char Suno limit truncates the
  // tags least likely to apply, while green anchor tags stay up front.
  const REFLECT_RANK = { green: 0, yellow: 1, unknown: 2, red: 3 };
  const TAG_REFLECT = new Map();
  function normalizeTagKey(s) {
    return String(s || '').toLowerCase().trim()
      .replace(/^\[(.+)\]$/, '$1')   // strip surrounding [...] section brackets
      .replace(/\s+/g, ' ');
  }
  DATA.entries.forEach(e => {
    const cls = reflectClass(e.reflect);
    if (!cls) return;
    String(e.tag || '').split('/').forEach(part => {
      const k = normalizeTagKey(part);
      if (!k) return;
      // Keep the strongest signal if a tag appears across multiple
      // catalog rows (green beats yellow beats red beats blank).
      const prev = TAG_REFLECT.get(k);
      if (!prev || REFLECT_RANK[cls] < REFLECT_RANK[prev]) TAG_REFLECT.set(k, cls);
    });
  });

  // Look up the reflect class for a chip tag, with a substring fallback
  // for AI-generated novel combos ("layered vocal harmonies" → matches
  // "vocal harmonies" in the catalog). Returns 'green' / 'yellow' /
  // 'red' / 'unknown'.
  function tagReflect(chipText) {
    if (!chipText) return 'unknown';
    const k = normalizeTagKey(chipText);
    if (TAG_REFLECT.has(k)) return TAG_REFLECT.get(k);
    // substring fallback: look for the longest catalog key contained in
    // the chip text. Skip very short keys (≤3 chars) to avoid noise.
    let best = null, bestLen = 0;
    for (const [key, cls] of TAG_REFLECT) {
      if (key.length <= 3) continue;
      if (k.includes(key) && key.length > bestLen) { best = cls; bestLen = key.length; }
    }
    return best || 'unknown';
  }

  // -------- Unified preset universe (templates + artists) --------
  // Each preset: { type, key, title, subtitle, region, eras, era, genre, style,
  //                structure, bpm, chapter, raw }
  function classifyArtistRegion(a) {
    return RE_KOREAN.test(a.genre) ? 'korean' : 'world';
  }
  // sanitize a variant's style/tags so display and chip-load match
  function sanitizeVariant(v) {
    if (!v) return v;
    return { ...v, style: sanitizeStyleString(v.style || ''), tags: sanitizeStyleString(v.tags || '') };
  }
  const PRESETS = [
    ...DATA.templates.map((t, i) => ({
      type: 'template',
      key:  't-' + i,
      title: t.title,
      subtitle: t.section_short || t.section,
      region: t.region.startsWith('world') ? 'world' : t.region,
      eras: t.eras && t.eras.length ? t.eras : ['(미지정)'],
      era:  t.primary_era || '(미지정)',
      genre: t.section_short || '',
      style: sanitizeStyleString(t.style || ''),
      structure: t.structure || '',
      bpm: t.bpm,
      bpm_hint: t.bpm_hint || '',
      chapter: t.chapter,
      reflect: t.reflect,
    })),
    ...DATA.artists.map((a, i) => {
      const v = (window.SUNO_ARTIST_VARIANTS || {})[a.artist] || null;
      const sigStyle = sanitizeStyleString(a.style || '');
      const sigTags = sanitizeStyleString(a.tags || '');
      const signature = {
        label: '대표곡', song: a.song, style: sigStyle,
        structure: a.structure, tags: sigTags,
      };
      // v.alt1 / v.alt2 are real songs from the artist's catalog; the legacy
      // v.ballad / v.anthem aliases are still emitted for compatibility.
      const alt1 = sanitizeVariant(v && (v.alt1 || v.ballad));
      const alt2 = sanitizeVariant(v && (v.alt2 || v.anthem));
      const variants = (alt1 && alt2)
        ? [signature,
           { label: tx('preset.signature.2', '대표곡 2'), ...alt1 },
           { label: tx('preset.signature.3', '대표곡 3'), ...alt2 }]
        : [signature];
      return {
        type: 'artist',
        key:  'a-' + i,
        title: a.artist,
        subtitle: a.song,
        region: classifyArtistRegion(a),
        eras: [a.era],
        era:  a.era,
        genre: a.genre,
        style: sigStyle,
        structure: a.structure,
        bpm: (function() { const m = /(\d{2,3})\s*BPM/i.exec(a.style); return m ? +m[1] : null; })(),
        peak: a.peak,
        tags: sigTags,
        artist_no: a.no,
        variants,
      };
    }),
  ];

  // Sorted era list including 'modern', '(미지정)', and decades 1920s..2020s
  const ERA_ORDER = ['modern', '2020s', '2010s', '2000s', '1990s', '1980s', '1970s', '1960s', '1950s', '1940s', '1930s', '1920s', 'global', '(미지정)'];
  function eraRank(e) {
    const i = ERA_ORDER.indexOf(e);
    return i === -1 ? 999 : i;
  }
  const allEras   = Array.from(new Set(PRESETS.flatMap(p => p.eras))).sort((a, b) => eraRank(a) - eraRank(b));
  const allGenres = sortByCategory(uniqueSorted(PRESETS.map(p => p.genre)), g => g);

  function presetMatchesCategory(p, cat) {
    if (cat === 'all') return true;
    if (cat === 'korean') return p.region === 'korean';
    if (cat === 'pop')    return RE_POP.test(p.genre) || RE_POP.test(p.title);
    return true;
  }

  // sections grouped by sheet -> [{section, entries}]
  const sectionsBySheet = {};
  DATA.sections.forEach(s => {
    (sectionsBySheet[s.sheet] = sectionsBySheet[s.sheet] || []).push(s.section);
  });

  // -------- Tabs --------
  function setTab(tab) {
    state.tab = tab;
    $$('.view').forEach(v => v.classList.add('hidden'));
    $('#view-' + tab).classList.remove('hidden');
    $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'artists' && !$('#artist-grid').dataset.ready) renderArtists();
    if (tab === 'guide' && !$('#guide-list').dataset.ready) renderGuideList();
    if (tab === 'album' && !$('#album-mood-chips').dataset.ready) initAlbum();
    if (tab === 'dance' && !$('#dance-list').dataset.ready) initDanceMachine();
    if (tab === 'search' && !$('#search-input').dataset.ready) initSearchTab();
    if (tab === 'presets') renderPresets();
  }
  // Sidebar tab click — pure navigation. Each tab preserves its own
  // in-progress state across switches (builder chips / title / lyrics /
  // AI prompt, search results, dance picks, album planner result with
  // its 12-track lyric generation in flight). Use each tab's explicit
  // 초기화 / Reset button to wipe its own content; tab clicks no longer
  // do an implicit reset because the surprise data loss during a
  // long-running album batch was worse than the cleanliness it bought.
  $$('.tab-btn').forEach(b => b.addEventListener('click', () => {
    if (!b.dataset.tab) return;
    setTab(b.dataset.tab);
  }));

  // ====================================================================
  // BUILDER
  // ====================================================================
  function initBuilder() {
    // 시작점 (in-builder picker) — visible only when chip stack is
    // empty AND no preset is loaded. Hides automatically as soon as
    // chips arrive from external tabs (프리셋 / 태그 / 댄싱머신 /
    // 검색) or are added manually. Picker selects share the
    // legacy populate/listener wiring; the visibility toggle lives
    // in updateStartingPointVisibility() and is driven by
    // renderChips after every chip mutation.
    const eraSel = $('#filter-era');
    if (eraSel) {
      populateEraSelect();
      populateGenreSelect('');
      populateArtistSelect('', '');
      eraSel.addEventListener('change', () => {
        populateGenreSelect(eraSel.value);
        populateArtistSelect(eraSel.value, '');
        renderPalette();
      });
      $('#filter-genre').addEventListener('change', () => {
        populateArtistSelect(eraSel.value, $('#filter-genre').value);
      });
      $('#filter-artist').addEventListener('change', () => {
        state.selectedArtist = findPreset($('#filter-artist').value);
        renderCurrentMeta();
        updateStartingPointVisibility();
      });
    }
    renderStructurePalette();
    renderPalette();
    renderCurrentMeta();
    updateStartingPointVisibility();
    initCategoryChips();

    $('#btn-load-artist').addEventListener('click', loadSelectedArtist);
    $('#btn-clear').addEventListener('click', () => {
      if (!confirm(tx('confirm.builder.reset', '빌더의 모든 작업을 초기화할까요?\n— 노래 제목, 가사, Style 칩, 슬라이더, 옵션, AI 프롬프트가 모두 기본값으로 되돌아갑니다.'))) return;
      resetBuilder();
      toast(tx('toast.builder.reset', '🗑️ 빌더 초기화 완료'));
    });
    $('#btn-skeleton').addEventListener('click', insertKoreanSkeleton);
    $('#btn-save-preset').addEventListener('click', savePresetFromBuilder);

    // style add
    const addBtn = $('#style-add-btn'), addInp = $('#style-add-input');
    addBtn.addEventListener('click', () => addCustomTag(addInp.value));
    addInp.addEventListener('keydown', e => { if (e.key === 'Enter') { addCustomTag(addInp.value); addInp.value = ''; } });

    // copy buttons
    $$('button[data-copy]').forEach(b => b.addEventListener('click', () => copyText($('#' + b.dataset.copy).value || '')));

    // option toggles re-render style
    $('#opt-bpm-hint').addEventListener('change', renderStyleOut);
    $('#opt-pitch-restraint')?.addEventListener('change', renderStyleOut);

    // Reveal "보컬 편곡 스타일" dropdown when C&R or Harmonies is on
    function updateArrangementRow() {
      const on = $('#opt-call-response').checked || $('#opt-harmonies').checked;
      $('#arrangement-style-row').classList.toggle('hidden', !on);
    }
    $('#opt-call-response').addEventListener('change', updateArrangementRow);
    $('#opt-harmonies').addEventListener('change', updateArrangementRow);
    updateArrangementRow();

    // language slider
    const slider = $('#lang-slider');
    slider.addEventListener('input', () => {
      state.englishPct = parseInt(slider.value, 10) || 0;
      applyLangUI();
    });
    applyLangUI();

    // metaphor / 시적 비유 slider
    const mSlider = $('#metaphor-slider');
    mSlider.addEventListener('input', () => {
      state.metaphorPct = parseInt(mSlider.value, 10) || 0;
      applyMetaphorUI();
    });
    applyMetaphorUI();

    // rap vs vocal balance slider
    const rSlider = $('#rap-slider');
    rSlider.addEventListener('input', () => {
      state.rapPct = parseInt(rSlider.value, 10) || 0;
      applyRapUI();
    });
    applyRapUI();

    // lyrics live stats
    $('#lyrics-out').addEventListener('input', updateStats);

    // palette tabs
    $$('.palette-tab').forEach(b => b.addEventListener('click', () => {
      state.palette = b.dataset.pal;
      $$('.palette-tab').forEach(x => x.classList.toggle('active', x === b));
      $('#palette-search').classList.toggle('hidden', state.palette !== 'search');
      renderPalette();
    }));
    $('#palette-search').addEventListener('input', debounce(e => { state.paletteQuery = e.target.value; renderPalette(); }, 150));
  }

  function presetsForBuilder() {
    return PRESETS.filter(p => presetMatchesCategory(p, state.cat.builder));
  }
  function populateEraSelect() {
    // No-op since the builder's preset chain was removed; kept callable
    // for future re-introduction or for any caller that still expects it.
    const sel = $('#filter-era');
    if (!sel) return;
    const pool = presetsForBuilder();
    const eras = Array.from(new Set(pool.flatMap(p => p.eras))).sort((a, b) => eraRank(a) - eraRank(b));
    sel.innerHTML = `<option value="">— ${tx('dd.era', '시대 선택')} —</option>` +
      eras.map(e => `<option value="${escapeHtml(e)}">${escapeHtml(tdx(eraLabel(e)))}</option>`).join('');
  }
  function eraLabel(e) {
    if (e === 'modern') return '현대 (Modern Korean Pop)';
    if (e === 'global') return '글로벌 (시대 무관)';
    if (e === '(미지정)') return '(시대 미지정)';
    return e;
  }
  function populateGenreSelect(era) {
    const sel = $('#filter-genre');
    if (!sel) return;
    let pool = presetsForBuilder();
    if (era) pool = pool.filter(p => p.eras.includes(era));
    const genres = sortByCategory(uniqueSorted(pool.map(p => p.genre)), g => g);
    sel.innerHTML = `<option value="">— ${tx('dd.group', '스타일 그룹 (선택)')} —</option>` +
      genres.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(tdx(g))}</option>`).join('');
  }
  function populateArtistSelect(era, genre) {
    const sel = $('#filter-artist');
    if (!sel) return;
    let pool = presetsForBuilder();
    if (era)   pool = pool.filter(p => p.eras.includes(era));
    if (genre) pool = pool.filter(p => p.genre === genre);
    // sort: templates first within category, then artists; both alpha
    pool = pool.slice().sort((a, b) => {
      if (a.type !== b.type) return a.type === 'template' ? -1 : 1;
      const ra = categoryRank(a.genre), rb = categoryRank(b.genre);
      if (ra !== rb) return ra - rb;
      return a.title.localeCompare(b.title, 'ko');
    });
    sel.innerHTML = `<option value="">— ${tx('dd.preset', '프리셋 (선택)')} —</option>` +
      pool.map(p => {
        const icon = p.type === 'template' ? '📜' : '🎤';
        const sub  = p.bpm ? ` · ${p.bpm} BPM` : '';
        return `<option value="${escapeHtml(p.key)}">${icon} ${escapeHtml(tdx(p.title))}${sub}</option>`;
      }).join('');
  }
  function findPreset(key) { return PRESETS.find(p => p.key === key) || null; }

  // Category chip wiring (per-scope: builder / artists / tags)
  function initCategoryChips() {
    $$('.cat-row').forEach(row => {
      const scope = row.dataset.catScope;
      row.querySelectorAll('.cat-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          state.cat[scope] = btn.dataset.cat;
          row.querySelectorAll('.cat-chip').forEach(b => b.classList.toggle('active', b === btn));
          onCategoryChange(scope);
        });
      });
    });
  }
  function onCategoryChange(scope) {
    if (scope === 'builder') {
      // reset selects to honor new filter
      populateEraSelect();
      populateGenreSelect('');
      populateArtistSelect('', '');
      state.selectedArtist = null;
      state.activeVariantView = null;
      renderCurrentMeta();
      // auto-set lyric language defaults when 한국 가요 is chosen
      if (state.cat.builder === 'korean') {
        state.englishPct = 0;
        applyLangUI();
      } else if (state.cat.builder === 'pop') {
        state.englishPct = 100;
        applyLangUI();
      }
    } else if (scope === 'artists') {
      const pool = PRESETS.filter(p => presetMatchesCategory(p, state.cat.artists));
      $('#art-era').innerHTML = `<option value="">${tx('dd.era.all', '시대 (전체)')}</option>` +
        Array.from(new Set(pool.flatMap(p => p.eras))).sort((a, b) => eraRank(a) - eraRank(b))
          .map(e => `<option value="${escapeHtml(e)}">${escapeHtml(eraLabel(e))}</option>`).join('');
      $('#art-genre').innerHTML = `<option value="">${tx('dd.group.all', '스타일 그룹 (전체)')}</option>` +
        sortByCategory(uniqueSorted(pool.map(p => p.genre)), g => g)
          .map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('');
      drawArtists();
    }
  }

  function loadSelectedArtist(variantIndex = 0) {
    // When no in-builder preset is selected, the button reads as a
    // "merge current 제어 settings into existing chips" action — useful
    // after chips were loaded from 검색 / 댄싱머신 / 태그 tabs and the
    // user then tweaks the Mix Console options.
    if (!state.selectedArtist) {
      if (!state.chips.length) {
        toastError(tx('toast.pick.first', '프리셋을 먼저 선택하거나 좌측 탭에서 스타일을 가져오세요'));
        return;
      }
      const applied = applyControlPanelToChips();
      renderChips(); renderStyleOut(); updateStats();
      if (applied > 0) toast(`✓ ${tx('toast.controls.merged', '제어 옵션 머지됨 — 보컬편곡 키워드')} ${applied}${tx('toast.added.suffix', '개 추가')}`);
      else toast(tx('toast.no.controls', '제어 옵션이 모두 꺼져 있어 추가할 키워드가 없습니다'));
      return;
    }
    const p = state.selectedArtist;
    // Pick a variant (artist presets carry up to 3: signature / ballad / anthem)
    let style = p.style, structure = p.structure, tags = p.tags, subtitle = p.subtitle;
    if (p.type === 'artist' && Array.isArray(p.variants) && p.variants[variantIndex]) {
      const v = p.variants[variantIndex];
      style = v.style; structure = v.structure; tags = v.tags;
      subtitle = v.song || p.subtitle;
      state.selectedVariantIndex = variantIndex;
    } else {
      state.selectedVariantIndex = 0;
    }
    state.chips = dedupeTags((style || '').split(',').map(stripStyleBrackets))
      .map(t => ({ tag: t, source: p.type }));
    if (structure) {
      $('#lyrics-out').value = artistStructureToLyrics(structure);
    } else if (p.region === 'korean') {
      insertKoreanSkeleton();
    }
    // Excel 원본 Style을 보존: AI가 다시 덮어쓰지 않도록 "Style 채우기"는 OFF
    const fill = $('#ai-fill-style');
    if (fill) { fill.checked = false; }
    setStyleFillLock(true);
    // Merge 제어 panel settings into chips at load time so the user only
    // needs to press one button after configuring both panels.
    const vocalArrApplied = applyControlPanelToChips();
    // Stash overridden subtitle/style/structure/tags for renderCurrentMeta to display
    state.activeVariantView = { style, structure, tags, subtitle };
    setAIStatus(tx('aistat.preset.locked', '📜 프리셋 로드됨 — Excel Style 그대로. AI는 Title/Lyrics만 생성합니다 (다시 쓰려면 "Style 채우기" 체크).'));
    renderChips(); renderStyleOut(); renderCurrentMeta(); updateStats();
    const variantLabel = (p.variants && p.variants[variantIndex] && p.variants[variantIndex].label) || '';
    const arrNote = vocalArrApplied > 0 ? ` · 보컬편곡 키워드 ${vocalArrApplied}개 추가` : '';
    toast(`${tx('toast.loaded', '불러옴')}: ${p.type === 'template' ? '📜' : '🎤'} ${tdx(p.title)}${variantLabel ? ` (${tdx(variantLabel)})` : ''}${arrNote}`);
  }

  // Apply enabled control-panel options (콜앤리스폰스 · 화음·코러스 + chosen
  // vocal arrangement style) directly into the Style chips. Returns count
  // of newly-added keywords. Called from loadSelectedArtist so a single
  // 빌더에 로드 button handoff captures both 시작점 and 제어 selections.
  function applyControlPanelToChips() {
    const cr = $('#opt-call-response')?.checked;
    const harm = $('#opt-harmonies')?.checked;
    if (!cr && !harm) return 0;
    const preset = $('#opt-arrangement-style')?.value || 'auto';
    return injectVocalVocabIntoChips(preset);
  }

  function artistStructureToLyrics(structure) {
    if (!structure) return '';
    // structure like "[Intro: solo trumpet] → [Theme] → [Solo trumpet] → ..."
    const parts = structure.split(/→|->|>/).map(s => s.trim()).filter(Boolean);
    // Build blocks with a blank line between each section header for visibility
    return parts.map(p => {
      const tag = p.startsWith('[') ? p : `[${p}]`;
      return `${tag}\n…`;
    }).join('\n\n');
  }

  function renderStructurePalette() {
    const ch01 = byChapter.get('Ch.01') || [];
    const wrap = $('#structure-palette');
    wrap.innerHTML = ch01.map(e => {
      const cls = reflectClass(e.reflect);
      const danger = cls === 'red' ? 'warn' : 'lyrics';
      return `<button class="chip ${danger}" data-action="add-structure" data-tag="${escapeHtml(e.tag)}" title="${escapeHtml(e.ko)} · ${reflectIcon(e.reflect)}">${escapeHtml(e.tag)}</button>`;
    }).join('');
    wrap.addEventListener('click', evt => {
      const btn = evt.target.closest('[data-action="add-structure"]');
      if (!btn) return;
      const tag = btn.dataset.tag.split('/')[0].trim(); // take first variant
      insertAtCursor($('#lyrics-out'), `\n\n${tag}\n…\n`);
      updateStats();
    }, { once: false });
  }

  function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end);
    const pos = start + text.length;
    textarea.focus();
    textarea.setSelectionRange(pos, pos);
  }

  function insertKoreanSkeleton() {
    const en = window.SU_LANG && window.SU_LANG() === 'en';
    const skeleton = en ? [
      '[Intro]',
      '...',
      '',
      '[Verse 1]',
      'Keep lines short — break into short phrases.',
      'One line within ~10 syllables.',
      'Use commas and periods to control phrasing.',
      '',
      '[Pre-Chorus]',
      'Tension rising,',
      'build-up right before the hook.',
      '',
      '[Chorus]',
      'The catchiest hook — repeat.',
      'Easy to sing along.',
      '',
      '[Verse 2]',
      'Second verse — a different angle.',
      '',
      '[Bridge]',
      'Shift the mood, change the tone.',
      '',
      '[Chorus]',
      'Hook repeats — hit it hardest.',
      '',
      '[Outro]',
      'Lingering, short ending.',
    ].join('\n') : [
      '[Intro]',
      '...',
      '',
      '[Verse 1]',
      '짧은 문장으로 끊어서.',
      '한 줄은 10음절 이내.',
      '쉼표, 마침표로 호흡 조절.',
      '',
      '[Pre-Chorus]',
      '점점 올라가는 텐션,',
      '훅 직전 빌드업.',
      '',
      '[Chorus]',
      '가장 캐치한 훅, 반복.',
      '쉽게 따라 부를 수 있도록.',
      '',
      '[Verse 2]',
      '두 번째 절, 다른 이야기.',
      '',
      '[Bridge]',
      '분위기 변주, 톤 전환.',
      '',
      '[Chorus]',
      '훅 반복 — 가장 강하게.',
      '',
      '[Outro]',
      '여운, 짧은 마무리.',
    ].join('\n');
    $('#lyrics-out').value = skeleton;
    updateStats();
  }

  // ----- chips & style output -----
  // Suno Style 필드는 콤마 구분 일반 텍스트이므로, 카탈로그·팔레트의 `[Tag]`
  // 표기에서 둘러싼 대괄호는 칩에 들어가기 전에 벗긴다. (Lyrics 필드 섹션
  // 태그는 insertAtCursor 경로에서 그대로 보존됨)
  function stripStyleBrackets(t) {
    return sanitizeStyleTag(String(t || '').trim().replace(/^\[([^\]]+)\]$/, '$1').trim());
  }

  function addChip(tag, source = 'manual') {
    // Preserve the original catalog text — Korean included — so the
    // chip in the builder reads exactly what the user clicked. The
    // Korean→English mapping + Hangul strip runs only at output time
    // (renderStyleOut) so Suno still receives a clean ASCII Style
    // string while the in-app chip stays human-readable.
    tag = String(tag || '').trim().replace(/^\[([^\]]+)\]$/, '$1').trim();
    if (!tag) return;
    // Block tags that would sanitise to empty (placeholder rows that
    // snuck through, or legacy saved presets pre-dating the filter).
    if (!sanitizeStyleTag(tag)) return;
    if (state.chips.some(c => c.tag.toLowerCase() === tag.toLowerCase())) {
      toast(tx('toast.dupe', '이미 추가됨')); return;
    }
    state.chips.push({ tag, source });
    renderChips(); renderStyleOut();
  }
  function addCustomTag(text) {
    if (!text) return;
    text.split(',').map(t => t.trim()).filter(Boolean).forEach(t => addChip(t, 'manual'));
  }
  function removeChip(i) {
    state.chips.splice(i, 1);
    renderChips(); renderStyleOut();
  }
  // Stable-sort chips by Suno reflect rank (🟢 0 → 🟡 1 → ⚪ 2 → 🔴 3).
  // Lyric-section tags (`[Verse]` / `[Chorus]` etc.) are kept where they
  // are — they're structural markers, not style tags, so reflect
  // matching doesn't apply. Style tags get reordered so the most
  // reliable signals sit at the head of the comma-list and the
  // unreliable ones drift to the tail (where the 200-char Suno limit
  // is most likely to truncate them).
  function sortChipsByReflect() {
    const isLyric = c => /^\[.+\]$/.test(c.tag);
    const lyricChips = state.chips.filter(isLyric);
    const styleChips = state.chips
      .filter(c => !isLyric(c))
      .map((c, i) => ({ c, i, rank: REFLECT_RANK[tagReflect(c.tag)] ?? 2 }))
      .sort((a, b) => a.rank - b.rank || a.i - b.i)  // stable within rank
      .map(x => x.c);
    state.chips = [...styleChips, ...lyricChips];
  }

  // Marker so we sort exactly once per chip mutation cycle (avoids
  // infinite re-entry from inside renderChips → renderStyleOut chains).
  let _chipsSortedThisCycle = false;

  function renderChips() {
    const el = $('#style-chips');
    if (state.chips.length === 0) {
      el.innerHTML = `<span class="text-xs text-slate-500 px-1 py-0.5">${tx('chips.empty', '아직 태그가 없습니다 — 팔레트/카탈로그/아티스트에서 추가하세요')}</span>`;
      updateStartingPointVisibility();
      _chipsSortedThisCycle = false;
      return;
    }
    if (!_chipsSortedThisCycle) {
      sortChipsByReflect();
      _chipsSortedThisCycle = true;
      // Reset on next event loop so subsequent independent mutations
      // re-sort. The flag exists only to absorb the
      // renderChips → renderStyleOut → renderChips bounce within a
      // single user action.
      queueMicrotask(() => { _chipsSortedThisCycle = false; });
    }
    el.innerHTML = state.chips.map((c, i) => {
      const lyrics = /^\[.+\]$/.test(c.tag);
      const src = String(c.source || 'manual');
      const r = lyrics ? '' : tagReflect(c.tag);
      const rL = r === 'green' ? tx('reflect.green', '🟢 잘 됨')
               : r === 'yellow' ? tx('reflect.yellow', '🟡 가끔만')
               : r === 'red' ? tx('reflect.red', '🔴 잘 안됨')
               : tx('reflect.unknown', '⚪ 데이터 없음');
      const tip = lyrics
        ? `${tx('chip.src', '출처')}: ${src}`
        : `${tx('chip.src', '출처')}: ${src} · ${tx('chip.reflect', 'Suno 적용도')}: ${rL}`;
      return `<span class="chip ${lyrics ? 'lyrics' : ''}" data-src="${escapeHtml(src)}" data-reflect="${escapeHtml(r)}" title="${escapeHtml(tip)}">${escapeHtml(c.tag)}<button data-rm="${i}" aria-label="${tx('aria.remove', '삭제')}">×</button></span>`;
    }).join('');
    $$('#style-chips button[data-rm]').forEach(b => b.addEventListener('click', () => removeChip(parseInt(b.dataset.rm, 10))));
    updateStartingPointVisibility();
  }

  // Hide the in-builder 시작점 picker once chips are populated (from
  // any source — external tabs OR manual add). Show again when the
  // builder is fresh / reset. Selecting a preset directly in the
  // picker also hides it because state.selectedArtist becomes truthy.
  function updateStartingPointVisibility() {
    const panel = document.getElementById('starting-point-panel');
    if (!panel) return;
    const hasChips    = (state.chips || []).length > 0;
    const hasArtist   = !!state.selectedArtist;
    panel.classList.toggle('hidden', hasChips || hasArtist);
  }
  // 고음 억제 — high-note-inducing Style tags swapped for restraint
  // descriptors. cinematic / epic / emotional tend to push Suno toward
  // belted, soaring high notes; restrained / intimate / controlled /
  // low-register pull the vocal back into a calm low-mid register.
  // Strip the trigger words wherever they appear — not just exact-match
  // chips. "cinematic strings" → "strings", "emotional ballad" →
  // "ballad", and a bare "epic" → dropped. Even one of these words
  // anywhere is enough to push Suno into belted high notes.
  const PITCH_HIGH_RX = /\b(?:cinematic|epic|emotional)\b/gi;
  const PITCH_LOW_TAGS = ['restrained', 'intimate', 'controlled', 'low-register'];
  function applyPitchRestraint(tags) {
    const out = [];
    for (const raw of tags) {
      const cleaned = String(raw)
        .replace(PITCH_HIGH_RX, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/^[\s,\-]+|[\s,\-]+$/g, '')
        .trim();
      if (cleaned) out.push(cleaned);   // drop tags that became empty
    }
    const have = new Set(out.map(t => t.trim().toLowerCase()));
    for (const lt of PITCH_LOW_TAGS) if (!have.has(lt)) out.push(lt);
    return out;
  }
  function renderStyleOut() {
    // Sanitise each chip's text right before joining: chips themselves
    // carry the original (possibly Korean) catalog text for display,
    // but Suno's Style field only understands the English-cleaned form.
    let base = dedupeTags(state.chips.map(c => sanitizeStyleTag(c.tag)).filter(Boolean));
    // 고음 억제 toggle reshapes only the OUTPUT string (chips untouched),
    // so flipping it on/off is non-destructive and reversible.
    if (document.getElementById('opt-pitch-restraint')?.checked) {
      base = applyPitchRestraint(base);
    }
    const merged = dedupeTags(base);
    $('#style-out').value = merged.join(', ');
    const stats = $('#style-stats');
    const bpm = $('#opt-bpm-hint').checked ? detectBPM($('#style-out').value) : null;
    stats.textContent = `${merged.length}${tx('stat.tags', '개 태그')} · ${$('#style-out').value.length}${tx('stat.chars', '자')}` + (bpm ? ` · ${bpm} BPM` : '');
  }

  // Full reset of the Builder tab back to defaults.
  function resetBuilder() {
    // chips & selected preset
    state.chips = [];
    state.selectedArtist = null;
    state.activeVariantView = null;
    state.cat.builder = 'all';
    $$('.cat-row[data-cat-scope="builder"] .cat-chip').forEach(b =>
      b.classList.toggle('active', b.dataset.cat === 'all'));
    populateEraSelect();
    populateGenreSelect('');
    populateArtistSelect('', '');

    // text fields
    $('#song-title').value = '';
    $('#lyrics-out').value = '';
    $('#ai-prompt').value = '';
    $('#style-add-input').value = '';

    // sliders
    state.englishPct = 0;
    state.metaphorPct = 50;
    state.rapPct = 0;
    applyLangUI(); applyMetaphorUI(); applyRapUI();

    // checkboxes
    const setCb = (id, v) => { const el = $(id); if (el) { el.checked = v; delete el.dataset.userSet; } };
    setCb('#opt-bpm-hint', true);
    setCb('#opt-section-cues', true);
    setCb('#opt-call-response', false);
    setCb('#opt-harmonies', false);
    setCb('#opt-pitch-restraint', false);
    setCb('#ai-fill-title', true);
    setCb('#ai-fill-style', true);
    setCb('#ai-fill-lyrics', true);
    setCb('#ai-use-context', true);
    setStyleFillLock(false);

    // arrangement style + visibility
    $('#opt-arrangement-style').value = 'auto';
    $('#arrangement-style-row').classList.add('hidden');

    // palette + AI status
    state.palette = 'recommended';
    state.paletteQuery = '';
    $$('.palette-tab').forEach(b => b.classList.toggle('active', b.dataset.pal === 'recommended'));
    $('#palette-search').classList.add('hidden');
    $('#palette-search').value = '';
    $('#ai-status').textContent = '';
    $('#ai-status').style.color = '';

    // re-render everything
    renderChips(); renderStyleOut(); renderCurrentMeta(); renderPalette();
    updateStats();
  }

  // Style-fill lock badge — visualises why the "Style 채우기" checkbox is off
  // after an Excel preset has been loaded. Clicking the Style checkbox (or its
  // label) clears the badge — the user has explicitly opted in to AI rewriting.
  function setStyleFillLock(locked) {
    const badge = document.getElementById('ai-style-lock-badge');
    const label = document.getElementById('ai-fill-style-label');
    if (badge) badge.classList.toggle('hidden', !locked);
    if (label) label.classList.toggle('locked', !!locked);
  }
  // Wire once at boot
  document.addEventListener('change', e => {
    if (e.target && e.target.id === 'ai-fill-style') setStyleFillLock(false);
  });
  // Clicking the badge itself = "I want AI to rewrite Style" — re-enable + clear
  document.addEventListener('click', e => {
    if (e.target && e.target.id === 'ai-style-lock-badge') {
      const cb = document.getElementById('ai-fill-style');
      if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
      setStyleFillLock(false);
    }
  });

  // Pull the cueVocab list for the given vocal-arrangement preset and filter
  // to phrases that fit cleanly in the Style field (drop full-sentence cues).
  function vocalArrVocab(presetKey) {
    const spec = window.SunoAI?.ARRANGEMENT_STYLES?.[presetKey || 'auto'];
    if (!spec) return [];
    return (spec.cueVocab || []).filter(v => v.length <= 50);
  }
  // Append up to N Suno-tested vocal-arrangement keywords into state.chips.
  // Skips any keyword already present (case-insensitive). Returns count added.
  function injectVocalVocabIntoChips(presetKey, max = 4) {
    const vocab = vocalArrVocab(presetKey).slice(0, max);
    let added = 0;
    for (const v of vocab) {
      const clean = stripStyleBrackets(v);
      if (!clean) continue;
      if (state.chips.some(c => c.tag.toLowerCase() === clean.toLowerCase())) continue;
      state.chips.push({ tag: clean, source: 'vocal-arr' });
      added++;
    }
    if (added) { renderChips(); renderStyleOut(); }
    return added;
  }

  // Helpers: case-insensitive dedupe / contains
  function dedupeTags(tags) {
    const seen = new Set();
    const out = [];
    for (const raw of tags) {
      const t = String(raw || '').trim();
      const key = t.toLowerCase().replace(/\s+/g, ' ');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
    return out;
  }
  function containsCI(tags, x) {
    const xl = x.toLowerCase().replace(/\s+/g, ' ');
    return tags.some(t => t.toLowerCase().replace(/\s+/g, ' ') === xl);
  }

  function updateStats() {
    const v = $('#lyrics-out').value;
    const lines = v.split('\n').filter(l => l.trim()).length;
    const sections = (v.match(/\[[^\]]+\]/g) || []).length;
    $('#lyrics-stats').textContent = `${sections}${tx('stat.sections', '개 섹션')} · ${lines}${tx('stat.lines', '줄')} · ${v.length}${tx('stat.chars', '자')}`;
    renderStyleOut();
  }

  function renderCurrentMeta() {
    const meta = $('#current-meta');
    if (!state.selectedArtist) {
      meta.innerHTML = `<p class="text-slate-500">${tx('cs.empty', '위 <b class="text-accent-400">시작점</b> 패널이나 좌측 사이드바의 <b class="text-accent-400">프리셋</b> / <b class="text-accent-400">태그</b> / <b class="text-accent-400">댄싱머신</b> / <b class="text-accent-400">검색</b> 탭에서 스타일을 골라 <b>빌더에 로드 / 빌더로 전송</b> 버튼을 누르면 여기에 표시됩니다.')}</p>`;
      return;
    }
    const p = state.selectedArtist;
    const eraTxt = p.eras.map(eraLabel).join(' / ');
    const typeBadge = p.type === 'template'
      ? `<span class="text-accent-400">${tx('cs.tpl', '📜 템플릿')}</span> · ${escapeHtml(p.chapter || '')}`
      : `<span class="text-mint-400">${tx('cs.artist', '🎤 아티스트')}</span> · #${p.artist_no || ''}`;
    const hasVariants = p.type === 'artist' && Array.isArray(p.variants) && p.variants.length > 1;
    const activeIdx = state.selectedVariantIndex || 0;
    const view = state.activeVariantView || {
      style: p.style, structure: p.structure, tags: p.tags, subtitle: p.subtitle,
    };
    let body = `
      <div>${typeBadge}</div>
      <div class="mt-2"><span class="text-slate-400 text-xs">${tx('cs.era.group', '시대 · 스타일 그룹')}</span><br>
        <span class="text-accent-400">${escapeHtml(tdx(eraTxt))}</span> · ${escapeHtml(tdx(p.genre || p.subtitle || ''))}</div>
      <div class="mt-2"><span class="text-slate-400 text-xs">${tx('cs.title', '제목')}</span><br>${escapeHtml(tdx(p.title))}</div>`;
    if (hasVariants) {
      body += `<div class="variant-switcher mt-3">
        <span class="text-slate-400 text-xs">${tx('cs.variants', '스타일 변형 (3가지 대표곡 스타일)')}</span>
        <div class="variant-tabs mt-1">
          ${p.variants.map((v, i) => `
            <button class="variant-tab ${i === activeIdx ? 'active' : ''}" data-variant="${i}" title="${escapeHtml(v.song || '')}">
              ${escapeHtml(tdx(v.label))}
            </button>`).join('')}
        </div>
      </div>`;
    }
    if (p.type === 'artist') {
      const songLabel = view.subtitle || p.subtitle;
      body += `<div class="mt-2"><span class="text-slate-400 text-xs">${tx('cs.peak.song', '전성기 · 대표곡')}</span><br>${escapeHtml(p.peak || '')} · 〈${escapeHtml(songLabel)}〉</div>`;
    }
    if (p.bpm_hint) {
      body += `<div class="mt-2"><span class="text-slate-400 text-xs">${tx('lbl.bpmhint', 'BPM 힌트')}</span><br><span class="text-mint-400">${escapeHtml(tdx(p.bpm_hint))}</span></div>`;
    }
    if (view.tags) {
      body += `<div class="mt-2"><span class="text-slate-400 text-xs">${tx('cs.coretags', '핵심 태그')}</span><br><span class="text-mint-400">${escapeHtml(view.tags)}</span></div>`;
    }
    if (view.structure) {
      body += `<div class="mt-2"><span class="text-slate-400 text-xs">${tx('cs.structure', '곡 구조')}</span><br><span class="font-mono text-xs">${escapeHtml(view.structure)}</span></div>`;
    }
    if (p.type === 'artist') {
      body += `<div class="disclaimer-inline">${tx('cs.disclaimer', 'ⓘ 아티스트명은 스타일을 빠르게 찾기 위한 참고용 라벨이며, Suno에 전달되는 프롬프트엔 이름이 포함되지 않습니다.')}</div>`;
    }
    meta.innerHTML = body;
    if (hasVariants) {
      meta.querySelectorAll('.variant-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.variant, 10) || 0;
          loadSelectedArtist(idx);
        });
      });
    }
  }

  // ----- palette -----
  // Palette tab buckets — practical music-creation filters. Each
  // bucket's rx is matched against the row's category / tip / tag in
  // priority order; first match wins. Same usability filter as the
  // chip catalog (placeholder rows + heavy-Korean rows skipped).
  const PAL_BUCKETS = [
    { id: 'mood',       rx: /무드|mood|에너지|energy|emotional|어둠|밝|분위기|atmosphere|atmospheric|vibe|텍스처|texture|효과|effect|어두/i },
    { id: 'vocal',      rx: /성별|창법|보컬|vocal|gender|male|female|chorus|화음|harmony|gang|샤우트|shout|falsetto|팔세토|\brap\b|랩\b/i },
    { id: 'instrument', rx: /건반|키보드|기타|guitar|piano|drum|드럼|퍼커션|현악|brass|악기|synth|신스|orchestra|오케스트라|saxophone|색소폰|trumpet|트럼펫|violin|cello|첼로|bass|베이스|sax|electric/i },
    { id: 'tempo',      rx: /\bBPM\b|tempo|템포|속도|\bslow\b|\bfast\b|midtempo|미디엄/i },
    { id: 'genre',      rx: /Rock|Pop|Hip[- ]?Hop|R&B|Jazz|Blues|Country|Latin|Electronic|EDM|Trot|발라드|힙합|재즈|시티팝|컨트리|라틴|일렉|장르|디스코|disco|funk|펑크|록\b|메탈|metal|reggae|레게|gospel|가스펠|아프로|afrobeats|소울|soul|애니|anime|J-pop|K-pop|folk|폴크|클래식|classical|년대|\d+s\b|genre/i },
  ];
  function paletteBucketOf(e) {
    const hay = `${e.category} ${e.tip} ${e.tag}`;
    for (const b of PAL_BUCKETS) if (b.rx.test(hay)) return b.id;
    return 'genre'; // fallback so every real Style tag lands in some bucket
  }

  function renderPalette() {
    const list = $('#palette-list');
    // Same chip-usability filter as the catalog: drop placeholder
    // rows, dash/exclude fields, non-bracket Lyrics rows, and
    // majority-Korean guide concepts.
    const usable = DATA.entries.filter(e => {
      if (!e.tag) return false;
      if (e.tag === '핵심 Style 프롬프트' || e.tag === '복사용') return false;
      if (e.field === '-' || e.field === 'Exclude') return false;
      if (e.field === 'Lyrics') return false;       // section markers handled by structure-palette
      if (!['Style', 'Style/Lyrics'].includes(e.field)) return false;
      const kc = (e.tag.match(/[가-힣]/g) || []).length;
      if (kc > 0 && kc / e.tag.length > 0.4) return false;
      return true;
    });

    let items = [];
    if (state.palette === 'search') {
      const q = state.paletteQuery.trim().toLowerCase();
      if (!q) { list.innerHTML = `<p class="text-xs text-slate-500 px-1">${tx('pal.search.empty', '검색어를 입력하세요')}</p>`; return; }
      items = usable.filter(e =>
        e.tag.toLowerCase().includes(q) ||
        e.ko.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      ).slice(0, 150);
    } else {
      // Bucket filter, prefer high-reflect tags first, dedupe by tag text
      items = usable.filter(e => paletteBucketOf(e) === state.palette);
      const rank = r => r && r.includes('🟢') ? 0 : r && r.includes('🟡') ? 1 : 2;
      const seen = new Set();
      items = items
        .sort((a, b) => rank(a.reflect) - rank(b.reflect))
        .filter(e => {
          const k = e.tag.toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .slice(0, 120);
    }
    list.innerHTML = items.map(e => {
      const lyrics = e.field === 'Lyrics';
      const r = reflectClass(e.reflect) || 'unknown';
      const rLabel = r === 'green' ? tx('reflect.green', '🟢 잘 됨')
                   : r === 'yellow' ? tx('reflect.yellow', '🟡 가끔만')
                   : r === 'red' ? tx('reflect.red', '🔴 잘 안됨')
                   : tx('reflect.unknown', '⚪ 데이터 없음');
      return `<div class="pal-item ${lyrics ? 'lyrics' : ''}" data-tag="${escapeHtml(e.tag)}" data-lyrics="${lyrics ? '1':'0'}" data-reflect="${r}" title="${tx('chip.reflect', 'Suno 적용도')}: ${rLabel}">
        <span class="reflect-dot" aria-hidden="true"></span>
        <span class="tag">${escapeHtml(e.tag)}</span>
        <span class="ko">${escapeHtml(e.ko)}</span>
        <span class="add">＋</span>
      </div>`;
    }).join('') || '<p class="text-xs text-slate-500 px-1">항목 없음</p>';
    $$('#palette-list .pal-item').forEach(item => {
      item.addEventListener('click', () => {
        const tag = item.dataset.tag;
        if (item.dataset.lyrics === '1') {
          // insert into lyrics textarea
          insertAtCursor($('#lyrics-out'), `\n\n${tag.split('/')[0].trim()}\n…\n`);
          updateStats();
        } else {
          addChip(tag, 'palette');
        }
      });
    });
  }


  // ====================================================================
  // ARTISTS grid
  // ====================================================================
  function renderArtists() {
    $('#art-era').innerHTML = `<option value="">${tx('dd.era.all', '시대 (전체)')}</option>` +
      allEras.map(e => `<option value="${escapeHtml(e)}">${escapeHtml(tdx(eraLabel(e)))}</option>`).join('');
    $('#art-genre').innerHTML = `<option value="">${tx('dd.group.kpop', '스타일 그룹 (한국·POP 우선)')}</option>` +
      allGenres.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(tdx(g))}</option>`).join('');
    if (!$('#art-type')) {
      // inject a type filter inline
      const target = $('#art-genre').parentNode;
      const wrap = document.createElement('select');
      wrap.id = 'art-type'; wrap.className = 'input';
      wrap.innerHTML = `<option value="">${tx('dd.type.all', '유형 (전체)')}</option><option value="template">${tx('dd.type.tpl', '📜 템플릿')}</option><option value="artist">${tx('dd.type.art', '🎤 아티스트')}</option>`;
      target.appendChild(wrap);
    }
    ['#art-q', '#art-era', '#art-genre', '#art-type'].forEach(s => {
      const el = $(s); if (el) el.addEventListener('input', drawArtists);
    });
    drawArtists();
    $('#artist-grid').dataset.ready = '1';
  }
  function drawArtists() {
    const q = $('#art-q').value.trim().toLowerCase();
    const era = $('#art-era').value;
    const genre = $('#art-genre').value;
    const type = $('#art-type') ? $('#art-type').value : '';

    let filtered = PRESETS.filter(p => presetMatchesCategory(p, state.cat.artists))
      .filter(p => {
        if (type && p.type !== type) return false;
        if (era && !p.eras.includes(era)) return false;
        if (genre && p.genre !== genre) return false;
        if (q) {
          const hay = (p.title + ' ' + p.genre + ' ' + p.subtitle + ' ' + (p.tags || '') + ' ' + p.style).toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
    filtered = filtered.slice().sort((a, b) => {
      const ra = categoryRank(a.genre), rb = categoryRank(b.genre);
      if (ra !== rb) return ra - rb;
      if (a.type !== b.type) return a.type === 'template' ? -1 : 1;
      return eraRank(a.era) - eraRank(b.era);
    });
    const cc = $('#art-cat-count');
    if (cc) cc.textContent = `${filtered.length} / ${PRESETS.length}`;
    const grid = $('#artist-grid');
    const loadLbl = tx('art.btn.load', '빌더에 로드');
    const copyLbl = tx('art.btn.copy', 'Style 복사');
    grid.innerHTML = filtered.map((p, i) => {
      const isTpl = p.type === 'template';
      const icon  = isTpl ? '📜' : '🎤';
      const sub   = isTpl
        ? `${escapeHtml(tdx(p.genre))}${p.bpm_hint ? ' · ' + escapeHtml(tdx(p.bpm_hint)) : ''}`
        : `${escapeHtml(tdx(p.genre))} · ${escapeHtml(p.peak || '')}`;
      const idLabel = isTpl ? escapeHtml(p.chapter) : `#${p.artist_no}`;
      let body = '';
      if (!isTpl && Array.isArray(p.variants) && p.variants.length > 1) {
        body = p.variants.map((v, vi) => `
          <div class="variant-block">
            <div class="variant-head">
              <span class="variant-label variant-label-${vi}">${escapeHtml(tdx(v.label))}</span>
              <span class="variant-song">〈${escapeHtml(v.song || p.subtitle || '')}〉</span>
            </div>
            <div class="style">${escapeHtml(v.style || '')}</div>
            ${v.structure ? `<div class="struct">${escapeHtml(v.structure)}</div>` : ''}
            <div class="actions">
              <button class="btn-load-builder" data-load="${i}" data-variant="${vi}">${loadLbl}</button>
              <button class="btn-secondary" data-copy-style="${i}" data-variant="${vi}">${copyLbl}</button>
            </div>
          </div>
        `).join('');
      } else {
        body = `
          <div class="style">${escapeHtml(p.style)}</div>
          ${p.structure ? `<div class="struct">${escapeHtml(p.structure)}</div>` : ''}
          <div class="actions">
            <button class="btn-load-builder" data-load="${i}" data-variant="0">${loadLbl}</button>
            <button class="btn-secondary" data-copy-style="${i}" data-variant="0">${copyLbl}</button>
          </div>`;
      }
      return `
      <div class="art-card ${!isTpl && p.variants && p.variants.length > 1 ? 'has-variants' : ''}" data-idx="${i}">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h3>${icon} ${escapeHtml(tdx(p.title))} <span class="text-slate-500 text-xs">${idLabel}</span></h3>
            <div class="meta">${sub}</div>
          </div>
          <span class="era">${escapeHtml(tdx(p.eras.map(eraLabel).join(' · ')))}</span>
        </div>
        ${body}
      </div>`;
    }).join('') || `<p class="text-slate-400 text-sm col-span-full text-center py-8">${tx('art.empty', '조건에 맞는 프리셋이 없습니다.')}</p>`;

    $$('#artist-grid [data-load]').forEach(b => b.addEventListener('click', () => {
      const p = filtered[parseInt(b.dataset.load, 10)];
      const vi = parseInt(b.dataset.variant, 10) || 0;
      state.selectedArtist = p;
      loadSelectedArtist(vi);
      setTab('builder');
    }));
    $$('#artist-grid [data-copy-style]').forEach(b => b.addEventListener('click', () => {
      const p  = filtered[parseInt(b.dataset.copyStyle, 10)];
      const vi = parseInt(b.dataset.variant, 10) || 0;
      const v  = (Array.isArray(p.variants) && p.variants[vi]) ? p.variants[vi] : null;
      copyText(v ? v.style : p.style);
    }));
  }

  // ====================================================================
  // GUIDE
  // ====================================================================
  // Strip the "Sheet1_" / "Sheet2_" prefix → "기본태그가이드" / "한국가요특화" etc.
  function sheetGroupName(sheet) {
    return String(sheet || '').replace(/^Sheet\d+_/, '');
  }

  function renderGuideList() {
    const all = Array.from(byChapter.keys()).sort((a, b) => {
      const na = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
      const nb = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
      return na - nb;
    });
    // Group chapters by their sheet so the index has visible section breaks
    const grouped = [];
    let lastGroup = null;
    for (const ch of all) {
      const entries = byChapter.get(ch);
      const sheet = entries[0]?.sheet || '';
      const group = sheetGroupName(sheet);
      if (group !== lastGroup) {
        grouped.push({ kind: 'header', group });
        lastGroup = group;
      }
      const heading = (entries[0]?.section || ch).replace(/^📌\s*Ch\.\d+\s*/, '').trim().split('―')[0].trim() || ch;
      grouped.push({ kind: 'item', ch, group, heading });
    }
    $('#guide-list').innerHTML = grouped.map(g => {
      if (g.kind === 'header') {
        return `<li class="guide-group-header">${escapeHtml(tdx(g.group))}</li>`;
      }
      return `<li data-ch="${escapeHtml(g.ch)}">
        <span class="text-accent-400 mr-2">${escapeHtml(g.ch)}</span>${escapeHtml(tdx(g.heading))}
        <span class="guide-group-tag">${escapeHtml(tdx(g.group))}</span>
      </li>`;
    }).join('');
    $$('#guide-list li[data-ch]').forEach(li => li.addEventListener('click', () => {
      $$('#guide-list li[data-ch]').forEach(x => x.classList.toggle('active', x === li));
      renderGuideChapter(li.dataset.ch);
    }));
    $('#guide-list').dataset.ready = '1';
    // auto select first
    const first = $('#guide-list li[data-ch]'); if (first) first.click();
  }
  function renderGuideChapter(ch) {
    const entries = byChapter.get(ch) || [];
    const group = sheetGroupName(entries[0]?.sheet || '');
    const banner = (entries[0]?.section || '').replace(/^📌\s*/, '');
    $('#guide-title').textContent = `${tdx(group)} · ${ch} · ${tdx(banner)}`;
    $('#guide-content').innerHTML = `
      <table>
        <thead><tr>
          <th>${tx('tag.col.reflect', '반영')}</th>
          <th>${tx('tag.col.field', '필드')}</th>
          <th>${tx('tag.col.cat', '카테고리')}</th>
          <th>${tx('tag.col.tag', '태그')}</th>
          <th>${tx('tag.col.desc', '설명')}</th>
          <th>${tx('tag.col.tip', '팁')}</th>
        </tr></thead>
        <tbody>
          ${entries.map(e => `<tr>
            <td>${reflectIcon(e.reflect)}</td>
            <td class="text-slate-400 text-xs">${escapeHtml(e.field)}</td>
            <td class="text-slate-400 text-xs">${escapeHtml(tdx(e.category))}</td>
            <td class="tag">${escapeHtml(e.tag)}</td>
            <td>${escapeHtml(tdx(e.ko))}</td>
            <td class="text-slate-400 text-xs">${escapeHtml(tdx(e.tip))}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  // ====================================================================
  // PRESETS
  // ====================================================================
  function savePresetFromBuilder() {
    const defaultName = $('#song-title').value.trim()
      || (state.selectedArtist ? `${state.selectedArtist.title} ${tx('preset.variant', '변형')}` : tx('preset.mine', '나의 프리셋'));
    const name = prompt(tx('prompt.preset.name', '프리셋 이름을 입력하세요'), defaultName);
    if (!name) return;
    const preset = {
      id: Date.now(),
      name,
      title: $('#song-title').value.trim(),
      created: new Date().toISOString(),
      basis: state.selectedArtist ? { era: state.selectedArtist.era, artist: state.selectedArtist.title } : null,
      style: $('#style-out').value,
      lyrics: $('#lyrics-out').value,
      chips: state.chips.map(c => c.tag),
      englishPct: state.englishPct,
      metaphorPct: state.metaphorPct,
      rapPct: state.rapPct,
      // Full control-panel snapshot so a restore gives byte-identical state
      variantIndex: state.selectedVariantIndex || 0,
      opts: {
        bpmHint:    $('#opt-bpm-hint')?.checked,
        sectionCues:$('#opt-section-cues')?.checked,
        callResp:   $('#opt-call-response')?.checked,
        harmonies:  $('#opt-harmonies')?.checked,
        pitchRestraint: $('#opt-pitch-restraint')?.checked,
        arrStyle:   $('#opt-arrangement-style')?.value || 'auto',
      },
    };
    state.presets.unshift(preset);
    savePresets();
    toast(tx('toast.preset.saved', '프리셋 저장됨'));
    if (state.tab === 'presets') renderPresets();
  }
  function renderPresets() {
    const list = $('#preset-list');
    if (state.presets.length === 0) {
      list.innerHTML = `<p class="col-span-full text-slate-400 text-sm text-center py-8">${tx('presets.empty', '저장된 프리셋이 없습니다. 빌더에서 “이 조합을 프리셋으로 저장”을 눌러보세요.')}</p>`;
      return;
    }
    const enMode = window.SU_LANG && window.SU_LANG() === 'en';
    const locale = enMode ? 'en-US' : 'ko-KR';
    list.innerHTML = state.presets.map(p => `
      <div class="preset-card" data-id="${p.id}">
        <h3>${escapeHtml(p.name)}</h3>
        <div class="text-xs text-slate-400 mb-2">
          ${p.title ? `🎵 ${escapeHtml(p.title)} · ` : ''}${new Date(p.created).toLocaleString(locale)}
          ${p.basis ? ` · ${escapeHtml(tdx(p.basis.era))} · ${escapeHtml(tdx(p.basis.artist))}` : ''}
          ${typeof p.englishPct === 'number' && p.englishPct !== 0 ? ` · ${tx('lbl.en', '영문')} ${p.englishPct}%` : ''}
          ${typeof p.metaphorPct === 'number' && p.metaphorPct !== 50 ? ` · 🎭 ${p.metaphorPct}%` : ''}
          ${typeof p.rapPct === 'number' && p.rapPct !== 0 ? ` · 🎤 ${p.rapPct}%` : ''}
        </div>
        <pre>${escapeHtml(p.style)}</pre>
        <div class="actions">
          <button class="btn-primary" data-restore="${p.id}">${tx('saved.btn.restore', '불러오기')}</button>
          <button class="btn-secondary" data-copy-p="${p.id}">${tx('saved.btn.copyall', '전체 복사')}</button>
          <button class="btn-ghost" data-save-p="${p.id}" title="${tx('saved.btn.file.tip', '개별 파일로 저장')}">${tx('saved.btn.file', '💾 파일')}</button>
          <button class="btn-ghost" data-delete="${p.id}">${tx('saved.btn.delete', '삭제')}</button>
        </div>
      </div>`).join('');
    $$('#preset-list [data-restore]').forEach(b => b.addEventListener('click', () => {
      const p = state.presets.find(x => x.id == b.dataset.restore);
      if (!p) return;
      state.chips = dedupeTags((p.chips || p.style.split(',')).map(stripStyleBrackets))
        .map(t => ({ tag: t, source: 'preset' }));
      $('#song-title').value = p.title || '';
      $('#lyrics-out').value = normalizeLyrics(p.lyrics || '');
      if (typeof p.englishPct === 'number') {
        state.englishPct = p.englishPct;
        applyLangUI();
      }
      if (typeof p.metaphorPct === 'number') {
        state.metaphorPct = p.metaphorPct;
        applyMetaphorUI();
      }
      if (typeof p.rapPct === 'number') {
        state.rapPct = p.rapPct;
        applyRapUI();
      }
      // Restore control-panel options if present
      if (p.opts) {
        const setCb = (sel, v) => { const el = $(sel); if (el && typeof v === 'boolean') el.checked = v; };
        setCb('#opt-bpm-hint',     p.opts.bpmHint);
        setCb('#opt-section-cues', p.opts.sectionCues);
        setCb('#opt-call-response',p.opts.callResp);
        setCb('#opt-harmonies',    p.opts.harmonies);
        setCb('#opt-pitch-restraint', p.opts.pitchRestraint);
        if (p.opts.arrStyle && $('#opt-arrangement-style')) $('#opt-arrangement-style').value = p.opts.arrStyle;
        // Refresh the arrangement-style row visibility
        const arrOn = !!(p.opts.callResp || p.opts.harmonies);
        $('#arrangement-style-row')?.classList.toggle('hidden', !arrOn);
      }
      if (typeof p.variantIndex === 'number') state.selectedVariantIndex = p.variantIndex;
      // Restored snapshots are the user's own saved chips — they don't
      // map to an Excel-curated preset, so wipe any previously selected
      // artist context (and the preset-protection lock) before
      // re-rendering. Otherwise AI generation would copy the leftover
      // refArtist style verbatim and clobber the restored chips.
      state.selectedArtist = null;
      state.activeVariantView = null;
      const fill = document.getElementById('ai-fill-style');
      if (fill) fill.checked = false;
      setStyleFillLock(false);
      renderChips(); renderStyleOut(); renderCurrentMeta(); updateStats();
      setTab('builder');
      toast(`${tx('toast.loaded', '불러옴')}: ${p.name}`);
    }));
    $$('#preset-list [data-copy-p]').forEach(b => b.addEventListener('click', () => {
      const p = state.presets.find(x => x.id == b.dataset.copyP);
      const titleLine = p.title ? `# ${p.title}\n\n` : '';
      copyText(`${titleLine}[STYLE]\n${p.style}\n\n[LYRICS]\n${normalizeLyrics(p.lyrics)}`);
    }));
    $$('#preset-list [data-save-p]').forEach(b => b.addEventListener('click', () => {
      const p = state.presets.find(x => x.id == b.dataset.saveP);
      if (!p) return;
      downloadJSON(p, `${APP_DIR}/preset/${safeFilename(p.name)}.json`);
      toast(`💾 ${APP_DIR}/preset/${safeFilename(p.name)}.json`);
    }));
    $$('#preset-list [data-delete]').forEach(b => b.addEventListener('click', () => {
      if (!confirm(tx('confirm.delete.preset', '이 프리셋을 삭제할까요?'))) return;
      state.presets = state.presets.filter(x => x.id != b.dataset.delete);
      savePresets(); renderPresets();
    }));
  }
  $('#btn-export').addEventListener('click', () => {
    if (!state.presets.length) return toast(tx('toast.no.presets', '내보낼 프리셋이 없습니다'));
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadJSON(state.presets, `${APP_DIR}/preset/all_presets_${ts}.json`);
    toast(`📁 Downloads/${APP_DIR}/preset/`);
  });
  $('#file-import').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const arr = JSON.parse(r.result);
        if (!Array.isArray(arr)) throw new Error('Invalid');
        // Dedup by id (and by name+style if no id) so re-importing
        // the same file doesn't multiply entries.
        const existingIds = new Set(state.presets.map(p => p.id));
        const existingKeys = new Set(state.presets.map(p => `${p.name}::${(p.style||'').slice(0,80)}`));
        const incoming = arr.filter(p => {
          if (p && p.id && existingIds.has(p.id)) return false;
          const k = `${p?.name||''}::${(p?.style||'').slice(0,80)}`;
          return !existingKeys.has(k);
        });
        state.presets = incoming.concat(state.presets);
        savePresets(); renderPresets();
        const skipped = arr.length - incoming.length;
        toast(`${incoming.length}개 가져옴${skipped ? ` · ${skipped}개 중복 건너뜀` : ''}`);
      } catch { toast(tx('toast.bad.json', '잘못된 JSON 파일')); }
      e.target.value = '';
    };
    r.readAsText(f);
  });
  $('#btn-clear-presets').addEventListener('click', () => {
    if (!confirm(tx('confirm.delete.all.presets', '모든 프리셋을 삭제할까요?'))) return;
    state.presets = []; savePresets(); renderPresets();
  });

  // ====================================================================
  // SETTINGS MODAL + AI
  // ====================================================================
  const ai = {
    cryptoKey: null,      // CryptoKey once unlocked
    provider: 'anthropic',
    model: '',
    abortCtl: null,
  };

  async function openSettings() {
    const m = $('#settings-modal');
    m.classList.remove('hidden'); m.setAttribute('aria-hidden', 'false');
    // No more passphrase entry — the device key auto-unlocks on boot.
    // If somehow it isn't loaded yet, bootstrap it now.
    if (!ai.cryptoKey) {
      try { ai.cryptoKey = await window.SunoVault.bootstrapKey(); }
      catch (e) { setStatus(`${tx('status.devkey.fail', '디바이스 키 초기화 실패')}: ${e.message}`, 'red'); return; }
    }
    await showUnlocked();
  }
  function closeSettings() {
    const m = $('#settings-modal');
    m.classList.add('hidden'); m.setAttribute('aria-hidden', 'true');
    $('#settings-status').textContent = '';
  }
  async function showUnlocked() {
    // load existing keys & meta
    const meta = window.SunoVault.getMeta();
    ai.provider = meta.provider || 'anthropic';
    $('#settings-provider').value = ai.provider;
    populateModelSelect(ai.provider, meta.models?.[ai.provider] || window.SunoAI.DEFAULT_MODEL[ai.provider]);

    try {
      const keys = await window.SunoVault.listKeys(ai.cryptoKey);
      $('#api-anthropic').value = keys.anthropic || '';
      $('#api-openai').value    = keys.openai    || '';
      $('#api-google').value    = keys.google    || '';
    } catch (e) {
      setStatus(`${tx('status.decrypt.fail', '키 복호화 실패')}: ${e.message}`, 'red');
    }
    syncAIProviderTabs();
  }
  function setStatus(text, color = '') {
    const el = $('#settings-status');
    el.textContent = text;
    el.style.color = color === 'red' ? '#fca5a5' : color === 'green' ? '#9ff0d4' : '';
    if (color === 'red' && text) toastError(text);
  }

  $('#btn-settings').addEventListener('click', openSettings);
  $$('#settings-modal [data-close-modal]').forEach(b => b.addEventListener('click', closeSettings));
  $('.modal-backdrop', $('#settings-modal')).addEventListener('click', closeSettings);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#settings-modal').classList.contains('hidden')) closeSettings(); });

  // Build the model <select> options for a given provider, marking the
  // recommended one with a ⭐ and showing per-token pricing. The picker
  // also supports a free-form "직접 입력" fallback for advanced users.
  function populateModelSelect(provider, currentId) {
    const sel = $('#settings-model');
    const note = $('#settings-model-note');
    const list = (window.SunoAI.MODELS || {})[provider] || [];
    sel.innerHTML = list.map(m => {
      const star = m.recommended ? '⭐ ' : '';
      return `<option value="${m.id}" data-provider="${provider}">${star}${m.label} · ${m.price}</option>`;
    }).join('') + `<option value="__custom__">${tx('settings.model.custom', '✏️ 직접 입력 (custom)')}</option>`;
    // pick currentId if it matches a recommended option, otherwise treat
    // it as a custom value and show the text input + remember it
    if (currentId && list.find(m => m.id === currentId)) {
      sel.value = currentId;
    } else if (currentId) {
      sel.value = '__custom__';
      sel.dataset.custom = currentId;
    } else {
      sel.value = list.find(m => m.recommended)?.id || list[0]?.id || '';
    }
    sel.dataset.provider = provider;
    refreshModelNote();
  }
  function refreshModelNote() {
    const sel = $('#settings-model');
    const note = $('#settings-model-note');
    if (!note) return;
    if (sel.value === '__custom__') {
      const cur = sel.dataset.custom || '';
      note.innerHTML = `<input id="settings-model-custom" class="input mt-1" placeholder="${tx('settings.model.custom.ph', '모델 ID 직접 입력 (예: gpt-5)')}" value="${cur.replace(/"/g,'&quot;')}" />`;
      const ci = note.querySelector('#settings-model-custom');
      ci?.addEventListener('input', () => { sel.dataset.custom = ci.value.trim(); });
    } else {
      // Look the model up fresh from MODELS so the note follows the
      // current UI language (re-fired on `su:lang`).
      const provider = sel.dataset.provider || 'anthropic';
      const list = (window.SunoAI.MODELS || {})[provider] || [];
      const m = list.find(x => x.id === sel.value);
      const enMode = window.SU_LANG && window.SU_LANG() === 'en';
      const text = m ? (((enMode && m.note_en) ? m.note_en : m.note) + ' · ' + m.price) : '';
      note.textContent = text;
    }
  }

  $('#settings-provider').addEventListener('change', () => {
    const p = $('#settings-provider').value;
    const meta = window.SunoVault.getMeta();
    populateModelSelect(p, meta.models?.[p] || window.SunoAI.DEFAULT_MODEL[p]);
  });
  $('#settings-model').addEventListener('change', refreshModelNote);

  // Resolve the user-selected model — handles the __custom__ fallback
  function getSelectedModel() {
    const sel = $('#settings-model');
    if (sel.value === '__custom__') return (sel.dataset.custom || '').trim();
    return sel.value;
  }

  $('#settings-save').addEventListener('click', async () => {
    if (!ai.cryptoKey) return;
    try {
      await window.SunoVault.setKeys(ai.cryptoKey, {
        anthropic: $('#api-anthropic').value.trim(),
        openai:    $('#api-openai').value.trim(),
        google:    $('#api-google').value.trim(),
      });
      const provider = $('#settings-provider').value;
      const meta = window.SunoVault.getMeta();
      meta.models = meta.models || {};
      meta.models[provider] = getSelectedModel() || window.SunoAI.DEFAULT_MODEL[provider];
      window.SunoVault.setMeta({ provider, models: meta.models });
      ai.provider = provider;
      ai.model = meta.models[provider];
      syncAIProviderTabs();
      setStatus(tx('status.saved', '저장 완료 (암호화됨)'), 'green');
      toast(tx('toast.settings.saved', '설정 저장됨'));
    } catch (e) { setStatus(e.message, 'red'); }
  });

  $('#settings-test').addEventListener('click', async () => {
    if (!ai.cryptoKey) return;
    const provider = $('#settings-provider').value;
    const inputId = '#api-' + provider;
    const apiKey = $(inputId).value.trim();
    const model  = getSelectedModel() || window.SunoAI.DEFAULT_MODEL[provider];
    if (!apiKey) { setStatus(tx('status.enter.key', '해당 제공업체의 API 키를 입력하세요'), 'red'); return; }
    setStatus(`${tx('status.testing', '테스트 중…')} (${window.SunoAI.PROVIDER_LABEL[provider]} / ${model})`);
    try {
      await window.SunoAI.ping({ provider, apiKey, model });
      setStatus(tx('status.conn.ok', '✅ 연결 OK — 키와 모델 모두 정상'), 'green');
    } catch (e) {
      setStatus('❌ ' + e.message, 'red');
    }
  });

  const resetVault = async () => {
    if (!confirm(tx('confirm.purge.vault', '저장된 모든 API 키와 설정을 삭제할까요? 되돌릴 수 없습니다.'))) return;
    window.SunoVault.reset();
    ai.cryptoKey = null;
    // Clear visible API key fields
    ['#api-anthropic', '#api-openai', '#api-google'].forEach(s => { const el = $(s); if (el) el.value = ''; });
    // Re-bootstrap a fresh device key so the user can immediately enter
    // new API keys without leaving the modal.
    try {
      ai.cryptoKey = await window.SunoVault.bootstrapKey();
      await showUnlocked();
      setStatus(tx('status.purged', '초기화 완료 — 새 디바이스 키 생성됨'), 'green');
    } catch (e) {
      setStatus(`${tx('status.purge.fail', '초기화 후 키 재생성 실패')}: ${e.message}`, 'red');
    }
    toast(tx('toast.vault.reset', 'Vault 초기화'));
  };
  $('#settings-reset2').addEventListener('click', resetVault);

  // ---- AI provider quick tabs in builder ----
  function syncAIProviderTabs() {
    $$('.ai-prov[data-prov]').forEach(b => b.classList.toggle('active', b.dataset.prov === ai.provider));
    document.querySelectorAll('#search-prov-tabs [data-search-prov]').forEach(b =>
      b.classList.toggle('active', b.dataset.searchProv === ai.provider));
    updateHeaderAI();
  }
  $$('.ai-prov').forEach(b => b.addEventListener('click', () => {
    ai.provider = b.dataset.prov;
    const meta = window.SunoVault.getMeta();
    ai.model = meta.models?.[ai.provider] || window.SunoAI.DEFAULT_MODEL[ai.provider];
    window.SunoVault.setMeta({ provider: ai.provider });
    syncAIProviderTabs();
  }));

  // ---- Instrumental toggle ----
  // 🎺 연주곡 ON:
  //   - inject an `instrumental` chip into the Style stack (idempotent)
  //   - force the Lyrics AI fill option ON — AI will write a section
  //     roadmap with musical cues (empty Lyrics in Suno produces a flat
  //     2-3 min loop, so a roadmap is the recommended Suno pattern for
  //     instrumental tracks)
  //   - blank the lyrics textarea so the freshly generated roadmap
  //     replaces any leftover sung lyrics
  // OFF: restore the previous Lyrics fill state. The `instrumental` chip
  // is left alone — user may have curated other tags around it and can
  // drop it manually or via the 초기화 button.
  (function initInstrumentalToggle() {
    const cb = document.getElementById('ai-instrumental');
    const lyricsCb = document.getElementById('ai-fill-lyrics');
    if (!cb || !lyricsCb) return;
    function apply(on) {
      if (on) {
        if (lyricsCb.dataset.prevChecked === undefined) {
          lyricsCb.dataset.prevChecked = String(lyricsCb.checked);
        }
        lyricsCb.checked = true;
        if (!state.chips.some(c => c.tag.toLowerCase() === 'instrumental')) {
          state.chips.unshift({ tag: 'instrumental', source: 'instrumental' });
          renderChips(); renderStyleOut();
        }
        const ta = document.getElementById('lyrics-out');
        if (ta && ta.value.trim()) { ta.value = ''; updateStats(); }
      } else if (lyricsCb.dataset.prevChecked !== undefined) {
        lyricsCb.checked = lyricsCb.dataset.prevChecked === 'true';
        delete lyricsCb.dataset.prevChecked;
      }
    }
    cb.addEventListener('change', () => apply(cb.checked));
  })();

  // ---- AI generate button ----
  function setAIStatus(text, color = '') {
    const el = $('#ai-status');
    el.textContent = text;
    el.style.color = color === 'red' ? '#fca5a5' : color === 'green' ? '#9ff0d4' : '';
    if (color === 'red' && text) toastError(text);
  }

  $('#ai-generate').addEventListener('click', async () => {
    const prompt = $('#ai-prompt').value.trim();
    if (!prompt) { setAIStatus(tx('status.ai.prompt', '프롬프트를 입력하세요'), 'red'); return; }
    if (!ai.cryptoKey) { setAIStatus(tx('status.ai.unlock', '먼저 ⚙️ 설정에서 API 키를 잠금 해제하세요'), 'red'); openSettings(); return; }
    let apiKey;
    try { apiKey = await window.SunoVault.getKey(ai.cryptoKey, ai.provider); }
    catch (e) { setAIStatus(`${tx('status.decrypt.fail', '키 복호화 실패')}: ${e.message}`, 'red'); return; }
    if (!apiKey) { setAIStatus(`${window.SunoAI.PROVIDER_LABEL[ai.provider]} ${tx('aistat.nokey', 'API 키가 없습니다')}`, 'red'); openSettings(); return; }

    const ctx = {
      lang: langConfig(),
      metaphorPct: state.metaphorPct,
      rapPct: state.rapPct,
      sectionCues:  $('#opt-section-cues').checked,
      callResponse: $('#opt-call-response').checked,
      harmonies:    $('#opt-harmonies').checked,
      pitchRestraint: $('#opt-pitch-restraint')?.checked || false,
      arrangementStyle: $('#opt-arrangement-style')?.value || 'auto',
      instrumental: $('#ai-instrumental')?.checked || false,
      titleLang:    $('#ai-title-lang')?.value || 'auto',
    };
    if ($('#ai-use-context').checked && state.selectedArtist) {
      // Pass the *active variant* view to the AI so it shapes the lyric/style
      // around the chosen Ballad/Anthem/Signature interpretation.
      const av = state.activeVariantView || {};
      ctx.refArtist = {
        ...state.selectedArtist,
        style:     av.style     || state.selectedArtist.style,
        structure: av.structure || state.selectedArtist.structure,
        tags:      av.tags      || state.selectedArtist.tags,
        subtitle:  av.subtitle  || state.selectedArtist.subtitle,
      };
    }
    // Only anchor to the user's existing title when they've chosen to
    // KEEP it (ai-fill-title unchecked). When ai-fill-title is checked
    // the user wants the AI to own the title, so we must NOT pass the
    // old one as a "you may keep it" hint — otherwise the model just
    // echoes it back and the title never changes on regeneration.
    if ($('#song-title').value.trim() && !$('#ai-fill-title').checked) {
      ctx.workingTitle = $('#song-title').value.trim();
    }

    const model = ai.model || window.SunoAI.DEFAULT_MODEL[ai.provider];
    setAIStatus(`${tx('aistat.generating', '생성 중…')} (${window.SunoAI.PROVIDER_LABEL[ai.provider]} / ${model} · ${langLabel()} · ${metaphorLabel()} · ${rapLabel()})`);
    const btn = $('#ai-generate'); btn.disabled = true; btn.textContent = tx('aibtn.generating', '⏳ 생성 중');

    try {
      const out = await window.SunoAI.generate({
        provider: ai.provider, apiKey, model, userPrompt: prompt, context: ctx,
      });
      if ($('#ai-fill-title').checked && out.title) {
        $('#song-title').value = out.title;
      }
      if ($('#ai-fill-style').checked && out.style) {
        // Pipe through the full sanitiser so redundant era / genre tail
        // tags AI tends to append (e.g. "early-2020s K-pop production",
        // "global K-pop dominance era") get dropped before chips are
        // created — same dedup pass used by preset/search loads.
        const sanitized = sanitizeStyleString(out.style);
        state.chips = dedupeTags(sanitized.split(',').map(stripStyleBrackets))
          .map(t => ({ tag: t, source: 'ai' }));
        renderChips(); renderStyleOut();
      }
      if ($('#ai-fill-lyrics').checked && out.lyrics) {
        $('#lyrics-out').value = normalizeLyrics(out.lyrics);
        updateStats();
      }
      setAIStatus(`${tx('aistat.done', '✅ 완료')} — ${out.style.length}${tx('stat.chars',' chars')} style · ${out.lyrics.length}${tx('stat.chars',' chars')} lyrics · ${langLabel()} · ${metaphorLabel()} · ${rapLabel()}`, 'green');
      toast(tx('toast.ai.done', 'AI 생성 완료'));
    } catch (e) {
      setAIStatus('❌ ' + e.message, 'red');
    } finally {
      btn.disabled = false; btn.textContent = tx('aibtn.generate', '▶ 생성');
    }
  });

  // ---- device key auto-bootstrap ----
  // No passphrase screen — we auto-generate (or restore) an AES-GCM
  // device key on every page load so API keys are immediately usable.
  (async () => {
    try {
      ai.cryptoKey = await window.SunoVault.bootstrapKey();
      const meta = window.SunoVault.getMeta();
      ai.provider = meta.provider || 'anthropic';
      ai.model = meta.models?.[ai.provider] || window.SunoAI.DEFAULT_MODEL[ai.provider];
      syncAIProviderTabs();
    } catch (e) {
      console.warn('Vault bootstrap failed:', e);
    }
  })();

  // ====================================================================
  // ALBUM PLANNER
  // ====================================================================
  // Mood chips — id is the canonical Korean label (stays stable for
  // the data layer / saved albums). The label() function returns the
  // localised display string via tx().
  const ALBUM_MOOD_IDS = [
    '🌧️ 멜랑콜리', '☀️ 희망적', '🔥 정열', '🧊 차가움', '💕 따뜻함',
    '😢 슬픔', '😡 분노', '🌸 노스탤지어', '⚡ 에너지', '🌙 고요',
    '✨ 환상적', '🎭 드라마틱', '🎉 흥겨움', '🌊 평온', '💔 이별',
  ];
  const moodLabel = id => tx(`mood.${ALBUM_MOOD_IDS.indexOf(id)}`, id);
  const ALBUM_MOODS = ALBUM_MOOD_IDS;
  const ALBUMS_KEY = 'suno_albums';
  const album = {
    moods: new Set(),
    englishPct: 0,
    result: null,        // { albumTitle, summary, baseStyle, tracks: [...] }
    saved: loadAlbums(),
    busy: false,
  };

  function loadAlbums() {
    try { return JSON.parse(localStorage.getItem(ALBUMS_KEY) || '[]'); }
    catch { return []; }
  }
  function persistAlbums() { localStorage.setItem(ALBUMS_KEY, JSON.stringify(album.saved)); }

  function initAlbum() {
    // Mood chips
    $('#album-mood-chips').innerHTML = ALBUM_MOODS.map(m =>
      `<button class="cat-chip" data-mood="${escapeHtml(m)}">${escapeHtml(moodLabel(m))}</button>`
    ).join('');
    $$('#album-mood-chips .cat-chip').forEach(b => {
      b.addEventListener('click', () => {
        const m = b.dataset.mood;
        if (album.moods.has(m)) album.moods.delete(m);
        else album.moods.add(m);
        b.classList.toggle('active', album.moods.has(m));
      });
    });

    // Era dropdown — reuse the same era list
    $('#album-era').innerHTML = `<option value="">— ${tx('dd.era.album', '시대 선택 (선택)')} —</option>` +
      allEras.map(e => `<option value="${escapeHtml(e)}">${escapeHtml(tdx(eraLabel(e)))}</option>`).join('');

    // ── Style group + Preset cascade (Builder-style picker) ────────────────
    function albumPresetPool() {
      const cat = $('#album-cat').value || 'all';
      const era = $('#album-era').value || '';
      let pool = PRESETS.filter(p => presetMatchesCategory(p, cat));
      if (era) pool = pool.filter(p => p.eras.includes(era));
      return pool;
    }
    function refreshAlbumStyleGroup() {
      const pool = albumPresetPool();
      const groups = sortByCategory(uniqueSorted(pool.map(p => p.genre)), g => g);
      $('#album-style-group').innerHTML = `<option value="">— ${tx('dd.album.style.auto', '자동 (앨범 컨셉에서 추론)')} —</option>` +
        groups.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(tdx(g))}</option>`).join('');
      refreshAlbumPreset();
    }
    function refreshAlbumPreset() {
      const group = $('#album-style-group').value || '';
      let pool = albumPresetPool();
      if (group) pool = pool.filter(p => p.genre === group);
      pool = pool.slice().sort((a, b) =>
        (a.type !== b.type) ? (a.type === 'template' ? -1 : 1) :
        a.title.localeCompare(b.title, 'ko')
      );
      $('#album-preset').innerHTML = `<option value="">— ${tx('dd.album.preset.none', '없음')} —</option>` +
        pool.map(p => {
          const icon = p.type === 'template' ? '📜' : '🎤';
          const sub = p.bpm ? ` · ${p.bpm} BPM` : '';
          return `<option value="${escapeHtml(p.key)}">${icon} ${escapeHtml(tdx(p.title))}${sub}</option>`;
        }).join('');
      refreshAlbumPresetMeta();
    }
    function refreshAlbumPresetMeta() {
      const key = $('#album-preset').value;
      const meta = $('#album-preset-meta');
      if (!key) { meta.classList.add('hidden'); return; }
      const p = findPreset(key);
      if (!p) { meta.classList.add('hidden'); return; }
      meta.classList.remove('hidden');
      const safeNote = p.type === 'artist'
        ? `<div class="disclaimer-inline">${tx('album.preset.disclaimer', 'ⓘ 아티스트명은 스타일 분류 라벨이며, Suno에 전달되는 프롬프트엔 이름이 포함되지 않습니다.')}</div>`
        : '';
      meta.innerHTML = `<span class="text-accent-400">${p.type === 'template' ? '📜' : '🎤'} ${escapeHtml(p.title)}</span>
        <span class="text-slate-500"> — ${escapeHtml(p.style.slice(0, 110))}${p.style.length > 110 ? '…' : ''}</span>${safeNote}`;
    }
    refreshAlbumStyleGroup();
    $('#album-cat').addEventListener('change', refreshAlbumStyleGroup);
    $('#album-era').addEventListener('change', refreshAlbumStyleGroup);
    $('#album-style-group').addEventListener('change', refreshAlbumPreset);
    $('#album-preset').addEventListener('change', refreshAlbumPresetMeta);
    // Re-render album dropdowns when the UI language switches so option
    // labels swap KO↔EN. The su:lang handler dispatches this event after
    // saving the current selection.
    document.addEventListener('su:album-redraw-dropdowns', () => {
      // Re-emit the era list (#album-era) too — that select is built in
      // the snippet just above this block.
      $('#album-era').innerHTML = `<option value="">— ${tx('dd.era.album', '시대 선택 (선택)')} —</option>` +
        allEras.map(e => `<option value="${escapeHtml(e)}">${escapeHtml(tdx(eraLabel(e)))}</option>`).join('');
      refreshAlbumStyleGroup();
    });

    $('#btn-album-from-builder').addEventListener('click', () => {
      if (!state.selectedArtist) { albumStatus(tx('status.album.nopreset', '빌더에 선택된 프리셋이 없습니다'), 'red'); return; }
      const p = state.selectedArtist;
      $('#album-cat').value = p.region === 'korean' ? 'korean' : (RE_POP.test(p.genre) ? 'pop' : 'all');
      $('#album-era').value = p.era || '';
      refreshAlbumStyleGroup();
      $('#album-style-group').value = p.genre || '';
      refreshAlbumPreset();
      $('#album-preset').value = p.key;
      refreshAlbumPresetMeta();
      albumStatus(`${tx('status.album.imported', '빌더 선택을 앨범 컨셉으로 가져옴')}: ${p.title}`, 'green');
    });

    // ── Generation options (right-pane panel) ─────────────────────────────
    function attachSlider(sliderId, readoutId, fmt) {
      const sl = $(sliderId), ro = $(readoutId);
      const update = () => { sl.style.setProperty('--pct', sl.value + '%'); ro.textContent = fmt(parseInt(sl.value, 10) || 0); };
      sl.addEventListener('input', update);
      update();
    }
    attachSlider('#album-opt-lang', '#album-opt-lang-readout',
      en => en === 0 ? `${tx('lbl.ko', '한글')} 100%` : en === 100 ? `${tx('lbl.en', '영문')} 100%` : `${tx('lbl.ko', '한글')} ${100-en}% · ${tx('lbl.en', '영문')} ${en}%`);
    attachSlider('#album-opt-meta', '#album-opt-meta-readout', m => {
      if (m <= 20)  return `📋 ${tx('lbl.direct', '직설')} ${m}%`;
      if (m <= 40)  return `📋 ${tx('lbl.semidirect', '거의 직설')} ${m}%`;
      if (m <= 60)  return `⚖️ ${tx('lbl.balanced', '균형')} ${m}%`;
      if (m <= 80)  return `🎨 ${tx('lbl.poetic', '시적')} ${m}%`;
      return        `🎨 ${tx('lbl.metaphorical', '시적·은유')} ${m}%`;
    });
    attachSlider('#album-opt-rap', '#album-opt-rap-readout', r => {
      const voc = tx('lbl.vocal', '보컬');
      const rap = tx('lbl.rap', '랩');
      if (r <= 10)  return `🎵 ${voc} ${100 - r}%`;
      if (r <= 30)  return `🎵 ${tx('lbl.vocalheavy', '보컬 위주')} (${rap} ${r}%)`;
      if (r <= 60)  return `⚖️ ${tx('lbl.balanced', '균형')} (${rap} ${r}%)`;
      if (r <= 85)  return `🎤 ${tx('lbl.rapheavy', '랩 위주')} ${r}%`;
      return        `🎤 ${rap} ${r}%`;
    });

    function updateAlbumArrRow() {
      const on = $('#album-opt-cr').checked || $('#album-opt-harm').checked;
      $('#album-arr-row').classList.toggle('hidden', !on);
    }
    $('#album-opt-cr').addEventListener('change', updateAlbumArrRow);
    $('#album-opt-harm').addEventListener('change', updateAlbumArrRow);
    updateAlbumArrRow();

    // "💡 12곡 전체 Style에 보컬 편곡 키워드 추가"
    $('#btn-album-add-vocal-vocab').addEventListener('click', () => {
      if (!album.result) { albumStatus(tx('status.album.first', '먼저 앨범을 생성하세요'), 'red'); return; }
      const preset = $('#album-opt-arr').value || 'auto';
      const vocab = vocalArrVocab(preset).slice(0, 3);
      if (!vocab.length) { albumStatus(tx('status.album.novocab', '보컬 편곡 키워드를 찾을 수 없습니다'), 'red'); return; }
      let totalAdded = 0, touched = 0;
      for (const t of album.result.tracks) {
        const current = (t.style || '').split(',').map(s => s.trim().toLowerCase());
        const toAdd = vocab.filter(v => !current.includes(v.toLowerCase()));
        if (toAdd.length) {
          t.style = (t.style ? t.style + ', ' : '') + toAdd.join(', ');
          totalAdded += toAdd.length;
          touched++;
        }
      }
      renderAlbum();
      if (totalAdded) albumStatus(`✨ ${touched}${tx('astat.tracks.added', '곡에 키워드 추가')} (${tx('astat.total', '총')} ${totalAdded} ${tx('tag.items','항목')})`, 'green');
      else albumStatus(tx('status.album.alreadyhas', '모든 트랙에 이미 포함되어 있습니다'), '');
    });

    // ── Main buttons ──────────────────────────────────────────────────────
    $('#btn-album-generate').addEventListener('click', generateAlbum);
    $('#btn-album-regen').addEventListener('click', generateAlbum);
    $('#btn-album-clear').addEventListener('click', () => {
      if (!confirm(tx('confirm.album.reset', '앨범의 모든 작업을 초기화할까요?\n— 앨범 컨셉, 프리셋 선택, 무드, 옵션, 생성된 12곡과 가사가 모두 사라집니다.'))) return;

      // concept inputs
      $('#album-concept').value = '';
      album.moods.clear();
      $$('#album-mood-chips .cat-chip').forEach(c => c.classList.remove('active'));
      $('#album-cat').value = 'all'; $('#album-era').value = '';
      $('#album-arc').value = 'journey';
      $('#album-style-group').value = ''; $('#album-preset').value = '';
      refreshAlbumStyleGroup();
      $('#album-preset-meta').classList.add('hidden');

      // top language slider
      album.englishPct = 0;
      const ls = $('#album-lang-slider');
      ls.value = '0'; ls.dispatchEvent(new window.Event('input'));

      // option-panel sliders
      ['#album-opt-lang', '#album-opt-meta', '#album-opt-rap'].forEach(sel => {
        const el = $(sel); if (!el) return;
        el.value = sel === '#album-opt-meta' ? '50' : '0';
        delete el.dataset.userSet;
        el.dispatchEvent(new window.Event('input'));
      });

      // option-panel checkboxes + arrangement
      $('#album-opt-cues').checked = true;
      $('#album-opt-cr').checked = false;
      $('#album-opt-harm').checked = false;
      $('#album-opt-arr').value = 'auto';
      $('#album-arr-row').classList.add('hidden');

      // result + status
      album.result = null;
      renderAlbum();
      albumStatus(tx('astat.cleared', '🗑️ 앨범 초기화 완료'), 'green');
    });
    $('#btn-album-save').addEventListener('click', saveAlbum);

    // Album JSON import (single album object or array of albums)
    $('#album-file-import')?.addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const data = JSON.parse(r.result);
          const arr = Array.isArray(data) ? data : [data];
          const valid = arr.filter(a => a && a.tracks && Array.isArray(a.tracks));
          if (!valid.length) throw new Error('Invalid');
          const existing = new Set(album.saved.map(a => `${a.name||a.albumTitle}::${a.savedAt||''}`));
          const incoming = valid.filter(a => !existing.has(`${a.name||a.albumTitle}::${a.savedAt||''}`));
          incoming.forEach(a => {
            if (!a.savedAt) a.savedAt = new Date().toISOString();
          });
          album.saved = incoming.concat(album.saved);
          persistAlbums();
          renderSavedAlbums();
          const skipped = valid.length - incoming.length;
          toast(`${incoming.length}개 앨범 가져옴${skipped ? ` · ${skipped}개 중복 건너뜀` : ''}`);
        } catch { toast(tx('toast.bad.json', '잘못된 JSON 파일')); }
        e.target.value = '';
      };
      r.readAsText(f);
    });

    $('#btn-album-clear-saved')?.addEventListener('click', () => {
      if (!album.saved.length) return toast(tx('toast.no.albums', '저장된 앨범이 없습니다'));
      if (!confirm(`저장된 앨범 ${album.saved.length}개를 모두 삭제할까요?`)) return;
      album.saved = [];
      persistAlbums();
      renderSavedAlbums();
      toast(tx('toast.albums.cleared', '저장된 앨범 전체 삭제됨'));
    });
    $('#btn-album-lyrics-all').addEventListener('click', () => generateTrackLyrics('all'));
    $('#btn-album-export').addEventListener('click', exportAlbum);

    // album-level language slider (concept stage — different from option panel)
    const ls = $('#album-lang-slider');
    ls.style.setProperty('--pct', '0%');
    ls.addEventListener('input', () => {
      album.englishPct = parseInt(ls.value, 10) || 0;
      ls.style.setProperty('--pct', album.englishPct + '%');
      const en = album.englishPct;
      $('#album-lang-readout').textContent = en === 0 ? `${tx('lbl.ko','한글')} 100%` : en === 100 ? `${tx('lbl.en','영문')} 100%` : `${tx('lbl.ko','한글')} ${100-en}% · ${tx('lbl.en','영문')} ${en}%`;
      // mirror to option panel by default so user only needs to set it once
      const op = $('#album-opt-lang'); if (op && !op.dataset.userSet) { op.value = String(en); op.dispatchEvent(new window.Event('input')); }
    });
    $('#album-opt-lang').addEventListener('change', e => { e.target.dataset.userSet = '1'; });

    renderSavedAlbums();
    $('#album-mood-chips').dataset.ready = '1';
  }

  // Read the album-level lyric-gen options. Used by both 일괄 and 개별 paths.
  function getAlbumGenOptions() {
    return {
      englishPct:   parseInt($('#album-opt-lang').value, 10) || 0,
      metaphorPct:  parseInt($('#album-opt-meta').value, 10) || 50,
      rapPct:       parseInt($('#album-opt-rap').value, 10)  || 0,
      sectionCues:  $('#album-opt-cues').checked,
      callResponse: $('#album-opt-cr').checked,
      harmonies:    $('#album-opt-harm').checked,
      arrangementStyle: $('#album-opt-arr').value || 'auto',
    };
  }

  function albumStatus(text, color) {
    const el = $('#album-status');
    el.textContent = text || '';
    el.style.color = color === 'red' ? '#fca5a5' : color === 'green' ? '#9ff0d4' : '';
    // Critical failures also surface as a red bottom-center toast so the
    // user notices them even if the inline status text is off-screen.
    if (color === 'red' && text) toastError(text);
  }

  async function generateAlbum() {
    if (album.busy) return;
    const concept = $('#album-concept').value.trim();
    const presetKey = $('#album-preset').value;
    const presetObj = presetKey ? findPreset(presetKey) : null;
    if (!concept && !presetObj) {
      albumStatus(tx('status.album.concept', '앨범 컨셉을 입력하거나 레퍼런스 프리셋을 선택하세요'), 'red'); return;
    }
    if (!ai.cryptoKey) { albumStatus(tx('status.ai.unlock', '먼저 ⚙️ 설정에서 API 키를 잠금 해제하세요'), 'red'); openSettings(); return; }
    let apiKey;
    try { apiKey = await window.SunoVault.getKey(ai.cryptoKey, ai.provider); }
    catch (e) { albumStatus(`${tx('status.decrypt.fail', '키 복호화 실패')}: ${e.message}`, 'red'); return; }
    if (!apiKey) { albumStatus(`${window.SunoAI.PROVIDER_LABEL[ai.provider]} ${tx('aistat.nokey', 'API 키가 없습니다')}`, 'red'); openSettings(); return; }

    const payload = {
      concept: concept || `${presetObj.title} 스타일의 12곡 컨셉 앨범`,
      era:  $('#album-era').value,
      cat:  $('#album-cat').value,
      styleGroup: $('#album-style-group').value,
      preset: presetObj ? {
        key: presetObj.key, type: presetObj.type, title: presetObj.title,
        genre: presetObj.genre, style: presetObj.style, era: presetObj.era,
        structure: presetObj.structure || '',
      } : null,
      moods: Array.from(album.moods),
      arc:  $('#album-arc').value,
      englishPct: album.englishPct,
    };
    album.busy = true;
    const btn = $('#btn-album-generate');
    btn.disabled = true; btn.textContent = '⏳ 기획 중…';
    const refLabel = presetObj ? ` · 참조 ${presetObj.title}` : '';
    albumStatus(`${tx('astat.planning', '기획 생성 중')} — ${window.SunoAI.PROVIDER_LABEL[ai.provider]}${refLabel}`);
    try {
      const out = await window.SunoAI.generateAlbum({
        provider: ai.provider, apiKey, model: ai.model, album: payload,
      });
      // Sanitize Korean characters out of every track's Style before storing
      if (Array.isArray(out.tracks)) {
        out.tracks.forEach(t => { if (t && t.style) t.style = sanitizeStyleString(t.style); });
      }
      if (out.baseStyle) out.baseStyle = sanitizeStyleString(out.baseStyle);
      album.result = { ...payload, ...out, id: Date.now() };
      renderAlbum();
      albumStatus(`${tx('astat.done.plan', '✅ 12곡 기획 완료')} — ${out.tracks.length}${tx('albums.tracks.suffix', '곡')} ${tx('astat.loaded', '로드됨')}${refLabel}`, 'green');
    } catch (e) {
      albumStatus('❌ ' + e.message, 'red');
    } finally {
      album.busy = false;
      btn.disabled = false; btn.textContent = '🎵 앨범 기획 생성 (12곡)';
    }
  }

  function renderAlbum() {
    if (!album.result) {
      $('#album-empty').classList.remove('hidden');
      $('#album-result').classList.add('hidden');
      return;
    }
    const r = album.result;
    $('#album-empty').classList.add('hidden');
    $('#album-result').classList.remove('hidden');
    $('#album-title').textContent = r.albumTitle || '(no title)';
    $('#album-summary').textContent = r.summary || '';
    const meta = [];
    if (r.cat && r.cat !== 'all') meta.push(r.cat === 'korean' ? tx('cat.kpop', '🇰🇷 한국 가요') : tx('cat.gpop', '🌍 POP'));
    if (r.era) meta.push(tdx(eraLabel(r.era)));
    if (r.arc) meta.push({journey:tx('arc.journey','감정 여정'), story:tx('arc.story','스토리 아크'), thematic:tx('arc.thematic','테마 통일'), variety:tx('arc.variety','버라이어티'), seasons:tx('arc.seasons','사계절'), day:tx('arc.day','하루')}[r.arc] || r.arc);
    if (typeof r.englishPct === 'number') meta.push(r.englishPct === 0 ? `${tx('lbl.ko','한글')} 100%` : r.englishPct === 100 ? `${tx('lbl.en','영문')} 100%` : `${tx('lbl.ko','한글')} ${100-r.englishPct}% · ${tx('lbl.en','영문')} ${r.englishPct}%`);
    $('#album-meta').textContent = meta.join(' · ');

    $('#album-tracks').innerHTML = r.tracks.map((t, i) => {
      const fullStyle = trackFullStyle(t);
      return `
      <div class="track-card ${t.lyrics ? 'has-lyrics' : ''}" data-idx="${i}">
        <div class="track-no-block">
          <span class="track-no">${String(t.no).padStart(2, '0')}</span>
          ${t.bpm ? `<span class="track-bpm">${t.bpm} BPM</span>` : ''}
        </div>
        <div class="track-body">
          <div class="track-title-row">
            <span class="track-title">${escapeHtml(t.title)}</span>
            ${t.mood ? `<span class="track-mood">${escapeHtml(moodLabel(t.mood))}</span>` : ''}
          </div>
          ${t.hook ? `<div class="track-hook">${escapeHtml(t.hook)}</div>` : ''}
          ${fullStyle ? `<div class="track-style-line">${escapeHtml(fullStyle.slice(0, 220))}${fullStyle.length > 220 ? '…' : ''}</div>` : ''}
          <div class="track-actions">
            <button class="btn-primary" data-track-lyrics="${i}">${t.lyrics ? tx('track.btn.regen', '🔄 가사 재생성') : tx('track.btn.gen', '📝 가사 생성')}</button>
            <button class="btn-secondary" data-track-to-builder="${i}">${tx('track.btn.tobuilder', '🎼 빌더로')}</button>
            <button class="btn-ghost" data-copy-title="${i}" title="${tx('track.copy.title.tip', '노래 제목만 복사')}">${tx('track.btn.title', '📋 제목')}</button>
            <button class="btn-ghost" data-copy-style="${i}" title="${tx('track.copy.style.tip', 'Style 프롬프트만 복사')}">📋 Style</button>
            ${t.lyrics ? `<button class="btn-ghost" data-copy-lyrics="${i}" title="${tx('track.copy.lyrics.tip', '가사만 복사')}">${tx('track.btn.lyrics', '📋 가사')}</button>` : ''}
            ${t.lyrics ? `<button class="btn-ghost" data-copy-all="${i}" title="${tx('track.copy.all.tip', '제목 + Style + 가사 한꺼번에 복사')}">${tx('track.btn.all', '📋 전체')}</button>` : ''}
          </div>
          ${t.lyrics ? `<div class="track-lyrics">${escapeHtml(normalizeLyrics(t.lyrics))}</div>` : ''}
        </div>
      </div>`;
    }).join('');

    $$('#album-tracks [data-track-lyrics]').forEach(b => b.addEventListener('click',
      () => generateTrackLyrics(parseInt(b.dataset.trackLyrics, 10))));
    $$('#album-tracks [data-track-to-builder]').forEach(b => b.addEventListener('click',
      () => sendTrackToBuilder(parseInt(b.dataset.trackToBuilder, 10))));
    $$('#album-tracks [data-copy-title]').forEach(b => b.addEventListener('click', () =>
      copyText(r.tracks[parseInt(b.dataset.copyTitle, 10)].title || '')));
    $$('#album-tracks [data-copy-style]').forEach(b => b.addEventListener('click', () =>
      copyText(trackFullStyle(r.tracks[parseInt(b.dataset.copyStyle, 10)]) || '')));
    $$('#album-tracks [data-copy-lyrics]').forEach(b => b.addEventListener('click', () =>
      copyText(normalizeLyrics(r.tracks[parseInt(b.dataset.copyLyrics, 10)].lyrics || ''))));
    $$('#album-tracks [data-copy-all]').forEach(b => b.addEventListener('click', () => {
      const t = r.tracks[parseInt(b.dataset.copyAll, 10)];
      copyText(`# ${t.title}\n\n[STYLE]\n${trackFullStyle(t)}\n\n[LYRICS]\n${normalizeLyrics(t.lyrics)}`);
    }));
  }

  // Per-track style is now the source of truth. Older saved albums used
  // baseStyle + styleDelta — fall back to that shape if present.
  function trackFullStyle(t) {
    if (t.style && t.style.trim()) return t.style.trim();
    const base = album.result?.baseStyle || '';
    const delta = t.styleDelta || '';
    return delta ? `${base}, ${delta}` : base;
  }

  async function generateTrackLyrics(which) {
    if (!album.result) return;
    if (album.busy) return;
    if (!ai.cryptoKey) { albumStatus(tx('status.ai.unlock', '먼저 ⚙️ 설정에서 API 키를 잠금 해제하세요'), 'red'); openSettings(); return; }
    let apiKey;
    try { apiKey = await window.SunoVault.getKey(ai.cryptoKey, ai.provider); }
    catch (e) { albumStatus(`${tx('status.decrypt.fail', '키 복호화 실패')}: ${e.message}`, 'red'); return; }
    if (!apiKey) { albumStatus(tx('aistat.nokey', 'API 키가 없습니다'), 'red'); openSettings(); return; }

    const idxs = which === 'all'
      ? album.result.tracks.map((_, i) => i)
      : [which];
    album.busy = true;
    for (let n = 0; n < idxs.length; n++) {
      const i = idxs[n];
      const t = album.result.tracks[i];
      albumStatus(`(${n+1}/${idxs.length}) ${t.title} — ${tx('astat.lyrics.gen', '가사 생성 중…')}`);
      // Use the ALBUM panel options (전체·개별 양쪽 모두 같은 옵션 셋 사용)
      const opts = getAlbumGenOptions();
      const ctx = {
        lang: { mode: opts.englishPct === 0 ? 'ko' : opts.englishPct === 100 ? 'en' : 'mixed', koreanPct: 100 - opts.englishPct, englishPct: opts.englishPct },
        metaphorPct: opts.metaphorPct,
        rapPct: opts.rapPct,
        sectionCues:  opts.sectionCues,
        callResponse: opts.callResponse,
        harmonies:    opts.harmonies,
        arrangementStyle: opts.arrangementStyle,
        refArtist: { style: trackFullStyle(t), era: album.result.era || '', genre: album.result.cat || '', structure: '' },
        workingTitle: t.title,
      };
      const userPrompt = `${album.result.albumTitle} — Track ${t.no} "${t.title}".
Theme: ${t.hook || album.result.summary}
Mood: ${t.mood || 'free'}.
Keep the existing title "${t.title}" — do not invent a new one.`;
      try {
        const out = await window.SunoAI.generate({
          provider: ai.provider, apiKey, model: ai.model,
          userPrompt, context: ctx,
        });
        t.lyrics = normalizeLyrics(out.lyrics || '');
        // title preserved per instructions; refresh card incrementally
        renderAlbum();
      } catch (e) {
        albumStatus(`❌ Track ${t.no}: ${e.message}`, 'red');
        break;
      }
    }
    album.busy = false;
    if (album.result.tracks.every(t => t.lyrics)) {
      albumStatus(tx('astat.lyrics.all.done', '✅ 모든 트랙 가사 생성 완료'), 'green');
    } else if (which !== 'all') {
      albumStatus(tx('astat.lyrics.done', '✅ 가사 생성 완료'), 'green');
    }
  }

  function sendTrackToBuilder(i) {
    if (!album.result) return;
    const t = album.result.tracks[i];
    $('#song-title').value = t.title || '';
    const style = trackFullStyle(t);
    state.chips = dedupeTags(style.split(',').map(stripStyleBrackets))
      .map(tag => ({ tag, source: 'album' }));
    $('#lyrics-out').value = t.lyrics || '';
    state.englishPct = album.englishPct;
    applyLangUI();
    // Album tracks bring their own style — wipe stale artist context so
    // AI generation can't drag a previously-loaded preset's refArtist
    // into the lyric prompt and overwrite this track's curated chips.
    state.selectedArtist = null;
    state.activeVariantView = null;
    const fill = $('#ai-fill-style'); if (fill) fill.checked = false;
    setStyleFillLock(false);
    renderChips(); renderStyleOut(); renderCurrentMeta(); updateStats();
    setTab('builder');
    toast(`🎼 ${t.title} → ${tx('toast.to.builder', '빌더')}`);
  }

  function saveAlbum() {
    if (!album.result) return;
    const name = prompt(tx('prompt.album.name', '앨범 이름을 입력하세요'), album.result.albumTitle);
    if (!name) return;
    // Snapshot the entire form state so a later load fully restores it
    const formState = {
      concept:    $('#album-concept').value,
      cat:        $('#album-cat').value,
      era:        $('#album-era').value,
      styleGroup: $('#album-style-group').value,
      preset:     $('#album-preset').value,
      arc:        $('#album-arc').value,
      moods:      Array.from(album.moods),
      englishPct: album.englishPct,
      lyricOpts: {
        lang:  parseInt($('#album-opt-lang')?.value || '0', 10),
        meta:  parseInt($('#album-opt-meta')?.value || '50', 10),
        rap:   parseInt($('#album-opt-rap')?.value || '0', 10),
        cues:  $('#album-opt-cues')?.checked,
        cr:    $('#album-opt-cr')?.checked,
        harm:  $('#album-opt-harm')?.checked,
        arr:   $('#album-opt-arr')?.value || 'auto',
      },
    };
    album.saved.unshift({
      ...album.result,
      name,
      savedAt: new Date().toISOString(),
      formState,
    });
    persistAlbums();
    renderSavedAlbums();
    toast(tx('toast.album.saved', '앨범 저장됨'));
  }

  function restoreAlbumFormState(fs) {
    if (!fs) return;
    const set = (sel, v) => { const el = $(sel); if (el != null && v != null) el.value = v; };
    set('#album-concept',     fs.concept);
    set('#album-cat',         fs.cat);
    set('#album-era',         fs.era);
    set('#album-style-group', fs.styleGroup);
    set('#album-preset',      fs.preset);
    set('#album-arc',         fs.arc);
    // Mood chips
    if (Array.isArray(fs.moods)) {
      album.moods = new Set(fs.moods);
      $$('#album-mood-chips .cat-chip').forEach(c => {
        c.classList.toggle('active', album.moods.has(c.dataset.mood));
      });
    }
    if (typeof fs.englishPct === 'number') {
      album.englishPct = fs.englishPct;
      const ls = $('#album-lang-slider');
      if (ls) { ls.value = fs.englishPct; ls.style.setProperty('--pct', fs.englishPct + '%'); }
      const lr = $('#album-lang-readout');
      if (lr) {
        const en = fs.englishPct;
        lr.textContent = en === 0 ? `${tx('lbl.ko','한글')} 100%` : en === 100 ? `${tx('lbl.en','영문')} 100%` : `${tx('lbl.ko','한글')} ${100 - en}% · ${tx('lbl.en','영문')} ${en}%`;
      }
    }
    if (fs.lyricOpts) {
      const lo = fs.lyricOpts;
      const setSlider = (sel, v) => { const s = $(sel); if (s && typeof v === 'number') { s.value = v; s.dispatchEvent(new Event('input')); } };
      const setCb = (sel, v) => { const c = $(sel); if (c && typeof v === 'boolean') c.checked = v; };
      setSlider('#album-opt-lang', lo.lang);
      setSlider('#album-opt-meta', lo.meta);
      setSlider('#album-opt-rap',  lo.rap);
      setCb('#album-opt-cues', lo.cues);
      setCb('#album-opt-cr',   lo.cr);
      setCb('#album-opt-harm', lo.harm);
      set('#album-opt-arr', lo.arr);
      const arrOn = !!(lo.cr || lo.harm);
      $('#album-arr-row')?.classList.toggle('hidden', !arrOn);
    }
  }

  function renderSavedAlbums() {
    const list = $('#album-saved-list');
    if (!album.saved.length) {
      list.innerHTML = `<p class="text-xs text-slate-500">${tx('albums.saved.empty', '저장된 앨범이 없습니다.')}</p>`;
      return;
    }
    const en = window.SU_LANG && window.SU_LANG() === 'en';
    list.innerHTML = album.saved.map((a, i) => `
      <div class="album-saved-item" data-saved="${i}">
        <span class="album-saved-name">💿 ${escapeHtml(a.name || a.albumTitle)}</span>
        <span class="album-saved-meta">${a.tracks.length}${tx('albums.tracks.suffix', '곡')} · ${new Date(a.savedAt).toLocaleDateString(en ? 'en-US' : 'ko-KR')}</span>
        <button class="btn-ghost" data-saved-del="${i}" title="${tx('aria.remove', '삭제')}">×</button>
      </div>`).join('');
    $$('#album-saved-list .album-saved-item').forEach(item => item.addEventListener('click', e => {
      if (e.target.closest('[data-saved-del]')) return;
      const a = album.saved[parseInt(item.dataset.saved, 10)];
      album.result = a;
      renderAlbum();
      // Restore the full form state if the album was saved with it,
      // otherwise fall back to the legacy concept-only restore.
      if (a.formState) restoreAlbumFormState(a.formState);
      else $('#album-concept').value = a.concept || '';
      toast(`${tx('toast.loaded', '불러옴')}: ${a.name || a.albumTitle}`);
    }));
    $$('#album-saved-list [data-saved-del]').forEach(b => b.addEventListener('click', () => {
      if (!confirm(tx('confirm.delete.album', '이 앨범을 삭제할까요?'))) return;
      album.saved.splice(parseInt(b.dataset.savedDel, 10), 1);
      persistAlbums();
      renderSavedAlbums();
    }));
  }

  function exportAlbum() {
    if (!album.result) return;
    const r = album.result;
    const name = safeFilename(r.albumTitle || r.name, 'album');
    const path = `${APP_DIR}/${name}.json`;
    // Single album-level JSON file containing all 12 tracks (concept,
    // arrangement options, per-track title/style/structure/lyrics). The
    // matching import handler reads the same shape back.
    downloadJSON(r, path);
    const n = (r.tracks || []).length;
    toast(`📤 Downloads/${path} · ${tx('toast.album.exported.suffix', '앨범 1개 · {n}곡 포함').replace('{n}', n)}`);
  }

  // ====================================================================
  // boot
  // ====================================================================
  // Theme switch — 3-state segmented: dark · graphite · light
  (function initTheme() {
    const root = document.documentElement;
    const seg  = document.getElementById('theme-seg');
    const lbl  = document.getElementById('theme-label');
    const LABELS = { dark: tx('theme.dark', '다크 모드'), graphite: 'Warm Sand', light: tx('theme.light', '라이트 모드') };
    function apply(t) {
      if (t === 'dark') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', t);
      if (lbl) lbl.textContent = LABELS[t] || '테마';
      if (seg) seg.querySelectorAll('.seg-btn').forEach(b => {
        b.setAttribute('aria-pressed', b.dataset.themeVal === t ? 'true' : 'false');
      });
    }
    // legacy values: 'dark' | 'light'  →  unchanged. New: 'graphite'.
    const saved = localStorage.getItem('su_theme') || 'dark';
    apply(['dark', 'graphite', 'light'].includes(saved) ? saved : 'dark');
    if (seg) seg.addEventListener('click', e => {
      const btn = e.target.closest('.seg-btn');
      if (!btn) return;
      const next = btn.dataset.themeVal;
      apply(next);
      localStorage.setItem('su_theme', next);
    });
  })();

  // ====================================================================
  // i18n — Korean (default) / English UI toggle. Tier 1 covers the
  // chrome: sidebar tabs, top bar, workflow chart, builder panel
  // headers, and the high-traffic primary action buttons. Help guide
  // and FAQ stay Korean for now (Tier 2). Catalog data (artist names,
  // Suno tags, presets) is naturally bilingual already.
  // ====================================================================
  (function initLang() {
    const STRINGS = {
      ko: {
        // Sidebar tabs
        'tab.builder': '빌더', 'tab.album': '앨범', 'tab.artists': '프리셋',
        'tab.search': '검색', 'tab.search.tip': 'AI 기반 검색',
        'tab.dance': '댄싱 머신', 'tab.guide': '가이드',
        'tab.presets': '저장됨',
        // Footer / sidebar bottom controls
        'footer.lang': '언어', 'footer.theme': '테마', 'footer.split': '분할 모드',
        'footer.suno': 'Suno 열기',
        'footer.suno.tip': 'Suno AI 를 분할 화면 옆에 띄움 (분할 모드일 때는 화면 우측 절반 위치로 자동)',
        'footer.help': '사용법 가이드',
        'footer.help.tip': '앱 사용법 가이드 (단축키: ?)',
        'footer.settings': '설정',
        'footer.settings.tip': 'API 키 / 모델 설정',
        // Workflow chart
        'wf.eyebrow': '처음이라면 — 4단계로 시작하세요',
        'wf.collapse': '접기',
        'wf.expand': '펴기',
        'wf.toggle.tip': '워크플로우 접기·펴기',
        'wf.s1.title': '스타일 고르기',
        'wf.s1.desc': '빌더 우측 <b>시작점</b> 패널에서 분류 → 시대 → 프리셋 직접 선택, 또는 좌측 <b>프리셋 · 댄싱머신 · 검색</b> 탭에서 골라 <b>빌더에 로드 / 빌더로 전송</b>',
        'wf.s2.title': '제어 조정',
        'wf.s2.desc': '우측 <b>제어 (Mix Console)</b> 에서 페이더로 한·영 비율 · 시적 비유 · 보컬↔랩 조절. 콜앤리스폰스·화음 옵션과 <b>보컬 편곡 스타일</b> 도 선택',
        'wf.s3.title': '빌더에 로드 + AI 생성 <span class="workflow-pill">선택</span>',
        'wf.s3.desc': '제어 패널 하단의 <b>빌더에 로드</b> 버튼을 누르면 Style·구조·편곡 키워드가 한 번에 적용. 필요하면 중앙 <b>AI</b> 패널에 컨셉 입력 → Claude·GPT·Gemini 로 제목·가사 자동 생성',
        'wf.s4.title': 'Suno에 붙여넣기',
        'wf.s4.desc': '<b>📋 Style 복사</b> · <b>📋 Lyrics 복사</b> 로 클립보드에 → Suno AI Custom Mode 의 Style · Lyrics 필드에 각각 붙여넣고 곡 생성',
        // Panel titles
        'panel.style': 'Style', 'panel.lyrics': 'Lyrics', 'panel.ai': 'AI',
        'panel.startingpoint': '시작점', 'panel.current': '현재 선택',
        'panel.control': '제어', 'panel.palette': '팔레트',
        'panel.search': '🔍 AI 검색',
        'panel.album.saved': '💾 저장된 앨범',
        'panel.album.concept': '💿 앨범 컨셉',
        'panel.dance.styles': '200 댄스 스타일 가이드',
        'panel.dance.tags': '댄스 태그 조합기',
        'panel.guide.index': '📚 챕터 인덱스 (93)',
        'panel.presets.saved': '💾 저장된 프리셋',
        // Primary action buttons
        'btn.reset': '초기화',
        'btn.reset.tip': '제목·가사·Style 칩·슬라이더·옵션·AI 프롬프트까지 모두 기본값으로 되돌립니다',
        'btn.copy.style': '📋 Style 복사',
        'btn.copy.lyrics': '📋 Lyrics 복사',
        'btn.save.preset': '💾 프리셋으로 저장',
        'btn.load.merge': '빌더에 로드 · 제어 옵션 머지',
        'btn.load.tip': '시작점 프리셋이 선택돼 있으면 프리셋 Style + 곡 구조 + 제어 옵션을 모두 적용. 없으면 현재 칩에 콜앤리스폰스·화음·코러스·보컬 편곡 키워드만 머지.',
        // Help modal — TOC
        'toc.overview': '개요', 'toc.workflow': '워크플로우', 'toc.quickstart': '빠른 시작',
        'toc.builder': '빌더', 'toc.album': '앨범', 'toc.dance': '댄싱 머신',
        'toc.presets': '프리셋', 'toc.search': '검색',
        'toc.design': '디자인·테마', 'toc.sanitize': '자동 정제', 'toc.backup': '백업·저장',
        'toc.security': '보안', 'toc.shortcuts': '단축키', 'toc.faq': 'FAQ',
        'toc.versions': '버전 히스토리',
        // Help modal — section h3
        'h3.overview': '🎯 개요 — SU-Note는 무엇인가',
        'h3.workflow': '🗺️ 4단계 워크플로우',
        'h3.quickstart': '🚀 빠른 시작 (3분)',
        'h3.builder': '🎼 빌더 — 단일 곡 만들기 (상세 매뉴얼)',
        'h3.album': '💿 앨범 기획 — 12곡 한 번에',
        'h3.dance': '🎯 댄싱 머신 — 200 댄스 스타일 + 태그 조합기',
        'h3.presets': '🎤 프리셋 — 아티스트별 3가지 대표곡 스타일',
        'h3.search': '🔍 검색 — 자유 텍스트 발견 (학습 데이터 / 웹 검색 선택)',
        'h3.design': '🎨 디자인 · 테마 · 레이아웃 모드',
        'h3.sanitize': '🧹 자동 정제 — Suno 영문 토큰화 보장',
        'h3.backup': '💾 백업 · 저장 — 위치와 안전한 보관',
        'h3.security': '🔐 보안 — API 키 저장 방식',
        'h3.shortcuts': '⌨️ 단축키 · 기타 팁',
        'h3.faq': '❓ 자주 묻는 질문 (FAQ)',
        'h3.versions': '📜 버전 히스토리',
        // Help modal — card h4
        'h4.builder.title': '① 노래 제목 (상단 Hero 입력칸)',
        'h4.builder.style': '② Style 패널 (중앙)',
        'h4.builder.lyrics': '③ Lyrics 패널 (중앙)',
        'h4.builder.ai': '④ AI 생성 패널 (중앙 하단)',
        'h4.builder.start': '⑤-1 시작점 패널 (우측 사이드바 상단 — 자동 표시·자동 숨김)',
        'h4.builder.current': '⑤-2 현재 선택 패널 (시작점 아래 — 항상 읽기 전용)',
        'h4.builder.control': '⑥ 제어 패널 (우측 사이드바 중앙 — Mix Console)',
        'h4.builder.palette': '⑦ 팔레트 패널 (우측 사이드바 하단)',
        'h4.dance.left': '좌측 — 200 댄스 스타일 가이드',
        'h4.dance.right': '우측 — 댄스 태그 조합기 (210 태그)',
        'h4.search.provider': 'Provider 선택 (패널 헤더 우측 탭)',
        'h4.search.web': '🌐 웹 검색 체크박스 (기본 OFF)',
        'h4.search.input': '입력 형태 — 3 가지 자유롭게',
        'h4.search.korean': '🇰🇷 한국어 (한글 음역) 검색 지원',
        'h4.search.output': 'AI 출력',
        'h4.search.use': '결과 활용',
        'h4.search.notes': '제약·참고',
        'h4.design.theme': '① 3 단 컬러 테마 (좌측 사이드바 하단 세그먼티드 컨트롤)',
        'h4.design.split': '② 분할 모드 (좌측 사이드바 하단 토글 + "Suno 열기" 버튼)',
        'h4.design.mobile': '③ 모바일 모드 (≤900px 자동 활성)',
        'h4.design.contrast': '④ 시인성 강조 요소',
        'h4.sanitize.korean': '① 한국어 음악 용어 → 영문 치환',
        'h4.sanitize.names': '② 아티스트·프로듀서·밴드멤버 이름 → 역할 라벨',
        'h4.sanitize.lang': '③ 언어 지시 자동 제거',
        'h4.sanitize.blank': '④ 가사 섹션 빈 줄 자동 삽입',
        'h4.sanitize.dedup': '⑤ 중복 era / genre 꼬리 태그 자동 제거',
        'h4.sanitize.sort': '⑥ Suno 적용도 기반 칩 자동 정렬',
        'h4.backup.auto': '① 자동 저장 (실시간) — localStorage',
        'h4.backup.manual': '② 수동 백업 (파일) — Downloads/suno_prompt_manager/',
        'h4.backup.restore': '③ 가져오기 (복원·이전)',
        'h4.backup.routine': '④ 추천 백업 루틴',
        // FAQ questions
        'faq.q.fill': 'Style 채우기 체크가 꺼져있어요',
        'faq.q.artistname': '아티스트명이 Suno 로 전달되나요?',
        'faq.q.lyricslang': '가사가 한글로 안 나와요',
        'faq.q.dupechip': '같은 칩이 두 번 들어가요',
        'faq.q.korstyle': 'Style 에 한글 (트로트 · 발라드) 이 보여요',
        'faq.q.namesinstyle': 'Style 에 아티스트 이름이 보여요 (예: McCartney · Bradley Cooper)',
        'faq.q.langdirective': 'Style 에 "in English / in Korean" 같은 표현이 들어가요',
        'faq.q.startpanel': '시작점 패널이 안 보여요',
        'faq.q.chipsort': '칩 순서가 자동으로 바뀌어요',
        'faq.q.reddot': '칩에 빨간 도트가 나오는 태그는 지워야 하나요?',
        'faq.q.addbtn': '"Style에 키워드 추가" 버튼이 사라졌어요',
        'faq.q.loaddual': '"빌더에 로드" 버튼이 두 가지 모드로 동작한다는데?',
        'faq.q.tabreset': '탭 전환할 때 빌더·앨범 작업 상태가 유지되나요?',
        'faq.q.korsearch': '해외 아티스트를 한글로 검색해도 되나요?',
        'faq.q.blanklines': '가사 섹션 사이에 빈 줄이 자동으로 들어가요',
        'faq.q.dancenotfound': '200 댄스 스타일에 원하는 게 없어요',
        'faq.q.albumslow': '앨범 12곡 가사 일괄 생성이 너무 느려요',
        'faq.q.aimismatch': 'AI 가 만든 가사가 제 의도와 달라요',
        'faq.q.offline': '오프라인에서 동작하나요?',
        'faq.q.instrumental': '가사 없는 연주곡을 만들고 싶어요',
        'faq.q.titlelang': '제목만 다른 언어로 만들고 싶어요 (예: 한국어 가사 + 영문 제목)',
        'faq.q.autopaste': '분할 모드에서 SU-Note 가 Suno 입력란에 직접 붙여넣을 수 있나요?',
        'faq.q.wfsplit': '분할 모드 ON / OFF 시 워크플로우 차트가 사라져요',
        'faq.q.aistyle': '댄싱머신 / 저장된 프리셋을 빌더로 보냈더니 AI 가 엉뚱한 스타일로 가사를 써요',
        'faq.q.shortinstr': 'Suno 가 연주곡인데 90초로 잘려 나와요',
        'faq.q.storage': '제 데이터는 어디 보관되나요?',
        'faq.q.mobile': '모바일에서도 쓸 수 있나요?',
        'faq.q.lost': '저장한 프리셋·앨범이 갑자기 사라졌어요',
        'faq.q.transfer': '다른 PC·브라우저로 작업을 옮기고 싶어요',
        // Builder AI panel
        'ai.prompt.ph': '어떤 곡을 만들고 싶나요? (예: 1980년대 신스웨이브 발라드, 첫사랑 회상)',
        'ai.opt.title': '제목',
        'ai.opt.instrumental': '🎺 연주곡',
        'ai.opt.context': '컨텍스트',
        'ai.lock': '프리셋 보호 중',
        'ai.lock.tip': '프리셋의 Excel 원본 Style이 덮어써지지 않도록 잠긴 상태. 클릭하면 AI가 새로 작성.',
        'ai.instr.tip': '가사 없이 연주곡으로 생성. AI 가 Lyrics 칸에 sung/rap 없이 [Intro] · [Verse: 음악 큐] · [Chorus] · [Bridge] · [Outro] 같은 섹션 로드맵 + --- 마커만 작성 (Suno 의 권장 instrumental 패턴 — 빈 칸은 단조로운 루프가 되기 쉬움). Style 에 instrumental 태그 자동 삽입.',
        'ai.titlelang.tip': 'AI 가 만들 제목의 언어. Auto 는 가사 언어 페이더를 따름.',
        'ai.title.lang.ko': '한국어',
        'ai.title.lang.ja': '日本語',
        'ai.title.lang.latin': 'Latin·다국어',
        'ai.generate': '생성',
        'ai.stop': '중지',
        // Starting point hint
        'startpoint.hint': '분류 → 시대 → 프리셋',
        // Search panel
        'search.web': '🌐 웹 검색 사용',
        'search.web.tip': '각 provider 의 네이티브 웹 검색 도구로 실시간 정보 조회. 끄면 AI 의 학습 데이터만 사용 (빠르고 저렴, 단 최신 정보 부정확 가능)',
        'search.input.ph': '예: Coldplay · 강남스타일 · BTS - Dynamite · 아이유 좋은 날 · Bohemian Rhapsody',
        'search.btn': '검색',
        'search.examples': '예시:',
        // Settings modal
        'settings.title': '⚙️ API 키 & 모델 설정',
        'settings.warning': '⚠️ API 키는 이 브라우저의 자동 생성된 디바이스 키로 AES-GCM 256bit 암호화되어 <b>localStorage</b> 에만 저장됩니다. 외부 서버로 전송되지 않습니다. 쿠키 및 사이트 데이터 삭제 / 시크릿 모드 종료 / 프로필 재설정 시 함께 사라지므로, 그 경우엔 다시 키를 입력하면 됩니다.',
        'settings.provider': '기본 제공업체',
        'settings.model': '모델 (가사 생성용 추천)',
        'settings.key.anthropic': '🤖 Anthropic API Key',
        'settings.key.openai': '💬 OpenAI API Key',
        'settings.key.google': '🔮 Google AI Studio Key (Gemini)',
        'settings.save': '💾 암호화 저장',
        'settings.test': '🔌 연결 테스트',
        'settings.purge': '🗑️ 전체 초기화',
        'settings.model.custom': '✏️ 직접 입력 (custom)',
        // Hero / top inputs
        'hero.title.ph': '노래 제목 (예: 첫눈에 / First Snow / 별의 노래)',
        'btn.skeleton': '기본 골격',
        'btn.skeleton.tip': '한국 가요 기본 가사 구조 골격을 가사 영역에 삽입합니다',
        // Mix Console (제어)
        'ctl.subtitle': '가사 생성 설정',
        'ctl.lang': '가사 언어',
        'ctl.lang.ko': '한글', 'ctl.lang.en': 'EN',
        'ctl.metaphor': '시적 비유',
        'ctl.metaphor.direct': '직설', 'ctl.metaphor.balanced': '균형', 'ctl.metaphor.poetic': '시적',
        'ctl.rap': '보컬 ↔ 랩',
        'ctl.rap.vocal': '보컬', 'ctl.rap.mix': '혼합', 'ctl.rap.rap': '랩',
        'ctl.bpm': 'BPM 자동 감지 표시',
        'ctl.cues': '섹션별 음악 지시 포함',
        'ctl.cr': '콜 앤 리스폰스 (Lead↔Crowd)',
        'ctl.harm': '화음·코러스 (layered)',
        'ctl.pitch': '🎚️ 고음 억제 (저음역·차분)',
        'ctl.pitch.tip': 'cinematic·epic·emotional 같은 고음 유발 태그를 빼고 restrained·intimate·controlled·low-register 를 더해 저음역·차분한 보컬로 유도',
        'ctl.arrange': '보컬 편곡 스타일',
        'ctl.arrange.auto': 'Auto (현재 Style에 맞춤)',
        'ctl.arrange.kpop': 'K-Pop 화음 — 에어리 레이어',
        'ctl.arrange.idol': 'K-Pop 아이돌 떼창',
        'ctl.arrange.stadium': 'Stadium Rock (Coldplay · U2)',
        'ctl.arrange.gospel': 'Black Gospel',
        'ctl.arrange.edm': 'EDM Festival',
        'ctl.arrange.anison': 'J-Pop · Anison Unison',
        'ctl.arrange.punk': 'Punk Gang Vocals',
        'ctl.handoff': '시작점 프리셋 + 제어 설정을 한 번에 적용 — 외부 탭 (검색·댄싱머신·태그) 에서 가져온 칩에는 <b>제어 옵션만 머지</b>',
        // Album planner — concept form
        'album.concept': '📝 앨범 주제 / 컨셉 (필수)',
        'album.concept.ph': '예: 도시 청춘의 사계절 — 봄에 만나 겨울에 헤어진 사랑의 12장면',
        'album.cat': '🏷️ 분류',
        'album.cat.all': '전체', 'album.cat.kr': '🇰🇷 한국 가요', 'album.cat.pop': '🌍 POP',
        'album.era': '🗓️ 시대 / 톤',
        'album.group': '🎯 스타일 그룹 (옵션)',
        'album.preset': '🎵 레퍼런스 프리셋 (선택)',
        'album.frombuilder': '📥 현재 빌더 선택 가져오기',
        'album.mood': '😶 무드 (다중)',
        'album.arc': '📚 앨범 흐름 (Concept Arc)',
        'album.arc.journey': '감정 여정 (만남 → 절정 → 이별 → 회복)',
        'album.arc.story': '스토리 아크 (시간 순 12장면)',
        'album.arc.thematic': '테마 통일 (하나의 무드)',
        'album.arc.variety': '버라이어티 (장르·무드 다양)',
        'album.arc.seasons': '사계절 (봄 3 · 여름 3 · 가을 3 · 겨울 3)',
        'album.arc.day': '하루의 흐름 (새벽 → 낮 → 저녁 → 밤)',
        'album.lang': '🌐 가사 언어',
        'album.btn.generate': '🎵 앨범 기획 생성 (12곡)',
        'album.btn.reset': '🗑️ 전체 초기화',
        'album.btn.reset.tip': '앨범 컨셉·프리셋·옵션·12곡 트랙·가사까지 모두 기본값으로 되돌립니다',
        'album.opts': '🎚️ 가사 생성 옵션',
        'album.opts.note': '— 일괄·개별 생성 모두에 적용',
        'album.meta': '🎭 시적 비유 · 은유 강도',
        'album.rap': '🎤 보컬 ↔ 랩 비율',
        'album.opt.cues': '🎬 섹션별 음악 지시 포함',
        'album.opt.cr': '🎙️ 콜 앤 리스폰스',
        'album.opt.harm': '🎶 메인 보컬 + 화음·코러스',
        'album.arr': '🎤 보컬 편곡 스타일',
        'album.arr.auto': '자동 (현재 Style에 맞춤)',
        'album.arr.kpop': '🇰🇷 K-Pop 화음',
        'album.arr.idol': '🪩 K-Pop 아이돌 떼창',
        'album.arr.stadium': '🏟️ 스타디움 록 (Coldplay·U2)',
        'album.arr.gospel': '⛪ 블랙 가스펠 합창',
        'album.arr.edm': '🎉 EDM 페스티벌',
        'album.arr.anison': '🎌 일본 애니송 유니즌',
        'album.arr.punk': '🤘 펑크 갱 보컬',
        'album.arr.inject': '💡 12곡 전체 Style에 보컬 편곡 키워드 추가',
        'album.arr.inject.tip': '12곡 전체의 Style 필드에 선택된 편곡 스타일의 Suno-tested 키워드를 추가합니다',
        // Dance machine
        'dance.subtitle': 'PDF 108 + 확장 92 = 200',
        'dance.q.ph': '🔍 스타일·한글·영문·BPM 검색',
        'dance.bpm.all': 'BPM (전체)',
        'dance.bpm.110': '~110 BPM (다운템포)',
        'dance.bpm.125': '110-125 (트로피컬·디스코)',
        'dance.bpm.135': '125-135 (하우스·테크노)',
        'dance.bpm.145': '135-145 (트랜스·하드)',
        'dance.bpm.160': '145-160 (하드스타일·해피하드)',
        'dance.bpm.200': '160-200+ (D&B·하드코어)',
        'dance.cardhint': '카드 클릭 시 우측의 빌더에 자동 로드 / Style 복사',
        'dance.combinerhint': '카테고리별 태그를 클릭해 Style을 즉시 조립. 좌측 스타일 가이드 카드를 클릭하면 베이스 스타일이 자동으로 시드됩니다.',
        'dance.seed': '베이스 스타일 (시드)',
        'dance.seed.ph': '좌측에서 댄스 스타일을 클릭하거나 직접 입력',
        'dance.picked': '선택된 태그',
        'dance.final': '조합된 최종 Style',
        'dance.final.ph': '베이스 시드 + 선택한 태그가 콤마로 결합되어 표시됩니다',
        'dance.send': '빌더로 보내기',
        'dance.reset.tip': '시드와 선택된 태그를 모두 비웁니다',
        // Toasts
        'toast.copied': '복사됨',
        'toast.dupe': '이미 추가됨',
        'toast.preset.saved': '프리셋 저장됨',
        'toast.bad.json': '잘못된 JSON 파일',
        'toast.vault.reset': 'Vault 초기화',
        'toast.ai.done': 'AI 생성 완료',
        'toast.no.presets': '내보낼 프리셋이 없습니다',
        'toast.no.albums': '저장된 앨범이 없습니다',
        'toast.album.saved': '앨범 저장됨',
        'toast.album.exported.suffix': '앨범 1개 · {n}곡 포함',
        'toast.albums.cleared': '저장된 앨범 전체 삭제됨',
        'toast.settings.saved': '설정 저장됨',
        'toast.builder.reset': '🗑️ 빌더 초기화 완료',
        'toast.no.controls': '제어 옵션이 모두 꺼져 있어 추가할 키워드가 없습니다',
        // Confirms
        'confirm.builder.reset': '빌더의 모든 작업을 초기화할까요?\n— 노래 제목, 가사, Style 칩, 슬라이더, 옵션, AI 프롬프트가 모두 기본값으로 되돌아갑니다.',
        'confirm.delete.preset': '이 프리셋을 삭제할까요?',
        'confirm.delete.all.presets': '모든 프리셋을 삭제할까요?',
        'confirm.purge.vault': '저장된 모든 API 키와 설정을 삭제할까요? 되돌릴 수 없습니다.',
        'confirm.album.reset': '앨범의 모든 작업을 초기화할까요?\n— 앨범 컨셉, 프리셋 선택, 무드, 옵션, 생성된 12곡과 가사가 모두 사라집니다.',
        'confirm.delete.album': '이 앨범을 삭제할까요?',
        // Top bar / workflow tips
        'topbar.stats': 'Suno V5.5 · 648 태그 · 867 템플릿 · 200 댄스',
        // Footer
        'footer.dev': '개발자',
        'footer.official': '🌐 공식 사이트',
        'footer.disclaimer': 'ⓘ 본 도구의 아티스트명은 사용자의 음악 스타일 선택을 돕기 위한 <b>참고용 분류 라벨</b>이며, Suno에 전달되는 프롬프트에 아티스트명이 포함되지 않습니다. 이 도구는 어떠한 저작권도 침해하지 않으며, 생성되는 음악의 권리는 Suno의 이용약관에 따릅니다. 본 도구는 Suno AI와 무관한 비공식 보조 도구입니다.',
        // Stats template — used by renderStats(); {tags}/{templates}/{artists}/{dance} substituted at render time
        'stats.tmpl': 'Suno V5.5 · {tags} 태그 · {templates} 템플릿 · {dance} 댄스',
        'wf.tip1': '💡 <b>자동 정제</b> ─ Style 에서 한국어 · 아티스트명 · 언어 지시 (in English 등) 가 모두 자동 제거되어 Suno 영문 토큰화에 최적화. 가사는 섹션 사이에 빈 줄이 자동 삽입됩니다.',
        'wf.tip2': '💡 <b>다른 기능</b> ─ 12곡 앨범 한번에 만들기 = <b>앨범</b> 탭 / 200 댄스 서브장르 + 태그 조합기 = <b>댄싱 머신</b> 탭 / 상세 매뉴얼 = <kbd>?</kbd> 키',
        // Style panel inline
        'style.subtitle': 'Suno Style 필드 · 권장 ~200자',
        'style.add.ph': '태그 직접 입력 후 Enter (예: 95 BPM, intimate piano)',
        'style.add.btn': '＋ 추가',
        'style.out.ph': '스타일 태그가 콤마로 결합되어 표시됩니다',
        'chips.empty': '아직 태그가 없습니다 — 팔레트/카탈로그/아티스트에서 추가하세요',
        'stat.tags': '개 태그', 'stat.sections': '개 섹션', 'stat.lines': '줄', 'stat.chars': '자',
        // Starting Point inline
        'cat.all': '전체', 'cat.korean': '한국', 'cat.pop': 'POP',
        'cat.label': '분류:',
        'cat.kpop': '🇰🇷 한국 가요', 'cat.gpop': '🌍 POP',
        'sp.era': '🗓️ 시대', 'sp.group': '🎯 스타일 그룹',
        'sp.preset': '🎵 프리셋 (템플릿·아티스트)',
        'sp.altsource': '또는 좌측 <b>프리셋</b> · <b>댄싱머신</b> · <b>검색</b> 탭에서 가져오기',
        // Current Selection
        'cs.readonly': '읽기 전용',
        'cs.empty': '위 <b class="text-accent-400">시작점</b> 패널이나 좌측 사이드바의 <b class="text-accent-400">프리셋</b> / <b class="text-accent-400">태그</b> / <b class="text-accent-400">댄싱머신</b> / <b class="text-accent-400">검색</b> 탭에서 스타일을 골라 <b>빌더에 로드 / 빌더로 전송</b> 버튼을 누르면 여기에 표시됩니다.',
        // Dropdown placeholders
        'dd.era': '시대 선택',
        'dd.group': '스타일 그룹 (선택)',
        'dd.preset': '프리셋 (선택)',
        'dd.era.album': '시대 선택 (선택)',
        'dd.era.all': '시대 (전체)',
        'dd.group.all': '스타일 그룹 (전체)',
        'dd.group.kpop': '스타일 그룹 (한국·POP 우선)',
        'dd.type.all': '유형 (전체)', 'dd.type.tpl': '📜 템플릿', 'dd.type.art': '🎤 아티스트',
        // Slider readout words
        'lbl.ko': '한글', 'lbl.en': '영문',
        'lbl.direct': '직설', 'lbl.semidirect': '거의 직설',
        'lbl.balanced': '균형', 'lbl.poetic': '시적', 'lbl.metaphorical': '시적·은유',
        'lbl.vocal': '보컬', 'lbl.rap': '랩',
        'lbl.vocalheavy': '보컬 위주', 'lbl.rapheavy': '랩 위주',
        // Reflect tooltips
        'reflect.green': '🟢 잘 됨', 'reflect.yellow': '🟡 가끔만',
        'reflect.red': '🔴 잘 안됨', 'reflect.unknown': '⚪ 데이터 없음',
        'reflect.always': '무조건', 'reflect.maybe': '비교적', 'reflect.rare': '잘 안됨',
        'chip.src': '출처', 'chip.reflect': 'Suno 적용도',
        'aria.remove': '삭제',
        // Palette
        'pal.tab.genre': '🎸 장르', 'pal.tab.mood': '🎭 분위기',
        'pal.tab.instr': '🥁 악기', 'pal.tab.vocal': '🎤 보컬',
        'pal.tab.tempo': '⏱ 템포',  'pal.tab.search': '🔍 검색',
        'pal.search.ph': '태그·설명 검색…',
        'pal.search.empty': '검색어를 입력하세요',
        'search.status.empty': '검색어를 입력하세요.',
        // Settings model custom
        'settings.model.custom.ph': '모델 ID 직접 입력 (예: gpt-5)',
        // Preset labels
        'preset.signature.2': '대표곡 2', 'preset.signature.3': '대표곡 3',
        'preset.variant': '변형', 'preset.mine': '나의 프리셋',
        'prompt.preset.name': '프리셋 이름을 입력하세요',
        'prompt.album.name': '앨범 이름을 입력하세요',
        'presets.export': '📤 JSON 내보내기',
        'presets.clearall': '전체 삭제',
        'presets.empty': '저장된 프리셋이 없습니다. 빌더에서 “이 조합을 프리셋으로 저장”을 눌러보세요.',
        // Album extra
        'album.empty': '좌측에서 앨범 컨셉을 입력하고 <b class="text-slate-300">"앨범 기획 생성"</b>을 누르면 여기에 12곡 트랙리스트가 표시됩니다.',
        'album.titlePh': '앨범 제목',
        'album.btn.save': '💾 앨범 승인 · 저장',
        'album.btn.regen': '🔄 다시 기획',
        'album.btn.lyrics12': '📝 12곡 가사 일괄 생성',
        'album.btn.export': '📤 JSON 내보내기',
        'album.import': '📥 가져오기',
        'album.import.tip': '앨범 JSON 가져오기',
        'album.clear.all': '🗑️ 전체',
        'album.clear.tip': '저장된 앨범 전체 삭제',
        'album.backup.warn': '⚠️ 브라우저 데이터 삭제 시 사라집니다. 작업 완료 후 <b>📤 JSON 내보내기</b> 로 <code>Downloads/suno_prompt_manager/&lt;앨범명&gt;/</code> 에 백업하세요.',
        // Arc labels
        'arc.journey': '감정 여정', 'arc.story': '스토리 아크',
        'arc.thematic': '테마 통일', 'arc.variety': '버라이어티',
        'arc.seasons': '사계절', 'arc.day': '하루',
        // Album moods — index aligned with ALBUM_MOOD_IDS
        'mood.0': '🌧️ 멜랑콜리', 'mood.1': '☀️ 희망적', 'mood.2': '🔥 정열', 'mood.3': '🧊 차가움', 'mood.4': '💕 따뜻함',
        'mood.5': '😢 슬픔', 'mood.6': '😡 분노', 'mood.7': '🌸 노스탤지어', 'mood.8': '⚡ 에너지', 'mood.9': '🌙 고요',
        'mood.10': '✨ 환상적', 'mood.11': '🎭 드라마틱', 'mood.12': '🎉 흥겨움', 'mood.13': '🌊 평온', 'mood.14': '💔 이별',
        // Status messages
        'status.devkey.fail': '디바이스 키 초기화 실패',
        'status.decrypt.fail': '키 복호화 실패',
        'status.saved': '저장 완료 (암호화됨)',
        'status.enter.key': '해당 제공업체의 API 키를 입력하세요',
        'status.purged': '초기화 완료 — 새 디바이스 키 생성됨',
        'status.purge.fail': '초기화 후 키 재생성 실패',
        'status.ai.prompt': '프롬프트를 입력하세요',
        'status.ai.unlock': '먼저 ⚙️ 설정에서 API 키를 잠금 해제하세요',
        'status.album.nopreset': '빌더에 선택된 프리셋이 없습니다',
        'status.album.imported': '빌더 선택을 앨범 컨셉으로 가져옴',
        'status.album.first': '먼저 앨범을 생성하세요',
        'status.album.novocab': '보컬 편곡 키워드를 찾을 수 없습니다',
        'status.album.alreadyhas': '모든 트랙에 이미 포함되어 있습니다',
        'status.album.concept': '앨범 컨셉을 입력하거나 레퍼런스 프리셋을 선택하세요',
        'toast.pick.first': '프리셋을 먼저 선택하거나 좌측 탭에서 스타일을 가져오세요',
        'toast.loaded': '불러옴',
        // Theme labels
        'theme.dark': '다크 모드', 'theme.light': '라이트 모드',
        // Help modal header
        'help.title': '📖 SU-Note 사용 매뉴얼',
        'help.subtitle': '수-노트 · Suno AI 프롬프트 매니저 · Suno V5.5 가이드 · 648 태그 · 867 템플릿 · 200 댄스 스타일',
        // Artist / preset cards
        'art.btn.load': '빌더에 로드',
        'art.btn.copy': 'Style 복사',
        'art.empty': '조건에 맞는 프리셋이 없습니다.',
        'art.q.ph': '🔍 제목 / 스타일 / 대표곡 / 태그 검색',
        // Tag table headers + filters
        // Guide-chapter table column headers (still used by renderGuideChapter)
        'tag.col.reflect': '반영',
        'tag.col.field': '필드',
        'tag.col.tag': '태그 / 프롬프트',
        'tag.col.cat': '카테고리',
        'tag.col.desc': '설명',
        'tag.col.tip': '팁',
        'tag.items': '항목',
        // Guide page
        'guide.pick': '챕터를 선택하세요',
        // Disclaimer (Artists view)
        'disclaimer.artists': '<span class="text-accent-400 font-semibold">ⓘ 안내 (저작권)</span> &nbsp; 목록의 아티스트명은 사용자가 원하는 음악 스타일을 빠르게 찾도록 돕기 위한 <b>참고용 분류 라벨</b>일 뿐이며, 특정 아티스트의 고유한 창작물·보이스·시그니처 사운드를 재현하거나 모방하기 위한 목적이 아닙니다. 또한 본 서비스에서 추가 제공되는 태그는 특정 아티스트에 특화된 고유 표현이 아닌, 음악 장르·분위기·악기 구성·템포 등 대중적으로 널리 사용되는 <b>범용 음악 태그</b>이며, 음악 초보자들의 이해를 돕기 위한 안내 수단으로만 제공됩니다. Suno에 전달되는 Style 프롬프트와 가사에는 <b>실제 아티스트명이 포함되지 않으며</b>, 이 도구는 어떠한 저작권·퍼블리시티권·상표권도 침해할 의도가 없습니다. 생성된 음악의 권리와 이용 범위는 Suno 이용약관에 따라 <b>사용자(사용자가 직접 만든 창작물)에게 귀속</b>됩니다. 또한 만약 생성되거나 표시되는 태그에 아티스트명이 포함되는 경우, 이는 의도된 기능이 아니라 데이터 처리 또는 AI 자동 생성 과정에서 발생한 오류이며, 발견 즉시 수정·제거될 수 있습니다.',
        // Current Selection card
        'cs.tpl': '📜 템플릿',
        'cs.artist': '🎤 아티스트',
        'cs.era.group': '시대 · 스타일 그룹',
        'cs.title': '제목',
        'cs.variants': '스타일 변형 (3가지 대표곡 스타일)',
        'cs.peak.song': '전성기 · 대표곡',
        'cs.coretags': '핵심 태그',
        'cs.structure': '곡 구조',
        'cs.disclaimer': 'ⓘ 아티스트명은 스타일을 빠르게 찾기 위한 참고용 라벨이며, Suno에 전달되는 프롬프트엔 이름이 포함되지 않습니다.',
        // AI status (builder AI panel)
        'aistat.preset.locked': '📜 프리셋 로드됨 — Excel Style 그대로. AI는 Title/Lyrics만 생성합니다 (다시 쓰려면 "Style 채우기" 체크).',
        'aistat.nokey': 'API 키가 없습니다',
        'aistat.generating': '생성 중…',
        'aistat.done': '✅ 완료',
        // Track card actions
        'track.btn.regen': '🔄 가사 재생성',
        'track.btn.gen': '📝 가사 생성',
        'track.btn.tobuilder': '🎼 빌더로',
        'track.btn.title': '📋 제목',
        'track.btn.lyrics': '📋 가사',
        'track.btn.all': '📋 전체',
        'track.copy.title.tip': '노래 제목만 복사',
        'track.copy.style.tip': 'Style 프롬프트만 복사',
        'track.copy.lyrics.tip': '가사만 복사',
        'track.copy.all.tip': '제목 + Style + 가사 한꺼번에 복사',
        'toast.to.builder': '빌더',
        // Saved albums list
        'albums.saved.empty': '저장된 앨범이 없습니다.',
        'albums.tracks.suffix': '곡',
        // Album status messages
        'astat.tracks.added': '곡에 키워드 추가',
        'astat.total': '총',
        'astat.cleared': '🗑️ 앨범 초기화 완료',
        'astat.planning': '기획 생성 중',
        'astat.done.plan': '✅ 12곡 기획 완료',
        'astat.loaded': '로드됨',
        'astat.lyrics.gen': '가사 생성 중…',
        'astat.lyrics.all.done': '✅ 모든 트랙 가사 생성 완료',
        'astat.lyrics.done': '✅ 가사 생성 완료',
        // Generic toasts touched in preset/dance/search handoffs
        'toast.controls.merged': '제어 옵션 머지됨 — 보컬편곡 키워드',
        'toast.added.suffix': '개 추가',
        'toast.suno.focus': '🎵 Suno 창으로 전환',
        'toast.style.empty': '조립된 Style이 비어있습니다',
        'toast.sent.builder': '빌더의 Style 칩으로 전송됨 — 아티스트 컨텍스트 초기화',
        // AI generate button + connection test status
        'aibtn.generate': '▶ 생성',
        'aibtn.generating': '⏳ 생성 중',
        'status.testing': '테스트 중…',
        'status.conn.ok': '✅ 연결 OK — 키와 모델 모두 정상',
        // Album-side extra dropdown placeholders
        'dd.album.style.auto': '자동 (앨범 컨셉에서 추론)',
        'dd.album.preset.none': '없음',
        'album.preset.disclaimer': 'ⓘ 아티스트명은 스타일 분류 라벨이며, Suno에 전달되는 프롬프트엔 이름이 포함되지 않습니다.',
        // Search tab example chips
        'search.ex.iu': '아이유 - 좋은 날',
        // Search panel cost hint + status
        'search.cost.off': '💡 OFF — 학습 데이터만 사용 (빠르고 저렴, 단 최신 정보 부정확 가능)',
        'search.cost.on': '💰 입력·출력 토큰 + {surcharge} · 토큰 사용량은 비검색 대비 2–5× · {prov} 콘솔에서 실제 단가 확인',
        'search.surcharge.default': '+ 웹 검색 사용료',
        'search.status.needkey': '먼저 ⚙️ 설정에서 API 키를 등록하세요.',
        'search.status.searching': '검색 중…',
        'search.with.web': '🌐 웹 검색',
        'search.with.training': '학습 데이터',
        'search.status.nores': '❓ AI 가 결과를 찾지 못했습니다. 다른 검색어를 시도하세요.',
        'search.status.found.suffix': '곡 검색됨',
        'search.noname': '(이름 없음)',
        'search.notitle': '(제목 없음)',
        // Search → Builder load toast
        'toast.vocal.added': '보컬편곡 키워드',
        'toast.search.loaded': '빌더 로드됨',
        // Saved-presets tab
        'saved.warn.title': '저장 위치 안내 — 브라우저 데이터 영역',
        'saved.warn.body': '모든 프리셋은 이 브라우저의 <b>localStorage</b> 에만 저장됩니다. 브라우저의 <b>쿠키 및 사이트 데이터 삭제</b>·시크릿 모드 종료·프로필 재설정 시 <b>모두 사라집니다</b>. 작업이 끝나면 반드시 <b>📤 JSON 내보내기</b> 또는 카드별 <b>💾 파일</b> 로 <code>Downloads/suno_prompt_manager/preset/</code> 에 백업하세요.',
        'saved.btn.restore': '불러오기',
        'saved.btn.copyall': '전체 복사',
        'saved.btn.file': '💾 파일',
        'saved.btn.file.tip': '개별 파일로 저장',
        'saved.btn.delete': '삭제',
        // Search disclaimer
        'disclaimer.search': '<span class="text-accent-400 font-semibold">🔍 AI 검색</span> &nbsp; 아티스트명·노래제목·"아티스트 - 노래" 등 자유롭게 입력하세요. AI 가 곡 정보와 대표 히트곡 5-8개를 정리해 Suno-ready Style 프롬프트로 제공합니다. <b>아티스트명은 Suno 프롬프트에 포함되지 않으며</b>, 음악 스타일 분류용 참고 라벨로만 쓰입니다.',
        // Dance machine misc
        'lbl.bpmhint': 'BPM 힌트',
        'lbl.styles': '스타일',
        'dance.card.tip': '클릭하여 우측 베이스 시드로 로드',
        'dance.nomatch': '조건에 맞는 스타일이 없습니다.',
        'dance.picked.empty': '위 카테고리에서 태그를 선택하세요',
        // Help guide — Overview section
        'h-overview.p1': 'SU-Note (수-노트) 는 Suno AI 음악 생성에 최적화된 <b>프롬프트 매니저</b> 입니다. Excel 형식의 <em>Suno AI 한국어 종합 가이드 v8</em> 을 기반으로 <b>648 개 검증된 고유 태그</b>, <b>867 개 스타일 템플릿</b> (261 큐레이션 + 202 아티스트 × 3 변형 = 606 시그니처), <b>200 가지 댄스 서브장르</b>를 한 화면에서 검색·조합·복사할 수 있도록 정리했습니다.',
        'h-overview.p2': '여기에 Claude · GPT · Gemini 세 AI 모델 연동을 더해 단일 곡과 12곡 앨범을 자동 기획·생성하며, 한국 가요 특화 옵션 (한·영 가사 비율, 보컬·랩 비율, 시적 비유 강도, 콜앤리스폰스, 화음·코러스) 까지 페이더로 조정할 수 있습니다.',
        'h-overview.callout': '<b>핵심 가치</b> ─ ① Suno 가 실제로 인식하는 검증된 태그만 노출 (반영도 색상 표시) ② 한국어 가사 디테일 ③ 아티스트 스타일을 안전하게 분류 라벨로만 사용 (Suno 에 아티스트명 전달 0건) ④ 12곡 앨범 일괄 기획 ⑤ 200 댄스 스타일 라이브러리.',
        // Help guide — Quickstart
        'h-quickstart.body': '<li><b>API 키 등록</b> — 좌측 사이드바 ⚙️ <b>설정</b> 클릭 → Anthropic · OpenAI · Google 중 하나의 키 입력 → <b>암호화 저장</b>. <span class="help-note">앱 부팅 시 자동 생성된 디바이스 키로 AES-GCM 256bit 암호화되어 브라우저에만 저장 — 별도 암호 입력 없이 바로 사용 가능.</span></li><li><b>스타일 고르기</b> — 좌측 사이드바의 <b>프리셋</b> / <b>태그</b> / <b>댄싱머신</b> 탭에서 원하는 스타일을 검색·선택 → <b>빌더에 로드</b> 또는 <b>빌더로 전송</b> 버튼 클릭</li><li><b>제어 조정 (선택)</b> — 빌더 우측의 <b>제어</b> 패널에서 페이더 (한·영 비율 · 시적 비유 · 보컬↔랩) · 콜앤리스폰스·화음 옵션 · 보컬 편곡 스타일까지 원하는 대로 설정 후 <kbd class="cyan">▶ 빌더에 로드</kbd> 한 번 클릭</li><li><b>AI 생성 (선택)</b> — 중앙 <b>AI</b> 패널에 컨셉 입력 → Claude · GPT · Gemini 로 제목·가사 자동 생성</li><li><b>Suno 복사</b> — <b>📋 Style 복사</b> · <b>📋 Lyrics 복사</b> 로 클립보드에 → Suno Custom Mode 의 Style · Lyrics 필드에 각각 붙여넣고 곡 생성</li>',
        // Help guide — Search section
        'h-search.intro': '큐레이션된 200 프리셋 밖의 <b>모든 아티스트·노래</b>를 검색합니다. 기본은 AI 의 학습 데이터로 답하고, <b>🌐 웹 검색</b> 체크 시 각 provider 의 네이티브 웹 도구로 실시간 정보 조회.',
        'h-search.provider.body': '<li><b>Claude</b> · <b>GPT</b> · <b>Gemini</b> 중 선택 — 메인 AI 패널 (가사 생성용) 의 provider 와 <b>동기화</b>됨</li><li>각 provider 의 API 키가 미리 ⚙️ 설정에 등록돼 있어야 동작</li>',
        'h-search.web.body': '<li><b>OFF (기본)</b> — AI 의 학습 데이터로 답함. <b>빠르고 저렴</b>, 단 최신 발매·차트 정보는 부정확할 수 있음 (모델의 cutoff date 기준)</li><li><b>ON</b> — provider 의 네이티브 웹 검색 도구 호출:<ul><li>Claude: <code>web_search_20250305</code> (Anthropic 네이티브)</li><li>GPT: <code>web_search_preview</code> (Responses API 경유)</li><li>Gemini: <code>googleSearch</code> grounding</li></ul></li><li>설정은 localStorage <code>su_search_web</code> 에 저장 — 다음 방문에 유지</li><li>체크박스 옆에 <b>실시간 비용 안내</b> 표시:<ul><li>OFF 시: "💡 OFF — 학습 데이터만 사용"</li><li>ON 시: "💰 입력·출력 토큰 + 웹 검색 사용료 + 토큰 사용량 2-5× + provider 콘솔에서 단가 확인"</li></ul></li><li>provider 별 웹 검색 단가 (2025-11 기준 참고용):<ul><li>Claude: 약 <b>$10 / 1,000 검색</b></li><li>GPT (Responses): 약 <b>$10 / 1,000 쿼리</b></li><li>Gemini (Google Search grounding): 약 <b>$35 / 1,000 grounded 요청</b></li><li>실제 청구액은 모델 토큰 사용량까지 합산되며, 각 사의 최신 가격 페이지에서 확인 필요</li></ul></li>',
        'h-search.input.body': '<li><b>아티스트명만</b> — 예: <code>Coldplay</code>, <code>아이유</code>, <code>Daft Punk</code></li><li><b>노래 제목만</b> — 예: <code>Bohemian Rhapsody</code>, <code>강남스타일</code>, <code>좋은 날</code></li><li><b>아티스트 - 노래</b> — 예: <code>BTS - Dynamite</code>, <code>Billie Eilish - bad guy</code>, <code>아이유 좋은 날</code></li><li>입력칸 아래 예시 칩 클릭으로 빠른 시도 가능</li>',
        'h-search.korean.body': '<li>해외 아티스트·노래를 한글로 입력해도 AI 가 정식 명칭으로 매핑해서 검색:<ul><li><code>콜드플레이</code> → Coldplay · <code>비틀즈</code> → The Beatles · <code>퀸</code> → Queen</li><li><code>다프트펑크</code> → Daft Punk · <code>라디오헤드</code> → Radiohead · <code>마이클잭슨</code> → Michael Jackson</li><li><code>빌리아일리시</code> → Billie Eilish · <code>테일러스위프트</code> → Taylor Swift · <code>에드시런</code> → Ed Sheeran</li><li>일본 아티스트: <code>요네즈켄시</code> → 米津玄師 · <code>우타다</code> → 宇多田ヒカル</li><li>노래 제목도 동일: <code>보헤미안랩소디</code> · <code>옐로우</code> · <code>비틀즈 - 헤이주드</code></li></ul></li><li>한국 아티스트 (방탄소년단·아이유·트로트·OST 등) 는 그대로 한글로 검색 — 역번역 안 됨</li><li>예시 칩 중 "(한글)" 표시된 항목으로 동작 확인 가능</li>',
        'h-search.output.body': '<li><b>아티스트 카드</b> — 이름 (영문·한글) · 국적 · 활동 시대 · 장르 · 1-2 문장 요약 (웹에서 수집한 최신 정보 반영)</li><li><b>대표곡 5-8 개</b> — 각각 제목·발매연도·Suno-ready Style (150-220자)·곡 구조·무드</li><li>"아티스트 - 노래" 검색 시 해당 곡이 결과 리스트 <b>맨 앞</b>에 우선 배치</li><li>AI 가 검색해도 정보를 찾지 못한 아티스트면 <code>queryType: unknown</code> + 빈 결과 — 환각 (hallucinate) 방지</li>',
        'h-search.use.body': '<li>각 곡 카드의 <kbd class="cyan">▶ 빌더에 로드</kbd> ─ Style 칩 · 제목 자동 채움. 가사는 비우고 빌더 AI 패널에서 별도 생성</li><li><b>📋 Style 복사</b> ─ 그 곡의 Style 프롬프트만 클립보드에</li><li>저장하려면 빌더 로드 후 Style 패널의 <b>💾 프리셋으로 저장</b> 버튼 사용 — 검색 결과는 자동 저장되지 않습니다</li><li>로드 시 이전 아티스트 컨텍스트 (refArtist) 자동 초기화 — AI 가사 생성 시 검색된 Style 이 덮어쓰이지 않음</li>',
        'h-search.notes.body': '<li>웹 검색 1 회 + AI 응답 1 회 = <b>토큰 사용량이 일반 채팅보다 2-5 배</b>. 검색 결과가 길수록 입력 토큰 늘어남</li><li>Provider 별 웹 검색 가격 (입력 토큰에 포함되거나 별도 청구) 은 각 사 문서 확인 필요</li><li>Style 필드는 자동 정제 — 한국어 장르명 · 아티스트명 자동 제거 (Suno 영문 토큰화 보장)</li><li>웹 검색이 차단되거나 결과가 부족할 때 AI 가 자체 지식으로 답할 수 있음 — 그래도 BPM·발매연도 등은 참고용으로만</li>',
        // FAQ answers
        'faq.a.fill': '프리셋을 로드하면 자동으로 잠깁니다 (Excel 원본 보호). 🔒 배지 클릭으로 해제하면 AI 가 Style 을 새로 작성합니다.',
        'faq.a.artistname': '아니요. 아티스트명은 사용자가 스타일을 찾기 쉽도록 돕는 <b>분류 라벨</b> 일 뿐이며, Suno 에 가는 프롬프트엔 포함되지 않습니다. 4 곳에 명시되어 있습니다.',
        'faq.a.lyricslang': '제어 패널의 <b>가사 언어 페이더</b> 가 한글 100% (좌측 끝) 인지 확인하세요. AI 가 페이더 값을 그대로 따릅니다.',
        'faq.a.dupechip': '대·소문자 무관 자동 중복 제거됩니다. 보인다면 <kbd>Ctrl+Shift+R</kbd> 강력 새로고침.',
        'faq.a.korstyle': '모든 한국어 음악 용어가 자동으로 영문 치환됩니다 (트로트 → Trot, 발라드 → ballad). 만약 보인다면 강력 새로고침 후 다시 시도하세요.',
        'faq.a.namesinstyle': '250+ 인명 패턴이 자동으로 역할 라벨 (the lead vocalist, the producer 등) 으로 치환됩니다. 갓 추가된 인명은 다음 빌드에서 잡힙니다.',
        'faq.a.langdirective': '언어 지시는 Style 에서 자동 제거됩니다. 가사 언어는 우측 <b>제어</b> 패널의 가사 언어 페이더로만 결정됩니다.',
        'faq.a.startpanel': '시작점 패널은 <b>Style 칩이 비어 있고 프리셋이 로드되지 않은 상태</b>에서만 자동 표시됩니다. 칩이 1 개라도 있으면 (수동 추가·다른 탭에서 전송 등) 자동으로 숨겨져요. 다시 보려면 <b>초기화</b> 버튼으로 빌더를 리셋. 또는 좌측 <b>프리셋 · 댄싱머신 · 검색</b> 탭에서 스타일을 골라 빌더로 전송해도 됩니다.',
        'faq.a.chipsort': '의도된 동작입니다. 칩은 <b>Suno 적용도 (reflect)</b> 기준으로 자동 정렬돼요 — 🟢 → 🟡 → ⚪ → 🔴. Suno 의 200자 token 한도에서 잘릴 때 잘 적용되는 태그가 살아남도록 핵심을 앞쪽에 모읍니다. 칩 좌측 도트 색상이 적용도를 표시 (마우스 오버 시 한국어 설명). 같은 적용도 안에선 추가된 순서가 유지됩니다 (stable sort).',
        'faq.a.reddot': '꼭 그럴 필요는 없습니다. 🔴 은 "Suno 가 잘 반영 안 함" 이지 "잘못된 태그" 가 아니에요. 의도적으로 무드·스토리 신호용으로 두고 싶으면 그대로 유지. 200자 한도에 가까울 때 우선순위 정렬로 뒤에 밀려있어 자동으로 잘릴 수도 있고, × 버튼으로 직접 제거해도 됩니다.',
        'faq.a.addbtn': '"빌더에 로드 · 제어 옵션 머지" 버튼에 통합됐습니다. 콜앤리스폰스 또는 화음·코러스가 켜져 있으면 선택한 보컬 편곡 스타일의 키워드가 로드 시 자동 추가됩니다.',
        'faq.a.loaddual': '네 — ① 시작점 패널에서 프리셋을 선택한 상태면 <b>프리셋 Style + 곡 구조 + 제어 옵션</b> 을 모두 적용. ② 검색·댄싱머신·태그 탭에서 가져온 칩만 있는 상태면 <b>제어 옵션 (콜앤리스폰스·화음·코러스·보컬 편곡 스타일) 만 기존 칩에 머지</b>. 어느 쪽이든 한 번 클릭으로 끝.',
        'faq.a.tabreset': '이젠 초기화되지 않습니다. 사이드바 탭은 순수 네비게이션이라 빌더의 칩·제목·가사·AI 프롬프트, 검색 결과, 댄싱머신 picks, 앨범 12곡 진행 상태가 탭을 옮겨도 그대로 유지됩니다. 특히 앨범 가사 일괄 생성처럼 시간이 걸리는 작업 중에 다른 탭을 봐도 안전합니다. 비우고 싶을 땐 각 탭의 <b>초기화</b> 버튼을 직접 누르세요.',
        'faq.a.korsearch': '네 — AI 가 한글 음역을 자동 인식합니다. 예: <code>콜드플레이</code> → Coldplay · <code>비틀즈</code> → The Beatles · <code>다프트펑크</code> → Daft Punk · <code>빌리아일리시</code> → Billie Eilish · <code>요네즈켄시</code> → Kenshi Yonezu. 노래 제목도 동일: <code>보헤미안랩소디</code>, <code>옐로우</code> 등. 한국 아티스트 (방탄소년단 · 아이유 등) 는 그대로 한글 검색.',
        'faq.a.blanklines': '가독성을 위한 의도된 동작입니다. [Verse 1] / [Chorus] 등 모든 섹션 헤더 앞에 빈 줄이 자동 보장됩니다. 직접 편집해도 다음 AI 생성 / 프리셋 로드 시 다시 정규화됩니다.',
        'faq.a.dancenotfound': '좌측에서 가장 가까운 시드 스타일을 고른 뒤 우측 태그 조합기에서 카테고리별 태그를 골라 직접 조합하세요. 8 카테고리 × 210 태그 = 충분한 변주가 가능합니다.',
        'faq.a.albumslow': '곡당 약 5~15 초 × 12 = 1~3 분 소요. AI 모델별로 응답 속도 다름. 진행 상황은 상태 바에 표시됩니다.',
        'faq.a.aimismatch': 'AI 프롬프트 입력칸을 더 구체적으로 — 시대·무드·이야기·핵심 단어를 명시. 페이더로 비유 강도·언어·랩 비율도 조정.',
        'faq.a.offline': 'UI 는 정적 SPA 라 첫 로딩만 인터넷 필요. 단 AI 생성은 항상 외부 API 호출이 필요합니다.',
        'faq.a.instrumental': 'AI 패널의 <b>🎺 연주곡</b> 체크박스 ON → Style 칩에 <code>instrumental</code> 자동 삽입, Lyrics textarea 비워짐, AI 는 sung 라인 없이 섹션 로드맵만 작성. 7-9 섹션 × 80-120 마디로 3-4분 트랙 보장. Suno Custom Mode 에 그대로 붙여넣으면 됩니다.',
        'faq.a.titlelang': 'AI 패널의 <b>제목 언어</b> 드롭다운에서 <code>English</code> 등 선택. <code>Auto</code> 면 가사 언어 페이더를 따르고, 나머지는 가사와 무관하게 제목만 강제 언어로 작성합니다. 연주곡 모드에서도 동작.',
        'faq.a.autopaste': '불가능합니다. 브라우저 보안 (Same-Origin Policy) 상 SU-Note 와 Suno.com 은 서로 다른 출처라 DOM 접근이 차단됩니다. <code>📋 Style 복사</code> · <code>📋 Lyrics 복사</code> → Suno 창 클릭 → <kbd>Ctrl+V</kbd> 가 유일한 방법.',
        'faq.a.wfsplit': '사라진 게 아니라 <b>사이드바 안 컴팩트 스트립</b> 으로 자동 이동합니다. 일반 모드로 돌리면 빌더 본문 상단 원래 자리로 복귀합니다.',
        'faq.a.aistyle': '최근 패치로 수정됐습니다. 이전엔 빌더 칩만 갈아끼우고 AI 가 참조하는 <code>state.selectedArtist</code> 가 이전 프리셋 상태로 남아 있어 그 아티스트 스타일이 강제됐어요. 지금은 댄스 전송 · 저장 프리셋 복원 · 앨범 트랙 송신 모든 흐름에서 잔여 컨텍스트가 자동 초기화됩니다.',
        'faq.a.shortinstr': 'Suno 는 Lyrics 필드의 글자 수와 섹션 밀도를 곡 길이 신호로 사용합니다. 연주곡 모드는 AI 에게 7-9 섹션 + 모든 브래킷에 명시적 마디 수 (8/16/24 bars) + Style 에 "extended arrangement" 길이 힌트를 강제하도록 설계됐어요. 그래도 짧다면 같은 프롬프트로 한 번 더 재생성 (Suno 자체의 변동성 가능).',
        'faq.a.storage': '모든 프리셋·앨범·API 키·테마·워크플로우 상태는 <b>브라우저 localStorage</b> 에만 보관됩니다. 외부 서버 전송 없음.',
        'faq.a.mobile': '반응형 디자인 적용. 1100px 이하에서 사이드바·페이더·태그 그리드가 세로로 재배치됩니다.',
        'faq.a.lost': '브라우저의 "쿠키 및 사이트 데이터 삭제" 또는 시크릿 모드 종료로 localStorage 가 초기화된 경우입니다. <b>📥 가져오기</b> 로 <code>Downloads/suno_prompt_manager/</code> 에 백업해 둔 JSON 파일을 다시 불러오세요. 백업이 없다면 복구 불가능. ⚠️ 정기적인 📤 JSON 내보내기를 권장합니다.',
        'faq.a.transfer': '현재 기기에서 📤 JSON 내보내기로 받은 파일을 새 기기로 옮긴 뒤, 동일 도메인 (또는 동일 로컬 서버) 에서 📥 가져오기로 로드. 같은 도메인이 아니면 localStorage 가 격리되어 자동 공유되지 않습니다.',
      },
      en: {
        // Sidebar tabs
        'tab.builder': 'Builder', 'tab.album': 'Album', 'tab.artists': 'Presets',
        'tab.search': 'Search', 'tab.search.tip': 'AI-powered search',
        'tab.dance': 'Dance Machine', 'tab.guide': 'Guide',
        'tab.presets': 'Saved',
        // Footer
        'footer.lang': 'Language', 'footer.theme': 'Theme', 'footer.split': 'Split mode',
        'footer.suno': 'Open Suno',
        'footer.suno.tip': 'Open Suno AI next to the split window (auto-docks to the right half in split mode)',
        'footer.help': 'User guide',
        'footer.help.tip': 'App user guide (shortcut: ?)',
        'footer.settings': 'Settings',
        'footer.settings.tip': 'API keys & model settings',
        // Workflow
        'wf.eyebrow': 'New here? Start in 4 steps',
        'wf.collapse': 'Collapse',
        'wf.expand': 'Expand',
        'wf.toggle.tip': 'Collapse / expand workflow',
        'wf.s1.title': 'Pick a style',
        'wf.s1.desc': 'In the builder\'s right-hand <b>Starting Point</b> panel pick category → era → preset, or grab one from the left-side <b>Presets · Dance Machine · Search</b> tabs and hit <b>Load to Builder / Send to Builder</b>',
        'wf.s2.title': 'Adjust controls',
        'wf.s2.desc': 'In the right-hand <b>Controls (Mix Console)</b> use the faders for Korean↔English ratio · poetic-metaphor intensity · vocal↔rap balance. Toggle call-&-response, harmony options, and a <b>vocal arrangement style</b>',
        'wf.s3.title': 'Load to Builder + AI generation <span class="workflow-pill">optional</span>',
        'wf.s3.desc': 'Hit <b>Load to Builder</b> at the bottom of the Controls panel — Style + structure + arrangement keywords drop in at once. Optional: type a concept in the central <b>AI</b> panel and let Claude · GPT · Gemini auto-write title & lyrics',
        'wf.s4.title': 'Paste into Suno',
        'wf.s4.desc': '<b>📋 Copy Style</b> · <b>📋 Copy Lyrics</b> to the clipboard → paste into the Style / Lyrics fields of Suno AI Custom Mode and generate',
        // Panel titles
        'panel.style': 'Style', 'panel.lyrics': 'Lyrics', 'panel.ai': 'AI',
        'panel.startingpoint': 'Starting Point', 'panel.current': 'Current Selection',
        'panel.control': 'Controls', 'panel.palette': 'Palette',
        'panel.search': '🔍 AI Search',
        'panel.album.saved': '💾 Saved Albums',
        'panel.album.concept': '💿 Album Concept',
        'panel.dance.styles': '200 Dance Styles Guide',
        'panel.dance.tags': 'Dance Tag Composer',
        'panel.guide.index': '📚 Chapter Index (93)',
        'panel.presets.saved': '💾 Saved Presets',
        // Buttons
        'btn.reset': 'Reset',
        'btn.reset.tip': 'Reset title, lyrics, Style chips, sliders, options, and the AI prompt back to defaults',
        'btn.copy.style': '📋 Copy Style',
        'btn.copy.lyrics': '📋 Copy Lyrics',
        'btn.save.preset': '💾 Save as preset',
        'btn.load.merge': 'Load to Builder · Merge controls',
        'btn.load.tip': 'If a Starting Point preset is selected, applies preset Style + song structure + control options. Otherwise merges only the call-&-response / harmony / vocal-arrangement keywords into the existing chips.',
        // Help modal — TOC
        'toc.overview': 'Overview', 'toc.workflow': 'Workflow', 'toc.quickstart': 'Quick Start',
        'toc.builder': 'Builder', 'toc.album': 'Album', 'toc.dance': 'Dance Machine',
        'toc.presets': 'Presets', 'toc.search': 'Search',
        'toc.design': 'Design & Theme', 'toc.sanitize': 'Auto-Cleanup', 'toc.backup': 'Backup & Save',
        'toc.security': 'Security', 'toc.shortcuts': 'Shortcuts', 'toc.faq': 'FAQ',
        'toc.versions': 'Version History',
        // Help modal — section h3
        'h3.overview': '🎯 Overview — What SU-Note Is',
        'h3.workflow': '🗺️ 4-Step Workflow',
        'h3.quickstart': '🚀 Quick Start (3 min)',
        'h3.builder': '🎼 Builder — Make a single song (full manual)',
        'h3.album': '💿 Album Planner — 12 tracks in one shot',
        'h3.dance': '🎯 Dance Machine — 200 dance styles + tag composer',
        'h3.presets': '🎤 Presets — 3 signature songs per artist',
        'h3.search': '🔍 Search — Free-text discovery (training data or web search)',
        'h3.design': '🎨 Design · Theme · Layout Modes',
        'h3.sanitize': '🧹 Auto-Cleanup — Guarantees Suno-safe English tokens',
        'h3.backup': '💾 Backup · Save — Where data lives and how to keep it',
        'h3.security': '🔐 Security — How API keys are stored',
        'h3.shortcuts': '⌨️ Shortcuts · Tips',
        'h3.faq': '❓ Frequently Asked Questions',
        'h3.versions': '📜 Version History',
        // Help modal — card h4
        'h4.builder.title': '① Song Title (top Hero input)',
        'h4.builder.style': '② Style panel (center)',
        'h4.builder.lyrics': '③ Lyrics panel (center)',
        'h4.builder.ai': '④ AI generation panel (lower center)',
        'h4.builder.start': '⑤-1 Starting Point panel (right sidebar top — auto show/hide)',
        'h4.builder.current': '⑤-2 Current Selection panel (under Starting Point — read-only)',
        'h4.builder.control': '⑥ Controls panel (right sidebar middle — Mix Console)',
        'h4.builder.palette': '⑦ Palette panel (right sidebar bottom)',
        'h4.dance.left': 'Left — 200 dance styles guide',
        'h4.dance.right': 'Right — Dance tag composer (210 tags)',
        'h4.search.provider': 'Provider selector (tabs at panel header right)',
        'h4.search.web': '🌐 Web search checkbox (off by default)',
        'h4.search.input': 'Input formats — 3 styles freely',
        'h4.search.korean': '🇰🇷 Hangul transliteration search',
        'h4.search.output': 'AI output',
        'h4.search.use': 'Using the results',
        'h4.search.notes': 'Notes & caveats',
        'h4.design.theme': '① 3-state colour theme (segmented control at the sidebar bottom)',
        'h4.design.split': '② Split mode (sidebar bottom toggle + "Open Suno" button)',
        'h4.design.mobile': '③ Mobile mode (auto-on ≤900px)',
        'h4.design.contrast': '④ Visibility highlights',
        'h4.sanitize.korean': '① Korean music terms → English equivalents',
        'h4.sanitize.names': '② Artist · producer · band-member names → role labels',
        'h4.sanitize.lang': '③ Language directives stripped automatically',
        'h4.sanitize.blank': '④ Auto blank lines between lyric sections',
        'h4.sanitize.dedup': '⑤ Duplicate era / genre tail tags removed',
        'h4.sanitize.sort': '⑥ Chips auto-sorted by Suno reflect score',
        'h4.backup.auto': '① Auto-save (live) — localStorage',
        'h4.backup.manual': '② Manual backup (file) — Downloads/suno_prompt_manager/',
        'h4.backup.restore': '③ Import (restore / migrate)',
        'h4.backup.routine': '④ Recommended backup routine',
        // FAQ questions
        'faq.q.fill': '"Fill Style" checkbox is off?',
        'faq.q.artistname': 'Are artist names sent to Suno?',
        'faq.q.lyricslang': 'Lyrics aren\'t coming out in Korean',
        'faq.q.dupechip': 'The same chip is added twice',
        'faq.q.korstyle': 'I see Korean (트로트 · 발라드) in Style',
        'faq.q.namesinstyle': 'I see artist names in Style (e.g. McCartney · Bradley Cooper)',
        'faq.q.langdirective': 'I see "in English / in Korean" in Style',
        'faq.q.startpanel': 'The Starting Point panel disappeared',
        'faq.q.chipsort': 'Chips re-order themselves',
        'faq.q.reddot': 'Should I delete chips with a red dot?',
        'faq.q.addbtn': 'The old "Add keyword to Style" button is gone',
        'faq.q.loaddual': '"Load to Builder" has two modes?',
        'faq.q.tabreset': 'Does my builder / album state survive tab switches?',
        'faq.q.korsearch': 'Can I search foreign artists in Korean?',
        'faq.q.blanklines': 'Blank lines appear between lyric sections automatically',
        'faq.q.dancenotfound': 'My dance style isn\'t in the 200 catalog',
        'faq.q.albumslow': 'Generating lyrics for all 12 album tracks is slow',
        'faq.q.aimismatch': 'AI lyrics don\'t match my intent',
        'faq.q.offline': 'Does it work offline?',
        'faq.q.instrumental': 'How to make a lyric-less instrumental?',
        'faq.q.titlelang': 'Make the title in a different language from the lyrics?',
        'faq.q.autopaste': 'Can SU-Note auto-paste into Suno in split mode?',
        'faq.q.wfsplit': 'Workflow chart vanishes when I toggle split mode',
        'faq.q.aistyle': 'AI writes wrong style after Dance Machine / preset handoff',
        'faq.q.shortinstr': 'My instrumental ends after 90s on Suno',
        'faq.q.storage': 'Where is my data stored?',
        'faq.q.mobile': 'Can I use this on mobile?',
        'faq.q.lost': 'My saved presets / albums suddenly disappeared',
        'faq.q.transfer': 'Migrate work to a different PC / browser?',
        // Builder AI panel
        'ai.prompt.ph': 'What kind of song do you want? (e.g. 1980s synthwave ballad, first-love memory)',
        'ai.opt.title': 'Title',
        'ai.opt.instrumental': '🎺 Instrumental',
        'ai.opt.context': 'Context',
        'ai.lock': 'Preset protected',
        'ai.lock.tip': 'The preset\'s original Excel Style is locked from overwrite. Click to let AI rewrite it.',
        'ai.instr.tip': 'Generate as an instrumental, no lyrics. AI writes only the section roadmap (Intro · Verse [music cue] · Chorus · Bridge · Outro) + --- markers — Suno\'s recommended instrumental pattern. Empty Lyrics fields tend to loop monotonously. Instrumental tag is auto-injected into Style.',
        'ai.titlelang.tip': 'Title language. Auto follows the lyrics-language fader.',
        'ai.title.lang.ko': 'Korean',
        'ai.title.lang.ja': 'Japanese',
        'ai.title.lang.latin': 'Latin / Multilingual',
        'ai.generate': 'Generate',
        'ai.stop': 'Stop',
        // Starting point hint
        'startpoint.hint': 'Category → Era → Preset',
        // Search panel
        'search.web': '🌐 Use web search',
        'search.web.tip': 'Use each provider\'s native web-search tool for live information. When off the AI uses training data only (faster and cheaper, but recent info may be inaccurate).',
        'search.input.ph': 'e.g. Coldplay · 강남스타일 · BTS - Dynamite · IU Good Day · Bohemian Rhapsody',
        'search.btn': 'Search',
        'search.examples': 'Examples:',
        // Settings modal
        'settings.title': '⚙️ API Keys & Model Settings',
        'settings.warning': '⚠️ API keys are encrypted with this browser\'s auto-generated device key (AES-GCM 256-bit) and stored only in <b>localStorage</b>. They are never sent to any server. Clearing cookies / site data, ending incognito, or resetting the profile wipes them — re-enter the keys when that happens.',
        'settings.provider': 'Default provider',
        'settings.model': 'Model (recommended for lyric generation)',
        'settings.key.anthropic': '🤖 Anthropic API Key',
        'settings.key.openai': '💬 OpenAI API Key',
        'settings.key.google': '🔮 Google AI Studio Key (Gemini)',
        'settings.save': '💾 Encrypt & save',
        'settings.test': '🔌 Test connection',
        'settings.purge': '🗑️ Purge all data',
        'settings.model.custom': '✏️ Enter a custom model ID',
        // Hero / top inputs
        'hero.title.ph': 'Song title (e.g. First Snow / 첫눈에 / Song of Stars)',
        'btn.skeleton': 'Skeleton',
        'btn.skeleton.tip': 'Insert a K-ballad lyric skeleton into the lyrics area',
        // Mix Console
        'ctl.subtitle': 'Lyric-generation settings',
        'ctl.lang': 'Lyrics language',
        'ctl.lang.ko': 'KR', 'ctl.lang.en': 'EN',
        'ctl.metaphor': 'Poetic metaphor',
        'ctl.metaphor.direct': 'Direct', 'ctl.metaphor.balanced': 'Balanced', 'ctl.metaphor.poetic': 'Poetic',
        'ctl.rap': 'Vocal ↔ Rap',
        'ctl.rap.vocal': 'Vocal', 'ctl.rap.mix': 'Mixed', 'ctl.rap.rap': 'Rap',
        'ctl.bpm': 'Auto-detect & show BPM',
        'ctl.cues': 'Include per-section music cues',
        'ctl.cr': 'Call & Response (Lead↔Crowd)',
        'ctl.harm': 'Harmonies / chorus (layered)',
        'ctl.pitch': '🎚️ Pitch restraint (low-register · calm)',
        'ctl.pitch.tip': 'Drops high-note-inducing tags (cinematic · epic · emotional) and adds restrained · intimate · controlled · low-register to steer vocals into a calm low register',
        'ctl.arrange': 'Vocal arrangement style',
        'ctl.arrange.auto': 'Auto (matches current Style)',
        'ctl.arrange.kpop': 'K-Pop harmonies — airy layers',
        'ctl.arrange.idol': 'K-Pop idol group chant',
        'ctl.arrange.stadium': 'Stadium Rock (Coldplay · U2)',
        'ctl.arrange.gospel': 'Black Gospel',
        'ctl.arrange.edm': 'EDM Festival',
        'ctl.arrange.anison': 'J-Pop · Anison Unison',
        'ctl.arrange.punk': 'Punk Gang Vocals',
        'ctl.handoff': 'Applies the Starting Point preset + control settings at once. Chips imported from external tabs (Search / Dance Machine / Tags) receive <b>only the control options</b>.',
        // Album planner
        'album.concept': '📝 Album theme / concept (required)',
        'album.concept.ph': 'e.g. Four seasons of city youth — 12 scenes of a love that began in spring and ended in winter',
        'album.cat': '🏷️ Category',
        'album.cat.all': 'All', 'album.cat.kr': '🇰🇷 K-Music', 'album.cat.pop': '🌍 Global Pop',
        'album.era': '🗓️ Era / Tone',
        'album.group': '🎯 Style group (optional)',
        'album.preset': '🎵 Reference preset (optional)',
        'album.frombuilder': '📥 Pull current Builder selection',
        'album.mood': '😶 Moods (multi-select)',
        'album.arc': '📚 Album arc (Concept Arc)',
        'album.arc.journey': 'Emotional journey (meet → climax → break-up → recovery)',
        'album.arc.story': 'Story arc (12 scenes in chronological order)',
        'album.arc.thematic': 'Thematic unity (one consistent mood)',
        'album.arc.variety': 'Variety (mixed genres & moods)',
        'album.arc.seasons': 'Four seasons (3 spring · 3 summer · 3 autumn · 3 winter)',
        'album.arc.day': 'Day cycle (dawn → noon → evening → night)',
        'album.lang': '🌐 Lyrics language',
        'album.btn.generate': '🎵 Generate 12-track album',
        'album.btn.reset': '🗑️ Reset all',
        'album.btn.reset.tip': 'Resets the album concept, preset, options, all 12 tracks and lyrics back to defaults',
        'album.opts': '🎚️ Lyric-generation options',
        'album.opts.note': '— applies to both batch and per-track generation',
        'album.meta': '🎭 Poetic metaphor intensity',
        'album.rap': '🎤 Vocal ↔ Rap balance',
        'album.opt.cues': '🎬 Include per-section music cues',
        'album.opt.cr': '🎙️ Call & Response',
        'album.opt.harm': '🎶 Lead vocal + harmonies',
        'album.arr': '🎤 Vocal arrangement style',
        'album.arr.auto': 'Auto (matches current Style)',
        'album.arr.kpop': '🇰🇷 K-Pop harmonies',
        'album.arr.idol': '🪩 K-Pop idol group chant',
        'album.arr.stadium': '🏟️ Stadium Rock (Coldplay · U2)',
        'album.arr.gospel': '⛪ Black Gospel choir',
        'album.arr.edm': '🎉 EDM Festival',
        'album.arr.anison': '🎌 J-Pop · Anison Unison',
        'album.arr.punk': '🤘 Punk Gang Vocals',
        'album.arr.inject': '💡 Inject vocal-arrangement keywords into all 12 Styles',
        'album.arr.inject.tip': 'Inject Suno-tested keywords for the chosen vocal arrangement style into all 12 tracks\' Style fields',
        // Dance machine
        'dance.subtitle': 'PDF 108 + Extended 92 = 200',
        'dance.q.ph': '🔍 Search style · KR · EN · BPM',
        'dance.bpm.all': 'BPM (all)',
        'dance.bpm.110': '~110 BPM (downtempo)',
        'dance.bpm.125': '110-125 (tropical · disco)',
        'dance.bpm.135': '125-135 (house · techno)',
        'dance.bpm.145': '135-145 (trance · hard)',
        'dance.bpm.160': '145-160 (hardstyle · happy-hardcore)',
        'dance.bpm.200': '160-200+ (D&B · hardcore)',
        'dance.cardhint': 'Click a card to auto-load into the Builder on the right / copy Style',
        'dance.combinerhint': 'Click category tags to compose a Style instantly. Clicking a style card on the left auto-seeds the base.',
        'dance.seed': 'Base style (seed)',
        'dance.seed.ph': 'Click a dance style on the left, or type your own',
        'dance.picked': 'Picked tags',
        'dance.final': 'Composed final Style',
        'dance.final.ph': 'Base seed + picked tags concatenated with commas',
        'dance.send': 'Send to Builder',
        'dance.reset.tip': 'Wipes both the seed and the picked tags',
        // Toasts
        'toast.copied': 'Copied',
        'toast.dupe': 'Already added',
        'toast.preset.saved': 'Preset saved',
        'toast.bad.json': 'Invalid JSON file',
        'toast.vault.reset': 'Vault reset',
        'toast.ai.done': 'AI generation complete',
        'toast.no.presets': 'No presets to export',
        'toast.no.albums': 'No saved albums',
        'toast.album.saved': 'Album saved',
        'toast.album.exported.suffix': '1 album · {n} tracks included',
        'toast.albums.cleared': 'All saved albums deleted',
        'toast.settings.saved': 'Settings saved',
        'toast.builder.reset': '🗑️ Builder reset',
        'toast.no.controls': 'No control options enabled — nothing to add',
        // Confirms
        'confirm.builder.reset': 'Reset everything in the Builder?\n— Song title, lyrics, Style chips, sliders, options, and the AI prompt will all return to defaults.',
        'confirm.delete.preset': 'Delete this preset?',
        'confirm.delete.all.presets': 'Delete all presets?',
        'confirm.purge.vault': 'Delete all stored API keys and settings? This cannot be undone.',
        'confirm.album.reset': 'Reset everything in the Album planner?\n— The concept, preset selection, mood, options, and all 12 generated tracks with lyrics will be cleared.',
        'confirm.delete.album': 'Delete this album?',
        // Top bar / workflow tips
        'topbar.stats': 'Suno V5.5 · 648 tags · 867 templates · 200 dance styles',
        // Footer
        'footer.dev': 'Developer',
        'footer.official': '🌐 Official site',
        'footer.disclaimer': 'ⓘ Artist names in this tool are <b>category labels</b> to help you pick a musical style — they are NOT included in the prompts sent to Suno. This tool does not infringe any copyright; the rights to generated music follow Suno’s terms of service. This is an unofficial helper tool, unaffiliated with Suno AI.',
        // Stats template — used by renderStats(); {tags}/{templates}/{artists}/{dance} substituted at render time
        'stats.tmpl': 'Suno V5.5 · {tags} tags · {templates} templates · {dance} dance styles',
        'wf.tip1': '💡 <b>Auto-cleanup</b> — Korean text · artist names · language directives ("in English" etc.) are stripped from Style automatically, optimised for Suno\'s English tokenisation. Lyrics get auto blank lines between sections.',
        'wf.tip2': '💡 <b>More features</b> — Plan a 12-track album at once = <b>Album</b> tab / 200 dance sub-genres + tag composer = <b>Dance Machine</b> tab / Full manual = <kbd>?</kbd> key',
        // Style panel inline
        'style.subtitle': 'Suno Style field · ~200 chars recommended',
        'style.add.ph': 'Type a tag and press Enter (e.g. 95 BPM, intimate piano)',
        'style.add.btn': '＋ Add',
        'style.out.ph': 'Style tags joined by commas will appear here',
        'chips.empty': 'No tags yet — add some from the Palette / catalog / artists',
        'stat.tags': ' tags', 'stat.sections': ' sections', 'stat.lines': ' lines', 'stat.chars': ' chars',
        // Starting Point inline
        'cat.all': 'All', 'cat.korean': 'KR', 'cat.pop': 'POP',
        'cat.label': 'Category:',
        'cat.kpop': '🇰🇷 K-Music', 'cat.gpop': '🌍 Global Pop',
        'sp.era': '🗓️ Era', 'sp.group': '🎯 Style group',
        'sp.preset': '🎵 Preset (template · artist)',
        'sp.altsource': 'Or grab one from the left-side <b>Presets</b> · <b>Dance Machine</b> · <b>Search</b> tabs',
        // Current Selection
        'cs.readonly': 'Read-only',
        'cs.empty': 'Pick a style from the <b class="text-accent-400">Starting Point</b> panel above or from the left-side <b class="text-accent-400">Presets</b> / <b class="text-accent-400">Tags</b> / <b class="text-accent-400">Dance Machine</b> / <b class="text-accent-400">Search</b> tabs and hit the <b>Load to Builder / Send to Builder</b> button — your selection will appear here.',
        // Dropdown placeholders
        'dd.era': 'Select an era',
        'dd.group': 'Style group (optional)',
        'dd.preset': 'Preset (optional)',
        'dd.era.album': 'Select an era (optional)',
        'dd.era.all': 'Era (all)',
        'dd.group.all': 'Style group (all)',
        'dd.group.kpop': 'Style group (KR · POP first)',
        'dd.type.all': 'Type (all)', 'dd.type.tpl': '📜 Template', 'dd.type.art': '🎤 Artist',
        // Slider readout words
        'lbl.ko': 'KR', 'lbl.en': 'EN',
        'lbl.direct': 'Direct', 'lbl.semidirect': 'Mostly direct',
        'lbl.balanced': 'Balanced', 'lbl.poetic': 'Poetic', 'lbl.metaphorical': 'Metaphor-heavy',
        'lbl.vocal': 'Vocal', 'lbl.rap': 'Rap',
        'lbl.vocalheavy': 'Vocal-heavy', 'lbl.rapheavy': 'Rap-heavy',
        // Reflect tooltips
        'reflect.green': '🟢 Reliable', 'reflect.yellow': '🟡 Sometimes',
        'reflect.red': '🔴 Rarely', 'reflect.unknown': '⚪ No data',
        'reflect.always': 'Always', 'reflect.maybe': 'Often', 'reflect.rare': 'Rarely',
        'chip.src': 'Source', 'chip.reflect': 'Suno reflect',
        'aria.remove': 'Remove',
        // Palette
        'pal.tab.genre': '🎸 Genre',     'pal.tab.mood': '🎭 Mood',
        'pal.tab.instr': '🥁 Instrument', 'pal.tab.vocal': '🎤 Vocal',
        'pal.tab.tempo': '⏱ Tempo',       'pal.tab.search': '🔍 Search',
        'pal.search.ph': 'Search tags · descriptions…',
        'pal.search.empty': 'Enter a search term',
        'search.status.empty': 'Please enter a query.',
        // Settings model custom
        'settings.model.custom.ph': 'Enter a custom model ID (e.g. gpt-5)',
        // Preset labels
        'preset.signature.2': 'Signature 2', 'preset.signature.3': 'Signature 3',
        'preset.variant': 'variant', 'preset.mine': 'My preset',
        'prompt.preset.name': 'Name this preset',
        'prompt.album.name': 'Name this album',
        'presets.export': '📤 Export JSON',
        'presets.clearall': 'Clear all',
        'presets.empty': 'No saved presets. Save your current combination from the Builder with "Save as preset".',
        // Album extra
        'album.empty': 'Enter an album concept on the left and click <b class="text-slate-300">"Generate 12-track album"</b> — the 12-song tracklist will appear here.',
        'album.titlePh': 'Album title',
        'album.btn.save': '💾 Approve & save',
        'album.btn.regen': '🔄 Re-plan',
        'album.btn.lyrics12': '📝 Generate lyrics for all 12',
        'album.btn.export': '📤 Export JSON',
        'album.import': '📥 Import',
        'album.import.tip': 'Import album JSON',
        'album.clear.all': '🗑️ All',
        'album.clear.tip': 'Delete all saved albums',
        'album.backup.warn': '⚠️ Stored only in this browser — clearing site data wipes it. After finishing work click <b>📤 Export JSON</b> to back up to <code>Downloads/suno_prompt_manager/&lt;album&gt;/</code>.',
        // Arc labels
        'arc.journey': 'Emotional journey', 'arc.story': 'Story arc',
        'arc.thematic': 'Thematic', 'arc.variety': 'Variety',
        'arc.seasons': 'Four seasons', 'arc.day': 'Day cycle',
        // Album moods — index aligned with ALBUM_MOOD_IDS
        'mood.0': '🌧️ Melancholy', 'mood.1': '☀️ Hopeful', 'mood.2': '🔥 Passion', 'mood.3': '🧊 Icy', 'mood.4': '💕 Warm',
        'mood.5': '😢 Sad', 'mood.6': '😡 Anger', 'mood.7': '🌸 Nostalgia', 'mood.8': '⚡ Energy', 'mood.9': '🌙 Calm',
        'mood.10': '✨ Fantasy', 'mood.11': '🎭 Dramatic', 'mood.12': '🎉 Joyful', 'mood.13': '🌊 Serene', 'mood.14': '💔 Heartbreak',
        // Status messages
        'status.devkey.fail': 'Device key initialisation failed',
        'status.decrypt.fail': 'Key decryption failed',
        'status.saved': 'Saved (encrypted)',
        'status.enter.key': 'Please enter an API key for the selected provider',
        'status.purged': 'Purged — new device key generated',
        'status.purge.fail': 'Failed to regenerate key after purge',
        'status.ai.prompt': 'Please enter a prompt',
        'status.ai.unlock': 'Unlock your API keys first in ⚙️ Settings',
        'status.album.nopreset': 'No preset selected in Builder',
        'status.album.imported': 'Imported Builder selection into album concept',
        'status.album.first': 'Generate an album first',
        'status.album.novocab': 'No vocal-arrangement keywords found',
        'status.album.alreadyhas': 'Already present in every track',
        'status.album.concept': 'Enter an album concept or pick a reference preset',
        'toast.pick.first': 'Pick a preset first, or pull a style from a left-side tab',
        'toast.loaded': 'Loaded',
        // Theme labels
        'theme.dark': 'Dark', 'theme.light': 'Light',
        // Help modal header
        'help.title': '📖 SU-Note User Manual',
        'help.subtitle': 'SU-Note · Suno AI Prompt Manager · Suno V5.5 guide · 648 tags · 867 templates · 200 dance styles',
        // Artist / preset cards
        'art.btn.load': 'Load to Builder',
        'art.btn.copy': 'Copy Style',
        'art.empty': 'No presets match the current filters.',
        'art.q.ph': '🔍 Search title / style / signature song / tag',
        // Tag table headers + filters
        // Guide-chapter table column headers (still used by renderGuideChapter)
        'tag.col.reflect': 'Reflect',
        'tag.col.field': 'Field',
        'tag.col.tag': 'Tag / Prompt',
        'tag.col.cat': 'Category',
        'tag.col.desc': 'Description',
        'tag.col.tip': 'Tip',
        'tag.items': 'items',
        // Guide page
        'guide.pick': 'Pick a chapter',
        // Disclaimer (Artists view)
        'disclaimer.artists': '<span class="text-accent-400 font-semibold">ⓘ Notice (copyright)</span> &nbsp; Artist names in this catalog are <b>reference-only classification labels</b> meant to help users quickly find a desired musical style — they are not intended to reproduce or imitate any specific artist\'s unique creative work, voice, or signature sound. Additional tags surfaced by this service are not artist-specific expressions either; they are <b>general-purpose musical tags</b> (genre, mood, instrumentation, tempo, and the like) drawn from widely used industry vocabulary, surfaced only as a learning aid for beginners. The Style prompt and lyrics sent to Suno <b>do not contain any real artist name</b>, and this tool has no intent to infringe any copyright, right of publicity, or trademark. The rights and permitted use of any generated music belong to the <b>user (as the creator of their own work)</b> under Suno\'s terms of service. If any generated or displayed tag does happen to contain an artist name, that is not an intended feature but an error in data processing or AI auto-generation, and will be corrected or removed as soon as it is found.',
        // Current Selection card
        'cs.tpl': '📜 Template',
        'cs.artist': '🎤 Artist',
        'cs.era.group': 'Era · Style group',
        'cs.title': 'Title',
        'cs.variants': 'Style variants (3 signature songs)',
        'cs.peak.song': 'Peak · Signature song',
        'cs.coretags': 'Core tags',
        'cs.structure': 'Song structure',
        'cs.disclaimer': 'ⓘ Artist names are reference labels for finding a style — they are NOT included in the prompt sent to Suno.',
        // AI status (builder AI panel)
        'aistat.preset.locked': '📜 Preset loaded — Excel Style kept as-is. AI will generate only Title / Lyrics (tick "Fill Style" to rewrite).',
        'aistat.nokey': 'API key is missing',
        'aistat.generating': 'Generating…',
        'aistat.done': '✅ Done',
        // Track card actions
        'track.btn.regen': '🔄 Regenerate lyrics',
        'track.btn.gen': '📝 Generate lyrics',
        'track.btn.tobuilder': '🎼 To Builder',
        'track.btn.title': '📋 Title',
        'track.btn.lyrics': '📋 Lyrics',
        'track.btn.all': '📋 All',
        'track.copy.title.tip': 'Copy the title only',
        'track.copy.style.tip': 'Copy the Style prompt only',
        'track.copy.lyrics.tip': 'Copy the lyrics only',
        'track.copy.all.tip': 'Copy title + Style + lyrics together',
        'toast.to.builder': 'Builder',
        // Saved albums list
        'albums.saved.empty': 'No saved albums.',
        'albums.tracks.suffix': ' tracks',
        // Album status messages
        'astat.tracks.added': ' tracks updated with keywords',
        'astat.total': 'total',
        'astat.cleared': '🗑️ Album reset',
        'astat.planning': 'Planning album',
        'astat.done.plan': '✅ 12-track plan complete',
        'astat.loaded': 'loaded',
        'astat.lyrics.gen': 'generating lyrics…',
        'astat.lyrics.all.done': '✅ All track lyrics generated',
        'astat.lyrics.done': '✅ Lyrics generated',
        // Generic toasts
        'toast.controls.merged': 'Control options merged — vocal-arrangement keywords',
        'toast.added.suffix': ' added',
        'toast.suno.focus': '🎵 Switched to Suno window',
        'toast.style.empty': 'Composed Style is empty',
        'toast.sent.builder': 'Sent to Builder Style chips — artist context cleared',
        // AI generate button + connection test status
        'aibtn.generate': '▶ Generate',
        'aibtn.generating': '⏳ Generating',
        'status.testing': 'Testing…',
        'status.conn.ok': '✅ Connection OK — key and model both valid',
        // Album-side extra dropdown placeholders
        'dd.album.style.auto': 'Auto (infer from album concept)',
        'dd.album.preset.none': 'None',
        'album.preset.disclaimer': 'ⓘ Artist names are style-classification labels — they are NOT included in the prompt sent to Suno.',
        // Search tab example chips
        'search.ex.iu': 'IU - Good Day',
        // Search panel cost hint + status
        'search.cost.off': '💡 OFF — using training data only (fast & cheap, recent info may be inaccurate)',
        'search.cost.on': '💰 input/output tokens + {surcharge} · token usage is 2-5× vs non-search · check {prov} console for actual pricing',
        'search.surcharge.default': '+ web-search fee',
        'search.status.needkey': 'Register an API key in ⚙️ Settings first.',
        'search.status.searching': 'Searching…',
        'search.with.web': '🌐 Web search',
        'search.with.training': 'Training data',
        'search.status.nores': '❓ AI couldn\'t find any results. Try a different query.',
        'search.status.found.suffix': ' songs found',
        'search.noname': '(no name)',
        'search.notitle': '(no title)',
        // Search → Builder load toast
        'toast.vocal.added': 'vocal-arrangement keywords',
        'toast.search.loaded': 'loaded into Builder',
        // Saved-presets tab
        'saved.warn.title': 'Storage location — browser data',
        'saved.warn.body': 'All presets are stored only in this browser\'s <b>localStorage</b>. They will <b>all disappear</b> if you clear <b>cookies and site data</b>, end an incognito session, or reset your profile. When you\'re finished, always back up with <b>📤 Export JSON</b> or per-card <b>💾 File</b> to <code>Downloads/suno_prompt_manager/preset/</code>.',
        'saved.btn.restore': 'Restore',
        'saved.btn.copyall': 'Copy all',
        'saved.btn.file': '💾 File',
        'saved.btn.file.tip': 'Save as individual file',
        'saved.btn.delete': 'Delete',
        // Search disclaimer
        'disclaimer.search': '<span class="text-accent-400 font-semibold">🔍 AI Search</span> &nbsp; Type an artist, song title, or "Artist - Song" freely. The AI returns a curated artist card + 5-8 signature songs with Suno-ready Style prompts. <b>Artist names are not sent to Suno</b> — they\'re used solely as reference labels for music-style classification.',
        // Dance machine misc
        'lbl.bpmhint': 'BPM hint',
        'lbl.styles': 'styles',
        'dance.card.tip': 'Click to auto-seed the base style on the right',
        'dance.nomatch': 'No styles match the current filters.',
        'dance.picked.empty': 'Pick tags from the categories above',
        // Help guide — Overview section
        'h-overview.p1': 'SU-Note is a <b>prompt manager</b> optimised for Suno AI music generation. Built on the Excel-based <em>Suno AI Korean Comprehensive Guide v8</em>, it organises <b>648 verified unique tags</b>, <b>867 style templates</b> (261 curated + 202 artists × 3 variants = 606 signatures), and <b>200 dance sub-genres</b> into a single screen for searching, composing, and copying.',
        'h-overview.p2': 'Three AI integrations — Claude · GPT · Gemini — automatically plan and generate both single songs and 12-track albums. K-music-specific options (Korean↔English lyric ratio, vocal↔rap balance, poetic-metaphor intensity, call-&-response, harmonies / chorus) are all adjustable via faders.',
        'h-overview.callout': '<b>Core values</b> — ① Surface only tags Suno actually recognises (with reflect-score colour) ② Korean-lyric detail ③ Treat artist styles as category labels only (zero artist names sent to Suno) ④ Batch plan 12-track albums ⑤ 200-style dance library.',
        // Help guide — Quickstart
        'h-quickstart.body': '<li><b>Register API keys</b> — Sidebar ⚙️ <b>Settings</b> → enter one of the Anthropic / OpenAI / Google keys → <b>Encrypt & save</b>. <span class="help-note">Encrypted with an auto-generated device key (AES-GCM 256-bit) stored only in your browser — no separate password needed.</span></li><li><b>Pick a style</b> — From the left-side <b>Presets</b> / <b>Tags</b> / <b>Dance Machine</b> tabs, find / pick a style → click <b>Load to Builder</b> or <b>Send to Builder</b>.</li><li><b>Adjust controls (optional)</b> — In the right-hand <b>Controls</b> panel set the faders (KR↔EN ratio · poetic metaphor · vocal↔rap), the call-&-response / harmony options, and a vocal arrangement style, then click <kbd class="cyan">▶ Load to Builder</kbd> once.</li><li><b>AI generation (optional)</b> — Type a concept in the central <b>AI</b> panel → Claude · GPT · Gemini auto-writes title & lyrics.</li><li><b>Copy into Suno</b> — <b>📋 Copy Style</b> · <b>📋 Copy Lyrics</b> to clipboard → paste each into Suno Custom Mode\'s Style / Lyrics fields and generate.</li>',
        // Help guide — Search section
        'h-search.intro': 'Search <b>any artist or song</b> beyond the curated 200 presets. Defaults to the AI\'s training data; when <b>🌐 Web search</b> is ticked it calls each provider\'s native web tool for live information.',
        'h-search.provider.body': '<li>Choose <b>Claude</b> · <b>GPT</b> · <b>Gemini</b> — <b>synced</b> with the main AI panel\'s provider (lyrics generator).</li><li>The selected provider must have its API key registered in ⚙️ Settings.</li>',
        'h-search.web.body': '<li><b>OFF (default)</b> — uses the AI\'s training data. <b>Fast and cheap</b>, but recent releases / chart info may be inaccurate (bounded by the model\'s cutoff date).</li><li><b>ON</b> — calls the provider\'s native web search tool:<ul><li>Claude: <code>web_search_20250305</code> (Anthropic native)</li><li>GPT: <code>web_search_preview</code> (via Responses API)</li><li>Gemini: <code>googleSearch</code> grounding</li></ul></li><li>The setting is saved to localStorage <code>su_search_web</code> — persists across visits.</li><li>The checkbox shows a <b>live cost hint</b>:<ul><li>OFF: "💡 OFF — using training data only"</li><li>ON: "💰 input/output tokens + web-search fees + 2-5× token usage + check provider console for unit prices"</li></ul></li><li>Web search unit prices (Nov 2025 reference):<ul><li>Claude: roughly <b>$10 / 1,000 searches</b></li><li>GPT (Responses): roughly <b>$10 / 1,000 queries</b></li><li>Gemini (Google Search grounding): roughly <b>$35 / 1,000 grounded requests</b></li><li>Actual billing adds the model\'s token usage — check each provider\'s current pricing page.</li></ul></li>',
        'h-search.input.body': '<li><b>Artist name only</b> — e.g. <code>Coldplay</code>, <code>아이유</code>, <code>Daft Punk</code></li><li><b>Song title only</b> — e.g. <code>Bohemian Rhapsody</code>, <code>강남스타일</code>, <code>좋은 날</code></li><li><b>Artist - Song</b> — e.g. <code>BTS - Dynamite</code>, <code>Billie Eilish - bad guy</code>, <code>아이유 좋은 날</code></li><li>Click the example chips below the input for quick tries.</li>',
        'h-search.korean.body': '<li>Even when you type a foreign artist / song in Hangul the AI maps it to the canonical name and searches:<ul><li><code>콜드플레이</code> → Coldplay · <code>비틀즈</code> → The Beatles · <code>퀸</code> → Queen</li><li><code>다프트펑크</code> → Daft Punk · <code>라디오헤드</code> → Radiohead · <code>마이클잭슨</code> → Michael Jackson</li><li><code>빌리아일리시</code> → Billie Eilish · <code>테일러스위프트</code> → Taylor Swift · <code>에드시런</code> → Ed Sheeran</li><li>Japanese acts: <code>요네즈켄시</code> → 米津玄師 · <code>우타다</code> → 宇多田ヒカル</li><li>Song titles too: <code>보헤미안랩소디</code> · <code>옐로우</code> · <code>비틀즈 - 헤이주드</code></li></ul></li><li>Native Korean acts (BTS · IU · Trot singers · OST etc.) stay in Korean — no reverse-translation.</li><li>Example chips marked "(한글)" verify the behaviour.</li>',
        'h-search.output.body': '<li><b>Artist card</b> — name (EN · KR) · nationality · active era · genre · 1-2 sentence summary (latest info from the web when enabled).</li><li><b>5-8 signature songs</b> — each with title · release year · Suno-ready Style (150-220 chars) · song structure · mood.</li><li>When searching "Artist - Song" the named track is pushed to the <b>top</b> of the result list.</li><li>If the AI cannot find the artist it returns <code>queryType: unknown</code> + empty results — no hallucinations.</li>',
        'h-search.use.body': '<li>Each song card\'s <kbd class="cyan">▶ Load to Builder</kbd> — auto-fills the Style chips and title. Lyrics stay empty; generate them separately from the Builder AI panel.</li><li><b>📋 Copy Style</b> — copy just that song\'s Style prompt to the clipboard.</li><li>To save permanently, load into Builder then use Style panel\'s <b>💾 Save as preset</b> — search results are not auto-saved.</li><li>The previous artist context (refArtist) is automatically cleared when loading — Search-fetched Style is not overwritten by subsequent AI lyric generation.</li>',
        'h-search.notes.body': '<li>One web search + one AI response ≈ <b>2-5× the token usage of a regular chat</b>. Longer search results inflate input tokens further.</li><li>Web-search pricing per provider (included in input tokens or billed separately) — check each vendor\'s documentation.</li><li>Style is auto-cleaned — Korean genre names · artist names are auto-stripped (guarantees Suno-safe English tokenisation).</li><li>If web search is blocked or returns too little, the AI may fall back to its own knowledge — treat BPM / release year etc. as reference only.</li>',
        // FAQ answers
        'faq.a.fill': 'It auto-locks when a preset is loaded so the original Excel Style isn\'t overwritten. Click the 🔒 badge to unlock — AI will then rewrite Style from scratch.',
        'faq.a.artistname': 'No. Artist names are just <b>category labels</b> to help you find a style. They are NOT included in the prompt sent to Suno. This is stated in 4 places across the UI.',
        'faq.a.lyricslang': 'Check the <b>Lyrics-language fader</b> in the Controls panel — it should sit at the far left (KR 100%). The AI follows the fader value exactly.',
        'faq.a.dupechip': 'Chips are auto-deduped (case-insensitive). If you still see one, hit <kbd>Ctrl+Shift+R</kbd> for a hard refresh.',
        'faq.a.korstyle': 'All Korean music terms are auto-replaced with English (트로트 → Trot, 발라드 → ballad). If you still see Korean, hard-refresh and retry.',
        'faq.a.namesinstyle': '250+ name patterns are auto-replaced with role labels (the lead vocalist, the producer, etc.). Brand-new names are caught in the next build.',
        'faq.a.langdirective': 'Language directives are stripped from Style automatically. The lyrics language is decided solely by the lyrics-language fader in the right-hand <b>Controls</b> panel.',
        'faq.a.startpanel': 'The Starting Point panel auto-shows only when <b>the Style chip stack is empty AND no preset is loaded</b>. As soon as even one chip arrives (manual add, handoff from another tab, etc.) it auto-hides. To bring it back, click <b>Reset</b> to wipe the builder — or pick a style from the left-side <b>Presets / Tags / Dance Machine / Search</b> tabs and send it to the builder.',
        'faq.a.chipsort': 'Intentional behaviour. Chips are stably sorted by <b>Suno reflect score</b>: 🟢 → 🟡 → ⚪ → 🔴. When the 200-char Suno limit truncates Style, the best-applied tags survive. The left-side dot colour shows the score (hover for a Korean tooltip). Within the same score the insertion order is preserved (stable sort).',
        'faq.a.reddot': 'Not necessarily. 🔴 means "Suno applies it poorly", not "wrong tag". If you want it kept as a mood / story signal, leave it — it will be pushed toward the tail and most likely truncated near the 200-char limit. Or remove it with the × button.',
        'faq.a.addbtn': 'It was merged into the "Load to Builder · Merge controls" button. When Call & Response or Harmonies is on, the chosen vocal-arrangement keywords are added at load time automatically.',
        'faq.a.loaddual': 'Yes — ① if a Starting Point preset is selected, it applies <b>preset Style + song structure + control options</b>. ② if only chips from Search / Dance Machine / Tags are present, it merges <b>only the control options</b> (Call & Response, Harmonies, Vocal Arrangement) into the existing chips. Either way, one click.',
        'faq.a.tabreset': 'No longer happens. Sidebar tabs are pure navigation now — builder chips / title / lyrics / AI prompt, search results, Dance Machine picks, and an in-progress 12-track album all persist across tab switches. That matters especially during a batch album lyric generation: you can flip back to the Builder to copy a track and the album state is untouched. Use each tab\'s explicit <b>Reset</b> button to clear its own content.',
        'faq.a.korsearch': 'Yes — AI auto-recognises Hangul transliterations. e.g. <code>콜드플레이</code> → Coldplay · <code>비틀즈</code> → The Beatles · <code>다프트펑크</code> → Daft Punk · <code>빌리아일리시</code> → Billie Eilish · <code>요네즈켄시</code> → Kenshi Yonezu. Song titles too: <code>보헤미안랩소디</code>, <code>옐로우</code>. Native Korean acts (BTS · IU · Trot singers) stay as-is.',
        'faq.a.blanklines': 'Intentional, for readability. A blank line is auto-guaranteed before every [Verse 1] / [Chorus] / etc. section header. Even if you edit it out manually, the next AI generation / preset load re-normalises it.',
        'faq.a.dancenotfound': 'Pick the closest seed style on the left, then use the tag composer on the right to add per-category tags. 8 categories × 210 tags is plenty of variation.',
        'faq.a.albumslow': 'About 5-15 seconds per song × 12 tracks = 1-3 minutes total. Response speed varies by AI model. Progress is shown in the status bar.',
        'faq.a.aimismatch': 'Be more specific in the AI prompt box — name the era, mood, story arc, key words. Adjust the metaphor / language / rap faders to match your intent.',
        'faq.a.offline': 'The UI is a static SPA, so only the initial load needs internet. AI generation always requires an external API call.',
        'faq.a.instrumental': 'Tick the <b>🎺 Instrumental</b> checkbox in the AI panel → <code>instrumental</code> is auto-injected into Style, the Lyrics textarea stays empty, and AI writes only a section roadmap with no sung lines. 7-9 sections × 80-120 bars guarantees a 3-4 minute track. Paste both into Suno Custom Mode as usual.',
        'faq.a.titlelang': 'In the AI panel\'s <b>Title language</b> dropdown pick <code>English</code> or whichever you want. <code>Auto</code> follows the lyrics-language fader; every other option forces the title language regardless of the lyrics. Works in instrumental mode too.',
        'faq.a.autopaste': 'No. Browser security (Same-Origin Policy) blocks SU-Note from touching Suno.com\'s DOM since they live on different origins. The only way is <code>📋 Copy Style</code> · <code>📋 Copy Lyrics</code> → click the Suno window → <kbd>Ctrl+V</kbd>.',
        'faq.a.wfsplit': 'It hasn\'t vanished — it auto-relocates into a <b>compact strip inside the sidebar</b>. Turning split mode off moves it back to the top of the builder body.',
        'faq.a.aistyle': 'Recently fixed. Previously only the chips changed while <code>state.selectedArtist</code> (which the AI reads as context) was left over from the prior preset, so AI forced that artist\'s style. Now every handoff path — Dance send / saved-preset restore / album-track send — clears the stale context automatically.',
        'faq.a.shortinstr': 'Suno uses Lyrics-field character count and section density as length signals. Instrumental mode forces the AI to emit 7-9 sections + explicit bar counts in every bracket (8/16/24 bars) + an "extended arrangement" length hint in Style. If a track still comes back short, regenerate once — Suno itself has variance.',
        'faq.a.storage': 'Every preset / album / API key / theme / workflow-state value lives only in the <b>browser\'s localStorage</b>. Never sent to any server.',
        'faq.a.mobile': 'Responsive design is in place. Below 1100px the sidebar, faders and tag grid stack vertically.',
        'faq.a.lost': 'Either "Clear cookies & site data" in your browser or ending an incognito session wiped localStorage. Use <b>📥 Import</b> to restore the JSON file you backed up to <code>Downloads/suno_prompt_manager/</code>. If you have no backup, recovery is impossible. ⚠️ Export to JSON regularly.',
        'faq.a.transfer': 'Export 📤 JSON on the current device, move the file to the new device, then 📥 import on the same domain (or same local server). Different domains can\'t share localStorage automatically.',
      },
    };

    const KEY = 'su_lang';
    const seg = document.getElementById('lang-seg');
    let current = 'ko';

    function t(key) {
      const m = STRINGS[current] || STRINGS.ko;
      return Object.prototype.hasOwnProperty.call(m, key) ? m[key]
           : Object.prototype.hasOwnProperty.call(STRINGS.ko, key) ? STRINGS.ko[key]
           : null;
    }

    // Free-form text-node translation for big prose blocks (help
    // modal cards, FAQ <dd> bodies, etc.) that we have not tagged
    // individually. Caches the original Korean on a `__suOrig` slot
    // of each text node so toggling KO ⇄ EN is reversible.
    // - Skips text inside <code>, <kbd>, <script>, <style>.
    // - Skips any node whose ancestor carries data-i18n (already
    //   handled by the structured path above).
    const TDX_ROOTS = '#help-modal, .workflow-chart, .disclaimer, .help-footer-note';
    function walkAndTranslate(root) {
      if (!root) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      const nodes = [];
      let n; while ((n = walker.nextNode())) nodes.push(n);
      nodes.forEach(node => {
        if (!node.nodeValue) return;
        // Cache the original Korean exactly once.
        if (node.__suOrig === undefined) node.__suOrig = node.nodeValue;
        const orig = node.__suOrig;
        if (!orig.trim()) return;
        // Skip technical / already-tagged subtrees.
        let p = node.parentElement;
        let skip = false;
        while (p && p !== root) {
          if (/^(CODE|KBD|SCRIPT|STYLE|TEXTAREA)$/i.test(p.tagName)) { skip = true; break; }
          if (p.hasAttribute('data-i18n')) { skip = true; break; }
          p = p.parentElement;
        }
        if (skip) return;
        node.nodeValue = (current === 'en') ? tdx(orig) : orig;
      });
    }

    function apply(lang) {
      current = lang;
      document.documentElement.setAttribute('lang', lang);
      document.documentElement.setAttribute('data-lang', lang);
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const v = t(el.dataset.i18n);
        if (v == null) return;
        if (/<[a-z]/i.test(v)) el.innerHTML = v; else el.textContent = v;
      });
      document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const v = t(el.dataset.i18nTitle);
        if (v != null) el.setAttribute('title', v);
      });
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const v = t(el.dataset.i18nPlaceholder);
        if (v != null) el.setAttribute('placeholder', v);
      });
      // Big prose blocks — DOM text-node translation pass.
      document.querySelectorAll(TDX_ROOTS).forEach(walkAndTranslate);
      if (seg) seg.querySelectorAll('.seg-btn').forEach(b => {
        b.setAttribute('aria-pressed', b.dataset.langVal === lang ? 'true' : 'false');
      });
      renderStats();
      document.dispatchEvent(new CustomEvent('su:lang', { detail: { lang } }));
    }

    // Compute the catalog totals from the loaded data and inject them
    // into every [data-stats] target (topbar + footer). Counting from
    // live data — including hand-maintained data/extras.js additions —
    // means the displayed numbers never drift from reality.
    //
    // Tag count is unique tags (rows in data.entries share the same
    // tag across categories — we dedupe). Templates fold in the
    // per-artist signature catalog (each artist contributes 3 ready-
    // to-use Style prompts: signature + alt1 + alt2 from
    // SUNO_ARTIST_VARIANTS), since both classes of asset are "load
    // straight into the builder" style recipes.
    function renderStats() {
      const D  = window.SUNO_DATA || {};
      const EX = window.SUNO_DATA_EXTRAS || {};
      const V  = window.SUNO_ARTIST_VARIANTS || {};
      const tagSet = new Set();
      for (const e of (D.entries || [])) {
        // Count only tags that can actually be added as a Style chip —
        // mirror the palette/chip usability filter so the headline
        // number matches what the app surfaces. Skip placeholder rows,
        // dash/exclude fields, non-bracket Lyrics tips, and majority-
        // Korean guide concepts; dedupe the rest case-insensitively.
        const tag = (e.tag || '').trim();
        if (!tag) continue;
        if (tag === '핵심 Style 프롬프트' || tag === '복사용') continue;
        if (e.field === '-' || e.field === 'Exclude') continue;
        if (e.field === 'Lyrics' && !/^\[.+\]/.test(tag)) continue;
        const kc = (tag.match(/[가-힣]/g) || []).length;
        if (kc > 0 && kc / tag.length > 0.4) continue;
        tagSet.add(tag.toLowerCase());
      }
      let artistStyles = 0;
      const allArtists = [...(D.artists || []), ...(EX.artists || [])];
      for (const a of allArtists) {
        const v = V[a.artist];
        const has3 = v && (v.alt1 || v.ballad) && (v.alt2 || v.anthem);
        artistStyles += has3 ? 3 : 1;
      }
      const n = {
        tags:      tagSet.size,
        templates: (D.templates || []).length + (EX.templates || []).length + artistStyles,
        dance:     (window.SUNO_DANCE_STYLES || []).length,
      };
      const fmt = v => v.toLocaleString('en-US');
      const tmpl = t('stats.tmpl') || 'Suno V5.5 · {tags} 태그 · {templates} 템플릿 · {dance} 댄스';
      const text = tmpl
        .replace('{tags}',      fmt(n.tags))
        .replace('{templates}', fmt(n.templates))
        .replace('{dance}',     fmt(n.dance));
      document.querySelectorAll('[data-stats]').forEach(el => { el.textContent = text; });
    }

    // Expose for other modules that need to translate at render time.
    window.SU_T = t;
    window.SU_LANG = () => current;

    // Re-render dynamic strings (chips empty-state, Style stats,
    // Lyrics counter, dance machine grid labels, etc.) on language
    // change. Functions are hoisted inside the outer IIFE so they
    // are reachable by the time the user clicks the language seg.
    document.addEventListener('su:lang', () => {
      try { if (typeof renderChips    === 'function') renderChips();    } catch {}
      try { if (typeof renderStyleOut === 'function') renderStyleOut(); } catch {}
      try { if (typeof updateStats    === 'function') updateStats();    } catch {}
      // Settings modal — re-render the custom-option label and refresh
      // the per-model note so it swaps to the active language.
      try {
        const modelSel = document.getElementById('settings-model');
        if (modelSel) {
          const customOpt = modelSel.querySelector('option[value="__custom__"]');
          if (customOpt) customOpt.textContent = tx('settings.model.custom', '✏️ 직접 입력 (custom)');
        }
        if (typeof refreshModelNote === 'function') refreshModelNote();
      } catch {}
      try { if (typeof renderCurrentMeta === 'function') renderCurrentMeta(); } catch {}
      try { if (typeof renderPalette  === 'function') renderPalette();  } catch {}
      try { if (typeof renderAlbum    === 'function') renderAlbum();    } catch {}
      try { if (typeof renderSavedAlbums === 'function') renderSavedAlbums(); } catch {}
      try { if (typeof renderPresets === 'function' && state.tab === 'presets') renderPresets(); } catch {}
      // Search tab — re-render results + cost hint if loaded
      try { if (typeof updateSearchCostHint === 'function') updateSearchCostHint(); } catch {}
      try {
        if (typeof renderSearchResults === 'function' &&
            typeof lastSearchResult !== 'undefined' && lastSearchResult) {
          renderSearchResults(lastSearchResult);
        }
      } catch {}
      // Album-side slider readouts — re-fire input so attachSlider's
      // formatter re-evaluates with the new language words.
      try {
        ['#album-opt-lang', '#album-opt-meta', '#album-opt-rap', '#album-lang-slider']
          .forEach(sel => { const el = document.querySelector(sel); if (el) el.dispatchEvent(new Event('input')); });
      } catch {}
      // Slider readouts (한글 X% / 직설 N% / 보컬 N%) regenerate so
      // the localised words swap in place.
      try { if (typeof applyLangUI     === 'function') applyLangUI();     } catch {}
      try { if (typeof applyMetaphorUI === 'function') applyMetaphorUI(); } catch {}
      try { if (typeof applyRapUI      === 'function') applyRapUI();      } catch {}
      // Tag / Artist / Album-era dropdowns rebuilt — their first
      // <option> placeholder uses tx() so the localised label appears
      // immediately. The currently-active tab's render fn re-emits
      // the full <select> innerHTML.
      try {
        if (state.tab === 'artists' && typeof renderArtists === 'function') renderArtists();
        if (state.tab === 'guide'   && typeof renderGuideList === 'function') { renderGuideList(); }
      } catch {}
      // Dance machine — re-render family chips / tag tabs / list /
      // picked-tags container if the user is on that tab. The init
      // sets dataset.ready so we only refresh when populated.
      try {
        const famBox = document.getElementById('dance-fam-row');
        if (famBox && famBox.children.length > 0) {
          if (typeof initDanceMachine === 'function' && state.tab === 'dance') {
            // Rebuild the family / category tabs + list. Picked state
            // and seed are preserved via danceState.
            const fams = window.SUNO_DANCE_FAMILIES || [];
            const enMode = window.SU_LANG && window.SU_LANG() === 'en';
            famBox.innerHTML = fams.map(f => {
              // EN mode: English label only. KO mode: Korean + (English).
              const primary = enMode ? f.label_en : f.label_ko;
              const secondary = enMode ? '' : f.label_en;
              const tail = secondary ? ` <span class="text-[10px] opacity-60">(${escapeHtml(secondary)})</span>` : '';
              return `<button class="cat-chip ${f.id===danceState.fam?'active':''}" data-fam="${escapeHtml(f.id)}">${escapeHtml(primary)}${tail}</button>`;
            }).join('');
            famBox.querySelectorAll('[data-fam]').forEach(b => b.addEventListener('click', () => {
              danceState.fam = b.dataset.fam;
              famBox.querySelectorAll('[data-fam]').forEach(x => x.classList.toggle('active', x.dataset.fam === danceState.fam));
              drawDanceList();
            }));
            const catRow = document.getElementById('dance-tag-cats');
            const cats = window.SUNO_DANCE_TAG_CATS || [];
            if (catRow) {
              catRow.innerHTML = cats.map(c => `<button class="dance-tag-tab ${c.id===danceState.cat?'active':''}" data-tcat="${escapeHtml(c.id)}">${escapeHtml(tdx(c.label))}</button>`).join('');
              catRow.querySelectorAll('[data-tcat]').forEach(b => b.addEventListener('click', () => {
                danceState.cat = b.dataset.tcat;
                catRow.querySelectorAll('[data-tcat]').forEach(x => x.classList.toggle('active', x.dataset.tcat === danceState.cat));
                drawDanceTagList();
              }));
            }
            drawDanceList();
            drawDanceTagList();
            drawPicked();
          }
        }
      } catch {}
      // Album mood chips — keep current selection, re-emit labels.
      try {
        const moodBox = document.getElementById('album-mood-chips');
        if (moodBox && moodBox.dataset.ready === '1') {
          const active = new Set(Array.from(moodBox.querySelectorAll('.cat-chip.active'))
                                       .map(b => b.dataset.mood));
          moodBox.innerHTML = ALBUM_MOOD_IDS.map(m =>
            `<button class="cat-chip${active.has(m)?' active':''}" data-mood="${escapeHtml(m)}">${escapeHtml(moodLabel(m))}</button>`
          ).join('');
          moodBox.querySelectorAll('.cat-chip').forEach(b => {
            b.addEventListener('click', () => {
              const id = b.dataset.mood;
              if (album.moods.has(id)) album.moods.delete(id);
              else album.moods.add(id);
              b.classList.toggle('active', album.moods.has(id));
            });
          });
        }
      } catch {}
      // Dropdown placeholders re-render — the "Select era" / "Style
      // group (optional)" / "Preset (optional)" labels live in the
      // first <option> of each select. Re-running the populate
      // functions reuses the current selection while swapping the
      // placeholder text.
      try {
        const eraSel = document.getElementById('filter-era');
        const genSel = document.getElementById('filter-genre');
        const eraVal = eraSel ? eraSel.value : '';
        const genVal = genSel ? genSel.value : '';
        if (typeof populateEraSelect    === 'function') populateEraSelect();
        if (typeof populateGenreSelect  === 'function') populateGenreSelect(eraVal);
        if (typeof populateArtistSelect === 'function') populateArtistSelect(eraVal, genVal);
        // Re-applying the values keeps the user's selection.
        if (eraSel) eraSel.value = eraVal;
        if (genSel) genSel.value = genVal;
      } catch {}
      // Album tab — re-render era / style-group / preset dropdowns so
      // their option labels swap to the active language. Preserve the
      // user's current selections across the rebuild.
      try {
        const albEra = document.getElementById('album-era');
        const albGrp = document.getElementById('album-style-group');
        const albPre = document.getElementById('album-preset');
        const eraVal = albEra ? albEra.value : '';
        const grpVal = albGrp ? albGrp.value : '';
        const preVal = albPre ? albPre.value : '';
        document.dispatchEvent(new CustomEvent('su:album-redraw-dropdowns'));
        if (albEra) albEra.value = eraVal;
        if (albGrp) albGrp.value = grpVal;
        if (albPre) albPre.value = preVal;
      } catch {}
    });

    const saved = localStorage.getItem(KEY) || 'ko';
    apply(['ko', 'en'].includes(saved) ? saved : 'ko');

    if (seg) seg.addEventListener('click', e => {
      const btn = e.target.closest('.seg-btn');
      if (!btn) return;
      const next = btn.dataset.langVal;
      if (next === current) return;
      apply(next);
      localStorage.setItem(KEY, next);
    });
  })();

  // Split-mode toggle — narrow layout so the app fits on the left half
  // of the screen with Suno AI on the right. Persisted in localStorage.
  // Also relocates the beginner workflow chart into the sidebar so the
  // narrow main column isn't crowded by the 4-step strip.
  (function initSplit() {
    const root = document.documentElement;
    const btn  = document.getElementById('split-switch');
    const KEY  = 'su_split';
    const chart   = document.getElementById('workflow-chart');
    const slot    = document.getElementById('sidebar-workflow-slot');
    const home    = chart?.parentNode || null;
    const homeRef = chart?.nextSibling || null;
    function relocate(on) {
      if (!chart || !slot || !home) return;
      if (on && chart.parentNode !== slot) {
        slot.appendChild(chart);
        chart.classList.add('in-sidebar');
      } else if (!on && chart.parentNode === slot) {
        home.insertBefore(chart, homeRef);
        chart.classList.remove('in-sidebar');
      }
    }
    function apply(on) {
      if (on) root.setAttribute('data-split', '1');
      else root.removeAttribute('data-split');
      relocate(on);
    }
    const saved = localStorage.getItem(KEY) === '1';
    apply(saved);
    if (btn) btn.addEventListener('click', () => {
      const next = root.getAttribute('data-split') !== '1';
      apply(next);
      localStorage.setItem(KEY, next ? '1' : '0');
      toast(next ? '🔀 분할 모드 켜짐 — 우측 절반에 Suno 를 배치하세요' : '분할 모드 꺼짐');
    });
  })();

  // Suno 열기 — opens/focuses https://suno.com/ in a sized popup.
  // In split mode, defaults the window to the right half of the screen
  // and remembers any user-customised size/position across page loads.
  // A live reference to the popup is kept (window-name 'suno_split'),
  // so subsequent clicks focus the existing window instead of opening
  // a duplicate. Cross-origin restrictions prevent us from reading
  // the popup's current screenX/Y, but the cached opener spec is
  // enough for "open at the same place every time" UX.
  const SUNO_POS_KEY = 'su_suno_pos';
  let sunoWin = null;
  function loadSunoPos() {
    try { return JSON.parse(localStorage.getItem(SUNO_POS_KEY) || 'null'); }
    catch { return null; }
  }
  function saveSunoPos(p) { localStorage.setItem(SUNO_POS_KEY, JSON.stringify(p)); }

  function openOrFocusSuno() {
    const root = document.documentElement;
    const split = root.getAttribute('data-split') === '1';
    const url = 'https://suno.com/';

    if (sunoWin && !sunoWin.closed) {
      try { sunoWin.focus(); toast(tx('toast.suno.focus', '🎵 Suno 창으로 전환')); return; }
      catch {}
    }

    if (split && window.screen) {
      const saved = loadSunoPos();
      const w = saved?.w || Math.round(window.screen.availWidth / 2);
      const h = saved?.h || window.screen.availHeight;
      const left = saved?.left ?? (window.screen.availLeft + Math.round(window.screen.availWidth / 2));
      const top  = saved?.top  ?? (window.screen.availTop || 0);
      const features = `width=${w},height=${h},left=${left},top=${top},popup=yes`;
      sunoWin = window.open(url, 'suno_split', features);
      if (!sunoWin || sunoWin.closed) {
        sunoWin = window.open(url, '_blank', 'noopener,noreferrer');
        toastError('팝업 차단 — 새 탭에서 열렸습니다. 윈도우 키 + ← / → 로 화면 절반에 배치하세요');
      } else {
        saveSunoPos({ w, h, left, top });
        toast(saved ? '🎵 Suno 재배치됨 (저장된 위치)' : '🎵 Suno 가 우측 절반에 열렸습니다');
      }
    } else {
      sunoWin = window.open(url, 'suno_split', 'noopener,noreferrer');
    }
  }

  (function initOpenSuno() {
    const btn = document.getElementById('btn-open-suno');
    if (btn) btn.addEventListener('click', openOrFocusSuno);
  })();

  // Mobile drawer — hamburger button + backdrop dismiss + ESC + tab autoclose.
  (function initMobileDrawer() {
    const root = document.documentElement;
    const btn  = document.getElementById('mobile-menu-btn');
    const back = document.getElementById('sidebar-backdrop');
    const side = document.getElementById('app-sidebar');
    if (!btn || !side) return;
    const open  = () => { root.classList.add('sidebar-open'); btn.setAttribute('aria-expanded', 'true'); };
    const close = () => { root.classList.remove('sidebar-open'); btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', () => {
      root.classList.contains('sidebar-open') ? close() : open();
    });
    if (back) back.addEventListener('click', close);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && root.classList.contains('sidebar-open')) close();
    });
    // Auto-close when a nav tab or sidebar action is tapped on mobile
    side.addEventListener('click', e => {
      const target = e.target.closest('.tab-btn, .side-action');
      if (target && window.matchMedia('(max-width: 900px)').matches) close();
    });
  })();

  // Help modal
  (function initHelp() {
    const m = document.getElementById('help-modal');
    const open  = (anchor) => {
      m.classList.remove('hidden');
      m.setAttribute('aria-hidden', 'false');
      if (anchor) {
        // Defer to next paint so the modal is in DOM flow before we scroll.
        requestAnimationFrame(() => {
          const target = m.querySelector(anchor);
          if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
        });
      }
    };
    const close = () => { m.classList.add('hidden'); m.setAttribute('aria-hidden', 'true'); };
    const btn = document.getElementById('btn-help');
    if (btn) btn.addEventListener('click', () => open());
    // Brand version chip → open guide at #h-versions
    const brand = document.querySelector('.brand-wordmark[href="#h-versions"]');
    if (brand) brand.addEventListener('click', e => { e.preventDefault(); open('#h-versions'); });
    document.querySelectorAll('#help-modal [data-close-modal], #help-modal .modal-backdrop')
      .forEach(el => el.addEventListener('click', close));
    document.addEventListener('keydown', e => {
      if (e.key === '?' && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) { e.preventDefault(); open(); }
      if (e.key === 'Escape' && !m.classList.contains('hidden')) close();
    });
  })();

  // ====================================================================
  // SEARCH — AI-powered free-text artist/song discovery
  // ====================================================================
  // Extends the curated 200-preset catalogue to "any artist on Earth" by
  // delegating to the configured AI provider. Returns artist info + 5-8
  // representative songs each with a Suno-ready Style field. The user
  // picks one → loaded into the builder via the same chip pipeline used
  // by the dedicated 프리셋 / 댄싱머신 tabs (refArtist context cleared,
  // ai-fill-style turned off so AI generations don't overwrite the
  // searched style).
  let lastSearchResult = null;

  function initSearchTab() {
    const input  = $('#search-input');
    const btn    = $('#search-btn');
    const webCb  = $('#search-use-web');
    if (!input || !btn) return;
    input.dataset.ready = '1';

    syncSearchProvTabs();
    document.querySelectorAll('#search-prov-tabs [data-search-prov]').forEach(b => {
      b.addEventListener('click', () => {
        ai.provider = b.dataset.searchProv;
        const meta = window.SunoVault.getMeta();
        ai.model = meta.models?.[ai.provider] || window.SunoAI.DEFAULT_MODEL[ai.provider];
        window.SunoVault.setMeta({ provider: ai.provider });
        syncAIProviderTabs();
        syncSearchProvTabs();
        updateSearchCostHint();
      });
    });

    // Web-search preference — opt-in, default OFF, persisted.
    if (webCb) {
      webCb.checked = localStorage.getItem('su_search_web') === '1';
      webCb.addEventListener('change', () => {
        localStorage.setItem('su_search_web', webCb.checked ? '1' : '0');
        updateSearchCostHint();
      });
    }
    updateSearchCostHint();

    const run = () => doSearch(input.value);
    btn.addEventListener('click', run);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
    document.querySelectorAll('.search-example').forEach(b => b.addEventListener('click', () => {
      input.value = b.dataset.q || '';
      run();
    }));
  }

  function syncSearchProvTabs() {
    document.querySelectorAll('#search-prov-tabs [data-search-prov]').forEach(b =>
      b.classList.toggle('active', b.dataset.searchProv === ai.provider));
  }

  // Per-provider published web-search pricing snapshot (Nov 2025).
  // These are approximate per-search surcharges — actual billing also
  // depends on the input/output tokens used by the model. Update when
  // providers publish new tariffs.
  const SEARCH_COST_BY_PROVIDER = {
    anthropic: '+ $10 / 1K searches (Anthropic web_search)',
    openai:    '+ $10 / 1K queries (Responses web_search_preview)',
    google:    '+ $35 / 1K grounded requests (Google Search grounding)',
  };
  function updateSearchCostHint() {
    const hint = document.getElementById('search-cost-hint');
    const cb   = document.getElementById('search-use-web');
    if (!hint) return;
    const on = !!(cb && cb.checked);
    if (on) {
      const provLabel = window.SunoAI.PROVIDER_LABEL[ai.provider] || ai.provider;
      const surcharge = SEARCH_COST_BY_PROVIDER[ai.provider] || tx('search.surcharge.default', '+ 웹 검색 사용료');
      hint.textContent = `${tx('search.cost.on', '💰 입력·출력 토큰 + {surcharge} · 토큰 사용량은 비검색 대비 2–5× · {prov} 콘솔에서 실제 단가 확인').replace('{surcharge}', surcharge).replace('{prov}', provLabel)}`;
      hint.className = 'text-xs ml-2 cost-on';
    } else {
      hint.textContent = tx('search.cost.off', '💡 OFF — 학습 데이터만 사용 (빠르고 저렴, 단 최신 정보 부정확 가능)');
      hint.className = 'text-xs ml-2 cost-off';
    }
  }

  async function doSearch(query) {
    const status = $('#search-status');
    const results = $('#search-results');
    const btn = $('#search-btn');
    query = (query || '').trim();
    if (!query) { status.textContent = tx('search.status.empty', '검색어를 입력하세요.'); status.style.color = '#fca5a5'; return; }
    if (!ai.cryptoKey) {
      status.textContent = tx('search.status.needkey', '먼저 ⚙️ 설정에서 API 키를 등록하세요.');
      status.style.color = '#fca5a5';
      openSettings();
      return;
    }
    let apiKey;
    try { apiKey = await window.SunoVault.getKey(ai.cryptoKey, ai.provider); }
    catch (e) { status.textContent = `${tx('status.decrypt.fail', '키 복호화 실패')}: ${e.message}`; status.style.color = '#fca5a5'; return; }
    if (!apiKey) {
      status.textContent = `${window.SunoAI.PROVIDER_LABEL[ai.provider]} ${tx('aistat.nokey', 'API 키가 없습니다')}.`;
      status.style.color = '#fca5a5';
      openSettings();
      return;
    }

    const model = ai.model || window.SunoAI.DEFAULT_MODEL[ai.provider];
    const useWeb = !!document.getElementById('search-use-web')?.checked;
    status.textContent = `${tx('search.status.searching', '검색 중…')} (${window.SunoAI.PROVIDER_LABEL[ai.provider]} / ${model}${useWeb ? ` · ${tx('search.with.web', '🌐 웹 검색')}` : ` · ${tx('search.with.training', '학습 데이터')}`})`;
    status.style.color = '';
    btn.disabled = true; btn.textContent = '⏳';
    results.innerHTML = '';
    try {
      const out = await window.SunoAI.searchPresets({
        provider: ai.provider, apiKey, model, query, useWeb,
        lang: (window.SU_LANG && window.SU_LANG() === 'en') ? 'en' : 'ko',
      });
      lastSearchResult = out;
      renderSearchResults(out);
      const songCount = (out.songs || []).length;
      if (out.queryType === 'unknown' || songCount === 0) {
        status.textContent = tx('search.status.nores', '❓ AI 가 결과를 찾지 못했습니다. 다른 검색어를 시도하세요.');
        status.style.color = '#fca5a5';
      } else {
        status.textContent = `✅ ${out.artist?.name || query} — ${songCount}${tx('search.status.found.suffix', '곡 검색됨')}`;
        status.style.color = '#9ff0d4';
      }
    } catch (e) {
      status.textContent = '❌ ' + e.message;
      status.style.color = '#fca5a5';
      toastError(e.message);
    } finally {
      btn.disabled = false; btn.textContent = '검색';
    }
  }

  function renderSearchResults(out) {
    const root = $('#search-results');
    if (!out || !Array.isArray(out.songs) || out.songs.length === 0) {
      root.innerHTML = '';
      return;
    }
    const a = out.artist || {};
    const artistCard = `
      <div class="panel search-artist-card mb-3">
        <div class="flex items-start gap-3">
          <div class="flex-1">
            <h3 class="text-lg" style="color: var(--primary); font-weight: 700;">
              ${escapeHtml(a.name || tx('search.noname', '(이름 없음)'))}
              ${a.name_ko ? `<span class="text-xs" style="color: var(--text-secondary); margin-left: 6px;">${escapeHtml(a.name_ko)}</span>` : ''}
            </h3>
            <div class="text-xs mt-1" style="color: var(--text-secondary);">
              ${[a.country, a.era, a.genre].filter(Boolean).map(escapeHtml).join(' · ')}
            </div>
            ${a.summary ? `<p class="text-sm mt-2" style="color: var(--text-primary);">${escapeHtml(a.summary)}</p>` : ''}
          </div>
          <span class="text-xs" style="color: var(--text-4); font-family: var(--f-mono);">
            ${escapeHtml(out.queryType || '')}
          </span>
        </div>
      </div>`;

    const songCards = out.songs.map((s, i) => `
      <div class="art-card search-song-card" data-song-idx="${i}">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h3>🎵 ${escapeHtml(s.title || tx('search.notitle', '(제목 없음)'))} <span class="text-slate-500 text-xs">${s.year || ''}</span></h3>
            <div class="meta">${escapeHtml(s.mood || '')}</div>
          </div>
          <span class="era">${escapeHtml(s.structure || '')}</span>
        </div>
        <div class="style">${escapeHtml(s.style || '')}</div>
        <div class="actions">
          <button class="btn-load-builder" data-search-load="${i}">${tx('art.btn.load', '빌더에 로드')}</button>
          <button class="btn-secondary" data-search-copy="${i}">${tx('art.btn.copy', 'Style 복사')}</button>
        </div>
      </div>
    `).join('');

    root.innerHTML = artistCard + `<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">${songCards}</div>`;

    $$('#search-results [data-search-load]').forEach(b => b.addEventListener('click', () => {
      const idx = parseInt(b.dataset.searchLoad, 10);
      loadSearchSongToBuilder(idx);
    }));
    $$('#search-results [data-search-copy]').forEach(b => b.addEventListener('click', () => {
      const idx = parseInt(b.dataset.searchCopy, 10);
      copyText(lastSearchResult?.songs?.[idx]?.style || '');
    }));
  }

  function loadSearchSongToBuilder(idx) {
    if (!lastSearchResult || !lastSearchResult.songs) return;
    const s = lastSearchResult.songs[idx];
    if (!s) return;

    // Style chips — run the same defensive sanitisation pipeline used
    // for Excel presets so any Korean genre token, artist name, or
    // language directive the AI may have slipped in gets normalised
    // before chips are created. The AI-search result is treated as a
    // one-off user-curated style (NOT an Excel preset) — so we clear
    // any stale refArtist / activeVariantView and turn off
    // ai-fill-style so future AI lyric generations don't overwrite
    // this freshly-loaded style.
    const sanitized = sanitizeStyleString(s.style || '');
    state.chips = dedupeTags(sanitized.split(',').map(stripStyleBrackets))
      .map(tag => ({ tag, source: 'search' }));
    state.selectedArtist = null;
    state.activeVariantView = null;

    // Song title is intentionally NOT carried over — loading a search
    // result brings only the Style, so the builder keeps whatever title
    // the user already typed (and an empty title lets the AI name it).

    // Lyrics — clear; user will generate via AI panel using this style
    $('#lyrics-out').value = '';

    // AI-fill state — keep Style off so we don't clobber the searched
    // style, but leave Title / Lyrics as user defaults
    const fillStyle = document.getElementById('ai-fill-style');
    if (fillStyle) fillStyle.checked = false;
    setStyleFillLock(false);

    // Merge any active Control panel options (콜앤리스폰스 · 화음·코러스 +
    // chosen vocal arrangement style) into the chip stack so a single
    // 검색 → 빌더 로드 captures both the searched song's style AND the
    // user's 제어 panel selections — mirrors the loadSelectedArtist
    // behaviour for curated presets.
    const vocalArrApplied = applyControlPanelToChips();

    renderChips(); renderStyleOut(); renderCurrentMeta(); updateStats();
    setTab('builder');
    const arrNote = vocalArrApplied > 0 ? ` · ${tx('toast.vocal.added', '보컬편곡 키워드')} ${vocalArrApplied}${tx('toast.added.suffix', '개 추가')}` : '';
    toast(`🔍 → 🎼 ${s.title} ${tx('toast.search.loaded', '빌더 로드됨')}${arrNote}`);
  }

  // ====================================================================
  // DANCING MACHINE — 200 dance-style guide + dance-specific tag combiner
  // ====================================================================
  const danceState = { fam: 'all', bpm: '', q: '', cat: 'drums', seed: '', picked: [] };

  function initDanceMachine() {
    const styles = window.SUNO_DANCE_STYLES || [];
    const fams   = window.SUNO_DANCE_FAMILIES || [];
    const tags   = window.SUNO_DANCE_TAGS || [];
    const cats   = window.SUNO_DANCE_TAG_CATS || [];

    // family chips
    const famRow = $('#dance-fam-row');
    famRow.innerHTML = fams.map(f => {
      const en = (window.SU_LANG && window.SU_LANG() === 'en');
      // EN mode: English label only — no Korean parens.
      // KO mode: Korean label primary + English in parens.
      const primary = en ? f.label_en : f.label_ko;
      const secondary = en ? '' : f.label_en;
      const tail = secondary ? ` <span class="text-[10px] opacity-60">(${escapeHtml(secondary)})</span>` : '';
      return `<button class="cat-chip ${f.id===danceState.fam?'active':''}" data-fam="${escapeHtml(f.id)}">${escapeHtml(primary)}${tail}</button>`;
    }).join('');
    famRow.querySelectorAll('[data-fam]').forEach(b => b.addEventListener('click', () => {
      danceState.fam = b.dataset.fam;
      famRow.querySelectorAll('[data-fam]').forEach(x => x.classList.toggle('active', x.dataset.fam === danceState.fam));
      drawDanceList();
    }));

    $('#dance-q').addEventListener('input', () => { danceState.q = $('#dance-q').value.trim().toLowerCase(); drawDanceList(); });
    $('#dance-bpm').addEventListener('change', () => { danceState.bpm = $('#dance-bpm').value; drawDanceList(); });

    // tag category tabs
    const catRow = $('#dance-tag-cats');
    catRow.innerHTML = cats.map(c => `<button class="dance-tag-tab ${c.id===danceState.cat?'active':''}" data-tcat="${escapeHtml(c.id)}">${escapeHtml(tdx(c.label))}</button>`).join('');
    catRow.querySelectorAll('[data-tcat]').forEach(b => b.addEventListener('click', () => {
      danceState.cat = b.dataset.tcat;
      catRow.querySelectorAll('[data-tcat]').forEach(x => x.classList.toggle('active', x.dataset.tcat === danceState.cat));
      drawDanceTagList();
    }));

    // seed textarea — manual edit
    $('#dance-seed-style').addEventListener('input', () => {
      danceState.seed = $('#dance-seed-style').value;
      composeDanceOutput();
    });

    // copy / send / reset
    $('#dance-copy').addEventListener('click', () => copyText($('#dance-output').value));
    $('#dance-send').addEventListener('click', () => {
      const text = $('#dance-output').value.trim();
      if (!text) { toast(tx('toast.style.empty', '조립된 Style이 비어있습니다')); return; }
      state.chips = dedupeTags(text.split(',').map(stripStyleBrackets)).map(t => ({ tag: t, source: 'ai' }));
      // Dance presets ship their own style world — wipe any previously
      // selected artist/template context so the AI generator can't drag
      // its `refArtist` style/structure/tags into the lyric prompt.
      // Also turn "Style 채우기" off so the AI keeps the dance chips
      // the user just curated, and clear the preset-specific lock badge
      // that would otherwise display the wrong protection reason.
      state.selectedArtist = null;
      state.activeVariantView = null;
      const fill = document.getElementById('ai-fill-style');
      if (fill) fill.checked = false;
      setStyleFillLock(false);
      renderChips(); renderStyleOut(); renderCurrentMeta();
      setTab('builder');
      toast(tx('toast.sent.builder', '빌더의 Style 칩으로 전송됨 — 아티스트 컨텍스트 초기화'));
    });
    $('#dance-reset').addEventListener('click', () => {
      danceState.seed = ''; danceState.picked = [];
      $('#dance-seed-style').value = '';
      composeDanceOutput(); drawPicked();
    });

    drawDanceList();
    drawDanceTagList();
    drawPicked();
    composeDanceOutput();
    $('#dance-list').dataset.ready = '1';
  }

  function bpmInBucket(bpmField, bucket) {
    if (!bucket) return true;
    // bpmField is a string like "120-128" or "140 / 70" or "140-160 (70-80)"
    const matches = String(bpmField).match(/\d{2,3}/g) || [];
    const nums = matches.map(Number).filter(n => n >= 50 && n <= 320);
    if (!nums.length) return false;
    const [lo, hi] = bucket.split('-').map(Number);
    return nums.some(n => n >= lo && n < hi);
  }

  function drawDanceList() {
    const styles = window.SUNO_DANCE_STYLES || [];
    let list = styles.filter(s => danceState.fam === 'all' || s.family === danceState.fam);
    if (danceState.bpm) list = list.filter(s => bpmInBucket(s.bpm, danceState.bpm));
    if (danceState.q) {
      const q = danceState.q;
      list = list.filter(s =>
        s.name_en.toLowerCase().includes(q) ||
        s.name_ko.includes(q) ||
        (s.desc || '').toLowerCase().includes(q) ||
        (s.tags || '').toLowerCase().includes(q) ||
        String(s.bpm).includes(q)
      );
    }
    $('#dance-count').textContent = `${list.length} / ${styles.length} ${tx('lbl.styles', '스타일')}`;
    const enMode = window.SU_LANG && window.SU_LANG() === 'en';
    const cardTip = tx('dance.card.tip', '클릭하여 우측 베이스 시드로 로드');
    $('#dance-list').innerHTML = list.map(s => `
      <button class="dance-card" data-no="${s.no}" data-family="${escapeHtml(s.family)}" title="${cardTip}">
        <div class="dance-card-head">
          <span class="dance-card-no">#${s.no}</span>
          <span class="dance-card-fam">${escapeHtml(s.family)}</span>
          <span class="dance-card-bpm">${escapeHtml(String(s.bpm))} BPM</span>
        </div>
        <div class="dance-card-name">
          ${enMode
            ? `<span class="dance-card-ko">${escapeHtml(s.name_en)}</span>`
            : `<span class="dance-card-ko">${escapeHtml(s.name_ko)}</span><span class="dance-card-en">${escapeHtml(s.name_en)}</span>`}
        </div>
        <div class="dance-card-desc">${escapeHtml(tdx(s.desc || ''))}</div>
        <div class="dance-card-style">${escapeHtml(s.style || '')}</div>
      </button>
    `).join('') || `<p class="text-xs col-span-full text-center py-8" style="color:var(--text-secondary)">${tx('dance.nomatch', '조건에 맞는 스타일이 없습니다.')}</p>`;

    $$('#dance-list .dance-card').forEach(card => {
      card.addEventListener('click', () => {
        const no = parseInt(card.dataset.no, 10);
        const s = styles.find(x => x.no === no);
        if (!s) return;
        danceState.seed = s.style || '';
        $('#dance-seed-style').value = danceState.seed;
        composeDanceOutput();
        toast(`${tx('toast.loaded', '불러옴')}: ${tdx(s.name_ko)} (${s.name_en})`);
        $('#dance-seed-style').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }

  function drawDanceTagList() {
    const tags = (window.SUNO_DANCE_TAGS || []).filter(t => t.cat === danceState.cat);
    const enMode = window.SU_LANG && window.SU_LANG() === 'en';
    $('#dance-tag-list').innerHTML = tags.map(t => {
      const picked = danceState.picked.includes(t.tag);
      // EN mode: English tag only (no Korean sub-label).
      // KO mode: English tag + Korean translation underneath.
      const ko = tdx(t.ko);
      const koLine = enMode ? '' : `<span class="dance-tag-ko">${escapeHtml(ko)}</span>`;
      return `<button class="dance-tag-pill ${picked ? 'active' : ''}" data-tag="${escapeHtml(t.tag)}" title="${escapeHtml(ko)}">
        <span class="dance-tag-en">${escapeHtml(t.tag)}</span>
        ${koLine}
      </button>`;
    }).join('');
    $$('#dance-tag-list .dance-tag-pill').forEach(b => b.addEventListener('click', () => {
      const tag = b.dataset.tag;
      const i = danceState.picked.indexOf(tag);
      if (i >= 0) danceState.picked.splice(i, 1);
      else danceState.picked.push(tag);
      b.classList.toggle('active');
      drawPicked();
      composeDanceOutput();
    }));
  }

  function drawPicked() {
    $('#dance-picked').innerHTML = danceState.picked.length
      ? danceState.picked.map(t => `<span class="chip" data-src="ai" data-pickedtag="${escapeHtml(t)}">${escapeHtml(t)}<button title="${tx('aria.remove', '삭제')}">×</button></span>`).join('')
      : `<span class="text-xs" style="color:var(--text-secondary)">${tx('dance.picked.empty', '위 카테고리에서 태그를 선택하세요')}</span>`;
    $$('#dance-picked .chip[data-pickedtag] button').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.parentElement.dataset.pickedtag;
        danceState.picked = danceState.picked.filter(x => x !== t);
        drawPicked(); drawDanceTagList(); composeDanceOutput();
      });
    });
  }

  function composeDanceOutput() {
    const seed = (danceState.seed || '').trim();
    const tagsCSV = danceState.picked.join(', ');
    const combined = [seed, tagsCSV].filter(Boolean).join(seed && tagsCSV ? ', ' : '');
    $('#dance-output').value = dedupeTags(combined.split(',').map(stripStyleBrackets)).join(', ');
  }

  // Workflow chart — collapsible onboarding banner, state persisted
  (function initWorkflow() {
    const wf = document.getElementById('workflow-chart');
    const btn = document.getElementById('workflow-toggle');
    if (!wf || !btn) return;
    const KEY = 'su_workflow_collapsed';
    const T = (k, fallback) => (window.SU_T ? (window.SU_T(k) ?? fallback) : fallback);
    const apply = (collapsed) => {
      wf.classList.toggle('collapsed', collapsed);
      btn.dataset.i18n = collapsed ? 'wf.expand' : 'wf.collapse';
      btn.textContent = collapsed
        ? T('wf.expand', '펴기')
        : T('wf.collapse', '접기');
    };
    apply(localStorage.getItem(KEY) === '1');
    // Re-sync label text on language change.
    document.addEventListener('su:lang', () => apply(wf.classList.contains('collapsed')));
    btn.addEventListener('click', () => {
      const now = !wf.classList.contains('collapsed');
      localStorage.setItem(KEY, now ? '1' : '0');
      apply(now);
    });
  })();

  initBuilder();
  setTab('builder');
  renderChips(); renderStyleOut(); updateStats();
  syncAIProviderTabs();
})();
