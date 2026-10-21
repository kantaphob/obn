"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { formatBillingDate } from "@/lib/youtube-billing";
import { cashbookTotals, youtubePaymentMethods, type GroupCharge } from "@/lib/youtube-cashbook";
import "../billing.css";
import "./cashbook.css";
import "../workspace.css";

type Entry = { updatedAt: Date | string; voidedAt: Date | string | null; id: string; source: string; sourceKey: string; type: string; groupId: string | null; groupName: string | null; title: string; party: string | null; amountSatang: number; transactionOn: string; dueDate: string | null; paymentMethod: string; reference: string | null; note: string | null };
type Payable = { id: string; updatedAt: Date | string; source: string; sourceKey: string; groupId: string | null; groupName: string | null; title: string; party: string | null; amountSatang: number; dueDate: string | null; note: string | null; status: string };
type Group = { id: string; name: string };
const money = (satang: number) => `฿${(satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const sourceLabels: Record<string, string> = { MEMBER_PAYMENT: "รับจากสมาชิก", GROUP_PAYMENT: "จ่ายประจำกลุ่ม", PAYABLE_PAYMENT: "จ่ายหนี้ที่อนุมัติแล้ว", MANUAL: "บันทึกเอง", OPENING: "ยอดรับยกมา", REVERSAL: "รายการกลับบัญชี", REVERSAL_OPENING: "กลับบัญชียอดยกมา" };
type FormState = { charge: GroupCharge | null; entry: Entry | null; requestKey: string; payableOnly?: boolean };

function EntryDialog({ state, today, groups, onClose, onSaved }: { state: FormState; today: string; groups: Group[]; onClose: () => void; onSaved: (isPayable: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState(state.entry?.type ?? "EXPENSE");
  const [payableOnly, setPayableOnly] = useState(Boolean(state.payableOnly || state.charge));
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed || saving) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget).entries());
    setSaving(true); setError("");
    try {
      const isPayable = !state.entry && (state.charge || payableOnly);
      const endpoint = state.entry ? `/api/youtube/ledger/${state.entry.id}` : isPayable ? "/api/youtube/ledger/payables" : "/api/youtube/ledger";
      const payload = { ...fields, version: state.entry ? new Date(state.entry.updatedAt).toISOString() : undefined, source: state.charge ? "GROUP_PAYMENT" : state.entry?.source ?? "MANUAL", type, requestKey: state.requestKey, confirmed, ...(state.charge ? { groupId: state.charge.groupId, dueDate: state.charge.dueDate, expectedAmountSatang: state.charge.amountSatang } : {}) };
      const response = await fetch(endpoint, { method: state.entry ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "บันทึกไม่สำเร็จ");
      onSaved(Boolean(isPayable));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { setSaving(false); }
  }
  return <dialog className="yb-dialog yc-dialog" ref={dialog} aria-labelledby="yc-entry-title" onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}><form onSubmit={submit}>
    <h2 id="yc-entry-title">{state.charge ? "สร้างหนี้ค่ากลุ่มเพื่อรออนุมัติ" : state.entry ? "แก้ไขรายการรับ–จ่าย" : payableOnly ? "สร้างหนี้รายจ่ายเพื่อรออนุมัติ" : "บันทึกรายรับ–รายจ่าย"}</h2>
    {state.charge ? <p>{state.charge.groupName} · กำหนดจ่าย {formatBillingDate(state.charge.dueDate)}<br />ครอบคลุมใช้งานถึง {formatBillingDate(state.charge.coveredThrough)}</p> : state.entry?.source === "GROUP_PAYMENT" ? <p>รายการจ่ายประจำกลุ่ม · แก้ไขรายละเอียดรายการเงินจริงได้</p> : state.entry?.source === "MEMBER_PAYMENT" ? <p>รายการรับจากสมาชิก · การแก้ไขจะอัปเดตประวัติการรับเงินของสมาชิกด้วย</p> : state.entry?.source === "OPENING" ? <p>ยอดรับยกมาของกลุ่ม · แก้ไขหรือลบที่นี่จะอัปเดตยอดยกมาในข้อมูลกลุ่มด้วย</p> : <><label>ประเภท<select name="type" value={type} onChange={(event) => { setType(event.target.value); if (event.target.value === "INCOME") setPayableOnly(false); }}><option value="INCOME">รายรับ</option><option value="EXPENSE">รายจ่าย</option></select></label><label>รายการ<input name="title" required maxLength={200} placeholder="เช่น ค่าอุปกรณ์ / รายรับอื่น" defaultValue={state.entry?.title ?? ""} /></label><label>กลุ่ม<select name="groupId" defaultValue={state.entry?.groupId ?? ""}><option value="">รายการทั่วไปของบริษัท</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><label>รับจาก / จ่ายให้<input name="party" maxLength={150} defaultValue={state.entry?.party ?? ""} /></label>{!state.entry && type === "EXPENSE" && <label className="yc-confirm"><input type="checkbox" checked={payableOnly} onChange={(event) => setPayableOnly(event.target.checked)} />สร้างเป็นหนี้และรออนุมัติก่อนจ่าย</label>}</>}
    <div className="yc-formGrid"><label>{payableOnly ? "ยอดหนี้ (บาท)" : "ยอดเงินจริง (บาท)"}<input name="amountBaht" type="number" required min="0.01" max="10000000" step="0.01" defaultValue={state.charge ? (state.charge.amountSatang / 100).toFixed(2) : state.entry ? (state.entry.amountSatang / 100).toFixed(2) : ""} /></label><label>{payableOnly ? "วันครบกำหนด" : "วันที่รับ / จ่ายจริง"}<input name={payableOnly ? "dueDate" : "transactionOn"} type="date" required min="2000-01-01" max={payableOnly ? undefined : today} defaultValue={state.charge?.dueDate ?? state.entry?.transactionOn ?? today} /></label></div>
    {state.charge && <p className="yb-note">ยอดตามกำหนด {money(state.charge.amountSatang)} · บันทึกเป็นหนี้ก่อน แล้วจึงอนุมัติและยืนยันจ่ายเงินจริง</p>}
    {!payableOnly && <><label>ช่องทางชำระ<select name="paymentMethod" defaultValue={state.entry?.paymentMethod ?? "BANK_TRANSFER"}>{Object.entries(youtubePaymentMethods).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>เลขอ้างอิง<input name="reference" maxLength={120} defaultValue={state.entry?.reference ?? ""} /></label></>}
    <label>หมายเหตุ<textarea name="note" maxLength={500} rows={2} defaultValue={state.entry?.note ?? ""} /></label>
    <label className="yc-confirm"><input type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />{payableOnly ? "ยืนยันว่ารายการนี้เป็นหนี้ที่ต้องขออนุมัติก่อนจ่าย" : `ยืนยันว่าได้${type === "EXPENSE" ? "ชำระ" : "รับ"}เงินจริงและตรวจสอบยอดแล้ว`}</label>
    {error && <p role="alert" className="yb-error">{error}</p>}
    <footer><button type="button" disabled={saving} onClick={onClose}>ยกเลิก</button><button className="yb-primary" disabled={saving || !confirmed}>{saving ? "กำลังบันทึก…" : state.entry ? "ยืนยันการแก้ไข" : payableOnly ? "สร้างหนี้รออนุมัติ" : "ยืนยันและลงบัญชี"}</button></footer>
  </form></dialog>;
}

function PayDialog({ payable, today, onClose, onSaved }: { payable: Payable; today: string; onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget).entries());
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/youtube/ledger/payables/${payable.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fields, action: "pay", version: new Date(payable.updatedAt).toISOString() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "บันทึกการจ่ายไม่สำเร็จ");
      onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { setSaving(false); }
  }
  return <dialog className="yb-dialog yc-dialog" ref={dialog} onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}><form onSubmit={submit}>
    <h2>ยืนยันจ่ายหนี้ที่อนุมัติแล้ว</h2><p>{payable.title} · {payable.groupName || payable.party || "รายการทั่วไป"}</p><p className="yb-note">ยอดจ่าย {money(payable.amountSatang)} · เมื่อยืนยันแล้วจะลงเป็นรายจ่ายจริงในสมุดบัญชี</p>
    <label>วันที่จ่ายจริง<input name="transactionOn" type="date" required min="2000-01-01" max={today} defaultValue={today} /></label>
    <label>ช่องทางชำระ<select name="paymentMethod" defaultValue="BANK_TRANSFER">{Object.entries(youtubePaymentMethods).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    <label>เลขอ้างอิง<input name="reference" maxLength={120} /></label>
    {error && <p role="alert" className="yb-error">{error}</p>}
    <footer><button type="button" disabled={saving} onClick={onClose}>ยกเลิก</button><button className="yb-primary" disabled={saving}>{saving ? "กำลังบันทึก…" : "ยืนยันจ่ายเงินจริง"}</button></footer>
  </form></dialog>;
}

export default function Cashbook({ today, groups, entries, charges, payables, canWrite, initialView = "records" }: { today: string; groups: Group[]; entries: Entry[]; charges: GroupCharge[]; payables: Payable[]; canWrite: boolean; initialView?: "records" | "payments" | "approvals" }) {
  const router = useRouter();
  const [view, setView] = useState<"records" | "payments" | "approvals">(initialView);
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [groupId, setGroupId] = useState("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(100);
  const [form, setForm] = useState<FormState | null>(null);
  const [paying, setPaying] = useState<Payable | null>(null);
  const [message, setMessage] = useState("");
  const selectedEntries = entries.filter((entry) => !groupId || entry.groupId === groupId);
  const allTotals = cashbookTotals(selectedEntries);
  const periodEntries = selectedEntries.filter((entry) => (!from || entry.transactionOn >= from) && (!to || entry.transactionOn <= to));
  const filtered = periodEntries.filter((entry) => [entry.title, entry.groupName, entry.party, entry.reference, entry.note].join(" ").toLocaleLowerCase("th").includes(query.trim().toLocaleLowerCase("th")));
  const totals = cashbookTotals(periodEntries);
  const periodNet = totals.income - totals.expense;
  const pending = charges.filter((charge) => !groupId || charge.groupId === groupId);
  const pendingAmount = pending.reduce((sum, charge) => sum + charge.amountSatang, 0);
  const selectedPayables = payables.filter((payable) => !groupId || payable.groupId === groupId);
  const awaitingApproval = selectedPayables.filter((payable) => payable.status === "PENDING_APPROVAL");
  const approvedPayables = selectedPayables.filter((payable) => payable.status === "APPROVED");
  async function payableAction(payable: Payable, action: "approve" | "reject") {
    if (action === "reject" && !window.confirm(`ไม่อนุมัติหนี้ “${payable.title}” จำนวน ${money(payable.amountSatang)} ใช่หรือไม่?`)) return;
    const response = await fetch(`/api/youtube/ledger/payables/${payable.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, version: new Date(payable.updatedAt).toISOString() }) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error || "ดำเนินการไม่สำเร็จ"); return; }
    setMessage(action === "approve" ? "อนุมัติหนี้แล้ว · พร้อมทำรายการจ่าย" : "ไม่อนุมัติหนี้แล้ว");
    router.refresh();
  }
  function open(charge: GroupCharge | null) { setMessage(""); setForm({ charge, entry: null, requestKey: crypto.randomUUID() }); }
  function edit(entry: Entry) { setMessage(""); setForm({ charge: null, entry, requestKey: crypto.randomUUID() }); }
  async function remove(entry: Entry) {
    if (!window.confirm(`ยกเลิกและกลับบัญชี “${entry.title}” จำนวน ${money(entry.amountSatang)} หรือไม่?${entry.source === "MEMBER_PAYMENT" ? " รายการเดิมจะยังคงอยู่ และรอบชำระล่าสุดจะกลับเป็นยังไม่รับเงิน" : ""}`)) return;
    setMessage("");
    const response = await fetch(`/api/youtube/ledger/${entry.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: new Date(entry.updatedAt).toISOString() }) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error || "ยกเลิกรายการไม่สำเร็จ"); return; }
    setMessage("ยกเลิกพร้อมสร้างรายการกลับบัญชีแล้ว");
    router.refresh();
  }
  return <main className="yc-page yu-shell">
    <p className="yu-eyebrow">YOUTUBE WORKSPACE / บัญชี</p><header className="yu-heading"><div><h1>สมุดบัญชีรับ–จ่าย</h1><p>รายการเงินจริงของบริษัท และการจ่ายค่าแพ็กเกจให้ YouTube</p></div><div className="yu-actions"><button type="button" className="yu-button" onClick={() => router.refresh()}><RefreshCw size={15} />อัปเดต</button><Link className="yu-button" href="/dashboard/youtube/ledger?view=central">รับ–จ่ายกลาง</Link><button className="yu-button yu-primary" type="button" disabled={!canWrite} onClick={() => open(null)}><Plus size={15} />เพิ่มรายการบัญชี YouTube</button></div></header>
    <div className="yc-filters"><label>รายการเงินจริงตั้งแต่<input type="date" min="2000-01-01" max={to || today} value={from} onChange={(event) => { setFrom(event.target.value); setLimit(100); }} /></label><label>ถึง<input type="date" min={from || "2000-01-01"} max={today} value={to} onChange={(event) => { setTo(event.target.value); setLimit(100); }} /></label><label>กลุ่ม<select value={groupId} onChange={(event) => { setGroupId(event.target.value); setLimit(100); }}><option value="">ทุกกลุ่มและรายการทั่วไป</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><label>ค้นหารายการ<input value={query} onChange={(event) => { setQuery(event.target.value); setLimit(100); }} placeholder="ชื่อรายการ / คู่รับจ่าย / อ้างอิง" /></label></div>
    <section className="yu-stats" aria-label="ยอดบัญชี"><div className="yu-stat"><span>รายรับจริงในช่วงที่เลือก</span><strong>{money(totals.income)}</strong><small>ไม่รวมยอดยกมา</small></div><div className="yu-stat"><span>รายจ่ายจริงในช่วงที่เลือก</span><strong>{money(totals.expense)}</strong><small>เฉพาะรายการยืนยันแล้ว</small></div><div className="yu-stat"><span>สุทธิช่วงที่เลือก</span><strong>{money(periodNet)}</strong><small>รายรับจริง − รายจ่ายจริง · {from} ถึง {to}</small></div><div className="yu-stat yu-warm"><span>หนี้รออนุมัติและรอจ่าย</span><strong>{money([...awaitingApproval, ...approvedPayables].reduce((sum, payable) => sum + payable.amountSatang, 0) + pendingAmount)}</strong><small>{awaitingApproval.length + approvedPayables.length + pending.length} รายการ · ยังไม่ลงเป็นรายจ่ายจริง</small></div></section>
    <section className="yc-balanceBreakdown" aria-label="ยอดเงินสะสม"><div><span>ยอดยกมา</span><strong>{money(allTotals.opening)}</strong></div><div><span>รับสะสม</span><strong>{money(allTotals.income)}</strong></div><div><span>จ่ายสะสม</span><strong>{money(allTotals.expense)}</strong></div><div><span>คงเหลือสะสม</span><strong>{money(allTotals.opening + allTotals.net)}</strong></div><p>ยอดสะสมคิดทุกรายการเงินจริงของ {groupId ? "กลุ่มที่เลือก" : "ทุกกลุ่มและรายการทั่วไป"} ไม่จำกัดช่วงวันที่ · สูตร: ยอดยกมา + รับสะสม − จ่ายสะสม</p></section>
    {message && <p className="yb-success" role="status">{message}</p>}
    <section className="yu-card"><div className="yu-toolbar"><div className="yu-tabs" role="group" aria-label="สมุดบัญชีและรายการจ่าย"><button type="button" id="yc-record-tab" aria-pressed={view === "records"} aria-controls="yc-record-panel" onClick={() => setView("records")}>รายการรับ–จ่ายจริง</button><button type="button" id="yc-payment-tab" aria-pressed={view === "payments"} aria-controls="yc-payment-panel" onClick={() => setView("payments")}>รอบค่าแพ็กเกจ ({pending.length})</button><button type="button" id="yc-approval-tab" aria-pressed={view === "approvals"} aria-controls="yc-approval-panel" onClick={() => setView("approvals")}>อนุมัติและจ่าย ({awaitingApproval.length + approvedPayables.length})</button></div><div className="yu-actions"><Link className="yu-button" href="/dashboard/youtube/reports">รายงานรับล่วงหน้า</Link><Link className="yu-button" href="/dashboard/youtube/collections">รับเงินสมาชิก →</Link></div></div>
    {view === "approvals" ? <div role="region" id="yc-approval-panel" aria-labelledby="yc-approval-tab"><p className="yu-formNote">หนี้จากค่าแพ็กเกจหรือรายจ่ายที่เลือกให้รออนุมัติ จะแสดงที่นี่ อนุมัติก่อน แล้วบันทึกจ่ายจริงเพื่อเข้ารายจ่ายในสมุดบัญชี</p><h2>รออนุมัติ ({awaitingApproval.length})</h2><div className="yu-tableWrap"><table className="yu-table"><thead><tr><th>รายการ / ผู้รับเงิน</th><th>กลุ่ม</th><th>ครบกำหนด</th><th>ยอดหนี้</th><th>จัดการ</th></tr></thead><tbody>{awaitingApproval.slice(0, limit).map((payable) => <tr key={payable.id}><td><strong>{payable.title}</strong><small>{payable.party || "—"}</small>{payable.note && <small>{payable.note}</small>}</td><td>{payable.groupName || "รายการทั่วไป"}</td><td>{payable.dueDate ? formatBillingDate(payable.dueDate) : "—"}</td><td><strong>{money(payable.amountSatang)}</strong></td><td><div className="yc-rowActions"><button type="button" disabled={!canWrite} onClick={() => void payableAction(payable, "approve")}>อนุมัติ</button><button type="button" className="yc-delete" disabled={!canWrite} onClick={() => void payableAction(payable, "reject")}>ไม่อนุมัติ</button></div></td></tr>)}</tbody></table></div>{!awaitingApproval.length && <p className="yu-empty">ไม่มีหนี้รออนุมัติ</p>}<h2>อนุมัติแล้ว · รอจ่าย ({approvedPayables.length})</h2><div className="yu-tableWrap"><table className="yu-table"><thead><tr><th>รายการ</th><th>กลุ่ม / ผู้รับเงิน</th><th>ครบกำหนด</th><th>ยอดหนี้</th><th>จัดการ</th></tr></thead><tbody>{approvedPayables.slice(0, limit).map((payable) => <tr key={payable.id}><td><strong>{payable.title}</strong></td><td>{payable.groupName || payable.party || "รายการทั่วไป"}</td><td>{payable.dueDate ? formatBillingDate(payable.dueDate) : "—"}</td><td><strong>{money(payable.amountSatang)}</strong></td><td><button type="button" className="yu-button yu-primary" disabled={!canWrite} onClick={() => setPaying(payable)}>บันทึกจ่ายเงินจริง</button></td></tr>)}</tbody></table></div>{!approvedPayables.length && <p className="yu-empty">ไม่มีหนี้ที่อนุมัติแล้วและรอจ่าย</p>}</div> : view === "payments" ? <div role="region" id="yc-payment-panel" aria-labelledby="yc-payment-tab"><p className="yu-formNote">รอบค่าแพ็กเกจที่ถึงกำหนดแล้ว กดสร้างหนี้เพื่อส่งอนุมัติก่อนจ่าย</p><div className="yu-tableWrap"><table className="yu-table"><thead><tr><th>กลุ่ม</th><th>กำหนดจ่าย</th><th>ครอบคลุมใช้งานถึง</th><th>ยอดตามรอบ</th><th>ดำเนินการ</th></tr></thead><tbody>{pending.slice(0, limit).map((charge) => <tr key={charge.sourceKey}><td data-label="กลุ่ม"><strong>{charge.groupName}</strong></td><td data-label="กำหนดจ่าย">{formatBillingDate(charge.dueDate)}</td><td data-label="ครอบคลุมใช้งานถึง">{formatBillingDate(charge.coveredThrough)}</td><td data-label="ยอดตามรอบ"><strong>{money(charge.amountSatang)}</strong></td><td data-label="ดำเนินการ"><button type="button" className="yu-button yu-primary" disabled={!canWrite} onClick={() => open(charge)}>สร้างหนี้รออนุมัติ</button></td></tr>)}</tbody></table></div>{!pending.length && <div className="yu-empty"><strong>ไม่มีรอบค่าแพ็กเกจรอสร้างหนี้</strong><p>ระบบใช้วันเริ่มกลุ่ม วันตัด และค่าแพ็กเกจที่ตั้งไว้ในหน้ากลุ่ม</p><Link className="yu-button" href="/dashboard/youtube/group">ดูการตั้งค่ากลุ่ม</Link></div>}</div> : <div role="region" id="yc-record-panel" aria-labelledby="yc-record-tab"><div className="yu-tableWrap"><table className="yu-table yc-ledgerTable"><thead><tr><th>วันที่เงินจริง</th><th>รายการ / กลุ่ม</th><th>รับ</th><th>จ่าย</th><th>ช่องทาง / อ้างอิง</th><th>จัดการ</th></tr></thead><tbody>{filtered.slice(0, limit).map((entry) => <tr key={entry.id}><td data-label="วันที่เงินจริง">{formatBillingDate(entry.transactionOn)}</td><td data-label="รายการ / กลุ่ม"><strong>{entry.title}{entry.voidedAt ? " · ยกเลิกแล้ว" : ""}</strong><small>{entry.groupName || "รายการทั่วไป"} · {entry.party || sourceLabels[entry.source]}</small><small>{sourceLabels[entry.source]}{entry.dueDate ? ` · รอบ ${formatBillingDate(entry.dueDate)}` : ""}</small>{entry.note && <small className="yc-note">{entry.note}</small>}</td><td data-label="รับ" className="yc-income">{entry.type === "INCOME" ? money(entry.amountSatang) : "—"}</td><td data-label="จ่าย" className="yc-expense">{entry.type === "EXPENSE" ? money(entry.amountSatang) : "—"}</td><td data-label="ช่องทาง / อ้างอิง">{youtubePaymentMethods[entry.paymentMethod] || entry.paymentMethod}<small>{entry.reference || "—"}</small></td><td data-label="จัดการ"><div className="yc-rowActions"><button type="button" disabled={!canWrite || Boolean(entry.voidedAt) || entry.source.startsWith("REVERSAL")} onClick={() => edit(entry)} aria-label={`แก้ไข ${entry.title}`}><Pencil size={15} />แก้ไข</button><button type="button" className="yc-delete" disabled={!canWrite || Boolean(entry.voidedAt) || entry.source.startsWith("REVERSAL")} onClick={() => void remove(entry)} aria-label={`ยกเลิก ${entry.title}`} title="ยกเลิกพร้อมกลับบัญชี"><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>{!filtered.length && <div className="yu-empty"><strong>ยังไม่มีรายการเงินจริงในช่วงนี้</strong><p>รับเงินจากสมาชิก หรือบันทึกจ่ายหนี้ที่อนุมัติแล้ว แล้วรายการจะแสดงที่นี่</p></div>}<p className="yu-muted" style={{ marginTop: 15 }}>แสดง {Math.min(limit, filtered.length)} จาก {filtered.length} รายการ · ยอดยกมาแสดงในรายการ แต่ไม่นับเป็นรายรับใหม่</p><details className="yu-advanced"><summary>ดูยอดสะสมทั้งหมดของกลุ่มที่เลือก</summary><div className="yu-actions"><span>รับจริง {money(allTotals.income)}</span><span>จ่ายจริง {money(allTotals.expense)}</span><span>ยอดยกมา {money(allTotals.opening)}</span></div></details></div>}
    </section>
    {((view === "records" && filtered.length > limit) || (view === "payments" && pending.length > limit) || (view === "approvals" && selectedPayables.length > limit)) && <button type="button" className="yu-button" style={{ marginTop: 16 }} onClick={() => setLimit((current) => current + 100)}>แสดงเพิ่มอีก 100 รายการ</button>}
    {form && <EntryDialog key={form.requestKey} state={form} groups={groups} today={today} onClose={() => setForm(null)} onSaved={(isPayable) => { setForm(null); setMessage(form.entry ? "แก้ไขรายการบัญชีแล้ว" : isPayable ? "สร้างหนี้รออนุมัติแล้ว" : "บันทึกเงินจริงลงสมุดบัญชีแล้ว"); router.refresh(); }} />}
    {paying && <PayDialog payable={paying} today={today} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); setMessage("จ่ายเงินจริงและลงรายการในสมุดบัญชีแล้ว"); router.refresh(); }} />}
  </main>;
}
