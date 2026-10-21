import { youtubeAuditFilters } from "@/lib/youtube-audit-filters";
import { Suspense } from "react";
import { io } from "next/cache";
import Link from "next/link";
import { getYoutubePageAccess, youtubePageDenied } from "@/lib/youtube-access";
import { prisma } from "@/lib/prisma";
import "../workspace.css";
import "./logs.css";

type Search = Promise<{ q?: string; entity?: string; page?: string; from?: string; to?: string; view?: string }>;
const labels: Record<string, string> = { CREATE: "สร้าง", UPDATE: "แก้ไข", DELETE: "ยกเลิก / เก็บเข้าคลัง", RECEIVE: "รับเงิน", PAY: "จ่ายเงิน", INSERT: "เพิ่ม", BASELINE: "ข้อมูลตั้งต้น" };
const types: Record<string, string> = { MEMBER: "สมาชิก", GROUP: "กลุ่ม", PAYMENT: "การชำระ", LEDGER: "บัญชี", SEAT: "สมาชิกในกลุ่ม", CHARGE: "กำหนดจ่ายประจำกลุ่ม", INVOICE: "ใบแจ้งหนี้", PAYABLE: "รายการรอจ่าย" };
const dateTime = (value: Date) => new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(value);

export default function YouTubeActivityPage({ searchParams }: { searchParams: Search }) {
  return <Suspense fallback={<main aria-live="polite" className="yu-shell">กำลังโหลด Log การทำงาน…</main>}><ActivityContent searchParams={searchParams} /></Suspense>;
}

