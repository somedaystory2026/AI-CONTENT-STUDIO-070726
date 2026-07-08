import type { CardNewsRatio, CardNewsTheme } from "@/types/content";

const themeClass: Record<CardNewsTheme, string> = {
  dark: "bg-slate-950 text-white",
  blue: "bg-blue-600 text-white",
  purple: "bg-purple-700 text-white",
  green: "bg-emerald-600 text-white",
  warm: "bg-orange-500 text-white",
};

const ratioClass: Record<CardNewsRatio, string> = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "16:9": "aspect-video",
};

export default function CardPreview({
  text,
  index,
  total,
  theme,
  ratio,
}: {
  text: string;
  index: number;
  total: number;
  theme: CardNewsTheme;
  ratio: CardNewsRatio;
}) {
  return (
    <div className={`${ratioClass[ratio]} ${themeClass[theme]} flex flex-col justify-between rounded-3xl p-7 shadow-sm`}>
      <div className="flex items-center justify-between text-xs font-semibold opacity-70">
        <span>AI CONTENT STUDIO</span>
        <span>{index + 1}/{total}</span>
      </div>
      <div className="flex flex-1 items-center justify-center py-8 text-center">
        <p className="whitespace-pre-line text-xl font-black leading-relaxed md:text-2xl">{text}</p>
      </div>
      <div className="h-1.5 w-20 rounded-full bg-white/50" />
    </div>
  );
}
