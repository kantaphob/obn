"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requestedCallback = searchParams.get("callbackURL") || "/portal";
  const callbackURL = requestedCallback.startsWith("/") && !requestedCallback.startsWith("//") ? requestedCallback : "/portal";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const value = identifier.trim();
    const result = value.includes("@")
      ? await authClient.signIn.email({ email: value.toLowerCase(), password, callbackURL })
      : await authClient.signIn.username({ username: value.toLowerCase(), password, callbackURL });
    setBusy(false);
    if (result.error) setError("Username/อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกระงับ");
  }

  return <main className="grid min-h-dvh place-items-center bg-[#f2f4f1] px-5 py-12 text-[#26332f]">
    <section className="w-full max-w-[440px] rounded-[28px] border border-[#dbe2dd] bg-white p-8 shadow-[0_18px_55px_#283b3018] sm:p-10">
      <div className="mb-8"><span className="text-xs font-bold tracking-[.24em] text-[#7c8c84]">OBNITHI WORKSPACE</span><h1 className="mt-3 text-3xl font-bold">เข้าสู่ระบบ</h1><p className="mt-2 text-sm text-[#728078]">ใช้บัญชีที่ผู้ดูแลระบบสร้างให้</p></div>
      <form onSubmit={submit} className="grid gap-5">
        <label className="grid gap-2 text-sm font-semibold">Username หรืออีเมล<input required type="text" autoComplete="username" value={identifier} onChange={e=>setIdentifier(e.target.value)} className="h-12 rounded-xl border border-[#d5ded8] bg-[#fbfcfb] px-4 outline-none focus:border-[#578370] focus:ring-2 focus:ring-[#57837025]" /></label>
        <label className="grid gap-2 text-sm font-semibold">รหัสผ่าน<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="h-12 rounded-xl border border-[#d5ded8] bg-[#fbfcfb] px-4 outline-none focus:border-[#578370] focus:ring-2 focus:ring-[#57837025]" /></label>
        {error && <p role="alert" className="rounded-xl bg-[#fff0ef] px-4 py-3 text-sm text-[#a33631]">{error}</p>}
        <button disabled={busy} className="mt-1 h-12 rounded-xl bg-[#315d4b] font-bold text-white transition hover:bg-[#254b3b] disabled:opacity-60">{busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}</button>
      </form>
      <p className="mt-6 text-xs leading-5 text-[#87928c]">หากยังไม่มีบัญชี กรุณาให้เจ้าของระบบสร้างบัญชีให้</p>
    </section>
  </main>;
}
