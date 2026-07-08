# AI Content Studio v5.6

## 원본 실행형 Video Studio 통합

- 쇼츠 스튜디오를 GPT PARK 쇼츠 리믹스 원본 실행형으로 교체
- Veo 스튜디오를 Google Veo3 Short Maker 원본 실행형으로 교체
- 롱폼 스튜디오를 longform-studio 원본 실행형으로 교체
- 바이럴 스튜디오를 viral-builder 원본 실행형으로 교체
- Music AI Studio / 씨네브루와 동일한 카드 실행 UI 적용
- 각 원본 앱은 `/public/tools/*` 아래에 빌드 결과를 배치
- 원본 ZIP은 `/public/downloads/*`에 보관
- Viral Builder용 `/api/suggest-topics`, `/api/generate-script` 추가
- Longform Studio용 `/api/vertex/generate` 추가

## 통합 원칙

- 중복 기능은 AI Content Studio 본체에 억지 병합하지 않음
- 완성도 높은 원본 앱은 카드에서 별도 실행
- 결과물은 AI 생성기 Pro, 씨네브루, 쇼츠, Veo, Amazon SEO 등으로 연결
