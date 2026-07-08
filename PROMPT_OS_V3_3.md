# v3.3 Prompt OS 시스템 업데이트

## 반영 내용

- 업로드한 `ai-prompt-kit-main.zip` 기반 Prompt Library 통합
- `lib/prompt-library.ts` 자동 생성
- `/prompts` 프롬프트 모음집 페이지 추가
- AI 생성기에서 Prompt OS 직접 선택/실행 가능
- 프롬프트 카테고리 검색/필터/즐겨찾기/복사/AI 생성기 보내기 UI 추가
- AI Generator UI 한국어화
- API 요청값을 기존 Zod 스키마에 맞도록 수정
  - tone: `professional/friendly/viral/premium/storytelling/seo`
  - language: `ko/en/ko-en/ja/es`
  - mode: `news/blog/sns/rewrite/translate`
- Sidebar에 `프롬프트 모음` 메뉴 추가

## Prompt OS 카테고리

- SNS
- 쇼츠
- 영상
- 이미지
- 음악
- 글쓰기/SEO
- 쇼핑/Amazon
- 편집 자동화
- 벤치마킹
- Claude Code
- 채널 셋업

## 실행 순서

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

## 확인

- Next 컴파일 단계는 통과했습니다.
- 현재 샌드박스에서는 Prisma 엔진 다운로드가 막혀 최종 타입체크는 중단됩니다.
- 로컬에서는 `npx prisma generate` 후 정상 빌드 확인하세요.