async function ActivityContent({ searchParams }: { searchParams: Search }) {
  await io();
  const { allowed } = await getYoutubePageAccess("/dashboard/youtube/logs");
  if (!allowed) return youtubePageDenied();
  const search = await searchParams;
  const { q, entity, from, to, eventsWhere, historyWhere } = youtubeAuditFilters(search);
  const view = search.view === "changes" ? "changes" : "activity";
  const page = Math.min(100000, Math.max(1, Number.parseInt(search.page || "1", 10) || 1));
  const skip = (page - 1) * 50;
  const [eventCount, historyCount] = await Promise.all([
    prisma.youtubeActivityLog.count({ where: eventsWhere }),
    prisma.youtubeRecordHistory.count({ where: historyWhere }),
  ]);
  const [events, history] = await Promise.all([
    view === "activity" ? prisma.youtubeActivityLog.findMany({ where: eventsWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50, skip }) : Promise.resolve([]),
    view === "changes" ? prisma.youtubeRecordHistory.findMany({ where: historyWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50, skip }) : Promise.resolve([]),
  ]);
  const count = view === "activity" ? eventCount : historyCount;
  const tabHref = (selected: "activity" | "changes") => {
    const params = new URLSearchParams();
    params.set("view", selected);
    if (q) params.set("q", q);
    if (entity) params.set("entity", entity);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/dashboard/youtube/logs?${params.toString()}`;
  };
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams({ view });
    if (q) params.set("q", q);
    if (entity) params.set("entity", entity);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("page", String(nextPage));
    return `?${params.toString()}`;
  };
  return <main className="yu-shell yu-logs">
    <p className="yu-eyebrow">YOUTUBE WORKSPACE / ประวัติ</p>
    <header className="yu-heading"><div><h1>Log การทำงาน</h1><p>เลือกดูรายการกิจกรรม หรือรายละเอียดค่าก่อนและหลังเปลี่ยนแปลง · {count.toLocaleString("th-TH")} รายการในมุมมองนี้</p></div></header>
    <nav className="yu-tabs" aria-label="มุมมองประวัติ"><Link aria-current={view === "activity" ? "page" : undefined} href={tabHref("activity")}>กิจกรรม ({eventCount.toLocaleString("th-TH")})</Link><Link aria-current={view === "changes" ? "page" : undefined} href={tabHref("changes")}>รายละเอียดการเปลี่ยนแปลง ({historyCount.toLocaleString("th-TH")})</Link></nav>
    <form className="yu-card yu-logFilters"><label>ค้นหาประวัติ<input name="q" defaultValue={q} placeholder="ชื่อกลุ่ม สมาชิก หรือรายการ" /></label><label>ประเภทข้อมูล<select name="entity" defaultValue={entity || ""}><option value="">ทุกประเภท</option>{Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>ตั้งแต่<input type="date" name="from" defaultValue={from} /></label><label>ถึง<input type="date" name="to" defaultValue={to} /></label><input type="hidden" name="view" value={view} /><button className="yu-button yu-primary">ค้นหา</button>{view === "activity" && <a className="yu-button" href={`/api/youtube/logs?q=${encodeURIComponent(q)}&entity=${entity || ""}&from=${from}&to=${to}`}>ส่งออกกิจกรรม CSV</a>}</form>
    {view === "activity" ? <section className="yu-card"><div className="yu-tableWrap"><table className="yu-table"><thead><tr><th>วันเวลา</th><th>ผู้ทำรายการ</th><th>การทำงาน</th><th>รายการ</th><th>รายละเอียด</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{dateTime(event.createdAt)}</td><td>{event.actorName}</td><td>{labels[event.action] || event.action} · {types[event.entityType] || event.entityType}</td><td>{event.entityLabel}</td><td>{event.summary}</td></tr>)}</tbody></table></div>{!events.length && <p className="yu-empty">ยังไม่มี Log การทำงานตามตัวกรองนี้</p>}<Pagination page={page} count={eventCount} pageHref={pageHref} /></section> : <section className="yu-card"><h2>ค่าก่อนและหลังเปลี่ยนแปลง</h2><p className="yu-formNote">ข้อมูลตั้งต้นหมายถึงสถานะตอนเริ่มเก็บประวัติ ไม่ใช่ประวัติย้อนหลังที่สร้างขึ้นใหม่</p>{history.map((event) => <details key={event.id} className="yu-historyItem"><summary>{dateTime(event.createdAt)} · {types[event.entityType] || event.entityType} · {labels[event.action] || event.action} · {historyLabel(event.entityType, event.afterJson, event.beforeJson)}</summary><HistoryChange before={event.beforeJson} after={event.afterJson} /></details>)}{!history.length && <p className="yu-empty">ไม่พบรายละเอียดการเปลี่ยนแปลงตามตัวกรองนี้</p>}<Pagination page={page} count={historyCount} pageHref={pageHref} /></section>}
  </main>;
}

function Pagination({ page, count, pageHref }: { page: number; count: number; pageHref: (page: number) => string }) {
  return <div className="yu-logPagination"><span>หน้า {page} · {count.toLocaleString("th-TH")} รายการ</span>{page > 1 && <Link className="yu-button" href={pageHref(page - 1)}>← ก่อนหน้า</Link>}{page * 50 < count && <Link className="yu-button" href={pageHref(page + 1)}>ถัดไป →</Link>}</div>;
}

function snapshot(json: string | null): Record<string, unknown> {
  try { return JSON.parse(json || "{}") as Record<string, unknown>; } catch { return {}; }
}

function historyLabel(entityType: string, after: string | null, before: string | null) {
  const value = { ...snapshot(before), ...snapshot(after) };
  const first = (...keys: string[]) => keys.map((key) => value[key]).find((candidate) => typeof candidate === "string" && candidate.trim()) as string | undefined;
  if (entityType === "MEMBER") return first("name", "displayName") || "สมาชิก";
  if (entityType === "GROUP") return first("name", "groupName") || "กลุ่ม";
  if (entityType === "SEAT") return first("displayName", "memberName", "email", "groupName") || "สมาชิกในกลุ่ม";
  if (entityType === "PAYMENT") return [first("memberName", "displayName"), first("groupName")].filter(Boolean).join(" · ") || "รายการชำระ";
  if (entityType === "CHARGE") return [first("groupName", "name"), first("dueDate")].filter(Boolean).join(" · ") || "กำหนดจ่าย";
  if (entityType === "LEDGER") return [first("title", "name"), first("groupName", "party")].filter(Boolean).join(" · ") || "รายการบัญชี";
  return first("name", "title", "displayName", "groupName") || "รายการ";
}

function HistoryChange({ before, after }: { before: string | null; after: string | null }) {
  const oldValue = snapshot(before);
  const newValue = snapshot(after);
  const fieldLabels: Record<string, string> = { name: "ชื่อ", displayName: "ชื่อสมาชิก", memberId: "สมาชิก", accountId: "บัญชี", priceSatang: "ยอดต่อรอบ (บาท)", monthlyPriceSatang: "ราคาแพ็กเกจ (บาท)", amountSatang: "ยอดเงิน (บาท)", dueDay: "วันประจำกลุ่ม", startedOn: "วันเริ่มกลุ่ม", nextDueDate: "กำหนดถัดไป", billingMonths: "รอบเดือน", email: "อีเมลบัญชี", status: "สถานะ", transactionOn: "วันที่เงินจริง", voidedAt: "ยกเลิกเมื่อ", archivedAt: "เก็บเข้าคลังเมื่อ", paymentMethod: "ช่องทาง", note: "หมายเหตุ", openingReceivedSatang: "ยอดยกมา (บาท)" };
  const keys = [...new Set([...Object.keys(oldValue), ...Object.keys(newValue)])].filter((key) => key in fieldLabels && JSON.stringify(oldValue[key]) !== JSON.stringify(newValue[key]));
  return <div className="yu-tableWrap"><table className="yu-table yu-historyTable"><thead><tr><th>ข้อมูล</th><th>ก่อน</th><th>หลัง</th></tr></thead><tbody>{keys.map((key) => <tr key={key}><td>{fieldLabels[key]}</td><td>{showValue(key, oldValue[key])}</td><td>{showValue(key, newValue[key])}</td></tr>)}</tbody></table>{!keys.length && <p className="yu-muted">ไม่มีการเปลี่ยนค่าที่แสดง หรือเป็นการอัปเดตเวลา/ข้อมูลอ้างอิง</p>}</div>;
}

function showValue(key: string, value: unknown) {
  if (key.endsWith("Satang") && typeof value === "number") return `${(value / 100).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`;
  return String(value ?? "—");
}
