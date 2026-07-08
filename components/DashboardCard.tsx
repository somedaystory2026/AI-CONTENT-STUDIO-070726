type Props = {
  title: string;
  value: string;
  icon: string;
};

export default function DashboardCard({
  title,
  value,
  icon,
}: Props) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border hover:shadow-lg transition">

      <div className="text-4xl">
        {icon}
      </div>

      <div className="mt-4 text-slate-500">
        {title}
      </div>

      <div className="text-3xl font-bold mt-2">
        {value}
      </div>

    </div>
  );
}