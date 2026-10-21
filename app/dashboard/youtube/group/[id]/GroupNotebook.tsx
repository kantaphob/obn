"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import GroupForm, { type BillingGroup, type GroupInput, type MemberOption } from "../../GroupForm";
import { formatBillingDate, prepaidGroupSummary } from "@/lib/youtube-billing";
import "../../workspace.css";

const money = (satang: number) => `฿${(satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export default function GroupNotebook({ group, memberOptions, today, actualExpense, canWrite, historicalCostSatang, chargeCount }: { historicalCostSatang: number; chargeCount: number; canWrite: boolean; group: BillingGroup; memberOptions: MemberOption[]; today: string; actualExpense: number }) {
  const router = useRouter();
  const [editor, setEditor] = useState<{ section: "details" | "accounts"; seatIndex?: number } | null>(null);
  const [view, setView] = useState<"members" | "prices">("members");
  const occupied = group.seats.filter((seat) => seat.memberId || seat.displayName || seat.email);
  const monthly = occupied.reduce((sum, seat) => sum + (seat.priceSatang || 0) / (seat.billingMonths || 1), 0);
  const schedule = prepaidGroupSummary(group.startedOn, group.dueDay, group.monthlyPriceSatang, today);
  const edit = (label: string, section: "details" | "accounts", seatIndex?: number) => <button type="button" className="yu-button" disabled={!canWrite} aria-label={label} onClick={() => setEditor({ section, seatIndex })}><Pencil size={15} />แก้ไข</button>;
  async function save(input: GroupInput) {
    const response = await fetch(`/api/youtube/groups/${group.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "บันทึกไม่สำเร็จ");
    setEditor(null); router.refresh();
  }
  return <main className="yu-shell">
    <Link href="/dashboard/youtube/group" className="yu-button yu-backToGroups"><ArrowLeft size={19} aria-hidden="true" />กลับไปหน้ากลุ่มทั้งหมด</Link>
    <header className="yu-heading"><div><p className="yu-eyebrow">สมุดสมาชิกประจำกลุ่ม</p><h1>{group.name}</h1><p>{occupied.length}/6 บัญชี · สมาชิกคนเดียวมีได้หลายบัญชี</p></div>{edit("แก้ไขชื่อและวันประจำกลุ่ม", "details")}</header>
    <section className="yu-card" style={{ marginBottom: 20 }}><div className="yu-toolbar"><div><strong>ระยะเวลาและวันชำระ</strong><p className="yu-muted">เริ่ม {formatBillingDate(group.startedOn)} · จ่ายให้ YouTube ทุกวันที่ {group.dueDay || "—"} · ครั้งถัดไป {formatBillingDate(schedule.nextPaymentDate)}</p></div>{edit("แก้ไขระยะเวลาและวันชำระ", "details")}</div></section>
    <section className="yu-stats" aria-label="ยอดเงินของกลุ่ม">
      <article className="yu-card"><div className="yu-toolbar"><span>ค่าแพ็กเกจ / เดือน</span>{edit("แก้ไขค่าแพ็กเกจ", "details")}</div><h2>{money(group.monthlyPriceSatang || 0)}</h2><p className="yu-muted">ต้นทุนทั้งกลุ่ม</p></article>
      <article className="yu-card"><div className="yu-toolbar"><span>เรียกเก็บรวม / เดือน</span>{edit("แก้ไขราคาสมาชิก", "accounts")}</div><h2>{money(monthly)}</h2><p className="yu-muted">รวมราคาทุกบัญชีหลังหารรอบเดือน</p></article>
      <article className="yu-card"><span>ต้นทุนถึงวันนี้</span><h2>{money(historicalCostSatang)}</h2><p className="yu-muted">{chargeCount} รอบ · รวมราคาแต่ละรอบที่เก็บไว้</p></article>
      <article className="yu-card"><span>จ่ายเงินจริงสะสม</span><h2>{money(actualExpense)}</h2><Link href={`/dashboard/youtube/ledger?view=payments`}>ดูและบันทึกการจ่าย →</Link></article>
    </section>
    <div className="yu-actions" style={{ marginBottom: 16 }}><Link className="yu-button" href={`/dashboard/youtube/group/${group.id}/history`}>ประวัติราคาและสมาชิก</Link><Link className="yu-button" href="/dashboard/youtube/reports">รายงานเงินรับล่วงหน้า</Link></div>
    <section className="yu-card"><div className="yu-toolbar"><div className="yu-tabs" role="group" aria-label="ส่วนจัดการกลุ่ม"><button type="button" aria-pressed={view === "members"} onClick={() => setView("members")}>สมุดสมาชิก</button><button type="button" aria-pressed={view === "prices"} onClick={() => setView("prices")}>ราคาและรอบชำระ</button></div><Link className="yu-button yu-primary" href={`/dashboard/youtube/invoices?group=${group.id}`}>ใบแจ้งหนี้สมาชิก →</Link></div>
      <p className="yu-muted">{view === "members" ? "เพิ่ม เปลี่ยน หรือนำสมาชิกออกได้ที่แต่ละช่อง" : "ราคาต่อเดือน × จำนวนเดือน = ยอดเรียกเก็บต่อรอบ · ยกเว้นชำระและเฉลี่ยราคาได้จากปุ่มแก้ไข"}</p>
      <div className="yu-tableWrap"><table className="yu-table"><thead><tr><th>บัญชี</th><th>สมาชิก</th>{view === "members" ? <th>อีเมล YouTube</th> : <><th>บาท / เดือน</th><th>รอบ / ยอดเรียกเก็บ</th><th>ครั้งถัดไป</th></>}<th>จัดการ</th></tr></thead><tbody>{Array.from({ length: 6 }, (_, index) => {
        const seat = group.seats.find((item) => item.position === index + 1);
        const filled = Boolean(seat?.memberId || seat?.displayName || seat?.email);
        return <tr key={index}><td>{index === 0 ? "บัญชีหลัก" : `บัญชีรอง ${index}`}</td><td><strong>{filled ? seat?.displayName || memberOptions.find((member) => member.memberId === seat?.memberId)?.name || "สมาชิก" : "ช่องว่าง"}</strong></td>{view === "members" ? <td>{seat?.email || "—"}</td> : <><td>{filled && seat?.priceSatang != null ? money(seat.priceSatang / (seat.billingMonths || 1)) : "—"}</td><td>{filled ? <>{seat?.priceSatang === 0 ? "ยกเว้นชำระ" : `${seat?.billingMonths || 1} เดือน · ${money(seat?.priceSatang || 0)}`}</> : "—"}</td><td>{filled ? formatBillingDate(seat?.nextDueDate || null) : "—"}</td></>}<td>{filled ? edit(`แก้ไขบัญชีที่ ${index + 1}`, "accounts", index) : <button type="button" className="yu-button" disabled={!canWrite} onClick={() => setEditor({ section: "accounts", seatIndex: index })}><Plus size={15} />เพิ่มสมาชิก</button>}</td></tr>;
      })}</tbody></table></div>
      <p className="yu-formNote">ส่วนต่างต่อเดือน {money(monthly - (group.monthlyPriceSatang || 0))} · การเปลี่ยนราคาเป็นการตั้งค่า ยังไม่นับเป็นเงินรับจริง</p>
    </section>
    {editor && <GroupForm key={`${editor.section}-${editor.seatIndex ?? "all"}`} group={group} memberOptions={memberOptions} today={today} section={editor.section} seatIndex={editor.seatIndex} onClose={() => setEditor(null)} onSave={save} />}
  </main>;
}
