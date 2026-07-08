import Link from "next/link";

const actions = [
  { title: "Collect News", desc: "RSS 기사 수집", href: "/news", icon: "📰", color: "bg-blue-500" },
  { title: "Card News", desc: "카드뉴스 제작", href: "/card-news", icon: "🧩", color: "bg-purple-500" },
  { title: "Image Studio", desc: "AI 이미지 생성", href: "/image-studio", icon: "🖼️", color: "bg-pink-500" },
  { title: "SNS Publisher", desc: "발행 자동화", href: "/publisher", icon: "🚀", color: "bg-green-500" },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {actions.map((action) => (
        <Link key={action.title} href={action.href} className="rounded-2xl border bg-white p-6 transition hover:shadow-lg">
          <div className={`flex h-14 w-14 items-center justify-center rounded-xl text-3xl text-white ${action.color}`}>{action.icon}</div>
          <h3 className="mt-5 text-xl font-bold">{action.title}</h3>
          <p className="mt-2 text-slate-500">{action.desc}</p>
        </Link>
      ))}
    </div>
  );
}
