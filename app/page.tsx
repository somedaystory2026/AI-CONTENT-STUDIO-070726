type Stat = { label: string; value: string; delta: string };
type Agent = { name: string; status: "실행중" | "대기중" | "오류"; };
type Step = {
  n: number;
  title: string;
  desc: string;
  icon: string;
  percent: number;
  count: string;
};
type Channel = { name: string; icon: string; pending: number; color: string };
type RevenueRow = { name: string; icon: string; amount: string; delta: string };
type LogItem = { time: string; text: string };
type Preview = { title: string; tag: string; time: string; gradient: string };

const stats: Stat[] = [
  { label: "오늘 생성 콘텐츠", value: "247건", delta: "+12.5%" },
  { label: "이번 달 생성 콘텐츠", value: "3,842건", delta: "+18.3%" },
  { label: "발행 대기 자료", value: "28,512건", delta: "+8.7%" },
  { label: "연결 채널", value: "5개", delta: "+15.2%" },
];

const agents: Agent[] = [
  { name: "뉴스 수집 에이전트", status: "실행중" },
  { name: "AI 콘텐츠 생성 에이전트", status: "실행중" },
  { name: "카드뉴스 제작 에이전트", status: "실행중" },
  { name: "이미지 생성 에이전트", status: "실행중" },
  { name: "영상 제작 에이전트", status: "대기중" },
  { name: "SEO 최적화 에이전트", status: "실행중" },
  { name: "발행 자료 준비 에이전트", status: "실행중" },
  { name: "업로드 알림 에이전트", status: "실행중" },
];

const steps: Step[] = [
  { n: 1, title: "글로벌 뉴스 수집", desc: "RSS 13개 피드 수집 중", icon: "🌐", percent: 95, count: "수집 기사 247개" },
  { n: 2, title: "AI 콘텐츠 생성 v2.0", desc: "텍스트 · 요약 · 프롬프트 생성", icon: "🧠", percent: 88, count: "처리 완료 247개" },
  { n: 3, title: "카드뉴스 · 이미지 제작", desc: "카드뉴스, 썸네일 자동 생성", icon: "🎨", percent: 76, count: "생성 완료 23개" },
  { n: 4, title: "영상 제작 예약", desc: "숏폼 · 롱폼 영상 초안 제작", icon: "🎬", percent: 65, count: "제작 대기 15개" },
  { n: 5, title: "SEO · 태그 최적화", desc: "키워드, 해시태그 자동 추출", icon: "🔍", percent: 90, count: "최적화 12개" },
  { n: 6, title: "업로드 자료 패키징", desc: "채널별 텍스트+이미지+영상 정리", icon: "📦", percent: 82, count: "패키징 8개" },
  { n: 7, title: "발행 체크리스트 생성", desc: "게시 시간 · 캡션 · 해시태그 추천", icon: "✅", percent: 78, count: "체크리스트 12개" },
  { n: 8, title: "성과 리포트 준비", desc: "게시 후 추적할 지표 세팅", icon: "📊", percent: 85, count: "리포트 5개" },
];

const channels: Channel[] = [
  { name: "블로그", icon: "✍️", pending: 23, color: "text-sky-400" },
  { name: "유튜브", icon: "▶️", pending: 15, color: "text-red-400" },
  { name: "네이버 블로그", icon: "N", pending: 23, color: "text-green-400" },
  { name: "인스타그램", icon: "📷", pending: 15, color: "text-pink-400" },
  { name: "페이스북", icon: "f", pending: 25, color: "text-blue-400" },
];

const revenue: RevenueRow[] = [
  { name: "Google AdSense", icon: "🟢", amount: "₩45,230", delta: "+12.3%" },
  { name: "네이버 애드포스트", icon: "N", amount: "₩32,150", delta: "+8.7%" },
  { name: "쿠팡 파트너스", icon: "🛒", amount: "₩28,450", delta: "+15.2%" },
  { name: "Amazon Associates", icon: "📦", amount: "₩85,000", delta: "+20.1%" },
  { name: "스폰서십", icon: "🤝", amount: "₩120,000", delta: "+18.3%" },
  { name: "기타 수익", icon: "💰", amount: "₩15,300", delta: "+5.7%" },
];

