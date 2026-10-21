"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Settings2, X, Check } from "lucide-react";
import { allocateRemainingMonthlyPrice, cyclePriceBaht, formatBillingDate, groupBillingDate, isBillingDate, memberDueFromStart } from "@/lib/youtube-billing";
import "./workspace.css";

export type MemberOption = { value: string; memberId: string; accountId: string; name: string; email: string; billingMonths: number | null; priceSatang: number | null };
export type GroupSeat = { id: string; position: number; memberId: string | null; accountId: string | null; displayName: string | null; email: string | null; billingMonths: number | null; priceSatang: number | null; nextDueDate: string | null; billingAnchorDay: number | null; updatedAt: Date | string; paymentStatus: string };
export type BillingGroup = { updatedAt?: Date | string; startedOn: string | null; openingReceivedSatang: number; monthlyPriceSatang: number | null; id: string; importKey: string; name: string; dueDay: number | null; status: string; seats: GroupSeat[] };
export type GroupInput = { scope?: "details" | "account" | "pricing"; seatPosition?: number; version?: string; name: string; dueDay: number; startedOn: string; openingReceivedBaht: string; monthlyPriceBaht: string; accounts: { memberId: string; accountId: string; email: string; cycleMonths: number; priceBaht: string; nextDueDate: string; version: string }[] };
type Entry = { optionValue: string; memberId: string; accountId: string; email: string; cycleMonths: number; monthlyPriceBaht: string; priceBaht: string; nextDueDate: string; version: string; mode: "auto" | "fixed" | "free" };
const steps = ["ข้อมูลกลุ่ม", "สมาชิกและราคา", "ตรวจสอบและบันทึก"];
const money = (baht: number) => `฿${baht.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function GroupForm({ group, memberOptions, today, onClose, onSave, section, seatIndex }: { section?: "details" | "accounts" | "create"; seatIndex?: number; group?: BillingGroup; memberOptions: MemberOption[]; today: string; onClose: () => void; onSave: (input: GroupInput) => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(section === "accounts" ? 1 : 0);
  const [name, setName] = useState(group?.name || "");
  const [price, setPrice] = useState(group?.monthlyPriceSatang == null ? "" : (group.monthlyPriceSatang / 100).toFixed(2));
  const [day, setDay] = useState(group?.dueDay || 1);
  const [start, setStart] = useState(group?.startedOn || "");
  const [opening, setOpening] = useState(((group?.openingReceivedSatang || 0) / 100).toFixed(2));
  const [expanded, setExpanded] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [entries, setEntries] = useState<Entry[]>(() => Array.from({ length: 6 }, (_, index) => {
    const seat = group?.seats.find((entry) => entry.position === index + 1);
    const option = memberOptions.find((entry) => entry.accountId && entry.accountId === seat?.accountId)
      ?? memberOptions.find((entry) => !entry.accountId && entry.memberId === seat?.memberId);
    const months = seat?.billingMonths || 1;
    return { optionValue: option?.value || "", memberId: option?.memberId || seat?.memberId || "", accountId: option?.accountId || seat?.accountId || "", email: seat?.email || "", cycleMonths: months,
      monthlyPriceBaht: seat?.priceSatang == null ? "" : (seat.priceSatang / 100 / months).toFixed(2),
      priceBaht: seat?.priceSatang == null ? "" : (seat.priceSatang / 100).toFixed(2), nextDueDate: seat?.nextDueDate || "",
      version: seat ? new Date(seat.updatedAt).toISOString() : "", mode: seat?.priceSatang === 0 ? "free" : seat?.priceSatang != null ? "fixed" : "auto" };
  }));
  useEffect(() => { dialog.current?.showModal(); }, []);
  const allocated = allocateRemainingMonthlyPrice(entries.map((entry) => ({ ...entry, paymentExempt: entry.mode === "free", remainingShare: entry.mode === "auto", monthlyPriceBaht: entry.mode === "free" ? "0.00" : entry.monthlyPriceBaht, priceBaht: entry.mode === "free" ? "0.00" : entry.priceBaht })), price);
  const selected = allocated.filter((entry) => entry.memberId);
  const paying = selected.filter((entry) => entry.mode !== "free");
  const monthlyTotal = selected.reduce((total, entry) => total + (Number(entry.priceBaht) || 0) / entry.cycleMonths, 0);
  const difference = Math.round((monthlyTotal - (Number(price) || 0)) * 100) / 100;
  const people = Array.from(new Set(selected.map((entry) => entry.memberId))).map((id) => {
    const accounts = selected.filter((entry) => entry.memberId === id);
    return { id, name: memberOptions.find((entry) => entry.memberId === id)?.name || "สมาชิก", count: accounts.length, monthly: accounts.reduce((sum, entry) => sum + (Number(entry.priceBaht) || 0) / entry.cycleMonths, 0) };
  });
  function change(index: number, values: Partial<Entry>) { setEntries((current) => current.map((entry, slot) => slot === index ? { ...entry, ...values } : entry)); }
  function due(entry: Entry) { return entry.memberId && entry.mode !== "free" ? groupBillingDate(entry.nextDueDate || memberDueFromStart(start || null, today, day, entry.cycleMonths), day) : ""; }
  function validate(target: number) {
    if (target >= 1) {
      if (!name.trim() || name.trim().length > 100 || !Number.isFinite(Number(price)) || Number(price) < .01 || Number(price) > 1000000 || !Number.isInteger(day) || day < 1 || day > 31 || (start && !isBillingDate(start)) || !Number.isFinite(Number(opening)) || Number(opening) < 0 || Number(opening) > 100000000) {
        setError("กรอกชื่อกลุ่ม ค่าแพ็กเกจ วันจ่าย และข้อมูลวันที่ให้ถูกต้อง"); setStep(0); return false;
      }
    }
    if (target >= 2) {
      if (!entries[0].memberId) { setError("เลือกสมาชิกในช่องแรกก่อน"); setStep(1); return false; }
      if (selected.some((entry) => !Number.isFinite(Number(entry.priceBaht)) || entry.priceBaht === "" || Number(entry.priceBaht) < 0 || Number(entry.priceBaht) > 1000000 || ![1, 3, 5].includes(entry.cycleMonths) || (entry.mode !== "free" && !isBillingDate(due(entry))))) { setError("ตรวจราคาและวันเรียกเก็บของบัญชีที่เลือกให้ครบ"); setStep(1); return false; }
      const emails = selected.map((entry) => entry.email.trim().toLocaleLowerCase("en")).filter(Boolean);
      if (new Set(emails).size !== emails.length) { setError("อีเมลเดียวกันเลือกได้เพียงหนึ่งช่องในกลุ่ม"); setStep(1); return false; }
    }
    setError(""); return true;
  }
  function go(target: number) { if (target < step || validate(target)) { setStep(target); setError(""); } }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!section && step < 2) { go(step + 1); return; }
    if (saving || !validate(section === "details" ? 1 : 2)) return;
    setSaving(true);
    try {
      await onSave({ ...(group && section ? { scope: section === "details" ? "details" as const : seatIndex !== undefined ? "account" as const : "pricing" as const, seatPosition: seatIndex === undefined ? undefined : seatIndex + 1, version: group.updatedAt ? new Date(group.updatedAt).toISOString() : undefined } : {}), name: name.trim(), dueDay: day, startedOn: start, openingReceivedBaht: opening, monthlyPriceBaht: price,
        accounts: allocated.map((entry) => ({ memberId: entry.memberId, accountId: entry.accountId, email: entry.email.trim(), cycleMonths: entry.cycleMonths, priceBaht: entry.priceBaht, nextDueDate: due(entry), version: entry.version })) });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { setSaving(false); }
  }
  return <dialog ref={dialog} className="yu-groupDialog" aria-labelledby="yu-group-title" onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}>
    <header className="yu-dialogHeader"><div><h2 id="yu-group-title">{group ? `จัดการกลุ่ม ${group.name}` : "สร้างกลุ่ม YouTube"}</h2><p>ตั้งค่ากลุ่มและบัญชีสมาชิก · รับเงินสมาชิกได้จากหน้าเรียกเก็บ</p></div><button type="button" className="yu-close" aria-label="ปิดหน้าต่าง" disabled={saving} onClick={onClose}><X size={18} /></button></header>
    {!section && <nav className="yu-steps" aria-label="ขั้นตอนตั้งค่ากลุ่ม">{steps.map((label, index) => <button type="button" key={label} aria-current={step === index ? "step" : undefined} disabled={saving} onClick={() => go(index)}><span>{index + 1}</span>{label}</button>)}</nav>}
    <form onSubmit={submit} noValidate>
      <div className="yu-dialogBody">
        {step === 1 && seatIndex === undefined && <div className="yu-actions" style={{ marginBottom: 16 }}><button type="button" className="yu-button" disabled={!entries[0].memberId} aria-pressed={entries[0].mode === "free"} title="เปลี่ยนการยกเว้นบัญชีหลัก พร้อมเฉลี่ยราคาให้บัญชีร่วมจ่ายใหม่" onClick={() => setEntries((current) => current.map((entry, index) => index === 0 ? { ...entry, mode: entry.mode === "free" ? "auto" : "free", monthlyPriceBaht: "", priceBaht: "" } : entry.mode === "free" ? entry : { ...entry, mode: "auto", monthlyPriceBaht: "", priceBaht: "" }))}>{entries[0].mode === "free" ? "ให้บัญชีหลักร่วมจ่าย" : "ยกเว้นบัญชีหลัก"}</button><span className="yu-muted">เปลี่ยนการยกเว้นแล้วระบบจะเฉลี่ยราคาบัญชีร่วมจ่ายใหม่</span></div>}
        {(step === 0 || section === "create") && <><div className="yu-formGrid"><label className="yu-field yu-wide">ชื่อกลุ่ม<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="เช่น บ้านเรา / กลุ่ม 01" autoFocus /></label><label className="yu-field">ค่าแพ็กเกจทั้งกลุ่ม / เดือน (บาท)<input type="number" min="0.01" max="1000000" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="399" /><small>ยอดที่บริษัทจ่ายให้ YouTube ต่อเดือน</small></label><label className="yu-field">วันจ่ายให้ YouTube ทุกเดือน<input type="number" min={1} max={31} value={day} onChange={(event) => setDay(Number(event.target.value))} /><small>เช่น วันที่ 3 ของทุกเดือน</small></label><label className="yu-field yu-wide">วันเริ่มกลุ่ม<input type="date" min="2000-01-01" max="2199-12-31" value={start} onChange={(event) => setStart(event.target.value)} /><small>ใช้สร้างกำหนดจ่ายแบบชำระล่วงหน้า ตั้งแต่วันตัดครั้งแรกที่ถึงวันเริ่ม</small></label></div><details className="yu-advanced"><summary>ข้อมูลรับเงินก่อนเริ่มใช้ระบบ</summary><div><label className="yu-field">ยอดรับจากสมาชิกเดิมที่ยังไม่มีในประวัติ (บาท)<input type="number" min="0" max="100000000" step="0.01" value={opening} onChange={(event) => setOpening(event.target.value)} /><small>กรอกเฉพาะยอดที่เคยรับแล้ว ระบบจะแยกเป็นยอดยกมา</small></label></div></details></>}
        {(step === 1 || section === "create") && <><div className="yu-allocationStats"><div><span>ค่าแพ็กเกจ / เดือน</span><strong>{money(Number(price) || 0)}</strong></div><div><span>เก็บจากสมาชิก / เดือน</span><strong>{money(monthlyTotal)}</strong></div><div><span>{difference >= 0 ? "ส่วนต่างเพิ่ม / เดือน" : "ยังขาด / เดือน"}</span><strong>{money(Math.abs(difference))}</strong></div></div><div className="yu-toolbar"><p className="yu-muted">{selected.length}/6 บัญชี · {people.length} คน · {paying.length} บัญชีร่วมจ่าย</p><button type="button" className="yu-button" disabled={!paying.length || seatIndex !== undefined} onClick={() => setEntries((current) => current.map((entry) => entry.mode === "free" ? entry : { ...entry, mode: "auto", monthlyPriceBaht: "", priceBaht: "" }))}>เฉลี่ยราคาใหม่</button></div><div className="yu-accountRows">{entries.map((entry, index) => {
          const computed = allocated[index]; const isOpen = expanded === index;
          if (seatIndex !== undefined && seatIndex !== index) return null;
          return <div key={index} className="yu-accountRow">
            <span title={index === 0 ? "บัญชีหลัก" : `บัญชีรอง ${index}`}>{index === 0 ? "หลัก" : index}</span>
            <label className="yu-field">สมาชิก<select value={entry.optionValue} onChange={(event) => { const option = memberOptions.find((item) => item.value === event.target.value); change(index, { optionValue: option?.value || "", memberId: option?.memberId || "", accountId: "", email: "", nextDueDate: "" }); }}><option value="">{index === 0 ? "เลือกสมาชิกหลัก" : "ว่าง · ยังไม่มีสมาชิก"}</option>{memberOptions.map((option) => <option key={option.value} value={option.value}>{option.name}</option>)}</select></label>
            <label className="yu-field">อีเมลบัญชี YouTube (ถ้ามี)<input type="email" maxLength={254} disabled={!entry.memberId} value={entry.email} placeholder="บัญชีที่ใช้กับช่องนี้" onChange={(event) => change(index, { email: event.target.value, accountId: "" })} /></label>
            <label className="yu-field">เก็บเงินทุก<select disabled={!entry.memberId || entry.mode === "free"} value={entry.cycleMonths} onChange={(event) => change(index, { cycleMonths: Number(event.target.value), priceBaht: cyclePriceBaht(entry.monthlyPriceBaht, Number(event.target.value)) })}>{[1, 3, 5].map((months) => <option key={months} value={months}>{months} เดือน</option>)}</select></label>
            <label className="yu-field">บาท / เดือน<input type="number" min="0" step="0.01" max={1000000 / entry.cycleMonths} disabled={!entry.memberId || entry.mode !== "fixed"} value={computed.monthlyPriceBaht} onChange={(event) => change(index, { monthlyPriceBaht: event.target.value, priceBaht: cyclePriceBaht(event.target.value, entry.cycleMonths) })} /></label>
            <div className="yu-roundPrice"><strong>{entry.memberId ? money(Number(computed.priceBaht) || 0) : "—"}</strong><small>{entry.mode === "free" && entry.memberId ? "ยกเว้นชำระ" : `เรียกเก็บ / ${entry.cycleMonths} เดือน`}</small></div>
            <button type="button" className="yu-close" aria-label={`ตั้งค่าช่องที่ ${index + 1}`} aria-expanded={isOpen} disabled={!entry.memberId} onClick={() => setExpanded(isOpen ? null : index)}><Settings2 size={16} /></button>
            {isOpen && <div className="yu-accountAdvanced"><label className="yu-field">วิธีคิดราคา<select value={entry.mode} onChange={(event) => { const mode = event.target.value as Entry["mode"]; change(index, { mode, monthlyPriceBaht: mode === "fixed" ? computed.monthlyPriceBaht : mode === "free" ? "0.00" : "", priceBaht: mode === "fixed" ? computed.priceBaht : "" }); }}><option value="auto">รับส่วนที่เหลืออัตโนมัติ</option><option value="fixed">กำหนดราคาบัญชีนี้เอง</option><option value="free">ยกเว้น · ไม่ร่วมจ่าย</option></select><small>ยอดเฉลี่ยปัดขึ้นเป็นบาทเต็ม บัญชียกเว้นไม่ถูกนำมาหาร</small></label><label className="yu-field">วันเรียกเก็บครั้งถัดไป<input type="date" min="2000-01-01" max="2199-12-31" disabled={entry.mode === "free"} value={due(computed)} onChange={(event) => change(index, { nextDueDate: event.target.value })} /><small><button type="button" className="yu-button" disabled={entry.mode === "free"} onClick={() => change(index, { nextDueDate: "" })}>ใช้วันที่อัตโนมัติ</button></small></label></div>}
          </div>;
        })}</div><p className="yu-formNote">เลือกชื่อสมาชิกได้โดยไม่ต้องผูกอีเมล · คนเดิมเพิ่มได้หลายช่องหรือหลายกลุ่ม · อีเมลบัญชีใช้แยกต่อช่องและไม่ใช่อีเมลติดต่อ</p></>}
        {step === 2 && <><div className="yu-allocationStats"><div><span>บริษัทจ่ายค่าแพ็กเกจ / เดือน</span><strong>{money(Number(price))}</strong></div><div><span>สมาชิกจ่ายรวม / เดือน</span><strong>{money(monthlyTotal)}</strong></div><div><span>ส่วนต่าง / เดือน</span><strong>{money(difference)}</strong></div></div><div className="yu-summaryRows"><div className="yu-summaryRow"><strong>{name}</strong><span>จ่ายให้ YouTube ทุกวันที่ {day}</span></div><div className="yu-summaryRow"><span>วันเริ่มกลุ่ม</span><strong>{start ? formatBillingDate(start) : "ยังไม่กำหนด"}</strong></div>{people.map((person) => <div className="yu-summaryRow" key={person.id}><div><strong>{person.name}</strong><small>{person.count} บัญชี</small></div><strong>{money(person.monthly)} / เดือน</strong></div>)}</div><p className="yu-formNote">รอบ 3 หรือ 5 เดือนคูณจากราคาต่อเดือนของแต่ละบัญชี การบันทึกนี้เป็นการตั้งค่ากลุ่ม ยืนยันรับ–จ่ายเงินจริงจากหน้าเรียกเก็บและสมุดบัญชี</p>{!start && <p className="yu-error">ยังไม่ระบุวันเริ่มกลุ่ม ระบบจะยังสร้างกำหนดจ่ายค่าแพ็กเกจย้อนหลังไม่ได้</p>}</>}
        {error && <p className="yu-error" role="alert">{error}</p>}
      </div>
      <footer className="yu-dialogFooter"><small>{section ? "แก้ไขเฉพาะส่วนนี้" : `ขั้นตอน ${step + 1} จาก 3`} · {selected.length}/6 บัญชี</small><div className="yu-actions"><button type="button" className="yu-button" disabled={saving} onClick={() => !section && step ? go(step - 1) : onClose()}>{!section && step ? <><ChevronLeft size={16} />ย้อนกลับ</> : "ยกเลิก"}</button><button type="submit" className="yu-button yu-primary" disabled={saving}>{saving ? "กำลังบันทึก…" : !section && step < 2 ? <>ถัดไป<ChevronRight size={16} /></> : <><Check size={16} />{group ? "บันทึกการเปลี่ยนแปลง" : "สร้างกลุ่ม"}</>}</button></div></footer>
    </form>
  </dialog>;
}
