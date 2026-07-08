export default function Header() {
  return (
    <header className="flex justify-between items-center bg-white border-b px-8 py-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          AI Content Studio
        </h1>

        <p className="text-sm text-slate-500">
          Create AI content faster than ever.
        </p>
      </div>

      <div className="flex items-center gap-5">

        <button className="text-2xl">
          🔔
        </button>

        <div className="flex items-center gap-3">

          <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
            TJ
          </div>

          <div>

            <div className="font-semibold">
              TJ HAN
            </div>

            <div className="text-xs text-slate-500">
              Pro Plan
            </div>

          </div>

        </div>

      </div>
    </header>
  );
}