"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@aics.local");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setMessage("로그인 실패: 이메일 또는 비밀번호를 확인하세요.");
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <p className="text-sm font-semibold text-blue-600">AI Content Studio</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">로그인</h1>
        <p className="mt-2 text-sm text-slate-500">Prisma + Auth.js 기반 계정 시스템입니다.</p>

        <label className="mt-8 block text-sm font-semibold text-slate-700">이메일</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-slate-950" />

        <label className="mt-4 block text-sm font-semibold text-slate-700">비밀번호</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-slate-950" />

        {message && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}

        <button disabled={loading} className="mt-6 w-full rounded-xl bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-50">
          {loading ? "로그인 중..." : "로그인"}
        </button>

        <p className="mt-5 text-center text-sm text-slate-500">
          계정이 없나요? <Link href="/register" className="font-bold text-blue-600">회원가입</Link>
        </p>
      </form>
    </div>
  );
}
