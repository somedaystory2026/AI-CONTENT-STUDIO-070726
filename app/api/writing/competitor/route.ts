import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { keyword } = await req.json();
  const key = keyword || "메인 키워드";
  const text = `[${key}] 경쟁사 분석 요약\n\n1. 상위글 공통 구조\n- 제목에 핵심 키워드 + 숫자/후기/가이드 조합 사용\n- 첫 문단에서 결론을 빠르게 제시\n- 중간에 체크리스트, 표, FAQ 배치\n\n2. 부족한 내용\n- 실제 사용 예시가 부족함\n- 초보자가 바로 따라 할 단계가 약함\n- 비교 기준과 주의사항이 짧음\n\n3. 차별화 포인트\n- 개인 경험/현장 관점 추가\n- 구매 전/실행 전 체크리스트 제공\n- 요약 박스와 FAQ를 넣어 AI 검색에도 잡히게 구성\n\n4. 추천 글 구조\n서론 → 핵심 요약 → 왜 중요한가 → 실전 방법 → 실수/주의사항 → 체크리스트 → FAQ → 결론`;
  return NextResponse.json({ success: true, text });
}
