import ModulePage from "@/components/ModulePage";

export default function AdminPage() {
  return <ModulePage eyebrow="Admin" title="Admin Console" description="사용자, 플랜, 시스템 상태, 콘텐츠 정책을 관리하는 운영자 페이지입니다." features={["사용자 관리", "시스템 로그", "콘텐츠 정책"]} />;
}
