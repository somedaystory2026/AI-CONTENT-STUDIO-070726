import ModulePage from "@/components/ModulePage";

export default function AnalyticsPage() {
  return <ModulePage eyebrow="Analytics" title="Analytics" description="콘텐츠 생성량, 발행 성과, 채널별 반응을 분석하는 대시보드입니다." features={["생성량 분석", "발행 성과", "채널 리포트"]} />;
}
