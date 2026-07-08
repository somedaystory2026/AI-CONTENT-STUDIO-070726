/* AI provider clients — direct browser → provider API calls.
 *
 * All three providers (Anthropic, OpenAI, Google) accept browser-origin
 * requests with the user's API key. Keys never leave the client; no proxy.
 *
 * Returns: { style: string, lyrics: string, raw: string, provider, model }
 */
(function () {
  'use strict';

  // Recommended models per provider for song-lyric generation.
  // The ⭐ default is the model that writes the BEST LYRICS — creative
  // phrasing, Korean emotional nuance, metaphor depth — even if it
  // costs more. The second entry in each list is the budget option
  // for high-volume generation. Pricing is per 1M tokens (input/output).
  const MODELS = {
    anthropic: [
      { id: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6', price: '$3.00 / $15.00 per 1M tokens', recommended: true,
        note: '★ 가사 품질 최우선 — 창의적 한국어 표현력·은유 깊이 최강. Opus 급 품질',
        note_en: '★ Top lyric quality — strongest creative phrasing & metaphor depth. Opus-class quality' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',  price: '$1.00 / $5.00 per 1M tokens',
        note: '저렴한 대량 생성용 · 가사 품질은 Sonnet 보다 한 단계 낮음',
        note_en: 'Budget option for bulk generation · lyric quality one step below Sonnet' },
    ],
    openai: [
      { id: 'gpt-5.4-mini',  label: 'GPT-5.4 mini',  price: '$0.75 / $4.50 per 1M tokens',  recommended: true,
        note: '★ 더 세련된 표현력 · 시적 비유·은유에 강함',
        note_en: '★ More polished phrasing · strong with poetic similes & metaphors' },
      { id: 'gpt-4.1-mini',  label: 'GPT-4.1 mini',  price: '$0.40 / $1.60 per 1M tokens',
        note: '저렴한 대량 생성용 · 무난한 품질',
        note_en: 'Budget option for bulk generation · solid all-round quality' },
    ],
    google: [
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', price: '$0.50 / $3.00 per 1M tokens', recommended: true,
        note: '★ 최신 Gemini · 풍부한 표현력 · 한국어 가사 자연스러움 우수',
        note_en: '★ Latest Gemini · rich expression · natural Korean lyric phrasing' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', price: '$0.30 / $2.50 per 1M tokens',
        note: '저렴한 대량 생성용 · 가성비 균형형 모델',
        note_en: 'Budget option for bulk generation · balanced cost-vs-quality model' },
    ],
  };

  const DEFAULT_MODEL = {
    anthropic: MODELS.anthropic.find(m => m.recommended).id,
    openai:    MODELS.openai.find(m => m.recommended).id,
    google:    MODELS.google.find(m => m.recommended).id,
  };

  const PROVIDER_LABEL = {
    anthropic: 'Claude (Anthropic)',
    openai:    'ChatGPT (OpenAI)',
    google:    'Gemini (Google)',
  };

  // ---- system prompt ----------------------------------------------------
  function buildLangBlock(lang) {
    if (!lang || lang.mode === 'ko') {
      return `- Write ALL lyrics in 한글 only (NO romanization, NO English words).
- Each line ≤ ~10 syllables. Use , and . for natural breathing.
- In the Style field, include exactly one Korean-language declaration (e.g. "Korean lyrics, singing in Korean"). Do NOT repeat it.`;
    }
    if (lang.mode === 'en') {
      return `- Write ALL lyrics in English. No Korean characters.
- In the Style field, declare English vocals once (e.g. "English lyrics"). Do NOT add any Korean-language tags.`;
    }
    // mixed — ratio influences lyric writing ONLY. Do not touch the Style field for language reasons.
    const { koreanPct, englishPct } = lang;
    return `- Write BILINGUAL Korean + English lyrics. Aim for roughly ${koreanPct}% Korean lines and ${englishPct}% English lines (K-Pop-style codeswitching — e.g. verses in 한글, hook/post-chorus in English, or vice-versa depending on the ratio).
- Write 한글 in Hangul (do not romanize).
- Do NOT add ANY language directives to the Style field. No "Korean lyrics", no "English lyrics", no "vocals in Korean and English", no "bilingual", no "natural codeswitching", no "(${koreanPct}/${englishPct})". The Style field describes music only — the language ratio is implicit from the lyrics themselves.`;
  }

  // Style-template lookup for the 보컬 편곡 스타일 dropdown.
  // These tables come straight from a tested Suno guide — the keyword choice
  // matters: vague phrases like "beautiful harmony" / "nice backing vocals"
  // are too abstract and the model ignores them. Use the concrete vocabulary.
  const ARRANGEMENT_STYLES = {
    auto: {
      label: 'Auto — match whatever Style is loaded',
      cueVocab: ['layered vocal harmonies', 'stacked chorus vocals', 'rich backing vocals', 'group vocals', 'gang vocals', 'singalong chorus'],
      example:  '[Chorus: layered harmonies, group vocals, anthemic singalong]',
    },
    kpop: {
      label: 'K-Pop 화음 — airy layered stacks',
      cueVocab: ['airy layered vocal harmonies', 'wide stereo backing vocals', 'emotional vocal stacks in chorus', 'breathy harmony layer'],
      example:  '[Chorus: emotional vocal stacks, wide stereo backing vocals, airy layered harmonies]',
    },
    idol: {
      label: 'K-Pop 아이돌 떼창 — member trades',
      cueVocab: ['member trades on verse', 'all members on chorus', 'anthemic singalong chorus', 'whoa-oh group hook'],
      example:  '[Chorus: all members in unison, anthemic singalong, whoa-oh hook]',
      lyricHints: 'Mark verses as "Member A:" / "Member B:" trading 2-line phrases. The Chorus is labeled "All:" with the full ensemble.',
    },
    'stadium-rock': {
      label: 'Stadium Rock (Coldplay / U2) — arena anthem',
      cueVocab: ['arena crowd chorus', 'powerful gang vocals', 'big singalong energy', 'Oh-oh-oh anthem hook', 'wall-of-sound choir'],
      example:  '[Chorus: arena crowd chorus, gang vocals, "Oh-oh-oh" anthem singalong]',
      lyricHints: 'End the chorus with a non-lexical hook line like "Oh-oh-oh!" or "Whoa-oh-oh!" for the crowd to join.',
    },
    gospel: {
      label: 'Black Gospel — choir response',
      cueVocab: ['gospel choir harmonies', 'soulful backing choir', 'call and response vocals', 'emotional crescendos', 'church choir energy'],
      example:  '[Chorus: lead singer with full gospel choir response, emotional crescendo]',
      lyricHints: 'Use "Lead:" for the soloist and "Choir:" for the response line. Responses are often single-word affirmations.',
    },
    'edm-festival': {
      label: 'EDM Festival — crowd chants',
      cueVocab: ['festival crowd chants', 'pitched vocal chops', 'layered euphoric chorus vocals', 'big-room chant hook', 'hands-up chant'],
      example:  '[Drop Chant: festival crowd chants, "Hey! Hey!" hands-up hook, pitched vocal chops]',
      lyricHints: 'Drop sections should be short shout phrases like "Hey!" / "Up! Up! Up!" / "Put your hands up!".',
    },
    anison: {
      label: 'J-Pop / Anison — unison hook',
      cueVocab: ['unison group vocals', 'anthemic anime chorus', 'harmonized hook', 'J-Rock chorus energy'],
      example:  '[Chorus: unison group vocals, harmonized hook, J-Pop anthemic build]',
    },
    'punk-gang': {
      label: 'Punk Gang Vocals — shout-along',
      cueVocab: ['gang vocals', 'shout-along chorus', 'crowd "Hey!" chant', 'raw group backing'],
      example:  '[Chorus: gang vocals, shout-along, "Hey! Hey!" crowd response]',
    },
  };

  function buildVocalArrangementBlock(ctx) {
    const enabled = [];
    if (ctx.callResponse) enabled.push('callResponse');
    if (ctx.harmonies)    enabled.push('harmonies');
    if (!enabled.length) return '';

    const styleKey = ctx.arrangementStyle && ARRANGEMENT_STYLES[ctx.arrangementStyle]
      ? ctx.arrangementStyle : 'auto';
    const styleSpec = ARRANGEMENT_STYLES[styleKey];

    const parts = [`# VOCAL ARRANGEMENT — Suno-tested patterns (style preset: ${styleSpec.label})`];

    if (ctx.callResponse) {
      parts.push(`## CALL & RESPONSE
- Mark alternating voices with **"Lead:"** and **"Crowd:"** prefixes on consecutive lyric lines — these are the labels Suno actually parses. Do NOT use "(Voice 1)" / "(Group)" / "Singer A" / etc.
- Keep each response line SHORT (1-4 syllables) and REPETITIVE — typically a one-word echo of the call, or a single affirmation. Long response sentences kill the effect.
- Inside a single sung line, use parentheses for backing-vocal echoes:
    I will rise tonight (rise tonight!)
    Never back down (never back down!)
- A final **"All:"** line at the end of a hook/drop signals everyone joining in.
- Good rhythmic patterns:
    Hey! — Hey!
    Oh na na — Oh na na!
    Run! — Run!
- Anti-pattern: responses that don't share rhythm/syllables with the call.

Canonical example block:

    [Chorus: call and response chorus, Lead/Crowd trade, 4-bar pattern]
    Lead: Are you ready now?
    Crowd: Ready now!
    Lead: Can you feel the fire?
    Crowd: Fire! Fire!
    All: Oh-oh-oh!`);
    }

    if (ctx.harmonies) {
      parts.push(`## HARMONIES & CHORUS STACK over lead
- Layer 2-3 part vocal harmonies on top of the lead in [Chorus] and [Bridge]; keep [Verse] mostly bare-lead so the harmonized chorus feels like a lift.
- Suno responds to CONCRETE vocabulary — vague phrases like "beautiful harmony" or "nice backing vocals" are too abstract and the engine ignores them. Use the specific vocabulary below.

### Universal effective phrases (mix 2-4 per chorus cue):
layered vocal harmonies · stacked chorus vocals · rich backing vocals · lush harmonies · gang vocals · anthemic singalong chorus · wide stereo backing vocals · vocal stacks · ad-lib vocal layers · crowd chants · group vocals · choir backing · doubled lead · octave harmony

### Genre flavour (use the preset's vocabulary first, then borrow from this list):
- K-Pop / Pop: airy layered harmonies, wide stereo backing vocals, emotional vocal stacks in chorus
- Rock / Pop-Rock: powerful gang vocals, crowd chant chorus, arena rock singalong
- Gospel / Soul: gospel choir harmonies, soulful backing choir, emotional crescendos
- EDM / Festival: pitched vocal chops, festival crowd chants, layered euphoric chorus vocals
- J-Pop / Anison: unison group vocals, anthemic chorus, harmonized hook
- Punk: gang vocals, shout-along chorus, "Hey!" crowd response`);
    }

    parts.push(`## ACTIVE STYLE PRESET — "${styleSpec.label}"
Use THESE phrases first when crafting the section cues for [Chorus] / [Hook] / [Drop] / [Bridge]:
    ${styleSpec.cueVocab.map(v => '"' + v + '"').join(', ')}

Canonical section cue from this preset:
    ${styleSpec.example}${styleSpec.lyricHints ? '\n\nLyric-body hint: ' + styleSpec.lyricHints : ''}`);

    parts.push(`## SHARED RULES
- Lyric lines must stay SHORT (≤ ~10 syllables) and rhythmically simple — the chorus needs breathing room for the layered/response voices to land.
- These directives affect the LYRICS body + [Section] cue brackets.
- If you are generating the Style field FROM SCRATCH (no REFERENCE STYLE block locked below), append 2-3 of the preset's vocabulary above to the comma-separated Style descriptors so Suno actually layers / responds.
- **NEVER override the vocal gender / voice type** implied by the loaded preset or the REFERENCE STYLE. Vocal arrangement cues describe ARRANGEMENT (layering, response, choir), not the lead singer's gender. If a cue would imply a different gender, drop the gender word and keep only the arrangement description.
- If a REFERENCE STYLE is locked: do NOT touch it. The section cues alone must carry the arrangement signal.`);

    return parts.join('\n\n');
  }

  function buildSectionCuesBlock(enabled) {
    if (!enabled) {
      return `# SECTION TAGS
- Use plain section tags only: [Intro], [Verse 1], [Pre-Chorus], [Chorus], [Bridge], [Outro], etc.
- Do NOT embed musical directions inside the brackets.`;
    }
    return `# SECTION TAGS — EMBED ENGLISH MUSICAL DIRECTIONS
- Every section header MUST include a brief English production / mood / instrumentation cue inside the brackets, separated from the section name by a colon, comma-delimited.
- Format: [SectionName: cue 1, cue 2, cue 3]
- Cues describe instrumentation, dynamics, mood, vocal delivery, production technique — NOT lyrics content. English ONLY, even when the lyrics are Korean.
- Keep each cue list to 2-5 short phrases (≤ 60 characters total inside the brackets).
- Examples (copy this style, not the literal text):
  • [Intro: gentle piano, ambient pad, slow build]
  • [Verse 1: soft female vocals, intimate close-mic, sparse drums]
  • [Pre-Chorus: tempo lifts, layered backing vocals, rising tension]
  • [Chorus: anthemic, full band, soaring harmonies, big snare]
  • [Rap Verse: aggressive male flow, hi-hat rolls, 808s prominent]
  • [Bridge: stripped to piano and voice, raw emotional vulnerability]
  • [Drop: massive bass, supersaw lead, sidechained pads]
  • [Guitar solo: distorted, blues-influenced bends, wah pedal]
  • [Instrumental break: 4 bars, drum fill, brass stabs]
  • [Outro: ambient fade, lone synth pad, reverb tail]
- A separator line "---" can be used to mark instrumental-only segments.
- The cues should reflect the Style field and the era of the song.`;
  }

  function buildRapBlock(pct) {
    if (typeof pct !== 'number') pct = 0;
    if (pct <= 5) {
      return `# VOCAL DELIVERY — 🎵 보컬 100% (sung throughout, no rap)
- Every section is SUNG. Use [Verse], [Pre-Chorus], [Chorus], [Bridge], [Outro] tags.
- Do NOT use [Rap], [Rap Verse], or [Rap Break] tags. No spoken / rapped delivery anywhere.
- The Style field should describe the vocalist as singing (e.g. "sung vocals", "melodic vocals"). Do not mention rap.`;
    }
    if (pct <= 25) {
      return `# VOCAL DELIVERY — 🎵 보컬 위주 (rap ${pct}%)
- Mostly SUNG. Allow at most ONE short rap moment — typically the second pre-chorus or a 4-8 line bridge — marked with a [Rap Break] or [Rap Verse] tag.
- All other sections stay melodic ([Verse], [Chorus], [Bridge]).
- The Style field may add one descriptor like "rap break" but keep "sung", "melodic" as the dominant vocal descriptors.`;
    }
    if (pct <= 60) {
      return `# VOCAL DELIVERY — ⚖️ 균형 보컬/랩 (rap ${pct}%)
- Alternating delivery. [Verse 1] and [Verse 2] should be RAPPED (mark them as [Rap Verse] or [Verse] with a "(rap)" hint), [Pre-Chorus] and [Chorus] SUNG, [Bridge] can be either.
- Aim for roughly half the line count rapped vs sung.
- The Style field should describe BOTH delivery modes (e.g. "rap verses with sung melodic chorus", "trap-pop hybrid male vocals", "rap-line + vocal-line").`;
    }
    if (pct <= 85) {
      return `# VOCAL DELIVERY — 🎤 랩 위주 (${pct}%) — RAP DOMINATES
- This song is PREDOMINANTLY RAPPED: about ${pct}% of all lines are rapped. Only ONE recurring melodic part (the [Chorus] / [Hook]) is sung; everything else is rap.
- RAP these sections — tag each explicitly as rap:
  • Every verse → [Rap Verse 1], [Rap Verse 2], …
  • The pre-chorus → [Rap Pre-Chorus] (or [Pre-Chorus] with a "(rap)" hint)
  • The bridge → [Rap Bridge]
  • Any post-chorus / break / intro-with-words → rap them too
- SING ONLY the [Chorus] / [Hook] (and its reprises) for melodic contrast — keep that hook short. The final chorus may stack a rapped ad-lib layer on top.
- HARD RULE: do NOT write melodic sung lines in the verses, pre-chorus, or bridge. If a section is not the chorus/hook, it MUST be rapped. A song with only 2 rapped verses and everything else sung is WRONG for this setting.
- The Style field should foreground rap delivery (e.g. "aggressive male rap", "hi-hat heavy trap flow", "rapid-fire rap", "dense bars") and treat the sung hook as a secondary descriptor.`;
    }
    return `# VOCAL DELIVERY — 🎤 랩 100% (${pct}%)
- ALL sections are RAPPED. Use [Rap Verse 1], [Rap Verse 2], [Rap Bridge], [Rap Hook] tags throughout.
- No melodic singing. If a hook is needed, mark it [Hook (rapped)] or "(rap)".
- The Style field should describe the delivery as fully rapped (e.g. "hard-hitting male rap", "rapid double-time flow", "boom-bap rap delivery") with no mention of melodic singing.`;
  }

  function buildMetaphorBlock(pct) {
    if (typeof pct !== 'number') pct = 50;
    if (pct <= 10) {
      return `# LYRIC POETICS — 직설 (literal, ${pct}%)
- Write straightforward, plainspoken lyrics. State emotions and events directly: "I miss you", "I can't sleep", "The sun came up".
- AVOID metaphors, similes, symbolic imagery, abstract nouns, or poetic devices.
- Use concrete, accessible everyday vocabulary. No flowery comparisons.`;
    }
    if (pct <= 30) {
      return `# LYRIC POETICS — 거의 직설 (mostly direct, ${pct}%)
- Mostly direct expression with at most 1-2 simple comparisons in the whole song (e.g. "like a stranger", "cold as winter").
- Keep imagery concrete and grounded. No extended metaphors.`;
    }
    if (pct <= 60) {
      return `# LYRIC POETICS — 균형 (balanced, ${pct}%)
- Mix literal storytelling with moderate poetic imagery. Roughly half the chorus / bridge lines can carry a metaphor or vivid sensory image; verses stay closer to plain description.
- One or two recurring images is enough — avoid stacking too many comparisons in a single line.`;
    }
    if (pct <= 85) {
      return `# LYRIC POETICS — 시적 (poetic, ${pct}%)
- Lean into figurative language: frequent metaphors, similes, and vivid sensory imagery (color, weather, season, distance, time as metaphor).
- Prefer indirect emotional expression — show feeling through imagery rather than stating it. Example: instead of "I am sad", "The streetlamp keeps my shadow company".
- Maintain one or two consistent symbolic threads across the song.`;
    }
    return `# LYRIC POETICS — 시적·은유 최대 (densely metaphorical, ${pct}%)
- Write densely figurative, almost entirely metaphorical lyrics. Avoid plain statements wherever possible — channel every emotion through imagery, symbolism, paradox, or extended metaphor.
- Use layered double meanings, sensory cross-references (sound described as color, time as architecture), and abstract conceits.
- One central symbol or extended conceit (a sea, a clock, a fire, a window …) should run through verses, chorus, and bridge to bind the song.
- Keep lines singable: poetic compression, not academic vocabulary.`;
  }

  // 고음 억제 — keep the vocal in a comfortable low-mid register.
  function buildPitchBlock() {
    return `# PITCH RESTRAINT — 고음 억제 (keep vocals in a low-mid register)
- The vocal melody MUST stay in a comfortable low-to-mid register. AVOID soaring high notes, belted climaxes, upward key changes, and falsetto peaks.
- In the Style field, the words "cinematic", "epic", and "emotional" are BANNED — remove them wherever they appear, including inside compound tags ("cinematic strings" → "strings", "emotional ballad" → "ballad", "epic orchestral" → "orchestral"). Even one occurrence pushes the vocal into belted high notes. Also avoid "anthemic", "soaring", "powerful belt", "explosive chorus", "high notes".
- INSTEAD add restraint descriptors to the Style field: "restrained", "intimate", "controlled", "low-register".
- The chorus stays melodically contained — convey emotion through delivery and lyric, NOT through pitch height.`;
  }

  function buildSystemPrompt(ctx = {}) {
    const langBlock = buildLangBlock(ctx.lang || (ctx.korean ? { mode: 'ko' } : { mode: 'en' }));
    const metaphorBlock = buildMetaphorBlock(ctx.metaphorPct);
    const rapBlock = buildRapBlock(ctx.rapPct);
    const cuesBlock = buildSectionCuesBlock(ctx.sectionCues !== false);
    const vocalArrBlock = buildVocalArrangementBlock(ctx);
    const pitchBlock = ctx.pitchRestraint ? buildPitchBlock() : '';
    const refLine = ctx.refArtist
      ? `\n# REFERENCE — the user has explicitly selected a preset (from the Excel guide).
- Era: ${ctx.refArtist.era || ''}
- Genre: ${ctx.refArtist.genre || ''}
- Reference structure: ${ctx.refArtist.structure || ''}

# REFERENCE STYLE (MANDATORY — copy character-for-character into the "style" field)
"""
${ctx.refArtist.style || ''}
"""
The "style" field of your JSON output MUST equal the Reference Style above, copied verbatim — no paraphrasing, no reordering, no wording changes, no added or removed adjectives. The user came from the Excel-curated preset, so the Style is already correct; your job is to write the song's title and lyrics around it, NOT to rewrite it.`
      : '';
    const titleHint = ctx.workingTitle
      ? `\n# WORKING TITLE — the user proposed "${ctx.workingTitle}". You may keep, refine, or replace it; output your final choice in the "title" field.`
      : '';

    const TITLE_LANG_DIRECTIVE = {
      ko:    'The title MUST be written entirely in Korean (Hangul). No Latin or other scripts.',
      en:    'The title MUST be written entirely in English. No Korean, no other scripts.',
      ja:    'The title MUST be written entirely in Japanese (any of hiragana, katakana, kanji is fine). No Korean, no Latin.',
      latin: 'The title MUST be written in the Latin alphabet (any Romance/Germanic vibe is fine — English, French, Spanish, Italian, Portuguese, German). No Korean, no CJK scripts.',
    };
    const titleLangBlock = ctx.titleLang && TITLE_LANG_DIRECTIVE[ctx.titleLang]
      ? `\n# TITLE LANGUAGE OVERRIDE — ${TITLE_LANG_DIRECTIVE[ctx.titleLang]}`
      : '';

    // When instrumental mode is active, we REPLACE the standard LYRICS
    // field rules with an instrumental-only roadmap spec — keeping both
    // blocks in the prompt produced contradictory guidance and the model
    // tended to follow the earlier "4-8 lines per section" rule and emit
    // sung lyrics anyway.
    const lyricsRulesBlock = ctx.instrumental ? `
# LYRICS field rules — INSTRUMENTAL MODE (override)
**THIS IS A FULLY INSTRUMENTAL TRACK. ABSOLUTELY NO SUNG OR RAPPED LYRICS.**
- The "lyrics" field MUST contain ONLY a section roadmap with musical cues — NO words to be sung, NO phrases, NO syllables.

## LENGTH TARGET — generate a 3-4 minute track (CRITICAL)
Suno reads the lyrics field's length and section count as a major cue for the rendered clip duration. With a sparse roadmap the model frequently truncates to 90 seconds. To force a proper 3-4 minute composition you MUST:
- Output **7-9 sections** (not 5). A typical full-length arc:
  Intro → Verse 1 → Pre-Chorus → Chorus 1 → Verse 2 → Bridge / Solo → Chorus 2 → Outro
  Club / EDM variant: Intro → Buildup 1 → Drop 1 → Break → Buildup 2 → Drop 2 → Outro
- **Every section bracket MUST include an explicit bar count** (e.g. "8 bars", "16 bars", "24 bars"). Total bars across all sections should sum to **80-120** so at the chosen BPM the piece lasts 3-4 minutes.
- Each bracket should pack **3-5 descriptors** — instrumentation + dynamics + length + register/articulation + any filter/modulation/key change. Verbose brackets give Suno more material to expand on. Example (good detail):
  [Verse 1: deep walking bass, brush snare with hi-hat 16ths, muted electric guitar comping, mezzo-piano, 16 bars, gradual brightening]
  Example (too sparse — AVOID):
  [Verse: bass, drums]
- Use reprise markers freely: \`[Chorus 2: same melody as Chorus 1, louder, brass added, 16 bars]\`, \`[Verse 2: similar to Verse 1, new countermelody, 16 bars]\`. Repeats are how instrumentals achieve full length without losing coherence.

## STRUCTURE
- Each section header sits on its own line with the cue INSIDE the brackets. Examples:
  [Intro: soft piano, ambient pad, mezzo-piano, 8 bars]
  [Verse 1: walking bass, brush snare, muted guitar, 16 bars]
  [Pre-Chorus: snare buildup, rising synth, crescendo, 8 bars]
  [Chorus 1: full band, brass swells, tutti, fortissimo, 16 bars]
  [Verse 2: similar to Verse 1, new countermelody, 16 bars]
  [Bridge: half-time, filtered synth solo, harmonic minor, 16 bars]
  [Chorus 2: tutti, key up, climax, 16 bars]
  [Outro: piano + pad, decrescendo, fade out, 8 bars]
- Between section tags, write a SINGLE "---" line on its own — that marks the silent vocal lane. Do NOT replace it with sung text.
- Keep EXACTLY ONE BLANK LINE between sections.
- Required output structure for the lyrics field (literal example layout — adapt section names + cues to the song):

  [Intro: soft piano, ambient pad, 8 bars]
  ---

  [Verse 1: walking bass, brush snare, 16 bars]
  ---

  [Chorus 1: full band, brass, 16 bars]
  ---

  …continue through 7-9 sections totalling 80-120 bars…

## ABSOLUTE BANS — NEVER output any of these inside the lyrics field:
  • Words like "I", "you", "we", "love", "heart", "night", "사랑", "너", "나" — these imply a singer.
  • Scat phrases: "la la la", "ooh ooh", "hmm", "yeah", "oh oh oh", "na na na".
  • Any line not enclosed in [Section: ...] brackets or equal to "---".
  • The literal text "(instrumental)" — use a proper section tag instead.
  • Sparse brackets like "[Verse: bass, drums]" with fewer than 3 descriptors or no bar count.

## OTHER FIELDS
- The "style" field MUST include "instrumental" prominently AND a length hint such as "extended arrangement", "full-length composition", or "3-4 minute track" (along with the usual BPM / genre / instrumentation).
- The "title" field is still REQUIRED — produce a creative, evocative title that fits the instrumental piece.
- The LANGUAGE / METAPHOR / RAP / VOCAL ARRANGEMENT context only shapes the style and title in instrumental mode. The SECTION CUES context still applies to the section bracket text.` : `
# LYRICS field rules
- Supported section names (use the right ones for the song's flow):
  Intro, Verse, Verse 1, Verse 2, Pre-Chorus, Chorus, Bridge, Outro, Instrumental,
  Post-Chorus, Hook, Break, Drop, Buildup, Interlude, Solo, Fade Out,
  Rap Verse, Rap Break, Dance Break, Guitar Solo.
- Each section header sits on its own line (the SECTION TAGS block below tells you whether to embed musical cues inside the brackets).
- ALWAYS leave EXACTLY ONE BLANK LINE between sections — the section header (e.g. [Chorus]) must be preceded by an empty line so the layout reads as visually distinct blocks. Example structure:

  [Intro]
  …intro lines…

  [Verse 1]
  …verse lines…

  [Chorus]
  …chorus lines…

- Typical flow: Intro → Verse 1 → Pre-Chorus → Chorus → Verse 2 → Pre-Chorus → Chorus → Bridge → Chorus → Outro.
- 4-8 lines of lyrics per sung/rapped section. Pure-instrumental sections (Intro, Solo, Drop, Break, Outro, Instrumental, Interlude) may have NO lyric lines — leave them blank or write "---" so Suno keeps the gap.
- Avoid filler like "..." in lyric lines.`;

    const outputSchema = ctx.instrumental
      ? `{"title": "<creative title for the instrumental piece>", "style": "<comma-separated English tags including the word \\"instrumental\\", include BPM, ~150-250 chars>", "lyrics": "<section-roadmap ONLY — section tags + --- markers, NO sung words>"}`
      : `{"title": "<short song title (Korean and/or English to match the language ratio)>", "style": "<comma-separated English tags, include BPM, ~150-250 chars>", "lyrics": "<full lyrics with section tags on their own lines>"}`;

    return `You are a senior Suno AI v8 prompt engineer. Produce a song title, a Style field, and a Lyrics field for ONE song.${ctx.instrumental ? '\n\n**TOP-LEVEL DIRECTIVE: INSTRUMENTAL MODE IS ACTIVE.** Do NOT write any sung or rapped lyric lines anywhere. The "lyrics" field is a SECTION ROADMAP only (see LYRICS field rules below).' : ''}

# OUTPUT — strict JSON only. No prose, no markdown fences. Exactly:
${outputSchema}

# STYLE field rules
- Comma-separated English descriptors.
- **CRITICAL — NO KOREAN CHARACTERS in the Style field at all.** Korean genre names (트로트, 발라드, 동요, 통기타, 한국 힙합 …) MUST be written in English: 트로트→Trot, 발라드→ballad, 동요→children song, 통기타→acoustic guitar folk, 한국 힙합→Korean hip-hop, 한국 인디→Korean indie, 한국 가요→Korean pop, 시티팝→city pop, 걸그룹→girl group, 보이그룹→boy group, 아이돌→idol. The Style field is for Suno's English tokenizer — Hangul breaks it.
- Always include: genre (English), era/decade, ${ctx.instrumental ? '"instrumental" tag, ' : 'vocal type, '}key instrumentation, mood, and a numeric BPM (e.g. "110 BPM").
- Keep concise (target 150-250 characters).
- **NO REDUNDANCY** — Each comma-separated tag MUST add NEW information.
  • NEVER state era twice (e.g. "2010s K-pop" + "2015-2019 idol pop" = forbidden — pick one).
  • NEVER state the genre lineage twice (e.g. "K-pop" + "Korean idol pop" + "K-pop production" = forbidden — pick the most specific one).
  • NEVER append filler tail phrases: "X-era sound", "X-era production", "X-pop production", "dominance era", "scene era", "golden era", "global X dominance", "X-era wave".
  • Slot order = [era] [genre/scene] [group/vocal type] [instrumentation] [mood/groove] [BPM]. Each slot appears at most ONCE — no tag may rephrase an earlier tag.
${lyricsRulesBlock}

# TITLE field rules
- 1-6 words. Match the language ratio of the lyrics.
- The title is a CREATIVE, ARTISTIC, evocative phrase — NEVER copy or paraphrase the user's theme description or genre name.
- Pick a single image, emotion, or metaphor that captures the song's core (e.g. "별의 노래", "First Snow", "잃어버린 여름", "푸른 새벽", "Neon Heart") rather than a literal restatement of the prompt.
- If a WORKING TITLE block appears later, you may keep or refine it; otherwise invent a fresh poetic title from the song's core feeling.
- No quotation marks in the value itself.

# LANGUAGE
${langBlock}

${metaphorBlock}

${rapBlock}
${pitchBlock ? '\n' + pitchBlock : ''}

${cuesBlock}
${vocalArrBlock ? '\n' + vocalArrBlock : ''}
${titleHint}${titleLangBlock}${refLine}

Return JSON only. No explanations.`;
  }

  // ---- output parsing ---------------------------------------------------
  // Tolerant JSON parser for LLM output. Tries strict JSON.parse first; on
  // failure applies the cheap common fixes (markdown fences, trailing commas,
  // unquoted property names, single-quoted strings, JS line comments) and
  // retries. Throws with a snippet around the offending position if all
  // attempts fail so the caller can show something useful to the user.
  function lenientJSONParse(input) {
    let s = String(input || '').trim();
    // strip ``` fences
    s = s.replace(/^```(?:json|JSON)?\s*/, '').replace(/```\s*$/, '').trim();
    // narrow to first { ... last }
    const i = s.indexOf('{'), j = s.lastIndexOf('}');
    if (i >= 0 && j > i) s = s.slice(i, j + 1);

    // attempt 1: as-is
    try { return JSON.parse(s); } catch (e1) {
      // attempt 2: cheap fixes
      let fixed = s
        // remove // line comments
        .replace(/(^|[^:"\\])\/\/.*$/gm, '$1')
        // remove /* block */ comments
        .replace(/\/\*[\s\S]*?\*\//g, '')
        // trailing commas: ",]" or ",}"
        .replace(/,(\s*[}\]])/g, '$1')
        // single-quoted property names: 'foo': ... -> "foo": ...
        .replace(/([{,]\s*)'([^'\\]+)'\s*:/g, '$1"$2":')
        // unquoted property names: { foo: ... } -> { "foo": ... }
        .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
        // single-quoted string values: "key": 'text' -> "key": "text"
        // (only when the quoted body has no inner double-quote)
        .replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, body) => ': "' + body.replace(/"/g, '\\"') + '"');
      try { return JSON.parse(fixed); } catch (e2) {
        // attempt 3: escape raw control characters that appeared inside
        // JSON string values. Some Gemini outputs emit literal \n/\r/\t
        // bytes mid-string instead of the \n / \r / \t escape sequences,
        // which strict JSON.parse rejects.
        let out = '';
        let inStr = false;
        let prevEsc = false;
        for (let i = 0; i < fixed.length; i++) {
          const c = fixed[i];
          if (prevEsc) { out += c; prevEsc = false; continue; }
          if (c === '\\') { out += c; prevEsc = true; continue; }
          if (c === '"')  { inStr = !inStr; out += c; continue; }
          if (inStr) {
            if (c === '\n')      { out += '\\n'; continue; }
            if (c === '\r')      { out += '\\r'; continue; }
            if (c === '\t')      { out += '\\t'; continue; }
          }
          out += c;
        }
        try { return JSON.parse(out); } catch (e3) {
          // build a context-aware error from the most-fixed attempt
          const m = /position\s+(\d+)/i.exec(e3.message);
          const pos = m ? parseInt(m[1], 10) : -1;
          const snip = pos >= 0 ? out.slice(Math.max(0, pos - 40), pos + 40) : out.slice(0, 200);
          throw new Error(`AI 응답 JSON 파싱 실패 — ${e3.message}\n…${snip}…`);
        }
      }
    }
  }

  function dedupeCSV(s) {
    const seen = new Set();
    const out = [];
    for (const raw of String(s).split(',')) {
      const t = raw.trim();
      const k = t.toLowerCase().replace(/\s+/g, ' ');
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
    return out.join(', ');
  }
  // Some providers (notably Gemini) occasionally return a double-encoded
  // string where backslash-escape sequences survive JSON.parse as literal
  // two-char pairs ("\\n" → "\n", "\\\"" → "\""). Symptom: lyrics show
  // visible "\n" instead of real line breaks. If the field has zero real
  // newlines but plenty of literal escape pairs, decode them once.
  function unescapeIfNeeded(s) {
    if (!s) return s;
    const hasReal = /\n/.test(s);
    const hasLit  = /\\(?:n|t|r|")/.test(s);
    if (hasReal || !hasLit) return s;
    return s
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  function parseModelOutput(text) {
    try {
      const obj = lenientJSONParse(text);
      return {
        title:  unescapeIfNeeded(String(obj.title  || '')).trim(),
        style:  dedupeCSV(unescapeIfNeeded(String(obj.style || ''))),
        lyrics: unescapeIfNeeded(String(obj.lyrics || '')).trim(),
      };
    } catch {
      // Targeted regex fallback for malformed JSON. Match each field as
      // a JSON-quoted string (with escaped quotes), then unescape via a
      // JSON.parse round-trip so "\n" / "\"" become real characters.
      const grab = (re) => {
        const r = String(text).match(re);
        if (!r) return '';
        try { return JSON.parse('"' + r[1] + '"'); }
        catch { return unescapeIfNeeded(r[1]); }
      };
      const title  = grab(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
      const style  = grab(/"style"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
      const lyrics = grab(/"lyrics"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
      if (lyrics || style || title) {
        return { title: title.trim(), style: dedupeCSV(style), lyrics: lyrics.trim() };
      }
      // Last-ditch loose match for severely malformed (non-JSON-shaped) text.
      const tt = String(text).match(/title[^:]*:\s*"?([^"\n]+)"?/i);
      const sm = String(text).match(/style[^:]*:\s*([\s\S]+?)(?:lyrics|$)/i);
      const lm = String(text).match(/lyrics[^:]*:\s*([\s\S]+)$/i);
      return {
        title:  tt ? unescapeIfNeeded(tt[1]).trim() : '',
        style:  sm ? unescapeIfNeeded(sm[1]).trim() : '',
        lyrics: lm ? unescapeIfNeeded(lm[1]).trim() : unescapeIfNeeded(String(text)),
      };
    }
  }

  // ---- provider clients -------------------------------------------------
  async function callAnthropic({ apiKey, model, system, user }) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL.anthropic,
        max_tokens: 2048,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.content?.[0]?.text || '';
  }

  async function callOpenAI({ apiKey, model, system, user }) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL.openai,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async function callGoogle({ apiKey, model, system, user }) {
    const m = model || DEFAULT_MODEL.google;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) throw new Error(`Google ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  }

  // ---- web-search variants — used by SunoAI.searchPresets so the AI
  // grounds its archivist response in live web results instead of its
  // training-cutoff memory. Each provider exposes a slightly different
  // tool surface; we extract the final natural-language / JSON text
  // from whatever response shape they return.

  async function callAnthropicWebSearch({ apiKey, model, system, user }) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL.anthropic,
        max_tokens: 4096,
        system,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json();
    // Response content is an array of blocks: text + tool_use +
    // tool_result + text … We want the concatenation of all `text`
    // blocks (final assistant prose / JSON).
    const blocks = data.content || [];
    return blocks.filter(b => b.type === 'text').map(b => b.text || '').join('\n').trim();
  }

  // OpenAI Responses API supports the `web_search_preview` tool —
  // a different endpoint than chat/completions. The `input` field
  // takes a string or a turns array; we use the string form and
  // prepend the system prompt as an `instructions` field.
  async function callOpenAIWebSearch({ apiKey, model, system, user }) {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL.openai,
        instructions: system,
        input: user,
        tools: [{ type: 'web_search_preview' }],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    // Responses API exposes `output_text` directly for convenience.
    // Fall back to walking the output array if not present.
    if (data.output_text) return data.output_text;
    const out = data.output || [];
    return out
      .filter(o => o.type === 'message')
      .flatMap(o => (o.content || []).filter(c => c.type === 'output_text').map(c => c.text || ''))
      .join('\n').trim();
  }

  // Gemini 2.5+ supports Google Search grounding via the `google_search`
  // tool. The `googleSearch` (camelCase) field is the v1beta name.
  async function callGoogleWebSearch({ apiKey, model, system, user }) {
    const m = model || DEFAULT_MODEL.google;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        // NOTE: when google_search grounding is enabled the API does
        // not allow responseMimeType="application/json", so we ask the
        // model to return JSON via the system prompt instead and parse
        // it leniently on our side.
        tools: [{ googleSearch: {} }],
      }),
    });
    if (!res.ok) throw new Error(`Google ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  }

  async function generate({ provider, apiKey, model, userPrompt, context }) {
    if (!apiKey) throw new Error(`${PROVIDER_LABEL[provider]} API 키가 설정되지 않았습니다.`);
    const system = buildSystemPrompt(context || {});
    const args = { apiKey, model, system, user: userPrompt };
    let raw;
    if (provider === 'anthropic')      raw = await callAnthropic(args);
    else if (provider === 'openai')    raw = await callOpenAI(args);
    else if (provider === 'google')    raw = await callGoogle(args);
    else throw new Error('알 수 없는 provider: ' + provider);
    const parsed = parseModelOutput(raw);
    return { ...parsed, raw, provider, model: model || DEFAULT_MODEL[provider] };
  }

  // ─── Album planner ─────────────────────────────────────────────────────
  function buildAlbumSystemPrompt(album) {
    const langPct = album.englishPct || 0;
    let langClause;
    if (langPct === 0)        langClause = 'Titles in Hangul (한글) only. NO romanization.';
    else if (langPct === 100) langClause = 'Titles in English only.';
    else                       langClause = `Titles in mixed Korean/English; about ${100-langPct}% pure-Hangul titles and ${langPct}% English / bilingual titles.`;

    const presetBlock = album.preset
      ? `

# REFERENCE PRESET — borrow stylistic range from this artist/template
- Type: ${album.preset.type === 'template' ? '📜 Template' : '🎤 Artist'}
- Name (for YOUR contextual reasoning ONLY — DO NOT echo this into any output): "${album.preset.title}" (genre: ${album.preset.genre || 'n/a'}, era: ${album.preset.era || 'n/a'})
- Reference Style prompt: """${album.preset.style || ''}"""

⚠️ COPYRIGHT GUARD — the "Name" above is a reference label only. NEVER
include that name (or any other real-world artist's name) in the
albumTitle, track titles, hooks, mood tags, or style strings. The user
borrows stylistic range, not identity. If you need to refer to the
sound, describe it ("3rd-gen K-Pop girl group sound", "early-2010s
trap-pop hybrid") instead of naming an artist.

The 12 tracks should COLLECTIVELY span this artist's known stylistic
range — not all 12 sound the same. Vary tempo, instrumentation, mood,
and subgenre. For example, a K-Pop girl group typically has:
  • 1-2 lead singles (driving up-tempo dance)
  • 1-2 power ballads
  • 1-2 mid-tempo R&B / city-pop B-sides
  • 1 hip-hop / rap-line showcase
  • 1 acoustic stripped intro/outro
  • 1 summer / tropical break
  • 1 dark concept track
  • 1 fan-service singalong / "Oh-oh-oh" anthem
Mirror that variety distribution proportionally to the reference's
genre. Each track's "style" field is a COMPLETE Suno Style prompt for
that one track — distinct vocal energy, instrumentation, BPM.`
      : '';

    return `You are a senior A&R producer and album conceptualist for a Suno AI project.
Plan a cohesive 12-track album from the user's brief.

# OUTPUT — strict JSON only. No prose, no markdown fences. Exactly:
{
  "albumTitle": "<artistic 1-6 word album title, NOT a paraphrase of the user concept>",
  "summary": "<2-3 sentences: the album's emotional arc and core image>",
  "tracks": [
    {
      "no": 1,
      "title": "<1-6 word artistic title>",
      "hook": "<1 sentence: what this track is about>",
      "mood": "<2-3 word mood tag>",
      "bpm": <int>,
      "style": "<COMPLETE Suno Style prompt for THIS track — comma-separated English descriptors only, NO Korean characters anywhere (트로트→Trot, 발라드→ballad, 동요→children song, 통기타→acoustic guitar folk, 한국 힙합→Korean hip-hop, 시티팝→city pop). ~120-200 chars, include genre, era, vocal type, key instrumentation, mood, BPM. NO language directives like 'Korean lyrics' or 'vocals in Korean and English' — use stylistic vocal phrasing instead.>"
    },
    ... 12 tracks total, each with its OWN distinct "style" string ...
  ]
}

# HARD RULES
- EXACTLY 12 tracks (no fewer, no more).
- Album title is ARTISTIC — invent a poetic phrase. Do NOT echo the user's concept text or the genre name.
- Each track has its OWN complete "style" string. They should NOT all share one master style — vary subgenre, tempo, instrumentation, mood across the 12 to span the album's range.
- Each track title is ARTISTIC and DISTINCT from the others. No "Track 1" / "Song 1" / "Untitled" placeholders.
- Track flow follows the arc: ${album.arc}.
- Use the supplied moods (${(album.moods || []).join(', ') || 'free choice'}) — distribute across the tracklist; not every track needs every mood.
- Genre / category context: ${album.cat === 'korean' ? '🇰🇷 Korean pop (K-Pop, ballad, R&B, trot or indie depending on era).' : album.cat === 'pop' ? '🌍 Global Pop family.' : 'mixed / free.'}
- Era / tone hint: ${album.era || 'free'}.
- Style group hint: ${album.styleGroup || 'auto'}.
- ${langClause}
- BPMs MUST vary across tracks (ballads 60-80, mid-tempo 90-110, dance 115-135, EDM/hyperpop 140+).
- Every track's "style" MUST be a clean Suno Style prompt — no language ratios, no "natural codeswitching", no "vocals in Korean and English" phrasing. Use stylistic vocal descriptors instead ("emotive vocal delivery", "expressive vocal phrasing", "dynamic vocal interplay", "intimate close-mic vocal", "airy layered harmonies").${presetBlock}

Return JSON only.`;
  }

  async function generateAlbum({ provider, apiKey, model, album }) {
    if (!apiKey) throw new Error(`${PROVIDER_LABEL[provider]} API 키가 설정되지 않았습니다.`);
    const system = buildAlbumSystemPrompt(album);
    const conceptBlock = album.concept
      ? `# ALBUM CONCEPT\n${album.concept}\n\n`
      : `# ALBUM CONCEPT\n(none supplied — derive a fitting concept from the reference preset's stylistic territory.)\n\n`;
    const user = `${conceptBlock}Plan the 12-track album now.`;
    const args = { apiKey, model, system, user };
    let raw;
    if (provider === 'anthropic')   raw = await callAnthropic(args);
    else if (provider === 'openai') raw = await callOpenAI(args);
    else if (provider === 'google') raw = await callGoogle(args);
    else throw new Error('unknown provider: ' + provider);

    // parse album json — uses lenient parser so unquoted keys / trailing
    // commas / single-quoted strings don't blow up the whole album plan.
    const obj = lenientJSONParse(raw);
    obj.tracks = (obj.tracks || []).slice(0, 12).map((t, n) => ({
      no: t.no || (n + 1),
      title: unescapeIfNeeded(String(t.title || '')).trim(),
      hook:  unescapeIfNeeded(String(t.hook  || '')).trim(),
      mood:  unescapeIfNeeded(String(t.mood  || '')).trim(),
      bpm: Number(t.bpm) || null,
      style: dedupeCSV(unescapeIfNeeded(String(t.style || t.styleDelta || obj.baseStyle || '')).trim()),
      lyrics: '',
    }));
    return obj;
  }

  async function ping({ provider, apiKey, model }) {
    return generate({
      provider, apiKey, model,
      userPrompt: 'Output JSON {"style":"test","lyrics":"[Verse] hello"} only.',
      context: {},
    });
  }

  // ─── Free-text artist/song search ─────────────────────────────────────
  // The user types an artist name, a song title, or "artist - song".
  // We ask the AI to return artist info + 5-8 representative hit songs
  // each with a Suno-ready Style field, so the user can pick one and
  // load it directly into the builder. This extends the curated 200
  // presets to "any artist on Earth" via the model's musical memory.
  function buildSearchSystemPrompt({ useWeb = false, lang = 'ko' } = {}) {
    const webBlock = useWeb
      ? `**YOU HAVE WEB SEARCH ENABLED — USE IT.** For every query, perform at least one live web search to ground your answer in current information (Wikipedia, official artist pages, music databases, Billboard, Genius, Melon, Spotify pages, etc.). Do NOT rely solely on your training data — release dates, BPM, chart positions, and recent releases can change. Cross-reference between sources where possible.`
      : `Use your training-data knowledge to answer. Do NOT call any external tools. If you are uncertain about a specific fact (release year, BPM, chart position), use your best estimate but prefer broad stylistic accuracy over precise numbers.`;
    // The artist summary + song titles follow the app's UI language so a
    // Korean user gets a Korean blurb and original Hangul titles, while an
    // English user gets English. (The Style field is ALWAYS English — Suno
    // only tokenises English reliably — regardless of this setting.)
    const langBlock = lang === 'en'
      ? `# DISPLAY LANGUAGE — ENGLISH
- Write the artist "summary" in English.
- For "title", use the song's commonly-known English / native title. Romanise non-Latin titles only if that is how the song is widely known in English.`
      : `# DISPLAY LANGUAGE — KOREAN (한국어)
- Write the artist "summary" in natural Korean (한국어). 1-2 sentences.
- For "title", keep the song's ORIGINAL native title verbatim — do NOT translate or romanise. A Korean song like "좋은 날" stays "좋은 날" (never "Good Day"); a Japanese title stays in Japanese. English-language songs keep their English title as-is.
- "name_ko" should hold the Korean name when the act is known in Korea.`;
    return `You are a music archivist with deep, encyclopaedic knowledge of pop, rock, K-pop, J-pop, hip-hop, R&B, jazz, classical, electronic, world music, OST and indie scenes spanning 1950s-2020s.

${webBlock}

${langBlock}

The user will provide a free-text query that may be:
- An artist name only: "Coldplay", "아이유", "Daft Punk"
- A song title only: "Bohemian Rhapsody", "강남스타일", "Yellow"
- Both, separated by "-" or whitespace: "BTS - Dynamite", "아이유 좋은 날"

# KOREAN TRANSLITERATION — CRITICAL
The query may be a **Korean transliteration of a non-Korean artist or song**.
You MUST recognise the Hangul phonetic spelling and resolve it to the canonical English/native name before answering.
Common patterns:
- 콜드플레이 → Coldplay  · 비틀즈 → The Beatles  · 마이클잭슨 → Michael Jackson
- 다프트펑크 → Daft Punk  · 라디오헤드 → Radiohead  · 퀸 → Queen
- 빌리아일리시 → Billie Eilish  · 테일러스위프트 → Taylor Swift  · 에드시런 → Ed Sheeran
- 마룬5 → Maroon 5  · 원더걸스/소녀시대/방탄소년단 are themselves Korean (don't reverse-translate)
- 보헤미안랩소디 → Bohemian Rhapsody  · 옐로우 → Yellow (when paired with Coldplay)
- For Japanese acts: 요네즈켄시 → 米津玄師 (Kenshi Yonezu)  · 우타다 → 宇多田ヒカル (Utada Hikaru)
Apply the same rule for song titles transliterated into Hangul.
If the query is unambiguously Korean (한국 K-pop / OST / 트로트), do NOT force a foreign mapping — keep it as-is.

# OUTPUT — strict JSON only. No prose, no markdown fences. Schema:
{
  "queryType": "artist" | "song" | "artist-song" | "unknown",
  "artist": {
    "name": "<canonical English name>",
    "name_ko": "<Korean name if applicable, else empty string>",
    "era": "<peak decade or range, e.g. \\"2000s-2020s\\">",
    "genre": "<comma-separated English genre tags>",
    "country": "<short country, e.g. \\"UK\\", \\"South Korea\\">",
    "summary": "<1-2 sentence summary in the DISPLAY LANGUAGE set above>"
  },
  "songs": [
    {
      "title": "<song title — follow the DISPLAY LANGUAGE title rule above>",
      "year": <4-digit year as a number>,
      "style": "<Suno-ready Style field — see STYLE rules below>",
      "structure": "<lowercase, comma-separated: intro, verse, pre-chorus, chorus, bridge, outro>",
      "mood": "<2-3 mood descriptors>"
    }
  ]
}

# STYLE field rules — each song's "style" MUST follow these:
- Comma-separated English descriptors, target 150-220 chars.
- **NO KOREAN CHARACTERS in style.** Korean genre names must be translated: 트로트→Trot, 발라드→ballad, 통기타→acoustic guitar folk, 한국 힙합→Korean hip-hop, 한국 가요→Korean pop, 시티팝→city pop, 걸그룹→girl group, 보이그룹→boy group, 아이돌→idol, 동요→children song.
- **NO ARTIST NAMES inside the style string.** The style is a sonic fingerprint, not a credit list. Describe the sound, not who made it.
- Always include: genre, era/decade, vocal type (male/female/group/instrumental), key instrumentation, mood, and a numeric BPM (e.g. "84 BPM").
- **NO REDUNDANCY** — Each comma-separated tag MUST add NEW information.
  • NEVER state era twice (e.g. "2010s K-pop" + "2015-2019 idol pop" = forbidden — pick one).
  • NEVER state the genre lineage twice (e.g. "K-pop" + "Korean idol pop" + "K-pop production" = forbidden — pick the most specific one).
  • NEVER append filler tail phrases: "X-era sound", "X-era production", "X-pop production", "dominance era", "scene era", "golden era", "global X dominance", "X-era wave".
  • Slot order = [era] [genre/scene] [group/vocal type] [instrumentation] [mood/groove] [BPM]. Each slot appears at most ONCE — no tag may rephrase an earlier tag.
- Example good style: "alternative rock, anthemic indie, jangly clean electric guitars, falsetto male vocals, soaring chorus, melancholic yet hopeful, 2000s UK rock, 84 BPM"
- Example BAD style (avoid): "2010s K-pop, 7-member Korean boy group, trap-pop, 120 BPM, 2015-2019 Korean idol pop, global K-pop dominance era" — last two tags duplicate era + genre.

# RESULT rules
- Return 5-8 songs total, prioritising widely-recognised chart hits / signature tracks.
- If queryType is "song" or "artist-song", put the SPECIFICALLY queried song FIRST in the songs array. Other entries are companion picks from the same artist.
- If the artist/song is genuinely unknown to you, return {"queryType":"unknown", "artist":{...empty strings...}, "songs":[]} — do NOT fabricate.
- year MUST be a number, NOT a string.
- Songs sorted: queried song first (if any), then by cultural significance / chart performance (not strictly chronological).

Return JSON only. No explanations.`;
  }

  async function searchPresets({ provider, apiKey, model, query, useWeb = false, lang = 'ko' }) {
    if (!apiKey) throw new Error(`${PROVIDER_LABEL[provider]} API 키가 설정되지 않았습니다.`);
    if (!query || !query.trim()) throw new Error('검색어를 입력하세요.');
    const userMsg = useWeb
      ? `Query: ${query.trim()}\n\nSearch the web for current information about this artist/song, then return JSON ONLY (no prose around it).`
      : `Query: ${query.trim()}\n\nReturn JSON ONLY based on your training-data knowledge. No web tools.`;
    const args = {
      apiKey,
      model: model || DEFAULT_MODEL[provider],
      system: buildSearchSystemPrompt({ useWeb, lang }),
      user: userMsg,
    };
    let raw;
    if (useWeb) {
      if (provider === 'anthropic')      raw = await callAnthropicWebSearch(args);
      else if (provider === 'openai')    raw = await callOpenAIWebSearch(args);
      else if (provider === 'google')    raw = await callGoogleWebSearch(args);
      else throw new Error('알 수 없는 provider: ' + provider);
    } else {
      if (provider === 'anthropic')      raw = await callAnthropic(args);
      else if (provider === 'openai')    raw = await callOpenAI(args);
      else if (provider === 'google')    raw = await callGoogle(args);
      else throw new Error('알 수 없는 provider: ' + provider);
    }

    // Reuse the tolerant JSON parser. parseModelOutput strips fences /
    // common JSON foibles and returns the raw text on failure — we then
    // call the same lenient parser used by generate().
    let payload;
    try {
      payload = lenientJSONParse(raw);
    } catch (e) {
      throw new Error('AI 응답을 JSON 으로 해석할 수 없습니다: ' + (e.message || ''));
    }
    if (!payload || typeof payload !== 'object') throw new Error('AI 가 빈 응답을 반환했습니다.');

    payload.queryType = payload.queryType || 'unknown';
    payload.artist    = payload.artist    || { name: '', name_ko: '', era: '', genre: '', country: '', summary: '' };
    payload.songs     = Array.isArray(payload.songs) ? payload.songs : [];
    return { ...payload, query, provider, model: args.model };
  }

  window.SunoAI = { generate, generateAlbum, searchPresets, ping, ARRANGEMENT_STYLES, DEFAULT_MODEL, PROVIDER_LABEL, MODELS };
})();
