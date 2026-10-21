"use client";
import ReceiptHistory from "./ReceiptHistory";

import Link from "next/link";
import { Search } from "lucide-react";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatBillingDate, nextBillingDate, unpaidBillingRounds } from "@/lib/youtube-billing";
import "./billing.css";
import "./workspace.css";

type Seat = { position: number; id: string; displayName: string | null; email: string | null; priceSatang: number | null; billingMonths: number | null; nextDueDate: string | null; billingAnchorDay: number | null };
type Group = { status: string; startedOn: string | null; monthlyPriceSatang: number | null; openingReceivedSatang: number; id: string; name: string; dueDay: number | null; seats: Seat[] };
export type PaymentRow = { groupId: string | null; id: string; groupName: string; memberName: string; email: string | null; amountSatang: number; paymentMethod: string; reference: string | null; note: string | null; billingMonths: number; dueDate: string; nextDueDate: string; paidOn: string };
const money = (satang: number) => `฿${(satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const paymentMethods = [{ value: "BANK_TRANSFER", label: "โอนธนาคาร" }, { value: "PROMPTPAY", label: "พร้อมเพย์" }, { value: "CASH", label: "เงินสด" }, { value: "OTHER", label: "อื่น ๆ" }];
type Selection = Seat & { groupName: string; requestKey: string };

function ReceivePayment({ seat, today, onClose, onSaved }: { seat: Selection; today: string; onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [paidOn, setPaidOn] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [confirmedReceived, setConfirmedReceived] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  const next = nextBillingDate(seat.nextDueDate!, seat.billingMonths!, seat.billingAnchorDay);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/youtube/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seatId: seat.id, dueDate: seat.nextDueDate, amountSatang: seat.priceSatang, paidOn, paymentMethod, reference, note, confirmedReceived, requestKey: seat.requestKey }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "บันทึกไม่สำเร็จ");
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally { setSaving(false); }
  }
  return <dialog ref={dialog} className="yb-dialog" onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }} aria-labelledby="yb-payment-title">
    <form onSubmit={submit}>
      <h2 id="yb-payment-title">รับเงินสมาชิก</h2>
      <p>{seat.groupName} · {seat.displayName || seat.email}</p>
      <dl><div><dt>ยอดรับเงิน</dt><dd>{money(seat.priceSatang!)}</dd></div><div><dt>รอบชำระ</dt><dd>{seat.billingMonths} เดือน</dd></div><div><dt>ครบกำหนดรอบนี้</dt><dd>{formatBillingDate(seat.nextDueDate)}</dd></div><div><dt>หลังรับเงิน ครบกำหนดถัดไป</dt><dd>{formatBillingDate(next)}</dd></div></dl>
      <label>วันที่รับเงินจริง<input type="date" required min="2000-01-01" max={today} value={paidOn} onChange={(event) => setPaidOn(event.target.value)} autoFocus /></label>
      <label>ช่องทางรับเงิน<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></label>
      <label>เลขอ้างอิงรายการ (ถ้ามี)<input maxLength={120} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="เช่น เลขที่รายการโอน" /></label>
      <label>หมายเหตุ (ถ้ามี)<textarea maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="รายละเอียดเพิ่มเติม" /></label>
      <p className="yb-note">บันทึกหนึ่งรอบเต็ม หากค้างหลายรอบ ให้บันทึกตามยอดที่รับทีละรอบ</p>
      <label className="yb-confirm"><input type="checkbox" required checked={confirmedReceived} onChange={(event) => setConfirmedReceived(event.target.checked)} />ยืนยันว่าได้ตรวจสอบและได้รับเงินจริงแล้ว</label>
      {error && <p role="alert" className="yb-error">{error}</p>}
      <footer><button type="button" disabled={saving} onClick={onClose}>ยกเลิก</button><button className="yb-primary" disabled={saving || !confirmedReceived}>{saving ? "กำลังบันทึก…" : "ยืนยันรับเงิน"}</button></footer>
    </form>
  </dialog>;
}

export default function BillingCollections({ groups, receiptTotals, today, initialGroupId = "", monthlyReceived, canWrite }: { canWrite: boolean; groups: Group[]; receiptTotals: Record<string, number>; today: string; initialGroupId?: string; monthlyReceived: Record<string, number> }) {
  const router = useRouter();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"collect" | "history" | "future">("collect");
  const [forecastMonth, setForecastMonth] = useState(nextBillingDate(today, 1).slice(0, 7));
  const [groupId, setGroupId] = useState(initialGroupId);
  const [status, setStatus] = useState("due");
  const [query, setQuery] = useState("");
  const seats = groups.filter((group) => group.status !== "ARCHIVED" && (!groupId || group.id === groupId)).flatMap((group) => group.seats.filter((seat) => seat.displayName || seat.email).map((seat) => ({ ...seat, groupName: group.name, billingAnchorDay: group.dueDay || seat.billingAnchorDay })));
  const dueSeats = seats.filter((seat) => seat.priceSatang && seat.nextDueDate && seat.nextDueDate <= today);
  const dueAmount = dueSeats.reduce((sum, seat) => sum + unpaidBillingRounds(seat, today).amountSatang, 0);
  const missing = seats.filter((seat) => seat.priceSatang !== 0 && (!seat.nextDueDate || seat.priceSatang === null)).length;
  const received = groupId ? monthlyReceived[groupId] || 0 : Object.values(monthlyReceived).reduce((sum, amount) => sum + amount, 0);
  const normalizedQuery = query.trim().toLocaleLowerCase("th");
  const allReceived = groupId ? receiptTotals[groupId] || 0 : Object.values(receiptTotals).reduce((sum, amount) => sum + amount, 0);
  const openingReceived = groups.filter((group) => !groupId || group.id === groupId).reduce((sum, group) => sum + group.openingReceivedSatang, 0);
  const forecast = seats.flatMap((seat) => {
    if (!seat.nextDueDate || !seat.priceSatang || !seat.billingMonths || ![1, 3, 5].includes(seat.billingMonths)) return [];
    const rows: (typeof seat & { forecastDate: string })[] = [];
    let date = seat.nextDueDate;
    while (date.slice(0, 7) <= forecastMonth) {
      if (date > today && date.slice(0, 7) === forecastMonth && [seat.displayName, seat.email, seat.groupName].join(" ").toLocaleLowerCase("th").includes(normalizedQuery)) rows.push({ ...seat, forecastDate: date });
      date = nextBillingDate(date, seat.billingMonths, seat.billingAnchorDay);
    }
    return rows;
  }).sort((a, b) => a.forecastDate.localeCompare(b.forecastDate));
  const visible = [...seats].filter((seat) => {
    const matchesQuery = [seat.displayName, seat.email, seat.groupName].join(" ").toLocaleLowerCase("th").includes(normalizedQuery);
    const matchesStatus = status === "all" || (status === "due" && Boolean(seat.priceSatang && seat.nextDueDate && seat.nextDueDate <= today)) || (status === "upcoming" && Boolean(seat.priceSatang && seat.nextDueDate && seat.nextDueDate > today)) || (status === "missing" && seat.priceSatang !== 0 && (!seat.nextDueDate || seat.priceSatang === null)) || (status === "free" && seat.priceSatang === 0);
    return matchesQuery && matchesStatus;
  }).sort((a, b) => (a.nextDueDate || "9999").localeCompare(b.nextDueDate || "9999"));
  function exportForecast() {
    const escape = (value: unknown) => { let text = String(value ?? ""); if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; };
    const rows = [["กำหนดเรียกเก็บ", "กลุ่ม", "สมาชิก", "บัญชี", "จำนวนเดือน", "ยอดบาท"], ...forecast.map((row) => [row.forecastDate, row.groupName, row.displayName || row.email || "", row.position, row.billingMonths, ((row.priceSatang || 0) / 100).toFixed(2)])];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `youtube-forecast-${forecastMonth}.csv`; link.click(); URL.revokeObjectURL(url);
  }
  return <main className="yu-shell"><p className="yu-eyebrow">YOUTUBE WORKSPACE / รับเงิน</p><header className="yu-heading"><div><h1>เรียกเก็บสมาชิก</h1><p>ตรวจรอบที่ถึงกำหนด แล้วบันทึกเมื่อได้รับเงินจริง</p></div><div className="yu-actions"><Link className="yu-button yu-primary" href="/dashboard/youtube/invoices">ใบแจ้งหนี้และกำหนดจ่าย</Link><Link className="yu-button" href="/dashboard/youtube/group">จัดการกลุ่มและราคา</Link></div></header>
    <div className="yu-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}><div className="yu-stat yu-warm"><span>ยอดเรียกเก็บค้างถึงวันนี้</span><strong>{money(dueAmount)}</strong><small>{dueSeats.length} บัญชี · รวมทุกรอบค้าง รับเงินครั้งละ 1 รอบ</small></div><div className="yu-stat"><span>รับเงินจริงเดือนนี้</span><strong>{money(received)}</strong><small>รวมประวัติทุกรายการของเดือนนี้</small></div><div className="yu-stat"><span>บัญชีที่ต้องตั้งค่ารอบชำระ</span><strong>{missing} <small>บัญชี</small></strong><small>ตั้งราคาและวันเรียกเก็บจากหน้ากลุ่ม</small></div></div>
    <div className="yu-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}><div className="yu-stat"><span>รับเงินสมาชิกสะสมถึงวันนี้</span><strong>{money(allReceived)}</strong><small>จากรายการรับเงินทั้งหมด ไม่รวมยอดยกมา</small></div><div className="yu-stat"><span>ยอดรับเดิมยกมา</span><strong>{money(openingReceived)}</strong><small>ไม่มีรายละเอียดแยกตามสมาชิกและรอบ</small></div><div className="yu-stat"><span>รวมรับสะสมและยอดยกมา</span><strong>{money(allReceived + openingReceived)}</strong><small>เฉพาะยอดที่บันทึกไว้ในระบบแล้ว</small></div></div>
    {message && <p className="yb-success" role="status">{message}</p>}
    <section className="yu-card"><div className="yu-toolbar"><div className="yu-tabs" role="group" aria-label="งานรับเงิน"><button type="button" id="yu-collect-tab" aria-pressed={tab === "collect"} aria-controls="yu-collect-panel" onClick={() => setTab("collect")}>รอเรียกเก็บ</button><button type="button" id="yu-history-tab" aria-pressed={tab === "history"} aria-controls="yu-history-panel" onClick={() => setTab("history")}>รับเงินแล้วทั้งหมด</button><button type="button" id="yu-future-tab" aria-pressed={tab === "future"} aria-controls="yu-future-panel" onClick={() => setTab("future")}>เรียกเก็บข้างหน้า</button></div><span className="yu-muted">{formatBillingDate(today)}</span></div>
    <div className="yu-toolbar"><label className="yu-search"><Search size={17} /><input aria-label="ค้นหาสมาชิกหรือรายการรับเงิน" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อสมาชิก อีเมล หรือกลุ่ม" /></label><div className="yu-actions"><select className="yu-filterSelect" style={{ width: "auto" }} aria-label="เลือกกลุ่ม" value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">ทุกกลุ่ม</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}{group.status === "ARCHIVED" ? " (ในคลัง)" : ""}</option>)}</select>{tab === "collect" && <select className="yu-filterSelect" style={{ width: "auto" }} aria-label="สถานะเรียกเก็บ" value={status} onChange={(event) => setStatus(event.target.value)}><option value="due">ถึงกำหนดรับเงิน</option><option value="upcoming">ยังไม่ถึงกำหนด</option><option value="missing">รอตั้งค่า</option><option value="free">ยกเว้นชำระ</option><option value="all">ทุกบัญชี</option></select>}</div></div>
    {tab === "future" && <section id="yu-future-panel" aria-labelledby="yu-future-tab"><div className="yu-toolbar"><label className="yu-field">เดือนที่วางแผนเรียกเก็บ<input type="month" min={today.slice(0, 7)} max={nextBillingDate(today, 24).slice(0, 7)} value={forecastMonth} onChange={(event) => { if (event.target.value >= today.slice(0, 7) && event.target.value <= nextBillingDate(today, 24).slice(0, 7)) setForecastMonth(event.target.value); }} /></label><div className="yu-actions"><strong>รวม {money(forecast.reduce((sum, row) => sum + (row.priceSatang || 0), 0))} · {forecast.length} รอบ</strong><button type="button" className="yu-button" disabled={!forecast.length} onClick={exportForecast}>ส่งออกกำหนดเรียกเก็บ CSV</button></div></div><div className="yu-tableWrap"><table className="yu-table"><thead><tr><th>กำหนดเรียกเก็บ</th><th>สมาชิก / กลุ่ม</th><th>รอบชำระ</th><th>ยอดคาดว่าจะรับ</th></tr></thead><tbody>{forecast.map((row) => <tr key={`${row.id}-${row.forecastDate}`}><td>{formatBillingDate(row.forecastDate)}</td><td><strong>{row.displayName || row.email}</strong><small>{row.groupName} · บัญชีที่ {row.position}</small></td><td>ทุก {row.billingMonths} เดือน</td><td><strong>{money(row.priceSatang || 0)}</strong></td></tr>)}</tbody></table></div>{!forecast.length && <p className="yu-empty">ไม่มีรอบเรียกเก็บในเดือนที่เลือก</p>}<p className="yu-formNote">ประมาณการจากราคาและรอบปัจจุบัน ไม่ใช่ยอดรับเงินจริง บัญชีที่ค้างต้องบันทึกรับรอบเก่าแยกต่างหาก</p></section>}
    {tab === "collect" ? <div role="region" id="yu-collect-panel" aria-labelledby="yu-collect-tab"><div className="yu-tableWrap"><table className="yu-table"><thead><tr><th>สมาชิก / บัญชี</th><th>กลุ่ม</th><th>กำหนดรับเงิน</th><th>ยอดรับต่อรอบ</th><th>ดำเนินการ</th></tr></thead><tbody>{visible.map((seat) => <tr key={seat.id}><td><strong>{seat.displayName || seat.email}</strong><small>{seat.position === 1 ? "บัญชีหลัก" : `บัญชีรอง ${seat.position - 1}`} · {seat.email || "ไม่ระบุอีเมล"}</small></td><td>{seat.groupName}</td><td>{formatBillingDate(seat.nextDueDate)}<small>{seat.priceSatang === 0 ? "ยกเว้นชำระ" : seat.nextDueDate && seat.nextDueDate < today ? "เกินกำหนด" : seat.nextDueDate === today ? "ครบกำหนดวันนี้" : seat.nextDueDate ? "ชำระล่วงหน้าได้" : "รอตั้งค่า"}</small></td><td><strong>{seat.priceSatang === null ? "ยังไม่กำหนด" : money(seat.priceSatang)}</strong><small>{seat.billingMonths ? `ต่อ ${seat.billingMonths} เดือน` : "ยังไม่ระบุรอบ"}</small></td><td><button type="button" className="yu-button yu-primary" disabled={!canWrite || !seat.nextDueDate || !seat.priceSatang || !seat.billingMonths} onClick={() => { setMessage(""); setSelection({ ...seat, requestKey: crypto.randomUUID() }); }}>บันทึกรับเงิน</button></td></tr>)}</tbody></table></div>{!visible.length && <div className="yu-empty"><strong>{status === "due" ? "ไม่มีบัญชีถึงกำหนดในตัวกรองนี้" : "ไม่พบบัญชีที่ตรงกับตัวกรอง"}</strong><p>ดูรอบชำระอื่นได้จากตัวเลือกสถานะ</p><button className="yu-button" type="button" onClick={() => { setStatus("all"); setQuery(""); }}>ดูบัญชีทั้งหมด</button></div>}<p className="yu-muted" style={{ marginTop: 15 }}>ยอดนี้เป็นรอบถัดไปของแต่ละบัญชี หากค้างหลายรอบ ให้รับเงินตามรอบทีละรายการเพื่อเลื่อนกำหนดอย่างถูกต้อง</p></div> : tab === "history" ? <div role="region" id="yu-history-panel" aria-labelledby="yu-history-tab"><ReceiptHistory key={`${groupId}-${normalizedQuery}`} groupId={groupId} query={normalizedQuery} today={today} /></div> : null}
    </section>
    {selection && <ReceivePayment key={selection.requestKey} seat={selection} today={today} onClose={() => setSelection(null)} onSaved={() => { setSelection(null); setMessage("บันทึกรับเงินจริงและลงรายรับในสมุดบัญชีแล้ว"); router.refresh(); }} />}
  </main>;
}
