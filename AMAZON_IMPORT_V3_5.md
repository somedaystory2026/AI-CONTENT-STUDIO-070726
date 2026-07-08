# AI Content Studio v3.5 업데이트

## 핵심 변경

- 전체 메인 대시보드 문구 한국어화 강화
- Amazon Import Manager 고도화
  - 제품 URL + 제휴 URL 2줄 자동 페어링 유지
  - HTML 요소/이미지 태그 붙여넣기 보조 입력창 추가
  - 상품 이미지 미리보기 및 이미지 URL 직접 수정
  - 리뷰 URL 자동 생성 유지
  - 제휴주소 원본 그대로 저장/CSV Export
  - 선택 상품 기준 블로그 글 자동 생성
  - HTML 리뷰글 자동 생성
  - SNS 문구 자동 생성
- Card News Editor 고도화
  - 이미지 위치/크기/모서리 조정
  - 제목/본문 위치와 크기 조정
  - 제목/본문/번호 색상 변경
  - 제목/본문 굵기 토글
  - 이미지/제목/본문 레이어 순서 조정
- Prompt OS
  - 업로드된 프롬프트 모음집 기반 라이브러리 유지

## 실행 순서

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

## 참고

Amazon 페이지가 차단되어 자동 이미지 추출이 실패하면 Amazon 상품 페이지에서 이미지 태그 또는 상품 영역 HTML을 복사해 보조 입력창에 붙여넣으면 됩니다.
