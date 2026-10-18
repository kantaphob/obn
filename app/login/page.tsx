import { Suspense } from "react";
import LoginForm from "./LoginForm";

function LoginFallback() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#f2f4f1] px-5 py-12 text-[#26332f]">
      <section
        aria-busy="true"
        className="w-full max-w-[440px] rounded-[28px] border border-[#dbe2dd] bg-white p-8 shadow-[0_18px_55px_#283b3018] sm:p-10"
      >
        <span className="text-xs font-bold tracking-[.24em] text-[#7c8c84]">
          OBNITHI WORKSPACE
        </span>
        <h1 className="mt-3 text-3xl font-bold">เข้าสู่ระบบ</h1>
        <p className="mt-2 text-sm text-[#728078]">กำลังเตรียมแบบฟอร์ม…</p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
