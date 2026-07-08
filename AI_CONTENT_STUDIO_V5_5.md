# AI Content Studio v5.5

## 변경 사항
- AI-CENEBREW-main(3).zip 재분석 및 원본 Vite 앱 재빌드.
- node_modules 포함 업로드를 활용했으나 Windows용 native package 문제를 Linux용 rollup/esbuild 패키지로 보정 후 build 완료.
- `/public/tools/cinebrew`에 빌드 산출물을 다시 배치.
- `/styles/*` 썸네일 경로 노출 문제 해결용 root styles 복사.
- CENEBREW 원본 앱이 호출하는 `/api/generate-text`, `/api/generate-image`, `/api/vertex-token` Next API 라우트 추가.
- `/cine` 페이지를 Music AI Studio와 같은 카드 실행형 UI로 재정리.
- 원본 ZIP 다운로드를 node_modules 포함 버전으로 교체.

## 확인
- `AI-CENEBREW-main` 내부 `npm run build` 성공 확인.
