type ToolCard = {
  title: string;
  desc: string;
  href: string;
  tag: string;
  note: string;
  primaryLabel: string;
  blank?: boolean;
  download?: boolean;
};

type ToolRunnerPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  chips: string[];
  cards: ToolCard[];
  usage: string;
  accent?: string;
};

const accentClass: Record<string, string> = {
  amber: "text-amber-600 hover:bg-amber-600",
  red: "text-red-600 hover:bg-red-600",
  violet: "text-violet-600 hover:bg-violet-600",
  blue: "text-blue-600 hover:bg-blue-600",
  emerald: "text-emerald-600 hover:bg-emerald-600",
};

export default function ToolRunnerPage({ eyebrow, title, description, chips, cards, usage, accent = "blue" }: ToolRunnerPageProps) {
  const color = accentClass[accent] || accentClass.blue;
  const [textColor, hoverColor] = color.split(" ");

  return (
    <div className="min-h-screen bg-slate-50 px-8 py-8 text-slate-950">
      <section className="mb-6 rounded-[28px] border border-slate-950 bg-white p-6 shadow-sm">
        <p className={`text-sm font-black ${textColor}`}>{eyebrow}</p>
        <h1 className="mt-1 text-4xl font-black tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
          {chips.map((chip) => (
            <span key={chip} className="rounded-full bg-slate-100 px-3 py-2 text-slate-700">{chip}</span>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {cards.map((tool) => (
          <section key={tool.href + tool.title} className="flex min-h-[250px] flex-col rounded-[24px] border border-slate-950 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
            <span className="mb-3 w-fit rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">{tool.tag}</span>
            <h2 className="text-xl font-black">{tool.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{tool.desc}</p>
            <p className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-xs font-bold leading-5 text-slate-700">{tool.note}</p>
            <a
              href={tool.href}
              target={tool.blank ? "_blank" : "_self"}
              download={tool.download}
              className={`mt-auto rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white transition ${hoverColor}`}
            >
              {tool.primaryLabel}
            </a>
          </section>
        ))}
      </div>

      <section className="mt-6 rounded-[24px] border border-slate-950 bg-white p-5">
        <h2 className="text-xl font-black">사용 순서</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600" dangerouslySetInnerHTML={{ __html: usage }} />
      </section>
    </div>
  );
}
