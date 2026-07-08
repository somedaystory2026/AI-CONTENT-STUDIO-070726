import ModulePage from "@/components/ModulePage";

export default function SettingsPage() {
  return <ModulePage eyebrow="Settings" title="Settings" description="API 키, 브랜드 톤, 기본 언어, SNS 연동 설정을 관리하는 페이지입니다." features={["API 환경설정", "브랜드 톤", "SNS 연결"]} />;
}
