"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, MoreHorizontal, Search, Settings2 } from "lucide-react";
import CreateGroupButton from "../CreateGroupButton";
import { type BillingGroup, type MemberOption } from "../GroupForm";
import { formatBillingDate, prepaidGroupSummary } from "@/lib/youtube-billing";
import "../workspace.css";

const money = (satang: number) => `฿${(satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export default function GroupManagementPanel({ groups, memberOptions, today, canWrite }: { canWrite: boolean; groups: BillingGroup[]; memberOptions: MemberOption[]; today: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const filtered = groups.filter((group) => [group.name, ...group.seats.flatMap((seat) => [seat.displayName || "", seat.email || ""])].join(" ").toLocaleLowerCase("th").includes(query.trim().toLocaleLowerCase("th")));
  const occupied = groups.reduce((count, group) => count + group.seats.filter((seat) => seat.memberId || seat.displayName || seat.email).length, 0);
  async function remove(group: BillingGroup) {
    if (!window.confirm(`เก็บกลุ่มเข้าคลัง “${group.name}” และการจัดบัญชีสมาชิกหรือไม่? ประวัติรับ–จ่ายยังคงเก็บไว้`)) return;
    setError("");
    try { const response = await fetch(`/api/youtube/groups/${group.id}`, { method: "DELETE" }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "ลบไม่สำเร็จ"); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "เชื่อมต่อไม่สำเร็จ"); }
  }
  return <main className="yu-shell"><p className="yu-eyebrow">YOUTUBE WORKSPACE / กลุ่ม</p><header className="yu-heading"><div><h1>กลุ่มและบัญชี</h1><p>จัดบัญชีสมาชิก กำหนดค่าแพ็กเกจ และแบ่งราคาของแต่ละกลุ่ม</p></div><div className="yu-actions"><Link className="yu-button" href="/dashboard/youtube/archive">คลังกลุ่มและสมาชิก</Link><CreateGroupButton canWrite={canWrite} memberOptions={memberOptions} today={today} /></div></header>
    <div className="yu-toolbar"><label className="yu-search"><Search size={18} /><input aria-label="ค้นหากลุ่ม" placeholder="ค้นหาชื่อกลุ่ม สมาชิก หรืออีเมล" value={query} onChange={(event) => setQuery(event.target.value)} /></label><span className="yu-muted">{groups.length} กลุ่ม · ใช้แล้ว {occupied}/{groups.length * 6} บัญชี</span></div>
    {error && <p role="alert" className="yu-error">{error}</p>}
    <div className="yu-groupGrid">{filtered.map((group) => {
      const seats = group.seats.filter((seat) => seat.memberId || seat.displayName || seat.email);
      const people = new Set(seats.map((seat) => seat.memberId || seat.displayName || seat.email)).size;
      const due = seats.filter((seat) => seat.priceSatang && seat.nextDueDate && seat.nextDueDate <= today).length;
      const configured = Boolean(group.startedOn && group.monthlyPriceSatang && group.dueDay);
      const schedule = prepaidGroupSummary(group.startedOn, group.dueDay, group.monthlyPriceSatang, today);
      return <article className="yu-groupCard" key={group.id}><div className="yu-groupCardTop"><div><h2>{group.name}</h2><p>{people} คน · {seats.length}/6 บัญชี</p></div><span className={`yu-badge ${configured ? "" : "yu-warning"}`}>{configured ? "ตั้งค่าครบ" : "รอตั้งค่า"}</span></div><div className="yu-occupancy" aria-label={`ใช้งาน ${seats.length} จาก 6 บัญชี`}>{Array.from({ length: 6 }, (_, index) => <i key={index} data-filled={index < seats.length} />)}</div><div className="yu-groupPrice"><span>ค่าแพ็กเกจทั้งกลุ่ม</span><strong>{group.monthlyPriceSatang === null ? "ยังไม่กำหนด" : money(group.monthlyPriceSatang)} <small>/ เดือน</small></strong></div><div className="yu-groupFacts"><div><span>วันจ่ายให้ YouTube</span><strong>{group.dueDay ? `ทุกวันที่ ${group.dueDay}` : "ยังไม่กำหนด"}</strong></div><div><span>สมาชิกที่ถึงรอบเก็บ</span><strong>{due} บัญชี</strong></div><div><span>วันเริ่มกลุ่ม</span><strong>{formatBillingDate(group.startedOn)}</strong></div><div><span>กำหนดจ่ายถัดไป</span><strong>{formatBillingDate(schedule.nextPaymentDate)}</strong></div></div><footer className="yu-groupFooter"><Link className="yu-button" href={`/dashboard/youtube/group/${group.id}`}><Settings2 size={15} />สมุดสมาชิก</Link><Link className="yu-button yu-primary" href={`/dashboard/youtube/collections?group=${group.id}`}>เรียกเก็บ<ArrowUpRight size={15} /></Link><details className="yu-groupMenu"><summary aria-label={`ตัวเลือกกลุ่ม ${group.name}`}><MoreHorizontal size={19} /></summary><div><button type="button" className="yu-button yu-danger" disabled={!canWrite} onClick={() => void remove(group)}>เก็บกลุ่มเข้าคลัง</button></div></details></footer></article>;
    })}</div>
    {!filtered.length && <div className="yu-card yu-empty"><strong>{groups.length ? "ไม่พบกลุ่มที่ค้นหา" : "เริ่มจากสร้างกลุ่มแรก"}</strong><p>{groups.length ? "ลองใช้ชื่อสมาชิกหรืออีเมล" : "ระบุค่าแพ็กเกจ วันจ่าย แล้วเลือกสมาชิกเข้าบัญชี"}</p></div>}
  </main>;
}
