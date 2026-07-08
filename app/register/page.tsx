"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("Demo User");
  const [email, setEmail] = useState("demo@aics.local");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const json = await res.json();
    setLoading(false);

    if (!json.success) {
      setMessage(json.message || "회원가입 실패");
      return;
    }

    router.push("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <p className="text-sm font-semibold text-blue-600">AI Content Studio</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">회원가입</h1>
        <p className="mt-2 text-sm text-slate-500">처음 실행 후 바로 테스트할 수 있는 Credentials Auth입니다.</p>

        <label className="mt-8 block text-sm font-semibold text-slate-700">이름</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-slate-950" />

        <label className="mt-4 block text-sm font-semibold text-slate-700">이메일</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-slate-950" />

        <label className="mt-4 block text-sm font-semibold text-slate-700">비밀번호</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-slate-950" />

        {message && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}

        <button disabled={loading} className="mt-6 w-full rounded-xl bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-50">
          {loading ? "생성 중..." : "계정 생성"}
        </button>

        <p className="mt-5 text-center text-sm text-slate-500">
          이미 계정이 있나요? <Link href="/login" className="font-bold text-blue-600">로그인</Link>
        </p>
      </form>
    </div>
  );
}
