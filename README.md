# AI Content Studio SaaS

Next.js(App Router) + TypeScript + TailwindCSS 기반 AI 콘텐츠 자동화 SaaS입니다.

## 현재 버전

`v0.9.0` 통합 업데이트

- v0.6 Prisma + PostgreSQL + Auth.js
- v0.7 Redis + BullMQ Queue
- v0.8 Image Studio
- v0.9 Video Studio

## 실행 방법

```bash
npm install
cp .env.example .env.local
```

`.env.local`에 값을 입력합니다.

```env
NEXTAUTH_URL="http://localhost:3000"
AUTH_SECRET="replace-with-a-long-random-secret"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_content_studio?schema=public"
OPENAI_API_KEY=""
GEMINI_API_KEY=""
REDIS_URL="redis://localhost:6379"
```

PostgreSQL/Redis 실행:

```bash
docker compose up -d
```

Prisma 준비:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

개발 서버:

```bash
npm run dev
```

Queue worker 실행:

```bash
npm run queue:worker
```

## 주요 폴더

```txt
app/api/auth/*          Auth.js 로그인/회원가입 API
app/api/library/*       DB 기반 Library 저장 API
app/api/projects/*      Project API
app/api/queue/*         Redis/BullMQ Queue 등록 API
app/api/video/*         Video Storyboard 생성 API
app/image-studio        Image Studio UI
app/video-studio        Video Studio UI
lib/auth.ts             Auth.js 설정
lib/prisma.ts           Prisma Client singleton
lib/queue.ts            Redis/BullMQ queue helper
prisma/schema.prisma    PostgreSQL 데이터 모델
scripts/queue-worker.ts Queue worker placeholder
```

## 주의

- 실제 API 키는 ZIP에 포함하지 않습니다. `.env.local`에 직접 입력하세요.
- `package-lock.json`은 기존 프로젝트 lock이므로, 이번 버전에서는 `npm install`로 새 의존성을 반영하세요.
- Redis가 없어도 Queue API는 로컬 fallback 응답을 주도록 구성되어 있습니다.
