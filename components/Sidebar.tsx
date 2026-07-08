import Link from "next/link";

const menu = [
  { href: "/", label: "대시보드", icon: "📊" },
  { href: "/marketing", label: "마케팅 허브", icon: "🧰" },
  { href: "/influencer", label: "AI 인플루언서", icon: "👩" },
  { href: "/amazon", label: "Amazon SEO", icon: "🛒" },
  { href: "/music", label: "음악 AI", icon: "🎵" },
  { href: "/news", label: "뉴스 AI", icon: "📰" },
  { href: "/writing", label: "글쓰기/웹상세", icon: "✍️" },
  { href: "/shorts", label: "쇼츠 스튜디오", icon: "⚡" },
  { href: "/cine", label: "씨네브루", icon: "🎞️" },
  { href: "/viral", label: "바이럴 스튜디오", icon: "🔥" },
  { href: "/longform", label: "롱폼 스튜디오", icon: "📺" },
  { href: "/veo", label: "Veo 스튜디오", icon: "🎥" },
  { href: "/video-prompt-builder", label: "영상 프롬프트 빌더", icon: "🧩" },
  { href: "/ai", label: "AI 생성기", icon: "🤖" },
  { href: "/card-news", label: "카드뉴스 · 이미지", icon: "🧩" },
  { href: "/prompts", label: "프롬프트 모음", icon: "🧠" },
  { href: "/settings", label: "설정", icon: "⚙️" },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-20 h-screen w-[260px] overflow-y-auto bg-slate-950 px-5 py-6 text-white">
      <Link href="/" className="mb-8 block rounded-2xl bg-white/5 p-4 transition hover:bg-white/10 active:scale-[0.99]">
        <div className="text-2xl font-black">AI Studio</div>
        <div className="mt-1 text-xs text-slate-400">콘텐츠 자동화 SaaS</div>
      </Link>

      <nav className="space-y-1 pb-8">
        {menu.map((item) => (
          <Link key={item.href} href={item.href} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white active:scale-[0.99]">
            <span className="text-base">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
