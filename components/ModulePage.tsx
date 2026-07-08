import Link from "next/link";

type ModulePageProps = {
  eyebrow: string;
  title: string;
  description: string;
  features: string[];
  nextLabel?: string;
  nextHref?: string;
};

export default function ModulePage({
  eyebrow,
  title,
  description,
  features,
  nextLabel = "Dashboard로 이동",
  nextHref = "/",
}: ModulePageProps) {
  return (
    <div className="p-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-blue-600">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">{title}</h1>
        <p className="mt-3 max-w-3xl text-slate-500">{description}</p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <div key={feature} className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
              <div className="mb-3 text-2xl">✨</div>
              <div className="font-bold text-slate-900">{feature}</div>
              <p className="mt-2 text-sm text-slate-500">이 기능은 다음 Phase에서 실제 API와 데이터 모델까지 연결됩니다.</p>
            </div>
          ))}
        </div>

        <Link href={nextHref} className="mt-8 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800">
          {nextLabel}
        </Link>
      </div>
    </div>
  );
}
