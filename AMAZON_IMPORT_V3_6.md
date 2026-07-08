# v3.6 Korean Workflow Fix

- AI 자동화 워크플로우 DB enum 오류 회피: QueueJob type을 기존 RSS_COLLECT로 저장하도록 수정
- Card News Editor: 카드 미리보기에서 제목/본문/번호/이미지를 마우스로 직접 드래그 이동 가능
- Card News Editor: 이미지 우하단 핸들로 마우스 크기 조절 가능
- Amazon Import Manager: HTML 리뷰글을 긴 WordPress/Blogger 스타일 리뷰글로 확장
- Amazon Import Manager: 각 상품에서 AI Pro로 보내는 버튼 추가
- News AI: 일반 AI 생성 버튼과 X(트위터)용 생성 버튼 분리
- AI 생성기 Pro: News AI/Amazon에서 넘어온 draft를 자동으로 불러오도록 수정
- Redis 워커: REDIS_URL 없을 때 안전 종료
