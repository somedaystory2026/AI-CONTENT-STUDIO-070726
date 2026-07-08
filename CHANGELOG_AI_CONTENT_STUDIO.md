# AI Content Studio Changelog

## v2.8.0
- v2.5 AI Generator Pro: Prompt Studio, presets, variables, chat workspace, history, usage estimate, library save.
- v2.6 Card News Pro foundation: template/brand kit APIs and editor-oriented system updates from v2.4 retained.
- v2.7 Amazon SEO Pro: bulk URL workflow, A+ content draft, CSV export, keyword/competitor analysis placeholders.
- v2.8 RSS & News Studio Pro: RSS source catalog, country/language/category filters, favorites, AI summary/translate/rewrite/compare, scheduler settings.
- Added reusable preset/catalog libraries and API routes.
- Added Prisma models: PromptTemplate, BrandKit, RssSource, UsageLog.

## v3.0 AI Automation

- 추가: `/workflows` AI 자동화 워크플로우 페이지
- 추가: `/api/automation/run` RSS → AI 요약 → 카드뉴스 → 이미지 프롬프트 → SNS 문안 → Library 저장 통합 실행 API
- 추가: `/api/automation/jobs` 자동화 작업 조회 API
- 추가: `lib/automation-engine.ts` 자동화 실행 엔진
- 추가: `lib/rss-collector.ts` RSS 수집 공통 모듈
- 변경: `/api/rss/collect`가 공통 RSS 수집 엔진을 사용하도록 정리
- 변경: Sidebar 한국어 UI 적용 및 AI 자동화 메뉴 우선 배치
- 변경: Prisma `CONTENT_AUTOMATION`, `AutomationWorkflow`, `AutomationRun` 모델 추가
- 변경: `.env.example` 최신화

## v5.8 Welcome Gift Resource Hub
- welcomegift-main.zip 분석 후 웰컴기프트 리소스 허브 추가
- `/welcome` 페이지 추가: 무료 소스, 블로그 글감, 구글링, 워드프레스, 인스타그램, 홈페이지형 블로그 자료 정리
- Marketing Hub에 웰컴기프트 허브 카드 추가
- Sidebar에 웰컴기프트 메뉴 추가
- Prompt OS에 웰컴기프트 기반 프롬프트 6종 추가
- 원본 ZIP을 `/downloads/welcomegift-main.zip`으로 보관 연결
