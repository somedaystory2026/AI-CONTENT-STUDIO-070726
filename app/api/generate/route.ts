import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
  const { genre, keyword, analysis, openaiKey, language, sectionKey } = await req.json();

  if (!openaiKey) {
    return NextResponse.json({ error: "OpenAI API 키가 없습니다." }, { status: 400 });
  }

  const client = new OpenAI({ apiKey: openaiKey });

  const analysisContext = analysis
    ? `
분석된 성공 공식: ${analysis.successFormula}
제목 전략: ${analysis.titleStrategy}
타겟 청중: ${analysis.audienceTarget}
콘텐츠 구조: ${analysis.contentStructure}
트렌드 키워드: ${analysis.trendKeywords?.join(", ")}
추천사항: ${analysis.recommendation}
`
    : `장르: ${genre}\n키워드: ${keyword}`;

  const langMap: Record<string, string> = {
    ko: "한국어 (Korean). 반드시 한국어로만 작성. 영어 훅은 30% 이내.",
    en: "English only. All lyrics must be written in English. Do not use any Korean.",
    mix: "한국어 + 영어 믹스. 후렴 핵심 라인은 영어로.",
    ja: `日本語のみ (Japanese only). すべての歌詞を必ず日本語で書くこと。韓国語や英語は使わないこと。

【日本語作詞 厳守ルール】

▼ 絶対使用禁止の単語・フレーズ:
希望 夢の欠片 終わらない物語 同じ空が繋いでいる 輝く光 未来へ手を伸ばそう きっと乗り越えていける
永遠に続く 奇跡を信じて 一人じゃない 大丈夫 輝ける未来 翼を広げて 心に刻む
夢を追いかけて この瞬間を忘れないで 輝いている

▼ 青春曲クリシェ 使用禁止ワード（AIが頻繁に使う陳腐なソザイ）:
校庭の隅の自販機 川沿い 夕焼け 坂道 オレンジ色の帰り道 踏切 一番星 ラララ
青春 はにかむ 届かない想い 消えそうな記憶 あの頃に戻りたい

▼ 禁止パターン:
- 〜していこう / 〜しようよ などの勧誘形で終わる行
- 「悲しい」「嬉しい」「切ない」「好き」など感情を直接書く表現
- 宇宙・世界・永遠など大きすぎるスケールの比喩
- 前向きなメッセージ・応援で締める構成
- 後半で オレンジ色 帰り道 思い出 忘れない を繰り返すループ構成

▼ 作詞スタイル（Mr.Children・あいみょん・米津玄師・back number を参考に）:

【感情は書かず、具体的な記憶で表現する】
悪い例: そんな日々が好きだった / なぜだか心地よかった
良い例: サイダーの泡が鼻に抜けた / 君はいつも左側を歩いた / 自転車の鍵をよく無くしてた

【構成のルール】
- 全体の80%は具体的な場面・行動・物で構成する
- 抽象表現は全体の20%以内に抑える
- 後半（Bridge以降）では必ず前半に出てこなかった新しい場面を一つ入れる
- 体言止めを積極的に使う
- ひらがな多め、漢字は効果的な場所にだけ使う
- 口語と文語を自然に混ぜる

【良い具体描写の例】
「君が苦手な数学のノートを後ろから回してた」
「自販機の小銭を何度も数え直した」
「返信が来るたびに画面の明るさを下げた」
「卒業式の朝だけ早く起きた」`,
    hi: "हिन्दी (Hindi only). सभी गाने के बोल हिन्दी में लिखें। कोई कोरियाई या अंग्रेज़ी नहीं।",
  };
  const langInstruction = langMap[language] || langMap["ko"];
  const langLabel = ({ ko: "한국어", en: "English", mix: "한영 믹스", ja: "日本語", hi: "हिन्दी" } as Record<string,string>)[language] || "한국어";

  // 섹션 단일 재생성 모드
  if (sectionKey) {
    const jaExtraRule = language === "ja" ? `
【日本語作詞 厳守ルール】
絶対使用禁止: 希望 夢の欠片 終わらない物語 輝く光 未来へ手を伸ばそう きっと乗り越えていける 永遠に続く 奇跡を信じて 一人じゃない 翼を広げて 心に刻む 夢を追いかけて

青春クリシェ禁止: 校庭の隅の自販機 川沿い 夕焼け 坂道 オレンジ色の帰り道 踏切 一番星 ラララ 青春 はにかむ

禁止パターン: 勧誘形で終わる行 / 感情を直接書く表現 / 大きすぎるスケールの比喩 / 前向きなメッセージで締める / オレンジ色・帰り道・思い出・忘れないの繰り返し

作詞スタイル:
- 感情は書かず「具体的な記憶・行動・物」で表現する
  良い例: サイダーの泡が鼻に抜けた / 君はいつも左側を歩いた / 自転車の鍵をよく無くしてた
- 舞台は日常の具体物（部屋・駅・コンビニ・窓・布団など）
- 体言止め多用 / ひらがな多め
- 後半には前半に出てこなかった新しい場面を一つ入れる` : "";

    const sectionPrompt = [
      "당신은 세계적인 수준의 작사가 겸 ASMR/Lo-fi 사운드 디자이너입니다.",
      "아래 섹션의 가사만 새로 창작해주세요.",
      "",
      "섹션: " + sectionKey,
      "장르/키워드: " + genre + " / " + keyword,
      "언어: " + langLabel + " — 반드시 이 언어로만 작성하세요.",
      langInstruction,
      jaExtraRule,
      "",
      "규칙:",
      "- 첫 줄은 반드시 영문 브라켓 태그로 시작: [" + sectionKey + ": 짧은 사운드/보컬 디렉션 1~4단어] (예: [Bridge: wordless humming], [Intro: pouring water, Rhodes piano])",
      "- 브라켓 태그 다음 줄부터 실제 가사",
      "- 가사 줄에는 특수문자 절대 금지: ! , . ? ; : \" \' ！ 등 (브라켓 태그 줄은 예외)",
      "- 애드립은 소괄호만: (yeah) (uh)",
      "- 가사만 출력, 다른 설명 없이 순수 가사 텍스트만",
      "",
      "가사만 출력하세요 (JSON 아님).",
    ].join("\n");

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: sectionPrompt }],
      temperature: 0.95,
      max_tokens: 500,
    });
    const text = completion.choices[0].message.content?.trim() || "";
    return NextResponse.json({ text });
  }

  // 전체 생성 모드
  const langHeader = [
    "⚠️ 가사 언어 필수 지침 ⚠️",
    "가사 언어: " + langLabel,
    langInstruction,
    "이 언어 규칙을 절대적으로 따르세요. 다른 언어로 작성하면 안 됩니다.",
  ].join("\n");

  const prompt = `
당신은 세계적인 수준의 Suno AI 전문 작사가, 프로듀서, 프롬프트 엔지니어입니다.

${langHeader}

아래 분석을 바탕으로 Suno AI에 바로 붙여넣을 수 있는 완성형 결과물을 만들어주세요.

${analysisContext}

Suno AI 핵심 규칙:
- Style of Music은 영문 400~700자 분량의 하나의 자연스러운 문단으로 작성. BPM/템포/장르 퓨전을 맨 앞에 배치하고, 핵심 악기와 역할, 장면에 어울리는 ASMR/Foley 사운드(예: 커피 그라인더, 빗소리, 종이 넘기는 소리 등 — 장면에 맞게 새로 창작)를 비트 구성 요소로 자연스럽게 녹여 쓰고, 보컬 스타일과 믹스/공간 효과(binaural panning, plate reverb, lo-fi tape warmth 등)까지 묘사
- 가장 중요한 요소(장르·BPM·분위기)를 맨 앞에 배치
- 인트로는 0초 임팩트: "Cold open" 또는 "Drop immediately" 방식
- 클리셰 단어 절대 금지: dream, shining, sky, tonight, forever, tapestry
- 부정 지시 금지 ("피아노 없음" 등)
- 후렴은 짧고 중독성 있게, 틱톡 바이럴 기준
- 가사 총 3,000자 이내
- 애드립은 소괄호: (yeah) (오늘도) (uh)
- 가사의 각 섹션(아래 lyrics 객체의 각 필드)은 반드시 첫 줄을 영문 브라켓 태그로 시작해야 합니다. 태그 안에는 그 섹션에서 쓰일 짧은 사운드/보컬 디렉션을 1~4단어로 적으세요 (예: [Intro: pouring water, Rhodes piano], [Chorus: soulful vocals], [Bridge: wordless humming], [Outro: tape noise, slow fade]). 태그 다음 줄부터 실제 가사를 씁니다.
- 브라켓 태그 줄을 제외한 가사 본문에는 특수문자 절대 사용 금지: ！ ! , . ? ; : " ' 등 모든 구두점

총 가사 분량: 실제 3~4분 노래 분량 (10개 섹션 풀 구성)

다음 형식의 JSON으로만 응답 (마크다운 코드블록 없이):
{
  "songTitle": "노래 제목",
  "style": {
    "genre": "장르 + 하위 장르",
    "tempo": "빠르기 (예: Slow 72BPM, Midtempo 98BPM)",
    "mood": "감성/분위기 (구체적 장면 묘사)",
    "instruments": ["악기1 - 역할", "악기2 - 역할", "악기3 - 역할", "악기4 - 역할"],
    "vocalStyle": "보컬 스타일 상세 묘사",
    "referenceSounds": "레퍼런스 아티스트 1~2명 + 곡 스타일"
  },
  "sunoStylePrompt": "위 규칙을 따른 Suno Style of Music 영문 문단 (400~700자, BPM/악기/ASMR Foley/보컬/믹스 기법 포함)",
  "structure": ["Intro", "Verse 1", "Pre-Chorus", "Chorus", "Verse 2", "Pre-Chorus", "Chorus", "Bridge", "Final Chorus", "Outro"],
  "lyrics": {
    "intro": "[Intro: 짧은 디렉션] 다음 줄부터 인트로 가사 4줄",
    "verse1": "[Verse 1] 다음 줄부터 1절 가사 8줄",
    "preChorus1": "[Pre-Chorus: 짧은 디렉션] 다음 줄부터 프리코러스 1 가사 4줄",
    "chorus": "[Chorus: 짧은 디렉션] 다음 줄부터 코러스 8줄",
    "verse2": "[Verse 2] 다음 줄부터 2절 가사 8줄",
    "preChorus2": "[Pre-Chorus: 짧은 디렉션] 다음 줄부터 프리코러스 2 가사 4줄",
    "chorus2": "[Chorus: 짧은 디렉션] 다음 줄부터 코러스 2 가사 8줄",
    "bridge": "[Bridge: 짧은 디렉션] 다음 줄부터 브릿지 가사 6줄 (가끔 허밍/보칼라이즈로 대체 가능)",
    "finalChorus": "[Chorus: 짧은 디렉션] 다음 줄부터 파이널 코러스 8줄",
    "outro": "[Outro: 짧은 디렉션] 다음 줄부터 아웃트로 4줄"
  },
  "productionNotes": "프로듀싱 방향",
  "targetEmotion": "청자가 느끼길 바라는 감정",
  "imagePrompt": "A cinematic 16:9 image prompt in English for AI image generation. Scene, mood, color palette, lighting, art style, 8k, cinematic, highly detailed."
}
`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.9,
    max_tokens: 4500,
  });

  const raw = completion.choices[0].message.content || "";
  const clean = raw.replace(/```json|```/g, "").trim();

  try {
    const parsed = JSON.parse(clean);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "GPT 응답 파싱 실패", raw }, { status: 500 });
  }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "가사 생성 중 알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
