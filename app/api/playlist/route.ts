import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

interface VideoRef {
  title: string;
  channel: string;
  viewCount?: string | number;
}

const langMap: Record<string, string> = {
  ko: "한국어 (Korean)만 사용하세요. 다른 언어를 섞지 마세요.",
  en: "English only. Do not use any Korean.",
  mix: "한국어 + 영어 믹스. 후렴 핵심 라인은 영어로.",
  ja: "日本語のみ (Japanese only). 韓国語や英語は使わないこと。",
  hi: "हिन्दी (Hindi only). कोई कोरियाई या अंग्रेज़ी नहीं।",
};

export async function POST(req: NextRequest) {
  try {
    const { videos, count, language, variations, useCases, genre, keyword, openaiKey } = await req.json();

    if (!openaiKey) {
      return NextResponse.json({ error: "OpenAI API 키가 없습니다." }, { status: 400 });
    }
    if (!Array.isArray(videos) || videos.length === 0) {
      return NextResponse.json({ error: "참조 영상을 1개 이상 선택해주세요." }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: openaiKey });
    const langInstruction = langMap[language] || langMap["ko"];

    const referenceContext = (videos as VideoRef[])
      .map((v, i) => `${i + 1}. "${v.title}" (채널: ${v.channel}, 조회수: ${v.viewCount ?? "?"})`)
      .join("\n");

    const variationText = Array.isArray(variations) && variations.length ? variations.join(", ") : "없음";
    const useCaseText = Array.isArray(useCases) && useCases.length ? useCases.join(", ") : "없음";
    const genreText = (genre && String(genre).trim()) || (keyword && String(keyword).trim()) || "참조 영상 분위기에서 자유롭게 추론";

    async function generateOne(index: number) {
      const prompt = `
당신은 세계적인 수준의 Suno AI 작사가/프로듀서이자 사운드 디자이너입니다. 장르에 따라 완전히 다른 사운드를 만들어낼 수 있는 다재다능한 프로듀서이며, 특정 장르(로파이/재즈 등)에 치우치지 않습니다.

이번 플레이리스트의 핵심 장르/스타일: ${genreText}
(반드시 이 장르/스타일에 맞는 BPM, 악기, 보컬 톤을 사용하세요. 예를 들어 EDM/Workout 계열이면 120~140 BPM의 강한 비트, K-Pop/Pop이면 90~128 BPM의 화려한 프로덕션, Jazz면 스윙감 있는 110~140 BPM도 가능, Lo-fi/Meditation 계열만 60~80 BPM의 느린 템포를 사용하세요. 장르와 무관하게 무조건 느린 다운템포로 만들지 마세요.)

참조 영상 목록 (이 영상들의 성공 요인을 참고해 전체적인 분위기를 잡아주세요):
${referenceContext}

이 곡은 플레이리스트의 ${index + 1}번째 곡입니다. 플레이리스트 전체의 톤은 통일하되, 장면/멜로디/장소 디테일은 다른 곡들과 겹치지 않게 새롭게 창작하세요.

가사 언어 지침: ${langInstruction}
추가하고 싶은 음악적 변주: ${variationText}
플레이리스트 용도/장르: ${useCaseText}

──────────────────────────────────
[1] Style of Music 작성 규칙
──────────────────────────────────
영문으로 400~700자 분량의 하나의 자연스러운 문단으로 작성하세요. 아래 요소를 모두 자연스럽게 녹여내세요:
- 위에서 지정한 핵심 장르/스타일(${genreText})에 맞는 정확한 BPM과 장르 표현을 맨 앞에 배치 (장르에 어울리는 템포를 선택하고, 그 장르가 로파이/칠/명상류가 아니라면 느린 다운템포를 강요하지 마세요)
- 핵심 악기와 그 역할을 구체적으로 묘사 (장르에 맞는 악기 구성을 사용하세요. 예: EDM이면 신스/사이드체인 베이스, 록이면 디스토션 기타/드럼킷, 재즈면 어쿠스틱 베이스/브러시 드럼 등)
- 장르와 곡의 장소/테마에 어울리는 사운드 디자인 요소를 비트의 구성 요소로 자연스럽게 짜넣기 (느린 ASMR/카페 환경음은 해당 장르가 Lo-fi/Chill/Meditation 계열일 때만 사용하고, 그 외 장르에는 그 장르에 맞는 사운드 디자인을 사용하세요 — 매번 새로운 장면으로 창작)
- 보컬 스타일을 상세히 묘사 (톤, 감정, 발음 느낌, 코러스/허밍 여부, 비하인드 더 비트 등)
- 믹스/공간 효과 기법 묘사 (장르에 맞는 믹스 기법, 예: EDM이면 사이드체인 컴프레션과 와이드 스테레오, 발라드면 lush plate reverb 등)
- 마지막 문장은 이 곡이 청자에게 어떤 경험/감정을 주는지로 마무리
- 클리셰 단어 금지: dream, shining, sky, tonight, forever

──────────────────────────────────
[2] 가사(lyrics) 작성 규칙 — 매우 중요
──────────────────────────────────
실제 Suno AI에 그대로 붙여넣을 수 있도록, 각 섹션 앞에 브라켓 태그를 반드시 붙이세요.
브라켓 태그 안에는 그 섹션에서 사용할 사운드/보컬 디렉션을 짧은 영어로 적습니다 (콜론 뒤에 1~4단어, 곡마다 새롭게 창작).

태그 예시 (그대로 베끼지 말고 곡의 장면에 맞게 새로 창작):
[Intro: pouring water, Rhodes piano]
[Verse 1]
[Pre-Chorus: slow bass groove]
[Chorus: soulful vocals]
[Verse 2]
[Bridge: wordless humming]  ← 또는 [Instrumental Solo: acoustic guitar, 8 bars]
[Chorus: soulful vocals]
[Outro: tape noise, slow fade]

구조는 Intro → Verse 1 → Pre-Chorus(선택) → Chorus → Verse 2 → Bridge 또는 Instrumental Solo → Chorus(반복) → Outro 순서를 기본으로 하되 자연스럽게 변형 가능합니다.
- 브라켓 태그 줄 자체는 영어, 그 외 실제 가사 줄에는 특수문자/구두점 절대 사용 금지 (! , . ? ; : " ' 등)
- 애드립은 소괄호만 사용: (yeah) (흠)
- Bridge에는 가끔 가사 대신 "흠... 흠..." 같은 허밍/보칼라이즈를 넣어도 좋습니다
- 전체 8~10개 섹션, 실제 노래 한 곡 분량으로 충실하게 작성
- lyrics 필드 안에 모든 섹션과 가사를 줄바꿈으로 이어서 하나의 문자열로 작성하세요 (위 예시처럼 태그 줄 다음 줄에 가사)

다음 JSON 형식으로만 응답 (마크다운 코드블록 없이):
{
  "songTitle": "노래 제목",
  "mood": "한 줄 분위기 요약",
  "sunoStylePrompt": "위 [1] 규칙을 따른 Suno Style of Music 영문 문단",
  "lyrics": "위 [2] 규칙을 따른 전체 가사 텍스트 (브라켓 태그 + 줄바꿈 포함, Intro부터 Outro까지)",
  "imagePromptKo": "유튜브 썸네일용 이미지 프롬프트 한글, 16:9 장면 묘사",
  "imagePromptEn": "Thumbnail image prompt in English, cinematic 16:9 scene, highly detailed"
}
`;

      let completion;
      try {
        completion = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.95,
          max_tokens: 2000,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "OpenAI 호출 실패";
        return {
          id: `song-${index + 1}`,
          songTitle: `곡 ${index + 1} (생성 실패)`,
          mood: "",
          sunoStylePrompt: "",
          lyrics: "",
          imagePromptKo: "",
          imagePromptEn: "",
          error: message,
        };
      }

      const raw = completion.choices[0].message.content || "";
      const clean = raw.replace(/```json|```/g, "").trim();
      try {
        const parsed = JSON.parse(clean);
        return { id: `song-${index + 1}`, ...parsed };
      } catch {
        return {
          id: `song-${index + 1}`,
          songTitle: `곡 ${index + 1} (생성 실패)`,
          mood: "",
          sunoStylePrompt: "",
          lyrics: "",
          imagePromptKo: "",
          imagePromptEn: "",
          error: "GPT 응답 파싱 실패",
        };
      }
    }

    const n = Math.min(Math.max(Number(count) || 1, 1), 30);

    // 동시 호출 부담을 줄이기 위해 5개씩 묶어서 처리
    const batchSize = 5;
    const songs: any[] = [];
    for (let i = 0; i < n; i += batchSize) {
      const batchIndices = Array.from({ length: Math.min(batchSize, n - i) }, (_, j) => i + j);
      const batchResults = await Promise.all(batchIndices.map((idx) => generateOne(idx)));
      songs.push(...batchResults);
    }

    return NextResponse.json({ songs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "플레이리스트 생성 중 알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
