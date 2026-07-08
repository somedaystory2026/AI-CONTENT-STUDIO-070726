export type PromptOption = { id: string; ko: string; detail: string };

export const CAMERA_PROMPTS: PromptOption[] = [
  { id: "selfie_cam", ko: "셀피캠", detail: "selfie cam" },
  { id: "handheld", ko: "핸드헬드", detail: "handheld camera" },
  { id: "fpv", ko: "FPV", detail: "FPV drone shot" },
  { id: "tracking", ko: "트래킹샷", detail: "tracking shot" },
  { id: "dolly", ko: "달리", detail: "dolly shot" },
  { id: "orbit", ko: "오빗", detail: "orbit shot around the subject" },
  { id: "push_in", ko: "푸시 인", detail: "slow push in" },
  { id: "pull_out", ko: "풀 아웃", detail: "slow pull out" },
  { id: "drone", ko: "드론", detail: "aerial drone shot" },
  { id: "over_shoulder", ko: "오버 숄더", detail: "over-the-shoulder shot" },
  { id: "pov", ko: "POV", detail: "first-person POV shot" },
  { id: "shoulder_cam", ko: "숄더캠", detail: "shoulder-mounted camera" },
  { id: "static_tripod", ko: "고정 트라이포드", detail: "static tripod shot" },
  { id: "crane", ko: "크레인샷", detail: "crane shot" },
  { id: "whip_pan", ko: "휩 팬", detail: "whip pan transition" },
];

export const MOTION_PROMPTS: PromptOption[] = [
  { id: "walking", ko: "자연스럽게 걷기", detail: "walking naturally" },
  { id: "arm_sway", ko: "팔 흔들림", detail: "slight arm sway" },
  { id: "hair_wind", ko: "머리카락 바람에 날림", detail: "hair moves with the wind" },
  { id: "jacket_react", ko: "옷 움직임 반응", detail: "jacket reacts to motion" },
  { id: "looks_camera", ko: "카메라 응시", detail: "looks into camera" },
  { id: "smiles_softly", ko: "은은한 미소", detail: "smiles softly" },
  { id: "breathing", ko: "자연스러운 호흡", detail: "breathing naturally" },
  { id: "blinking", ko: "눈 깜빡임", detail: "eye blinking" },
  { id: "hand_gesture", ko: "자연스러운 손짓", detail: "natural hand gestures" },
  { id: "head_turn", ko: "천천히 고개 돌림", detail: "turns head slowly" },
  { id: "adjust_clothing", ko: "옷매무새 정리", detail: "adjusts clothing" },
  { id: "glance_away", ko: "시선 이탈 후 복귀", detail: "glances away then back" },
  { id: "weight_shift", ko: "미세한 무게중심 이동", detail: "subtle weight shift" },
  { id: "head_tilt", ko: "캐주얼한 고개 기울임", detail: "casual head tilt" },
];

export const REALISM_PROMPTS: PromptOption[] = [
  { id: "authentic", ko: "진짜같은", detail: "authentic" },
  { id: "everyday", ko: "일상적인 느낌", detail: "everyday feel" },
  { id: "natural", ko: "자연스러운", detail: "natural" },
  { id: "raw", ko: "가공되지 않은", detail: "raw" },
  { id: "documentary", ko: "다큐멘터리풍", detail: "documentary style" },
  { id: "candid", ko: "연출되지 않은", detail: "candid" },
  { id: "unscripted", ko: "즉흥적인", detail: "unscripted" },
  { id: "unposed", ko: "포즈 안 잡은", detail: "unposed" },
  { id: "imperfect_framing", ko: "약간 어긋난 구도", detail: "slightly imperfect framing" },
  { id: "real_skin", ko: "리얼 피부 질감", detail: "real skin texture" },
];

export const CAMERA_DEFECT_PROMPTS: PromptOption[] = [
  { id: "af_hunting", ko: "오토포커스 헌팅", detail: "autofocus hunting" },
  { id: "exposure_breathing", ko: "노출 미세 변화", detail: "slight exposure breathing" },
  { id: "handheld_shake", ko: "손떨림", detail: "handheld shake" },
  { id: "rolling_shutter", ko: "롤링 셔터", detail: "rolling shutter" },
  { id: "lens_breathing", ko: "렌즈 브리딩", detail: "lens breathing" },
  { id: "stabilization", ko: "폰 손떨림 보정 잔여감", detail: "phone stabilization artifacts" },
  { id: "micro_jitter", ko: "미세 지터", detail: "micro jitters" },
  { id: "motion_blur", ko: "살짝 모션 블러", detail: "slight motion blur" },
  { id: "focus_pull", ko: "가끔 포커스 풀링", detail: "occasional focus pull" },
  { id: "grain", ko: "미세 그레인", detail: "subtle film grain" },
];

export const LIGHTING_PROMPTS: PromptOption[] = [
  { id: "golden_hour", ko: "골든아워", detail: "golden hour" },
  { id: "rainy_street", ko: "비 오는 거리", detail: "rainy street with reflections" },
  { id: "soft_daylight", ko: "부드러운 낮 햇살", detail: "soft daylight" },
  { id: "cloudy", ko: "흐린 날씨", detail: "cloudy overcast light" },
  { id: "neon", ko: "네온 조명", detail: "neon lights" },
  { id: "volumetric", ko: "빛내림", detail: "volumetric light" },
  { id: "rim_light", ko: "림 라이트", detail: "rim light" },
  { id: "window_light", ko: "창가광", detail: "window light" },
  { id: "blue_hour", ko: "블루아워", detail: "blue hour" },
  { id: "harsh_noon", ko: "강한 정오 햇살", detail: "harsh midday sun" },
  { id: "candlelight", ko: "촛불", detail: "candlelight" },
  { id: "streetlight", ko: "가로등 불빛", detail: "streetlight glow" },
];

