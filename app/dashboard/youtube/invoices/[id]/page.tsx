import { Suspense } from "react";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getYoutubePageAccess, youtubePageDenied } from "@/lib/youtube-access";
import { billingToday, formatBillingDate } from "@/lib/youtube-billing";
import InvoiceActions from "./InvoiceActions";
import "../../workspace.css";
import "./invoice.css";

export default function Page({ params }: { params: Promise<{ id: string }> }) { return <Suspense fallback={<main>กำลังเปิดใบแจ้งหนี้…</main>}><Content params={params} /></Suspense>; }
async function Content({ params }: { params: Promise<{ id: string }> }) {
  await io();
  const { allowed, access } = await getYoutubePageAccess("/dashboard/youtube/invoices");
  if (!allowed || !access) return youtubePageDenied();
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const invoice = await prisma.youtubeInvoice.findUnique({ where: { id } });
  if (!invoice) notFound();
  const [seat, payment] = await Promise.all([
    prisma.youtubeBillingSeat.findUnique({ where: { id: invoice.seatId }, include: { group: { select: { status: true } } } }),
    invoice.receiptId ? prisma.youtubePayment.findUnique({ where: { id: invoice.receiptId } }) : null,
  ]);
  const through = new Date(`${invoice.nextDueDate}T00:00:00Z`); through.setUTCDate(through.getUTCDate() - 1);
  const canReceive = Boolean(seat && (seat.assignmentKey === invoice.assignmentKey ? seat.nextDueDate === invoice.dueDate && (seat.group.status === "ACTIVE" || invoice.dueDate <= billingToday()) : invoice.dueDate <= billingToday()));
  const money = (satang: number) => `${(satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`;
  return <main className="yu-shell"><Link className="yu-button yu-backToGroups yu-printActions" href="/dashboard/youtube/invoices">← กลับใบแจ้งหนี้และกำหนดจ่าย</Link><InvoiceActions invoice={invoice} today={billingToday()} canReceive={canReceive} canWrite={access.roleCode === "owner" || access.permissions.includes("*") || access.permissions.includes("dashboard:write")} /><article className="yu-card yu-invoicePaper"><header className="yu-heading"><div><p className="yu-eyebrow">Yture Co., Ltd.</p><h1>ใบแจ้งหนี้ค่าสมาชิก YouTube</h1><p>YT-INV-{String(invoice.id).padStart(6, "0")}</p></div><span className="yu-badge">{invoice.status === "PAID" ? "ชำระแล้ว" : invoice.status === "CANCELLED" ? "ยกเลิก" : "รอชำระ"}</span></header><div className="yu-twoColumns"><div><h2>เรียกเก็บจาก</h2><strong>{invoice.memberName}</strong><p>{invoice.email || "ไม่ระบุอีเมลบัญชี"}</p><p>กลุ่ม {invoice.groupName} · {invoice.position === 1 ? "บัญชีหลัก" : `บัญชีรอง ${invoice.position - 1}`}</p></div><div><p>วันที่ออก: {formatBillingDate(invoice.issuedOn)}</p><p><strong>ชำระภายใน: {formatBillingDate(invoice.dueDate)}</strong></p>{payment && <p>วันที่รับเงินจริง: {formatBillingDate(payment.paidOn)} · {money(payment.amountSatang)}</p>}</div></div><div className="yu-tableWrap"><table className="yu-table"><thead><tr><th>รายการ</th><th>ช่วงบริการ</th><th>จำนวนเดือน</th><th>จำนวนเงิน</th></tr></thead><tbody><tr><td>ค่าสมาชิก YouTube · กลุ่ม {invoice.groupName}</td><td>{formatBillingDate(invoice.dueDate)} – {formatBillingDate(through.toISOString().slice(0, 10))}</td><td>{invoice.billingMonths}</td><td>{money(invoice.amountSatang)}</td></tr></tbody></table></div><div className="yu-summaryRow" style={{ marginTop: 24 }}><strong>ยอดชำระรวม</strong><strong>{money(invoice.amountSatang)}</strong></div><p className="yu-formNote">ยอดเฉลี่ยต่อเดือน {(invoice.amountSatang / 100 / invoice.billingMonths).toFixed(2)} บาท · ยอดที่ต้องชำระเป็นยอดรวมต่อรอบด้านบน</p>{invoice.note && <p>หมายเหตุ: {invoice.note}</p>}<p className="yu-muted">การออกใบแจ้งหนี้ยังไม่ถือว่าได้รับเงิน รายการจะลงสมุดบัญชีหลังยืนยันการรับเงินจริง</p></article></main>;
}
