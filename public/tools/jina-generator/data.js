// ============================================================
// AI 인플루언서 진아 생성기 — 데이터 모듈 (전체 옵션)
// 일반 스크립트(비-모듈)로 로드되어 window.JinaData 에 담깁니다.
// file:// 로 직접 열어도(더블클릭) 동작하도록 ES module import를 쓰지 않습니다.
// ============================================================
(function () {
  const GENDERS = [
    { id: "female", ko: "여성", detail: "woman" },
    { id: "male", ko: "남성", detail: "man" },
    { id: "nonbinary", ko: "기타/중성", detail: "person" },
  ];

  const AD_TYPES = [
    { id: "group_buy", ko: "공동 구매 (Group Buy)", detail: 'Limited-time exclusive discount sale driven by fandom power. Vibe: Urgent, Excited. Pose: Showing product clearly to camera, pointing to "Link in Bio".' },
    { id: "seeding", ko: "단순 협찬 (Seeding)", detail: "Casual genuine review of a gifted product. Vibe: Natural, Daily Life, Authentic." },
    { id: "paid_partnership", ko: "브랜디드 콘텐츠 (Paid Ad)", detail: "High-quality official advertisement. Vibe: Professional, Polished, Commercial." },
    { id: "ambassador", ko: "앰배서더 (Ambassador)", detail: "Long-term brand face. Vibe: Iconic, Confident, Luxurious." },
    { id: "my_money", ko: "내돈내산 (Genuine Review)", detail: "Authentic unsponsored review bought with own money. Vibe: Honest, Trustworthy." },
  ];

  const DAILY_VIBES = [
    { id: "morning_vibes", ko: "🌅 아침 거울 셀카", config: { outfit: "luxurious navy blue satin pajama set", location: "cozy sunlight-filled bedroom with a full-length vanity mirror", expression: "relaxed", pose: "mirror_selfie", lighting: "m_win", hairStyle: "bun_m", camera: "iphone_front", filmStock: "instax", skin: ["pore", "dewy"] } },
    { id: "cafe_vlog", ko: "☕ 성수동 카페 브이로그", config: { outfit: "oversized white crisp button-up shirt and gold accessories", location: "aesthetic industrial cafe with warm ambient lighting", expression: "dreamy", pose: "vlog_selfie", lighting: "g_5pm", hairStyle: "l_str_b", camera: "vlog_cam", filmStock: "f_400h", skin: ["glow", "rosy"] } },
    { id: "gym_routine", ko: "💪 오운완 짐벌 셀카", config: { outfit: "tight seamless sports bra and high-waist leggings", location: "modern high-end fitness center with mirrors", expression: "determined", pose: "gimbal_selfie", lighting: "top_lit", hairStyle: "ponytail_h", camera: "gimbal", filmStock: "modern_digital", skin: ["sweat", "texture"] } },
    { id: "elevator_ootd", ko: "🏢 엘리베이터 OOTD", config: { outfit: "chic mini skirt with an oversized boxy blazer and designer bag", location: "luxury mirrored elevator with soft bright lighting", expression: "chic", pose: "mirror_selfie", lighting: "studio_soft", hairStyle: "half_up", camera: "iphone_front", filmStock: "modern_digital", skin: ["pore", "matte"] } },
    { id: "rooftop_sunset", ko: "🌇 루프탑 선셋 브이로그", config: { outfit: "feminine floral silk wrap dress", location: "city rooftop terrace at dusk with golden city lights", expression: "smile", pose: "vlog_selfie", lighting: "g_5pm", hairStyle: "l_wave_br", camera: "vlog_cam", filmStock: "f_400h", skin: ["glow", "highlight"] } },
    { id: "airport_fashion", ko: "✈️ 공항 패션", config: { outfit: "oversized beige trench coat, wide-leg trousers, designer sunglasses, carry-on suitcase", location: "bright modern airport departure hall with large windows", expression: "chic", pose: "walking", lighting: "daylight", hairStyle: "l_str_b", camera: "iphone_front", filmStock: "modern_digital", skin: ["pore", "matte"] } },
    { id: "convenience_night", ko: "🌙 편의점 야식 브이로그", config: { outfit: "oversized hoodie and casual shorts, no makeup look", location: "brightly lit convenience store at night with neon signage", expression: "playful", pose: "leaning", lighting: "neon", hairStyle: "bun_m", camera: "vlog_cam", filmStock: "modern_digital", skin: ["pore", "dewy"] } },
    { id: "library_study", ko: "📚 도서관 스터디 카페", config: { outfit: "soft knit cardigan over a plain white tee, round glasses", location: "quiet minimalist study cafe with wooden desks and soft daylight", expression: "focused", pose: "sitting", lighting: "m_win", hairStyle: "half_up", camera: "iphone_front", filmStock: "f_400h", skin: ["pore", "matte"] } },
    { id: "festival_crowd", ko: "🎪 페스티벌 데이룩", config: { outfit: "colorful crop top, denim shorts, layered accessories, glitter makeup", location: "outdoor music festival grounds with crowd and stage lights in the distance", expression: "excited", pose: "jumping", lighting: "afternoon_gold", hairStyle: "braids_t", camera: "gimbal", filmStock: "instax", skin: ["glow", "sweat"] } },
    { id: "winter_street", ko: "🧥 겨울 롱코트 거리컷", config: { outfit: "camel long wool coat, cashmere scarf, ankle boots", location: "European-style stone street lined with bare winter trees", expression: "chic", pose: "walking", lighting: "daylight", hairStyle: "l_wave_br", camera: "dslr_85mm", filmStock: "f_400h", skin: ["pore", "matte"] } },
    { id: "rainy_window", ko: "🌧️ 비 오는 날 창가", config: { outfit: "oversized cream sweater, cozy knit socks", location: "cafe window seat with raindrops on the glass and city lights blurred outside", expression: "dreamy", pose: "sitting", lighting: "m_win", hairStyle: "l_str_b", camera: "iphone_front", filmStock: "f_400h", skin: ["pore", "dewy"] } },
    { id: "brunch_kitchen", ko: "🍳 홈 브런치 아침", config: { outfit: "silk pajama shirt, messy bun, minimal makeup", location: "bright modern kitchen island with brunch spread and morning sunlight", expression: "g_smile", pose: "sitting", lighting: "morning_sun", hairStyle: "bun_m", camera: "iphone_front", filmStock: "instax", skin: ["dewy", "pore"] } },
    { id: "night_drive", ko: "🚗 야경 드라이브", config: { outfit: "leather jacket over a simple black top", location: "inside a car at night with city skyline lights and dashboard glow", expression: "chic", pose: "selfie", lighting: "neon_noir", hairStyle: "l_wave_br", camera: "iphone_front", filmStock: "modern_digital", skin: ["glow", "highlight"] } },
    { id: "department_shopping", ko: "🛍️ 백화점 쇼핑", config: { outfit: "tailored blazer dress, heels, designer shopping bags", location: "luxury department store atrium with marble floors and bright lighting", expression: "chic", pose: "walking", lighting: "studio_soft", hairStyle: "half_up", camera: "iphone_front", filmStock: "modern_digital", skin: ["pore", "matte"] } },
    { id: "beach_getaway", ko: "🏖️ 여름 바다 여행", config: { outfit: "flowy linen sundress, straw hat, gold jewelry", location: "tropical beach with turquoise water and palm trees at golden hour", expression: "smile", pose: "walking", lighting: "afternoon_gold", hairStyle: "l_wave_br", camera: "gimbal", filmStock: "instax", skin: ["glow", "sweat"] } },
    { id: "office_overtime", ko: "🌃 사무실 야근", config: { outfit: "crisp white blouse, loosened top button, cardigan draped over the chair", location: "dim modern office at night lit mostly by desk lamps and monitor glow", expression: "sleepy", pose: "sitting", lighting: "neon_noir", hairStyle: "l_str_b", camera: "iphone_front", filmStock: "modern_digital", skin: ["pore", "matte"] } },
    { id: "hiking_picnic", ko: "🥾 등산 피크닉", config: { outfit: "casual outdoor fleece vest, cap, comfortable hiking pants", location: "scenic mountain trail overlook with a picnic mat and blue sky", expression: "smile", pose: "sitting", lighting: "daylight", hairStyle: "ponytail_h", camera: "vlog_cam", filmStock: "modern_digital", skin: ["pore", "sweat"] } },
    { id: "christmas_party", ko: "🎄 크리스마스 파티룩", config: { outfit: "red velvet party dress, statement earrings, soft glam makeup", location: "cozy living room decorated with a Christmas tree and warm string lights", expression: "excited", pose: "standing", lighting: "warm_natural", hairStyle: "l_wave_br", camera: "iphone_front", filmStock: "instax", skin: ["glow", "highlight"] } },
  ];

  const ETHNICITIES = [
    { id: "kr", ko: "한국인", detail: "Korean" },
    { id: "jp", ko: "일본인", detail: "Japanese" },
    { id: "cn", ko: "중국인", detail: "Chinese" },
    { id: "vn", ko: "베트남인", detail: "Vietnamese" },
    { id: "th", ko: "태국인", detail: "Thai" },
    { id: "tw", ko: "대만인", detail: "Taiwanese" },
    { id: "sg", ko: "싱가포르인", detail: "Singaporean" },
    { id: "id", ko: "인도네시아인", detail: "Indonesian" },
    { id: "ph", ko: "필리핀인", detail: "Filipino" },
    { id: "in_n", ko: "북인도인", detail: "North Indian" },
    { id: "in_s", ko: "남인도인", detail: "South Indian" },
    { id: "me_a", ko: "중동 아랍인", detail: "Arab" },
    { id: "me_p", ko: "중동 페르시아인", detail: "Persian" },
    { id: "tr", ko: "터키인", detail: "Turkish" },
    { id: "cau_n", ko: "북유럽 백인", detail: "Nordic" },
    { id: "cau_m", ko: "지중해 백인", detail: "Mediterranean" },
    { id: "cau_e", ko: "동유럽 백인", detail: "Eastern European" },
    { id: "ru", ko: "러시아인", detail: "Russian" },
    { id: "fr", ko: "프랑스인", detail: "French" },
    { id: "it", ko: "이탈리아인", detail: "Italian" },
    { id: "es", ko: "스페인인", detail: "Spanish" },
    { id: "uk", ko: "영국인", detail: "British" },
    { id: "de", ko: "독일인", detail: "German" },
    { id: "af_am", ko: "아프리카계 미국인", detail: "African American" },
    { id: "af_w", ko: "서아프리카인", detail: "West African" },
    { id: "lat_m", ko: "라틴 메스티소", detail: "Mestizo Latina" },
    { id: "br", ko: "브라질인", detail: "Brazilian" },
    { id: "mx", ko: "멕시코인", detail: "Mexican" },
    { id: "au", ko: "호주인", detail: "Australian" },
    { id: "global", ko: "글로벌 에스닉", detail: "Global Mixed" },
  ];

  const AGES = Array.from({ length: 30 }, (_, i) => {
    const age = 18 + i;
    return { id: String(age), ko: `${age}세`, detail: `${age} years old` };
  });

  const HAIRSTYLES = [
    { id: "ref_same", ko: "✨ 레퍼런스와 동일 (고정)", detail: "EXACTLY SAME AS THE REFERENCE IMAGE" },
    { id: "l_str_b", ko: "긴 검정 생머리", detail: "long silky jet black straight hair" },
    { id: "l_str_br", ko: "긴 갈색 생머리", detail: "long silky chestnut brown straight hair" },
    { id: "l_wave_b", ko: "긴 검정 웨이브", detail: "long voluminous black wavy hair" },
    { id: "l_wave_br", ko: "긴 갈색 웨이브", detail: "long voluminous brown wavy hair" },
    { id: "l_wave_bl", ko: "긴 금발 웨이브", detail: "long voluminous honey blonde wavy hair" },
    { id: "bob_b", ko: "단발 검정", detail: "chic black bob cut" },
    { id: "bob_bl", ko: "단발 금발", detail: "chic blonde bob cut" },
    { id: "ponytail_h", ko: "하이 포니테일", detail: "high sleek ponytail" },
    { id: "ponytail_l", ko: "로우 포니테일", detail: "elegant low ponytail" },
    { id: "bun_h", ko: "하이 번", detail: "neat high hair bun" },
    { id: "bun_m", ko: "메시 번", detail: "natural messy hair bun" },
    { id: "short_p", ko: "픽시 컷", detail: "bold short pixie cut" },
    { id: "short_w", ko: "울프 컷", detail: "edgy layered wolf cut" },
    { id: "braids_s", ko: "한쪽 땋음", detail: "loose side braid" },
    { id: "braids_t", ko: "양갈래 땋음", detail: "cute twin braids" },
    { id: "half_up", ko: "반묶음", detail: "feminine half-up half-down style" },
    { id: "hime", ko: "히메 컷", detail: "traditional Japanese hime cut" },
    { id: "see_thru", ko: "시스루 뱅", detail: "delicate see-through bangs" },
    { id: "perm_h", ko: "히피 펌", detail: "tight hippie perm curls" },
    { id: "wet", ko: "웨트 헤어", detail: "trendy wet hair look" },
    { id: "ash_g", ko: "애쉬 그레이", detail: "modern ash grey dyed hair" },
    { id: "rose_g", ko: "로즈 골드", detail: "ethereal rose gold hair" },
    { id: "lavender", ko: "라벤더", detail: "soft lavender dyed hair" },
    { id: "blue_b", ko: "블루 블랙", detail: "deep blue black hair" },
    { id: "ginger", ko: "진저/레드", detail: "natural vibrant ginger hair" },
    { id: "side_part", ko: "가르마 스타일", detail: "deep side-parted hair" },
    { id: "curtain", ko: "커튼 뱅", detail: "face-framing curtain bangs" },
    { id: "balayage", ko: "발레아쥬", detail: "natural sun-kissed balayage" },
    { id: "silver", ko: "실버", detail: "striking metallic silver hair" },
    { id: "pixie_long", ko: "롱 픽시", detail: "feminine long pixie cut" },
  ];

  const FACE_STYLES = [
    { id: "elegant", ko: "우아한 분위기", detail: "elegant refined facial features" },
    { id: "innocent", ko: "청순한 느낌", detail: "pure innocent facial features" },
    { id: "cute", ko: "귀여운/상큼", detail: "cute youthful facial features" },
    { id: "sharp", ko: "날카로운/도시적", detail: "sharp defined facial features" },
    { id: "chic", ko: "시크한/차가운", detail: "cool chic modelesque look" },
    { id: "soft", ko: "부드러운/포근", detail: "soft approachable features" },
    { id: "mature", ko: "성숙한/고혹", detail: "sophisticated mature facial features" },
    { id: "cat", ko: "고양이상", detail: "mysterious cat-like eyes" },
    { id: "puppy", ko: "강아지상", detail: "round friendly puppy-like eyes" },
    { id: "deer", ko: "사슴상", detail: "large clear deer-like eyes" },
    { id: "fox", ko: "여우상", detail: "sharp attractive fox-like features" },
    { id: "rabbit", ko: "토끼상", detail: "bright adorable rabbit-like features" },
    { id: "intellectual", ko: "지적인", detail: "intellectual sophisticated look" },
    { id: "dreamy", ko: "몽환적인", detail: "ethereal dreamy facial vibe" },
    { id: "athletic", ko: "건강미", detail: "toned healthy facial structure" },
    { id: "exotic", ko: "이국적인", detail: "striking exotic beauty" },
    { id: "classic", ko: "클래식한", detail: "timeless classic beauty" },
    { id: "modern", ko: "모던한", detail: "modern trendy influencer face" },
    { id: "avant", ko: "아방가르드", detail: "unique high-fashion features" },
    { id: "minimal", ko: "미니멀한", detail: "clean minimal facial lines" },
    { id: "vivacious", ko: "생기있는", detail: "bright energetic facial expression" },
    { id: "stoic", ko: "강인한", detail: "powerful stoic features" },
    { id: "graceful", ko: "단아한", detail: "poised graceful appearance" },
    { id: "bold", ko: "강렬한", detail: "bold charismatic facial features" },
    { id: "serene", ko: "평온한", detail: "calm serene facial look" },
    { id: "mysterious", ko: "신비로운", detail: "enigmatic mysterious gaze" },
    { id: "delicate", ko: "섬세한", detail: "fine delicate facial structure" },
    { id: "fresh", ko: "싱그러운", detail: "fresh natural beauty" },
    { id: "radiant", ko: "눈부신", detail: "radiant glowing facial features" },
    { id: "doll", ko: "인형같은", detail: "perfect doll-like features" },
  ];

  const EXPRESSIONS = [
    { id: "g_smile", ko: "은은한 미소", detail: "soft gentle smile" },
    { id: "smile", ko: "밝은 미소", detail: "bright radiant smile" },
    { id: "laugh", ko: "파안대소", detail: "laughing out loud with crescent eyes" },
    { id: "wink", ko: "윙크", detail: "playful wink" },
    { id: "serious", ko: "진지한", detail: "serious professional gaze" },
    { id: "chic", ko: "시크한 무표정", detail: "cool neutral chic expression" },
    { id: "pout", ko: "뾰로통한", detail: "cute pouting expression" },
    { id: "surprised", ko: "놀란", detail: "wide-eyed surprised look" },
    { id: "dreamy", ko: "몽환적인", detail: "hazy dreamy look" },
    { id: "seductive", ko: "매혹적인", detail: "alluring seductive gaze" },
    { id: "pensive", ko: "생각에 잠긴", detail: "deep in thought, pensive look" },
    { id: "sleepy", ko: "졸린듯한", detail: "sleepy half-closed eyes" },
    { id: "smug", ko: "자신만만한", detail: "confident smug grin" },
    { id: "curious", ko: "호기심 어린", detail: "curious tilted head expression" },
    { id: "relaxed", ko: "편안한", detail: "relaxed facial muscles" },
    { id: "vibrant", ko: "생기 넘치는", detail: "energetic vibrant expression" },
    { id: "stoic", ko: "단호한", detail: "expressionless stoic face" },
    { id: "bashful", ko: "부끄러워하는", detail: "shy bashful look with slight blush" },
    { id: "joyful", ko: "환희에 찬", detail: "expression of pure joy" },
    { id: "mysterious", ko: "미스터리한", detail: "mysterious enigmatic look" },
    { id: "determined", ko: "결연한", detail: "strong determined gaze" },
    { id: "tender", ko: "다정한", detail: "warm tender expression" },
    { id: "haughty", ko: "도도한", detail: "proud haughty expression" },
    { id: "playful", ko: "장난스러운", detail: "naughty playful grin" },
    { id: "melancholy", ko: "우울한", detail: "sad melancholy expression" },
    { id: "serene", ko: "고요한", detail: "peaceful serene look" },
    { id: "startled", ko: "깜짝 놀란", detail: "sharp startled expression" },
    { id: "disdainful", ko: "경멸하는", detail: "cool disdainful look" },
    { id: "yearning", ko: "갈망하는", detail: "longing yearning gaze" },
    { id: "hopeful", ko: "희망찬", detail: "bright hopeful expression" },
  ];

  const POSES = [
    { id: "selfie", ko: "기본 셀카", detail: "holding phone for a traditional selfie, arm slightly visible" },
    { id: "mirror_selfie", ko: "거울 셀카", detail: "posing in front of a mirror holding a smartphone" },
    { id: "vlog_selfie", ko: "브이로그 캠", detail: "holding a compact vlog camera with flip-screen at arm length" },
    { id: "gimbal_selfie", ko: "짐벌 팔로잉", detail: "holding a gimbal stabilizer while walking for a POV selfie" },
    { id: "top_angle", ko: "하이 앵글 셀카", detail: "holding the device high above the head looking up" },
    { id: "standing", ko: "정면 서기", detail: "standing straight facing camera" },
    { id: "sitting", ko: "앉아있기", detail: "sitting comfortably" },
    { id: "leaning", ko: "벽에 기대기", detail: "leaning against a wall" },
    { id: "over_shoulder", ko: "뒤돌아보기", detail: "looking back over shoulder" },
    { id: "walking", ko: "걷는 중", detail: "captured while walking" },
    { id: "crouching", ko: "웅크리기", detail: "stylish crouching pose" },
    { id: "lying", ko: "누워있기", detail: "lying down on a surface" },
    { id: "jumping", ko: "점프", detail: "dynamic mid-air jump" },
    { id: "dancing", ko: "춤추기", detail: "moving while dancing" },
    { id: "fixing_hair", ko: "머리 만지기", detail: "hands fixing hair" },
    { id: "stretching", ko: "스트레칭", detail: "morning stretch pose" },
    { id: "yoga", ko: "요가 자세", detail: "zen yoga posture" },
    { id: "holding_phone", ko: "폰 들기", detail: "holding a smartphone" },
    { id: "drinking", ko: "음료 마시기", detail: "holding a cup near lips" },
    { id: "adjusting_glasses", ko: "안경 고치기", detail: "hand on glasses frame" },
    { id: "cross_arms", ko: "팔짱 끼기", detail: "confident crossed arms" },
    { id: "hands_pocket", ko: "주머니에 손", detail: "relaxed hands in pocket" },
    { id: "kneeling", ko: "무릎 꿇기", detail: "graceful kneeling position" },
    { id: "twisting", ko: "몸 틀기", detail: "dynamic body twist" },
    { id: "running", ko: "달리기", detail: "mid-stride running action" },
    { id: "squatting", ko: "스쿼트", detail: "athletic squatting pose" },
    { id: "saluting", ko: "경례", detail: "playful salute" },
    { id: "waving", ko: "손 흔들기", detail: "waving at the camera" },
    { id: "pointing", ko: "가리키기", detail: "pointing at something" },
    { id: "praying", ko: "기도하기", detail: "hands pressed together" },
  ];

  const CAPTION_ENGINES = [
    { id: "gemini", ko: "Gemini", sub: "제미나이" },
    { id: "openai", ko: "GPT", sub: "OpenAI" },
    { id: "claude", ko: "Claude", sub: "클로드" },
  ];

  const PRODUCT_TYPES = [
    { id: "top", ko: "상의 (셔츠/니트/티셔츠 등)" },
    { id: "bottom", ko: "하의 (바지/스커트 등)" },
    { id: "dress", ko: "원피스/드레스" },
    { id: "outer", ko: "아우터 (자켓/코트 등)" },
    { id: "shoes", ko: "신발" },
    { id: "bag", ko: "가방" },
    { id: "accessory", ko: "액세서리 (주얼리/모자/안경 등)" },
    { id: "full_outfit", ko: "전체 코디 (여러 개 조합)" },
  ];

  const OUTFIT_GROUPS = [
    {
      category: "Daily Trend (인플루언서 OOTD)",
      options: [
        { id: "oversized_shirt", ko: "오버사이즈 화이트 셔츠", detail: "oversized white crisp button-up shirt" },
        { id: "crop_hoodie", ko: "크롭 후디 & 조거팬츠", detail: "trendy crop hoodie and matching joggers set" },
        { id: "cargo_pants_top", ko: "카고 팬츠 & 탱크탑", detail: "street style cargo pants and tight white tank top" },
        { id: "denim_shorts_tee", ko: "데님 숏팬츠 & 그래픽 티", detail: "vintage denim shorts and oversized graphic t-shirt" },
        { id: "knit_vest_shirt", ko: "니트 베스트 & 셔츠 레이어드", detail: "preppy knit vest layered over a white shirt" },
        { id: "mini_skirt_blazer", ko: "미니스커트 & 오버 블레이저", detail: "chic mini skirt with an oversized boxy blazer" },
        { id: "biker_shorts_sweat", ko: "바이커 쇼츠 & 맨투맨", detail: "athletic biker shorts with an oversized sweatshirt" },
        { id: "slip_dress_tee", ko: "슬립 드레스 & 티셔츠 레이어드", detail: "silky slip dress layered over a simple white tee" },
        { id: "knit_set", ko: "원마일웨어 니트 세트", detail: "matching soft knit top and wide pants set" },
        { id: "pleated_skirt_polo", ko: "플리츠 스커트 & 폴로 셔츠", detail: "sporty pleated mini skirt and cropped polo shirt" },
        { id: "leather_pants_crop", ko: "가죽 팬츠 & 크롭 가디건", detail: "black faux leather pants and fuzzy crop cardigan" },
        { id: "check_skirt_boots", ko: "체크 스커트 & 롱부츠 룩", detail: "plaid mini skirt paired with knee-high leather boots" },
        { id: "puffer_vest_leggings", ko: "푸퍼 베스트 & 레깅스", detail: "glossy puffer vest with high-waisted leggings" },
        { id: "off_shoulder_knit", ko: "오프숄더 니트 & 와이드 슬랙스", detail: "soft off-shoulder knit sweater and loose slacks" },
        { id: "varsity_jacket", ko: "바시티 자켓 & 테니스 스커트", detail: "oversized varsity jacket and white tennis skirt" },
      ],
    },
    {
      category: "오피스 (요일별)",
      options: [
        { id: "mon_office", ko: "월요일 미니멀 오피스룩", detail: "white silky blouse tucked in, high-waisted cream wide-leg slacks, beige pointed-toe heels, ivory mini leather handbag, small pearl earrings, thin gold necklace" },
        { id: "tue_smart", ko: "화요일 스마트 캐주얼", detail: "mint knit short-sleeve top, white wide-leg trousers, nude pumps, small white crossbody bag" },
        { id: "wed_chic", ko: "수요일 시크 오피스", detail: "sky blue cropped tweed jacket, white blouse, cream wide-leg slacks, white leather handbag, beige heels" },
        { id: "thu_cozy", ko: "목요일 코지 오피스", detail: "navy striped knit sweater, light blue straight jeans, white loafers, white mini handbag" },
        { id: "fri_casual", ko: "금요일 프라이데이 캐주얼", detail: "soft lavender off-shoulder knit, white wide-leg slacks, nude heels, black mini shoulder bag" },
      ],
    },
    {
      category: "Luxury & Elegant (명품/격식)",
      options: [
        { id: "satin_slip", ko: "럭셔리 새틴 슬립 드레스", detail: "luxurious champagne satin slip dress" },
        { id: "tweed_set", ko: "클래식 트위드 셋업", detail: "elegant designer pink tweed jacket and skirt set" },
        { id: "cocktail_black", ko: "리틀 블랙 드레스", detail: "chic designer little black cocktail dress" },
        { id: "silk_blouse_slacks", ko: "실크 블라우스 & 하이웨스트 슬랙스", detail: "cream silk pussy-bow blouse and tailored slacks" },
        { id: "trench_dress", ko: "트렌치 드레스 룩", detail: "belted classic beige trench coat worn as a dress" },
        { id: "velvet_gown", ko: "이브닝 벨벳 가운", detail: "glamorous floor-length deep red velvet evening gown" },
        { id: "lace_midi_dress", ko: "레이스 미디 원피스", detail: "delicate white lace midi dress" },
        { id: "wrap_dress", ko: "패턴 랩 원피스", detail: "feminine floral silk wrap dress" },
        { id: "power_suit_white", ko: "화이트 파워 수트", detail: "sharp all-white tailored power suit" },
        { id: "sequin_dress", ko: "스팽글 파티 드레스", detail: "shimmering silver sequin mini dress" },
      ],
    },
    {
      category: "Underwear & Loungewear (언더웨어/홈웨어)",
      options: [
        { id: "lace_lingerie_set", ko: "시스루 레이스 란제리 세트", detail: "delicate black see-through lace lingerie set" },
        { id: "sporty_underwear", ko: "스포티 밴딩 언더웨어", detail: "minimalist grey cotton sporty underwear set with branded elastic band" },
        { id: "silk_pajama", ko: "새틴 파자마 세트", detail: "luxurious navy blue satin pajama set" },
        { id: "corset_top", ko: "화이트 코르셋 탑", detail: "vintage style white lace-up corset top" },
        { id: "bodysuit_lace", ko: "레이스 바디수트", detail: "intricate black lace bodysuit" },
        { id: "silk_robe", ko: "실크 로브 & 슬립", detail: "elegant long silk robe over a matching slip" },
        { id: "bralette_shorts", ko: "브라렛 & 프릴 팬츠", detail: "comfy lace bralette and ruffled sleep shorts" },
        { id: "teddy_lingerie", ko: "테디 란제리", detail: "seductive sheer mesh teddy lingerie" },
        { id: "oversized_knit_socks", ko: "오버사이즈 니트 & 롱삭스", detail: "oversized chunky knit sweater and thigh-high wool socks" },
        { id: "sports_bra_leggings", ko: "심리스 스포츠 브라", detail: "tight seamless sports bra and high-waist leggings" },
      ],
    },
    {
      category: "Active & Swim (활동/수영복)",
      options: [
        { id: "high_cut_bikini", ko: "하이컷 비키니", detail: "stylish high-cut string bikini" },
        { id: "monokini", ko: "컷아웃 모노키니", detail: "chic black monokini with side cut-outs" },
        { id: "rash_guard_set", ko: "크롭 래쉬가드 세트", detail: "sporty cropped rash guard and mini bikini bottom" },
        { id: "yoga_all_in_one", ko: "요가 올인원 수트", detail: "tight-fitting one-piece yoga jumpsuit" },
        { id: "tennis_skirt_set", ko: "테니스 셋업", detail: "white tennis polo and pleated skirt" },
        { id: "surfing_suit", ko: "네오프렌 서핑 수트", detail: "professional sleek black neoprene surfing suit" },
        { id: "gym_set_bright", ko: "네온 컬러 짐 웨어", detail: "bright neon pink seamless workout set" },
        { id: "ballet_leotard", ko: "발레 레오타드 & 랩스커트", detail: "graceful ballet leotard and sheer wrap skirt" },
      ],
    },
    {
      category: "Themed & Concept (컨셉/기타)",
      options: [
        { id: "modern_hanbok", ko: "현대식 개량 한복", detail: "stylized modern traditional Hanbok" },
        { id: "techwear_set", ko: "테크웨어 룩", detail: "futuristic tactical techwear with straps" },
        { id: "maid_outfit", ko: "클래식 메이드복", detail: "classic black and white maid costume" },
        { id: "cheongsam_modern", ko: "모던 치파오", detail: "elegant modern Cheongsam" },
        { id: "kimono_yukata", ko: "유카타", detail: "traditional floral Japanese yukata" },
        { id: "school_uniform_k", ko: "한국식 교복", detail: "trendy Korean style high school uniform" },
        { id: "cyberpunk_neon", ko: "사이버펑크 네온 룩", detail: "neon glowing cyberpunk outfit with metallic accents" },
        { id: "fairy_core", ko: "페어리코어 드레스", detail: "ethereal layered tulle dress with floral accents" },
      ],
    },
  ];

  const LOCATION_GROUPS = [
    {
      category: "Indoor (실내)",
      options: [
        { id: "bedroom", ko: "아늑한 침실", detail: "cozy sunlight-filled bedroom" },
        { id: "studio", ko: "화이트 스튜디오", detail: "minimalist white photo studio" },
        { id: "kitchen", ko: "모던 주방", detail: "modern luxury marble kitchen" },
        { id: "library", ko: "도서관", detail: "antique grand library" },
        { id: "elevator", ko: "거울 엘리베이터", detail: "luxury mirrored elevator" },
        { id: "bathroom", ko: "욕실/욕조", detail: "luxurious bathroom with marble tub" },
        { id: "gallery", ko: "아트 갤러리", detail: "minimalist art gallery" },
        { id: "cinema", ko: "영화관", detail: "vintage movie theater seats" },
        { id: "gym", ko: "헬스장", detail: "modern high-end fitness center" },
        { id: "hotel_lobby", ko: "호텔 로비", detail: "grand luxury hotel lobby" },
      ],
    },
    {
      category: "Office (오피스)",
      options: [
        { id: "office_lobby", ko: "오피스 로비", detail: "bright modern office lobby with large windows" },
        { id: "office_hall", ko: "오피스 복도", detail: "modern office hallway" },
        { id: "office_lounge", ko: "오피스 라운지", detail: "stylish office lounge" },
        { id: "cafe_before_work", ko: "출근길 카페", detail: "modern café before work" },
        { id: "corp_entrance", ko: "오피스 건물 입구", detail: "corporate building entrance" },
      ],
    },
    {
      category: "Urban (도시)",
      options: [
        { id: "cafe", ko: "성수동 카페", detail: "aesthetic industrial cafe" },
        { id: "rooftop", ko: "루프탑 테라스", detail: "city rooftop terrace at dusk" },
        { id: "neon_street", ko: "네온 밤거리", detail: "Shinjuku neon street at night" },
        { id: "subway", ko: "지하철역", detail: "futuristic subway station" },
        { id: "parking_lot", ko: "주차장", detail: "moody underground parking lot" },
        { id: "times_square", ko: "타임스퀘어", detail: "busy Times Square background" },
        { id: "alleyway", ko: "좁은 골목", detail: "mysterious narrow urban alleyway" },
        { id: "bus_stop", ko: "버스 정류장", detail: "city bus stop in the rain" },
        { id: "department", ko: "백화점", detail: "high-end luxury shopping mall" },
        { id: "office", ko: "사무실", detail: "high-rise corporate office" },
      ],
    },
    {
      category: "Nature (자연/여행)",
      options: [
        { id: "beach", ko: "에메랄드 해변", detail: "tropical beach at sunset" },
        { id: "forest", ko: "안개 낀 숲", detail: "misty pine forest" },
        { id: "garden", ko: "유럽식 정원", detail: "English rose garden" },
        { id: "desert", ko: "사구(사막)", detail: "vast golden sand dunes" },
        { id: "yacht", ko: "럭셔리 요트", detail: "yacht deck in the Mediterranean" },
        { id: "waterfall", ko: "폭포", detail: "majestic jungle waterfall" },
        { id: "mountain", ko: "설산", detail: "snow-capped mountain peak" },
        { id: "meadow", ko: "꽃밭", detail: "vibrant flower meadow" },
        { id: "swimming_pool", ko: "수영장", detail: "luxury infinity pool" },
        { id: "temple", ko: "사찰/신사", detail: "peaceful ancient temple" },
      ],
    },
  ];

  const SKINS = [
    { id: "pore", ko: "초정밀 모공", detail: "visible micro-pores" },
    { id: "freckle", ko: "자연스러운 주근깨", detail: "natural freckles" },
    { id: "glow", ko: "건강한 광채", detail: "healthy skin glow" },
    { id: "dewy", ko: "물광 피부", detail: "highly reflective dewy skin" },
    { id: "matte", ko: "보송한 매트", detail: "velvety matte finish" },
    { id: "blemish", ko: "사실적 잡티", detail: "subtle realistic blemishes" },
    { id: "mole", ko: "매력점", detail: "small beauty mark" },
    { id: "sweat", ko: "미세한 땀", detail: "micro sweat beads" },
    { id: "vein", ko: "투명한 핏줄", detail: "faint subcutaneous veins" },
    { id: "texture", ko: "거친 피부 질감", detail: "raw skin texture" },
    { id: "lines", ko: "미세 잔주름", detail: "natural fine lines" },
    { id: "tanned", ko: "태닝 피부", detail: "sun-kissed tanned skin" },
    { id: "pale", ko: "창백한 피부", detail: "ethereal pale skin" },
    { id: "olive", ko: "올리브 톤", detail: "rich olive skin tone" },
    { id: "rosy", ko: "홍조", detail: "natural rosy flush on cheeks" },
    { id: "scar", ko: "작은 흉터", detail: "subtle realistic skin scar" },
    { id: "oily", ko: "약간의 유분", detail: "natural oily sheen" },
    { id: "porcelain", ko: "도자기 피부", detail: "smooth porcelain-like skin" },
    { id: "vibrant", ko: "생기있는 피부", detail: "energetic healthy skin" },
    { id: "soft_focus", ko: "소프트 포커스", detail: "gentle soft focus skin rendering" },
    { id: "high_res", ko: "8K 디테일", detail: "extreme 8K skin resolution" },
    { id: "subsurface", ko: "심층 산란", detail: "realistic subsurface scattering" },
    { id: "unfiltered", ko: "무보정 질감", detail: "strictly unfiltered raw skin" },
    { id: "velvet", ko: "벨벳 질감", detail: "smooth velvety skin surface" },
    { id: "peach_fuzz", ko: "솜털", detail: "microscopic peach fuzz hairs" },
    { id: "highlight", ko: "강한 하이라이트", detail: "pronounced skin highlights" },
    { id: "even_tone", ko: "균일한 톤", detail: "perfectly even skin tone" },
    { id: "aged", ko: "성숙한 질감", detail: "mature sophisticated skin texture" },
    { id: "glossy", ko: "광택", detail: "shiny glossy skin finish" },
    { id: "translucent", ko: "반투명 피부", detail: "delicate translucent skin look" },
  ];

  const LIGHTINGS = [
    { id: "g_5pm", ko: "오후 5시 골든아워", detail: "warm 5pm golden-hour sunlight" },
    { id: "blue_h", ko: "블루아워", detail: "cool blue-hour ambient light" },
    { id: "m_win", ko: "아침 창가광", detail: "soft morning window light" },
    { id: "sunset", ko: "강렬한 노을", detail: "intense orange sunset glow" },
    { id: "neon", ko: "네온/사이버", detail: "vibrant neon city lights" },
    { id: "studio_soft", ko: "스튜디오 소프트박스", detail: "diffused soft studio-quality illumination with seamless shadows" },
    { id: "ring_light", ko: "인플루언서 링라이트", detail: "classic circular ring-light glow" },
    { id: "top_lit", ko: "상단광", detail: "high-contrast top lighting" },
    { id: "bokeh", ko: "보케 배경 조명", detail: "dreamy blurred background lights" },
    { id: "fluorescent", ko: "형광등", detail: "harsh industrial fluorescent light" },
    { id: "morning_mist", ko: "안개 자욱한 아침", detail: "diffused morning mist light" },
    { id: "twilight", ko: "황혼", detail: "deep purple twilight sky light" },
    { id: "volumetric", ko: "빛내림 (틴들 현상)", detail: "god rays, volumetric lighting shafts piercing through" },
    { id: "rembrandt", ko: "렘브란트 조명 (클래식)", detail: "classic Rembrandt lighting triangle on cheek, dramatic chiaroscuro" },
    { id: "neon_noir", ko: "네온 느와르", detail: "moody dark cinematic lighting with pink and teal neon accents" },
    { id: "candle", ko: "따뜻한 촛불", detail: "intimate warm flickering candlelight glow" },
    { id: "biolum", ko: "신비로운 발광", detail: "ethereal bioluminescent blue and purple forest glow" },
    { id: "club_laser", ko: "클럽 레이저", detail: "dynamic sharp club laser lights cutting through smoke" },
    { id: "morning_sun", ko: "아침 햇살", detail: "soft morning sunlight" },
    { id: "daylight", ko: "자연 주광", detail: "soft natural daylight" },
    { id: "afternoon_gold", ko: "오후 황금빛", detail: "golden afternoon sunlight" },
    { id: "warm_natural", ko: "따뜻한 자연광", detail: "warm natural lighting" },
  ];

  const CAMERAS = [
    {
      category: "Selfie Mode (직접 촬영)",
      options: [
        { id: "iphone_front", ko: "폰카 셀카 (전면)", detail: "iPhone front-facing camera selfie perspective, slightly wide angle" },
        { id: "galaxy_flip", ko: "Z플립 셀카 (하이앵글)", detail: "Samsung Galaxy Z Flip high-angle selfie shot" },
        { id: "vlog_cam", ko: "브이로그 캠 (광각)", detail: "handheld vlog camera style with wide lens" },
        { id: "gimbal", ko: "짐벌 액션캠 (다이내믹)", detail: "handheld gimbal stabilized dynamic selfie" },
        { id: "fisheye", ko: "어안렌즈 (Y2K 감성)", detail: "Y2K style fisheye lens close-up selfie" },
      ],
    },
    {
      category: "Third Person (남이 찍어줌)",
      options: [
        { id: "iphone_rear", ko: "폰카 후면 (기본)", detail: "smartphone rear camera, candid shot by friend" },
        { id: "dslr_50mm", ko: "DSLR 50mm (인물 중심)", detail: "professional 50mm f/1.2 lens portrait" },
        { id: "dslr_85mm", ko: "DSLR 85mm (배경 흐림)", detail: "professional 85mm f/1.2 telephoto lens with heavy bokeh" },
        { id: "film_cam", ko: "필름 카메라 (빈티지)", detail: "35mm analog film camera shot by photographer" },
        { id: "paparazzi", ko: "파파라치 (자연스러움)", detail: "long lens paparazzi style, candid walking shot" },
        { id: "drone", ko: "드론 (항공샷)", detail: "high-angle drone shot capturing environment" },
      ],
    },
  ];

  const FILMS = [
    { id: "p_400", ko: "코닥 포트라 400", detail: "Kodak Portra 400 look" },
    { id: "f_400h", ko: "후지 400H", detail: "Fuji Pro 400H aesthetic" },
    { id: "g_200", ko: "코닥 골드 200", detail: "warm Kodak Gold" },
    { id: "instax", ko: "인스탁스", detail: "instant film softness" },
    { id: "cinestill", ko: "시네스틸 800T", detail: "halations around lights" },
    { id: "modern_digital", ko: "현대적 디지털", detail: "clean modern sensor data" },
    { id: "ilford", ko: "일포드 흑백", detail: "classic Ilford HP5 Plus 400 black and white film grain" },
    { id: "polaroid", ko: "빈티지 폴라로이드", detail: "faded vintage Polaroid 600 tones with soft edges" },
    { id: "ektar", ko: "코닥 엑타 (비비드)", detail: "vibrant and sharp Kodak Ektar 100 fine grain" },
    { id: "lomo", ko: "로모 (비네팅)", detail: "Lomo style saturated colors with heavy vignetting" },
    { id: "slide", ko: "슬라이드 필름", detail: "high contrast positive slide film look (Velvia)" },
  ];

  const QUALITIES = [
    { id: "1K", ko: "1K (빠름)" },
    { id: "2K", ko: "2K (권장)" },
    { id: "4K", ko: "4K (고화질)" },
  ];

  const ASPECT_RATIOS = [
    { id: "3:4", ko: "3:4 (인스타 세로)" },
    { id: "1:1", ko: "1:1 (정사각)" },
    { id: "9:16", ko: "9:16 (스토리/릴스)" },
    { id: "4:3", ko: "4:3 (가로)" },
  ];

  // 매번 다른 컷을 만들어도 "같은 사람, 같은 얼굴"을 유지하기 위한 공통 고정 문구
  const FACE_LOCK_RULES =
    "same face, consistent character, same young woman, same facial features, same body proportions, " +
    "same identity as the reference image, photorealistic, ultra realistic, high detail skin texture, " +
    "Instagram influencer photography, natural lighting, 85mm lens";

  // 사진처럼 보이되 부자연스러운 인공물(로고/워터마크/장비 노출 등)을 배제하는 공통 규칙
  const NEGATIVE_RULES =
    "Exclude any readable text, signage, logos, posters, labels, watermarks; " +
    "no photographic equipment, light stands, softbox hardware, studio gear, or visible camera rigs; " +
    "keep realistic pores and subtle imperfections; avoid perfect symmetry; natural shadows only; " +
    "smooth highlight roll-off; subtle film grain; no HDR, no over-sharpening, no CGI look, no beauty filter, no plastic skin.";

  // 요일별 원클릭 테마 (사이드바 상단 퀵버튼)
  const WEEKDAY_THEMES = [
    { id: "mon", ko: "월", label: "미니멀 오피스", outfit: "mon_office", location: "office_lobby", lighting: "morning_sun", pose: "standing", expression: "smile" },
    { id: "tue", ko: "화", label: "스마트 캐주얼", outfit: "tue_smart", location: "office_hall", lighting: "daylight", pose: "drinking", expression: "curious" },
    { id: "wed", ko: "수", label: "시크 오피스", outfit: "wed_chic", location: "corp_entrance", lighting: "daylight", pose: "standing", expression: "chic" },
    { id: "thu", ko: "목", label: "코지 오피스", outfit: "thu_cozy", location: "cafe_before_work", lighting: "warm_natural", pose: "sitting", expression: "g_smile" },
    { id: "fri", ko: "금", label: "프라이데이 캐주얼", outfit: "fri_casual", location: "office_lounge", lighting: "afternoon_gold", pose: "leaning", expression: "relaxed" },
  ];

  window.JinaData = {
    GENDERS, AD_TYPES, DAILY_VIBES, ETHNICITIES, AGES, HAIRSTYLES, FACE_STYLES,
    EXPRESSIONS, POSES, OUTFIT_GROUPS, LOCATION_GROUPS, SKINS, LIGHTINGS,
    CAMERAS, FILMS, QUALITIES, ASPECT_RATIOS, FACE_LOCK_RULES, NEGATIVE_RULES,
    WEEKDAY_THEMES, PRODUCT_TYPES, CAPTION_ENGINES,
  };
})();
