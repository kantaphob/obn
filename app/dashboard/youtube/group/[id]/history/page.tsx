import { Suspense } from "react";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getYoutubePageAccess, youtubePageDenied } from "@/lib/youtube-access";
import { formatBillingDate } from "@/lib/youtube-billing";
import "../../../workspace.css";

export default function Page({ params }: { params: Promise<{ id: string }> }) { return <Suspense fallback={<main>กำลังโหลดประวัติกลุ่ม…</main>}><Content params={params} /></Suspense>; }
async function Content({ params }: { params: Promise<{ id: string }> }) {
  await io();
  const { allowed } = await getYoutubePageAccess("/dashboard/youtube/group");
  if (!allowed) return youtubePageDenied();
  const { id } = await params;
  const [group, periods] = await Promise.all([
    prisma.youtubeBillingGroup.findUnique({ where: { id }, include: { seats: { select: { id: true, position: true } } } }),
    prisma.youtubeMembershipPeriod.findMany({ where: { groupId: id }, orderBy: [{ knownSince: "desc" }, { assignmentKey: "desc" }] }),
  ]);
  if (!group) notFound();
  const prices = await prisma.youtubeSeatPricePeriod.findMany({ where: { assignmentKey: { in: periods.map((period) => period.assignmentKey) } }, orderBy: { id: "desc" } });
  return <main className="yu-shell"><Link className="yu-button yu-backToGroups" href={`/dashboard/youtube/group/${id}`}>← กลับสมุดสมาชิก {group.name}</Link><header className="yu-heading"><div><h1>ประวัติสมาชิกและราคา · {group.name}</h1><p>เก็บช่วงของแต่ละบัญชี แม้เปลี่ยนคนหรือเปลี่ยนอีเมล · ข้อมูลตั้งต้นไม่อนุมานวันที่เข้ากลุ่มเดิม</p></div><Link className="yu-button" href={`/dashboard/youtube/logs?q=${id}`}>ดูค่าก่อน–หลังใน Log</Link></header><section className="yu-card">{periods.map((period) => {
    const position = group.seats.find((seat) => seat.id === period.seatId)?.position;
    return <details key={period.assignmentKey} className="yu-advanced"><summary>{period.memberName || "สมาชิก"} · บัญชี {position || "เดิม"} · {period.endedOn ? `ออก ${formatBillingDate(period.endedOn)}` : group.status === "ARCHIVED" ? "กลุ่มพักใช้งาน" : "ประจำบัญชี"}</summary><p className="yu-muted">อีเมล: {period.email || "ไม่ระบุ"} · เข้า: {period.startedOn ? formatBillingDate(period.startedOn) : "ไม่ทราบ (ข้อมูลตั้งต้น)"} · เริ่มเก็บประวัติ: {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(period.knownSince)}</p><div className="yu-tableWrap"><table className="yu-table"><thead><tr><th>ใช้กับรอบตั้งแต่</th><th>บาท / เดือน</th><th>รอบชำระ</th><th>ยอด / รอบ</th></tr></thead><tbody>{prices.filter((price) => price.assignmentKey === period.assignmentKey).map((price) => <tr key={price.id}><td>{price.baseline ? "ราคาเดิมตอนเริ่มเก็บประวัติ" : formatBillingDate(price.effectiveOn)}</td><td>{price.priceSatang === null ? "—" : (price.priceSatang / 100 / (price.billingMonths || 1)).toFixed(2)}</td><td>{price.billingMonths || "—"} เดือน</td><td>{price.priceSatang === null ? "—" : price.priceSatang === 0 ? "ยกเว้นชำระ" : `${(price.priceSatang / 100).toFixed(2)} บาท`}</td></tr>)}</tbody></table></div></details>;
  })}{!periods.length && <p className="yu-empty">ยังไม่มีประวัติสมาชิก</p>}</section></main>;
}
