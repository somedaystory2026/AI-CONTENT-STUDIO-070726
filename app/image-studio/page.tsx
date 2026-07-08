"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ImageStudioRedirect() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.replace("/card-news"), 900);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-8 text-center text-slate-950">
      <div className="rounded-3xl border bg-white p-10 shadow-sm">
        <p className="text-sm font-semibold text-purple-600">Image Studio</p>
        <h1 className="mt-2 text-2xl font-black">이미지 스튜디오가 카드뉴스로 합쳐졌습니다</h1>
        <p className="mt-2 max-w-md text-slate-500">
          이미지 생성 기능은 이제 카드뉴스 화면의 &quot;🖼️ 이미지 먼저 만들기&quot; 버튼 안에 있어요. 잠시 후 자동으로 이동합니다.
        </p>
        <a href="/card-news" className="mt-5 inline-block rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">
          카드뉴스로 바로 이동
        </a>
      </div>
    </main>
  );
}