export const STYLE_PROMPTS: PromptOption[] = [
  { id: "cinematic", ko: "시네마틱", detail: "cinematic" },
  { id: "netflix", ko: "넷플릭스풍", detail: "Netflix-style" },
  { id: "sony_fx3", ko: "Sony FX3", detail: "Sony FX3 look" },
  { id: "iphone_vlog", ko: "아이폰 브이로그", detail: "iPhone vlog style" },
  { id: "film_35mm", ko: "35mm 필름", detail: "35mm film" },
  { id: "kodak", ko: "코닥 색감", detail: "Kodak color science" },
  { id: "documentary_style", ko: "다큐 스타일", detail: "documentary" },
  { id: "commercial", ko: "커머셜", detail: "commercial" },
  { id: "travel_vlog", ko: "여행 브이로그", detail: "travel vlog" },
  { id: "indie_film", ko: "인디 영화풍 (A24)", detail: "A24-style indie film" },
  { id: "music_video", ko: "뮤직비디오", detail: "music video style" },
  { id: "found_footage", ko: "파운드 푸티지", detail: "found footage style" },
];

export const SUBJECT_AGES: PromptOption[] = [
  { id: "early20s", ko: "20대 초반", detail: "22-year-old" },
  { id: "mid20s", ko: "20대 중반", detail: "25-year-old" },
  { id: "late20s", ko: "20대 후반", detail: "28-year-old" },
  { id: "early30s", ko: "30대 초반", detail: "32-year-old" },
  { id: "mid30s", ko: "30대 중반", detail: "35-year-old" },
];

export const SUBJECT_NATIONALITIES: PromptOption[] = [
  { id: "korean", ko: "한국인", detail: "Korean" },
  { id: "japanese", ko: "일본인", detail: "Japanese" },
  { id: "chinese", ko: "중국인", detail: "Chinese" },
  { id: "american", ko: "미국인", detail: "American" },
  { id: "european", ko: "유럽인", detail: "European" },
  { id: "global", ko: "글로벌 (미지정)", detail: "" },
];

export const SUBJECT_GENDERS: PromptOption[] = [
  { id: "woman", ko: "여성", detail: "woman" },
  { id: "man", ko: "남성", detail: "man" },
];

export const SUBJECT_HAIR: PromptOption[] = [
  { id: "black_ponytail", ko: "검정 포니테일", detail: "black ponytail" },
  { id: "black_straight", ko: "검정 생머리", detail: "long black straight hair" },
  { id: "brown_wave", ko: "갈색 웨이브", detail: "brown wavy hair" },
  { id: "bob_cut", ko: "단발", detail: "bob cut" },
  { id: "bun", ko: "묶은 머리", detail: "hair in a bun" },
  { id: "short_hair", ko: "짧은 머리", detail: "short hair" },
];

export const SUBJECT_OUTFITS: PromptOption[] = [
  { id: "grey_hoodie", ko: "그레이 후드티", detail: "grey hoodie" },
  { id: "white_tank", ko: "화이트 탱크탑", detail: "white tank top" },
  { id: "denim_jacket", ko: "데님 자켓", detail: "denim jacket" },
  { id: "office_blazer", ko: "오피스 블레이저", detail: "office blazer" },
  { id: "sundress", ko: "썬드레스", detail: "summer sundress" },
  { id: "sportswear", ko: "스포츠웨어", detail: "sportswear" },
];

export const SUBJECT_EXPRESSIONS: PromptOption[] = [
  { id: "minimal_makeup", ko: "미니멀 메이크업 · 자연스러운 표정", detail: "minimal makeup, natural skin, realistic face" },
  { id: "confident", ko: "자신감 있는 표정", detail: "confident expression, realistic face" },
  { id: "relaxed", ko: "편안한 표정", detail: "relaxed expression, natural skin" },
];

export const OUTPUT_PROMPTS: PromptOption[] = [
  { id: "res_4k", ko: "4K", detail: "4K" },
  { id: "res_1080p", ko: "1080p", detail: "1080p" },
  { id: "ratio_169", ko: "16:9", detail: "16:9" },
  { id: "ratio_916", ko: "9:16", detail: "9:16" },
  { id: "ratio_11", ko: "1:1", detail: "1:1" },
  { id: "dur_15", ko: "15초", detail: "15 seconds" },
  { id: "dur_30", ko: "30초", detail: "30 seconds" },
  { id: "dur_60", ko: "60초", detail: "60 seconds" },
  { id: "smooth_motion", ko: "부드러운 움직임", detail: "smooth motion" },
  { id: "high_realism", ko: "높은 리얼리즘", detail: "high realism" },
  { id: "no_text", ko: "텍스트 오버레이 없음", detail: "no text overlay" },
  { id: "no_watermark", ko: "워터마크 없음", detail: "no watermark" },
];

// Krea 2 / Veo 3 / Kling / Hailuo 등 모델별로 프롬프트 앞에 붙이면 좋은 짧은 안내 문구.
// 실제 문법 차이는 거의 없고, 각 모델이 특히 잘 반응하는 표현 톤만 다릅니다.
export const MODEL_HINTS: { id: string; label: string; hint: string }[] = [
  { id: "generic", label: "범용 (Seedance 등)", hint: "" },
  { id: "veo3", label: "Google Veo 3", hint: "High-fidelity realistic video. " },
  { id: "kling", label: "Kling", hint: "Ultra realistic cinematic video, consistent subject identity. " },
  { id: "hailuo", label: "Hailuo (MiniMax)", hint: "Photorealistic natural motion video. " },
  { id: "krea2", label: "Krea 2", hint: "Raw authentic realism, minimal AI artifacts. " },
];
