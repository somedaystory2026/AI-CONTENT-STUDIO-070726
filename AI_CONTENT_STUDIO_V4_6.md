# AI Content Studio v4.6

- 뉴스 목록에서 Google News 원문 복원 실패 항목 옆에 `원문 재시도` 버튼 추가
- 재시도 중/성공/실패 상태 문구 표시
- 재시도 성공 시 기사 링크와 X 초안 URL 자동 갱신
- `/api/rss/resolve` 재시도 모드 및 HTML 내부 URL 추출 보강

## 왜 원문 복원이 실패하는가
Google News RSS 링크는 언론사 원문 URL이 그대로 들어있는 경우도 있지만, 일부는 암호화된 Google News article 링크만 제공합니다. 이 경우 Google의 내부 서명값, 지역/언어, 세션, 언론사 차단, 리다이렉트 정책에 따라 서버에서 원문 복원이 실패할 수 있습니다. 그래서 실패 항목은 Google News 주소를 임시 사용하고, 사용자가 원할 때 다시 시도하도록 처리했습니다.
