# 🎌 수노 일본 시니어 엔카 생성기

일본 시니어(60~80대) 타겟 유튜브 채널을 위한 **쇼와·엔카 스타일 Suno AI 노래 자동 생성기**입니다.

## 스크린샷

> 노래 만들기 / EQ 가이드 / 수노 공식 세 탭으로 구성

## 주요 기능

- **Style of Music 자동 생성** — 5단계 공식 적용, 영문 자연어 150~250자
- **가사 자동 생성** — `[Intro][Verse][Chorus][Bridge][Outro]` 수노 섹션 형식
- **YouTube 제목 추천** — 【昭和の名曲】/懐かしい昭和 등 시니어 타겟 포맷
- **3초 체크리스트 자동 평가**
- **EQ 가이드** — 수노 엔카 음원 믹싱 팁
- **수노 공식 레퍼런스** — 가사 7대 규칙, 인트로 타입 공식

## 설치 & 실행

### 1. 저장소 클론

```bash
git clone https://github.com/YOUR_USERNAME/suno-japan-generator.git
cd suno-japan-generator
```

### 2. API 키 설정

**방법 A — 로컬 테스트 (빠른 시작)**

`app.js` 상단 `CONFIG` 에서 `API_KEY`에 Anthropic API 키를 직접 입력하세요.

```js
const CONFIG = {
  API_KEY: "sk-ant-xxxxxxx",  // ← 여기에 입력
  ...
};
```

> ⚠️ API 키를 깃허브에 절대 커밋하지 마세요! `.gitignore`에 `.env`가 포함되어 있습니다.

**방법 B — 서버 프록시 (권장, 배포용)**

Cloudflare Workers, Vercel Edge Functions, 또는 Express 서버로 프록시를 만든 후 `PROXY_URL`에 입력합니다.

```js
const CONFIG = {
  API_KEY: "",
  PROXY_URL: "https://your-worker.workers.dev/generate",
  ...
};
```

### 3. 실행

별도 빌드 불필요. 브라우저에서 `index.html`을 열거나 로컬 서버를 사용하세요.

```bash
# Python
python3 -m http.server 8080

# Node.js (npx)
npx serve .
```

## 파일 구조

```
suno-japan-generator/
├── index.html   — 메인 UI
├── style.css    — 스타일시트
├── app.js       — Claude API 연동 + 로직
├── .gitignore
└── README.md
```

## 배포 (GitHub Pages)

1. GitHub 저장소 → **Settings** → **Pages**
2. Source: `Deploy from a branch` → `main` / `/ (root)`
3. 저장 후 `https://YOUR_USERNAME.github.io/suno-japan-generator` 에서 접근 가능

> GitHub Pages 배포 시 API 키가 브라우저에 노출됩니다. 공개 배포에는 반드시 서버 프록시를 사용하세요.

## 사용 방법

1. **장르·주제·분위기·악기** 선택
2. **보컬, 인트로 타입, 시대 배경** 설정
3. **"演歌を生成する"** 클릭
4. 생성된 **Style of Music**을 수노 `Style of Music` 칸에 붙여넣기
5. 생성된 **가사**를 수노 `Lyrics` 칸에 붙여넣기

## 기술 스택

- Vanilla HTML / CSS / JavaScript (프레임워크 없음)
- [Anthropic Claude API](https://docs.anthropic.com/) (`claude-sonnet-4-20250514`)

## 라이선스

MIT
