const items = [
  { name: "OpenAI", status: "환경변수 필요", color: "bg-amber-500" },
  { name: "Gemini", status: "구조 준비", color: "bg-blue-500" },
  { name: "RSS", status: "13개 피드 연결", color: "bg-green-500" },
  { name: "Database", status: "Prisma Phase 예정", color: "bg-slate-400" },
];

export default function SystemStatus() {
  return (
    <div className="rounded-2xl border bg-white p-6">
      <h2 className="mb-5 text-xl font-bold">System Status</h2>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.name} className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{item.name}</div>
              <div className="text-sm text-slate-500">{item.status}</div>
            </div>
            <div className={`h-3 w-3 rounded-full ${item.color}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
