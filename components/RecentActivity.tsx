const activities = [
  { title: "News AI generated X post", time: "2 minutes ago", icon: "📰" },
  { title: "Music AI created lyrics", time: "12 minutes ago", icon: "🎵" },
  { title: "Influencer caption generated", time: "35 minutes ago", icon: "👩" },
  { title: "Amazon SEO article saved", time: "1 hour ago", icon: "🛒" },
];

export default function RecentActivity() {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border mt-8">
      <h3 className="text-xl font-bold mb-5">Recent Activity</h3>

      <div className="grid gap-4">
        {activities.map((item, index) => (
          <div
            key={index}
            className="flex items-center justify-between border-b last:border-b-0 pb-4 last:pb-0"
          >
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-xl">
                {item.icon}
              </div>

              <div>
                <div className="font-semibold text-slate-800">{item.title}</div>
                <div className="text-sm text-slate-500">{item.time}</div>
              </div>
            </div>

            <button className="text-sm text-blue-600 font-semibold">
              View
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}