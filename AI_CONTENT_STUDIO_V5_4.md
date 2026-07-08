# AI Content Studio v5.4 — CINEBREW 원본 실행 통합

## 변경 사항

- `/cine` 페이지를 Music AI Studio와 같은 카드형 실행 허브로 재구성했습니다.
- `AI-CENEBREW-main` 원본 Vite 앱을 빌드하여 `/tools/cinebrew/index.html`로 실행 가능하게 포함했습니다.
- `씨네브루 실행` 버튼을 누르면 원본 스타일 UI가 새 창에서 열립니다.
- 중복되는 `AI-CINEBREW-clean`, `AI-CINEBREW-main` 코드는 직접 병합하지 않고 원본 ZIP 다운로드/보관용으로만 연결했습니다.
- CINEBREW 원본 앱이 사용하는 `/api/generate-text`, `/api/generate-image`, `/api/vertex-token` API 라우트를 Next.js App Router 방식으로 추가했습니다.
- 사이드바 메뉴명을 `시네 스튜디오`에서 `씨네브루`로 변경했습니다.

## 사용 방법

1. 사이드바에서 `씨네브루` 클릭
2. `씨네브루 실행` 클릭
3. 원본 CINEBREW 화면에서 스타일/엔진/비율 선택
4. 대본 입력 후 생성
5. 결과를 AI 생성기, 이미지 스튜디오, 비디오 스튜디오로 이어서 사용
