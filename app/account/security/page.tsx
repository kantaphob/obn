"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

export default function AccountSecurityPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setError("");
    if (newPassword !== confirmPassword) { setError("รหัสผ่านใหม่และการยืนยันไม่ตรงกัน"); return; }
    setBusy(true);
    const result = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
    setBusy(false);
    if (result.error) { setError("เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาตรวจสอบรหัสผ่านปัจจุบันและลองใหม่"); return; }
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setMessage("เปลี่ยนรหัสผ่านแล้ว และออกจากระบบในอุปกรณ์อื่นเรียบร้อย");
  }

  return <main className="mx-auto min-h-dvh max-w-3xl px-5 py-10 text-[#26332f] sm:px-8">
    <p className="text-sm font-semibold text-[#728078]">บัญชีผู้ใช้งาน</p><h1 className="mt-1 text-3xl font-bold">เปลี่ยนรหัสผ่าน</h1>
    <p className="mb-7 mt-2 text-sm text-[#728078]">ตั้งรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร</p>
    <form onSubmit={submit} className="grid gap-5 rounded-2xl border border-[#dbe2dd] bg-white p-5 sm:p-7">
      <label className="grid gap-2 text-sm font-semibold">รหัสผ่านปัจจุบัน<input required type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} className="h-12 rounded-xl border border-[#d5ded8] px-4 outline-none focus:border-[#578370]" /></label>
      <label className="grid gap-2 text-sm font-semibold">รหัสผ่านใหม่<input required type="password" minLength={8} autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="h-12 rounded-xl border border-[#d5ded8] px-4 outline-none focus:border-[#578370]" /></label>
      <label className="grid gap-2 text-sm font-semibold">ยืนยันรหัสผ่านใหม่<input required type="password" minLength={8} autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className="h-12 rounded-xl border border-[#d5ded8] px-4 outline-none focus:border-[#578370]" /></label>
      {error&&<p role="alert" className="rounded-xl bg-[#fff0ef] px-4 py-3 text-sm text-[#a33631]">{error}</p>}{message&&<p role="status" className="rounded-xl bg-[#edf8f0] px-4 py-3 text-sm text-[#28633f]">{message}</p>}
      <button disabled={busy} className="h-12 rounded-xl bg-[#315d4b] px-5 font-bold text-white disabled:opacity-60">{busy?"กำลังบันทึก…":"บันทึกรหัสผ่านใหม่"}</button>
    </form>
  </main>;
}