const logs: LogItem[] = [
  { time: "14:30:35", text: "뉴스 수집 완료: 247개 기사 수집" },
  { time: "14:30:16", text: "AI 요약 완료: 247개 기사 처리" },
  { time: "14:30:15", text: "카드뉴스 제작 완료: 23개 완성" },
  { time: "14:30:12", text: "영상 초안 제작 진행: 16개" },
  { time: "14:30:08", text: "SEO 최적화 진행: 27개 글 완료" },
  { time: "14:30:03", text: "업로드 자료 패키징 완료: 6개 세트" },
];

const previews: Preview[] = [
  { title: "글로벌 테크 트렌드 카드뉴스", tag: "발행 대기", time: "14:30 작성", gradient: "from-indigo-500 to-purple-600" },
  { title: "밀리언 뷰 AI 가이드 영상 초안", tag: "발행 대기", time: "14:30 작성", gradient: "from-amber-400 to-orange-600" },
];

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-[#0a0f1e] p-5 text-slate-200 md:p-7">
      {/* header */}
      <div className="mb-6 flex flex-col gap-5 rounded-2xl border border-white/5 bg-[#0d1426] p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white">AI 콘텐츠 자동화 에이전트 시스템</h1>
            <span className="rounded-full bg-cyan-500/15 px-2.5 py-1 text-xs font-bold text-cyan-300">v1.0</span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            에이전트가 자동으로 수집 · 생성 · 최적화까지 처리하고, 채널 업로드용 자료를 완성해 둡니다. 실제 게시는 직접 진행합니다.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-auto">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-center lg:text-left">
              <p className="text-[11px] text-slate-400">{s.label}</p>
              <p className="mt-1 text-lg font-bold text-white">{s.value}</p>
              <p className="text-[11px] font-semibold text-emerald-400">▲ {s.delta}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[260px_1fr_300px]">
        {/* left: agent status */}
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-white/5 bg-[#0d1426] p-5">
            <h2 className="mb-4 text-sm font-bold text-white">에이전트 상태</h2>
            <div className="space-y-3">
              {agents.map((a) => (
                <div key={a.name} className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">{a.name}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      a.status === "실행중"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : a.status === "대기중"
                        ? "bg-slate-500/15 text-slate-400"
                        : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-[#0d1426] p-5">
            <h2 className="mb-4 text-sm font-bold text-white">에이전트 집중 상태</h2>
            <div className="flex items-center justify-center">
              <div
                className="relative flex h-28 w-28 items-center justify-center rounded-full"
                style={{
                  background:
                    "conic-gradient(#34d399 0deg 252deg, #fbbf24 252deg 324deg, #f87171 324deg 360deg)",
                }}
              >
                <div className="absolute inset-[10px] rounded-full bg-[#0d1426]" />
              </div>
            </div>
            <div className="mt-4 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-slate-300"><span className="h-2 w-2 rounded-full bg-emerald-400" />정상 70%</div>
              <div className="flex items-center gap-2 text-slate-300"><span className="h-2 w-2 rounded-full bg-amber-400" />주의 20%</div>
              <div className="flex items-center gap-2 text-slate-300"><span className="h-2 w-2 rounded-full bg-red-400" />오류 10%</div>
            </div>
          </div>
        </div>

        {/* center: pipeline + channels + revenue */}
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-white/5 bg-[#0d1426] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                자동화 워크플로우
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">실행중</span>
              </h2>
              <button className="text-xs text-slate-500 hover:text-slate-300">전체 로그 보기</button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {steps.map((s) => (
                <div key={s.n} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-base">{s.icon}</span>
                    <p className="text-xs font-bold leading-tight text-white">{s.n}. {s.title}</p>
                  </div>
                  <p className="text-[11px] leading-5 text-slate-400">{s.desc}</p>
                  <p className="mt-2 text-[11px] font-semibold text-cyan-300">{s.count}</p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400" style={{ width: `${s.percent}%` }} />
                  </div>
                  <p className="mt-1 text-right text-[10px] text-slate-500">{s.percent}%</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/5 bg-[#0d1426] p-5">
              <h2 className="mb-4 flex items-center justify-between text-sm font-bold text-white">
                콘텐츠 발행 채널
                <span className="text-[11px] font-normal text-slate-500">자료 준비 완료 · 직접 업로드</span>
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {channels.map((c) => (
                  <div key={c.name} className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
                    <div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-sm font-bold ${c.color}`}>{c.icon}</div>
                    <p className="mt-2 text-xs font-semibold text-white">{c.name}</p>
                    <p className="text-[11px] text-slate-400">대기 {c.pending}건</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#0d1426] p-5">
              <h2 className="mb-4 text-sm font-bold text-white">수익 연동 채널</h2>
              <div className="space-y-2.5">
                {revenue.map((r) => (
                  <div key={r.name} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-xs">{r.icon}</span>
                      <span className="text-xs font-medium text-slate-200">{r.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-white">{r.amount}</p>
                      <p className="text-[10px] font-semibold text-emerald-400">{r.delta}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* right: activity, previews, system */}
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-white/5 bg-[#0d1426] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">실시간 활동 로그</h2>
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />모든 시스템 정상 작동
              </span>
            </div>
            <div className="space-y-3">
              {logs.map((l, i) => (
                <div key={i} className="flex gap-3 text-xs">
                  <span className="shrink-0 text-slate-500">{l.time}</span>
                  <span className="text-slate-300">{l.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-[#0d1426] p-5">
            <h2 className="mb-4 text-sm font-bold text-white">콘텐츠 미리보기</h2>
            <div className="space-y-3">
              {previews.map((p) => (
                <div key={p.title} className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.03]">
                  <div className={`flex h-16 items-center justify-center bg-gradient-to-br ${p.gradient} text-xl`}>🖼️</div>
                  <div className="p-3">
                    <p className="text-xs font-semibold leading-snug text-white">{p.title}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">{p.tag}</span>
                      <span className="text-[10px] text-slate-500">{p.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-[#0d1426] p-5">
            <h2 className="mb-4 text-sm font-bold text-white">시스템 성능 모니터링</h2>
            <div className="flex justify-between text-center">
              <div>
                <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "conic-gradient(#38bdf8 223deg, rgba(255,255,255,0.08) 0deg)" }}>
                  <div className="absolute inset-[5px] flex items-center justify-center rounded-full bg-[#0d1426] text-xs font-bold text-white">62%</div>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">CPU 사용량</p>
              </div>
              <div>
                <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "conic-gradient(#34d399 173deg, rgba(255,255,255,0.08) 0deg)" }}>
                  <div className="absolute inset-[5px] flex items-center justify-center rounded-full bg-[#0d1426] text-xs font-bold text-white">48%</div>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">메모리 사용량</p>
              </div>
              <div>
                <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "conic-gradient(#a78bfa 198deg, rgba(255,255,255,0.08) 0deg)" }}>
                  <div className="absolute inset-[5px] flex items-center justify-center rounded-full bg-[#0d1426] text-xs font-bold text-white">55%</div>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">디스크 사용량</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] px-5 py-3 text-center text-xs text-cyan-200">
        시스템이 자동으로 콘텐츠를 수집·생성·정리하고 있습니다. 채널 업로드는 준비된 자료를 확인한 뒤 직접 진행해 주세요.
      </div>
    </div>
  );
}
