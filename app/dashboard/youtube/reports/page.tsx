import { Suspense } from "react";
import { io } from "next/cache";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getYoutubePageAccess, youtubePageDenied } from "@/lib/youtube-access";
import { billingToday, formatBillingDate } from "@/lib/youtube-billing";
import { receiptServiceAllocation } from "@/lib/youtube-service-periods";
import "../workspace.css";

const money = (satang: number) => `฿${(satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export default function Page() { return <Suspense fallback={<main>กำลังคำนวณช่วงบริการ…</main>}><Content /></Suspense>; }
async function Content() {
  await io();
  const { allowed } = await getYoutubePageAccess("/dashboard/youtube/ledger");
  if (!allowed) return youtubePageDenied();
  const today = billingToday();
  const payments = await prisma.youtubePayment.findMany({ where: { voidedAt: null, paidOn: { lte: today } }, orderBy: [{ groupName: "asc" }, { memberName: "asc" }, { dueDate: "asc" }] });
  const rows = payments.map((payment) => ({ ...payment, ...receiptServiceAllocation(payment, today) }));
  const received = rows.reduce((sum, row) => sum + row.amountSatang, 0);
  const used = rows.reduce((sum, row) => sum + row.usedSatang, 0);
  const people = new Map<string, { name: string; group: string; received: number; used: number; prepaid: number }>();
  for (const row of rows) {
    const key = `${row.groupId || row.groupName}:${row.assignmentMemberId || row.memberName}`;
    const person = people.get(key) || { name: row.memberName, group: row.groupName, received: 0, used: 0, prepaid: 0 };
    person.received += row.amountSatang; person.used += row.usedSatang; person.prepaid += row.prepaidSatang; people.set(key, person);
  }
  return <main className="yu-shell"><Link className="yu-button yu-backToGroups" href="/dashboard/youtube/ledger">← กลับสมุดบัญชี</Link><header className="yu-heading"><div><h1>เงินรับล่วงหน้าและช่วงบริการ</h1><p>ณ {formatBillingDate(today)} · รวมทุกบัญชีของสมาชิกในแต่ละกลุ่ม</p></div></header><div className="yu-stats"><article className="yu-stat"><span>รับเงินจริงสะสม</span><strong>{money(received)}</strong><small>เฉพาะรายการรับที่ยังไม่ถูกยกเลิก</small></article><article className="yu-stat"><span>มูลค่าบริการใช้แล้วโดยประมาณ</span><strong>{money(used)}</strong><small>เฉลี่ยตามวันในช่วงบริการถึงวันนี้</small></article><article className="yu-stat"><span>เงินรับสำหรับบริการในอนาคต</span><strong>{money(received - used)}</strong><small>ส่วนที่ยังไม่ถึงช่วงใช้งาน · ไม่ใช่กำไร</small></article></div><p className="yu-formNote">รายงานนี้เฉลี่ยยอดรับตามจำนวนวัน ตั้งแต่วันครบกำหนดถึงก่อนรอบถัดไป ไม่ใช่รายการบัญชีเพิ่มเติม และไม่เปลี่ยนยอดเงินสดในสมุดบัญชี ยอดยกมาที่ไม่มีช่วงบริการไม่รวมในรายงานนี้</p><section className="yu-card"><div className="yu-tableWrap"><table className="yu-table"><thead><tr><th>สมาชิก / กลุ่ม</th><th>รับจริง</th><th>ใช้บริการแล้ว</th><th>รับล่วงหน้าคงเหลือ</th></tr></thead><tbody>{[...people.entries()].map(([key, person]) => <tr key={key}><td><strong>{person.name}</strong><small>{person.group}</small></td><td>{money(person.received)}</td><td>{money(person.used)}</td><td>{money(person.prepaid)}</td></tr>)}</tbody></table></div>{!rows.length && <p className="yu-empty">ยังไม่มีรายการรับเงิน</p>}{rows.some((row) => row.unknown) && <p role="status">บางรายการมีช่วงบริการไม่ครบ จึงแสดงเป็นเงินรับล่วงหน้ารอตรวจสอบ</p>}</section></main>;
}
