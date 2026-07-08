import ModulePage from "@/components/ModulePage";

export default function BillingPage() {
  return <ModulePage eyebrow="Billing" title="Billing" description="Stripe 결제, 플랜, 사용량 제한, 구독 상태를 관리하는 페이지입니다." features={["Stripe 구독", "플랜 관리", "사용량 제한"]} />;
}
