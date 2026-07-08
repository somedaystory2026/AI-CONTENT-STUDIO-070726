export default function InfluencerPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-950">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-pink-600">AI Influencer Jina Studio</p>
          <h1 className="text-4xl font-black">AI 인플루언서 진아 생성기</h1>
          <p className="mt-2 max-w-3xl text-slate-500">
            진아 페르소나, 착장, 포즈, SNS 캡션, 이미지 프롬프트를 한 화면에서 만들 수 있도록 기존 진아 생성기를 통합했습니다.
          </p>
        </div>
        <a href="/downloads/AI_influencer_jina_generator.zip" download className="rounded-2xl bg-slate-950 px-6 py-4 font-black text-white shadow-sm transition hover:scale-[1.02]">
          📦 진아 생성기 ZIP 다운로드
        </a>
      </div>

      <div className="mb-8 flex flex-wrap gap-3">
        <a
          href="https://twitter.com/compose/tweet"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:scale-[1.03] active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
          X 바로가기
        </a>
        <a
          href="https://www.instagram.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:scale-[1.03] active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM12 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" /></svg>
          인스타 바로가기
        </a>
      </div>

      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-sm font-black text-pink-600">01</div>
          <h2 className="mt-2 text-xl font-black">진아 캐릭터 고정</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">얼굴 톤, 분위기, 포즈, 스타일을 고정해 제품 리뷰·룩북·숏폼 썸네일에 반복 사용합니다.</p>
        </div>
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-sm font-black text-purple-600">02</div>
          <h2 className="mt-2 text-xl font-black">SNS 콘텐츠 생성</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">인스타그램, X, 쇼츠, 릴스용 캡션과 후킹 문구를 진아 톤으로 생성합니다.</p>
        </div>
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-sm font-black text-orange-600">03</div>
          <h2 className="mt-2 text-xl font-black">아마존 SEO 연동</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">아마존 상품 리뷰글에서 진아가 해당 제품을 착용·사용하는 이미지 프롬프트로 연결됩니다.</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-[32px] border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b bg-slate-950 px-6 py-4 text-white">
          <div>
            <h2 className="font-black">진아 생성기 실행 화면</h2>
            <p className="text-sm text-slate-300">아래 화면이 안 보이면 새 창 실행 버튼을 누르세요.</p>
          </div>
          <a href="/tools/jina-generator/index.html" target="_blank" className="rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-950">
            새 창으로 실행
          </a>
        </div>
        <iframe src="/tools/jina-generator/index.html" className="h-[760px] w-full" />
      </section>
    </main>
  );
}
