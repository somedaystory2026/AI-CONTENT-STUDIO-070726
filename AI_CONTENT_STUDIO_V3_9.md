# AI Content Studio v3.9

## 반영 내용
- 뉴스 수집 결과를 localStorage에 저장해 `/ai`로 이동해도 `/news` 목록 유지
- X용 생성 이동 전에 Google News RSS 링크를 실제 기사 URL로 재해석하는 `/api/rss/resolve` 추가
- X 게시글 포맷을 본문 80~100자 + 해시태그 3~5개 + 실제 기사 URL 줄바꿈 형식으로 변경
- AI 생성기 Pro에 X 트위터 100자 프롬프트 버튼 추가
- X 자동 생성 시 프롬프트/기록 패널 자동 접기
- 카드뉴스 우측 숫자 슬라이더 제거, 마우스 편집 중심 UI로 정리
- 자동화 실행 후 다음 작업 안내 및 Library/카드뉴스/AI 이동 버튼 추가
- 자동화 SNS 문안에 X 작성 버튼 추가

## 확인
- npm run lint 통과
- typecheck는 Prisma binary 다운로드가 차단되어 실행 불가. 사용 환경에서 `npx prisma generate` 후 확인 필요.
