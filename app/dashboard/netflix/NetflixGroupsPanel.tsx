"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, Pencil, Plus, Search, Trash2, UsersRound, WalletCards, X } from "lucide-react";
import "./netflix.css";

type Profile = { id?: string; position?: number; name: string; contactEmail: string | null; phone: string | null };
type Group = { id: string; name: string; accountEmail: string | null; plan: string; monthlySatang: number | null; startedOn: string | null; billingDay: number | null; renewalDate: string | null; profiles: Profile[] };
type DraftProfile = { profileId?: string; name: string; contactEmail: string; phone: string };
type DraftGroup = { name: string; accountEmail: string; plan: string; monthlyPrice: string; startedOn: string; billingDay: string; renewalDate: string; profiles: DraftProfile[] };
type Payment = { id: string; profileId: string | null; groupId: string | null; groupName: string; profileName: string; billingMonth: string; amountSatang: number; paidOn: string };
type Invoice = { id: string; sourceKey: string; groupId: string | null; groupName: string | null; profileId: string | null; profileName: string | null; amountSatang: number; transactionOn: string; reference: string | null; status: string };
const emptyProfile = (): DraftProfile => ({ name: "", contactEmail: "", phone: "" });
const emptyGroup = (): DraftGroup => ({ name: "", accountEmail: "", plan: "Premium", monthlyPrice: "", startedOn: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }), billingDay: "1", renewalDate: "", profiles: [] });
const money = (satang: number | null) => satang === null ? "—" : `฿${(satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function InvoiceDialog({ group, profile, month, invoice, mode, onClose, onIssue, onConfirm }: { group: Group; profile: Profile; month: string; invoice?: Invoice; mode: "issue" | "confirm"; onClose: () => void; onIssue: (profile: Profile, month: string, amountBaht: string) => Promise<void>; onConfirm: (invoice: Invoice, paidOn: string) => Promise<void> }) {
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSaving(true);
    try { if (mode === "issue") await onIssue(profile, month, amount); else if (invoice) await onConfirm(invoice, paidOn); } catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกรายการไม่สำเร็จ"); } finally { setSaving(false); }
  }
  const [year, monthNumber] = month.split("-").map(Number);
  const scheduledDate = `${month}-${String(Math.min(group.billingDay ?? 1, new Date(Date.UTC(year, monthNumber, 0)).getUTCDate())).padStart(2, "0")}`;
  const dueDate = group.startedOn?.slice(0, 7) === month && group.startedOn > scheduledDate ? group.startedOn : scheduledDate;
  return <div className="nf-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className="nf-dialog nf-payment-dialog" role="dialog" aria-modal="true" aria-labelledby="nf-payment-title">
      <header className="nf-dialog-header"><div><span className="nf-dialog-icon"><WalletCards size={18} /></span><div><h2 id="nf-payment-title">{mode === "issue" ? "ออกใบแจ้งหนี้สมาชิก" : "ยืนยันรับเงินจริง"}</h2><p>{group.name} · {profile.name} · {month}</p></div></div><button type="button" aria-label="ปิด" disabled={saving} onClick={onClose}><X size={19} /></button></header>
      <form onSubmit={submit}><div className="nf-payment-fields">{mode === "issue" ? <><label className="nf-field">ยอดเรียกเก็บ (บาท)<input type="number" min="0.01" max="1000000" step="0.01" required autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="เช่น 100" /></label><label className="nf-field">วันครบกำหนดชำระ<input type="date" readOnly value={dueDate} /><small>กำหนดตามวันชำระของกลุ่ม</small></label></> : <><div className="nf-field"><span>ยอดตามใบแจ้งหนี้</span><strong>{money(invoice?.amountSatang ?? 0)} · {invoice?.reference ?? ""}</strong></div><label className="nf-field">วันที่รับเงินจริง<input type="date" required value={paidOn} onChange={(event) => setPaidOn(event.target.value)} /></label></>}</div>{error && <p className="nf-error" role="alert">{error}</p>}<footer className="nf-dialog-footer"><button className="nf-cancel" type="button" disabled={saving} onClick={onClose}>ยกเลิก</button><button className="nf-primary" type="submit" disabled={saving}>{saving ? "กำลังบันทึก..." : mode === "issue" ? "ออกใบแจ้งหนี้" : "ยืนยันรับเงินจริง"}</button></footer></form>
    </section>
  </div>;
}

function ProfileDialog({ group, onClose, onSave }: { group: Group; onClose: () => void; onSave: (group: Group, profile: DraftProfile) => Promise<void> }) {
  const [profile, setProfile] = useState<DraftProfile>(emptyProfile);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSaving(true);
    try { await onSave(group, profile); } catch (cause) { setError(cause instanceof Error ? cause.message : "สร้างโปรไฟล์ไม่สำเร็จ"); } finally { setSaving(false); }
  }
  return <div className="nf-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className="nf-dialog nf-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="nf-profile-dialog-title">
      <header className="nf-dialog-header"><div><span className="nf-dialog-icon"><UsersRound size={18} /></span><div><h2 id="nf-profile-dialog-title">สร้างโปรไฟล์สมาชิก</h2><p>{group.name} · โปรไฟล์ที่ {group.profiles.length + 1} จาก 5</p></div></div><button type="button" aria-label="ปิด" disabled={saving} onClick={onClose}><X size={19} /></button></header>
      <form onSubmit={submit}><div className="nf-profile-create-fields">
        <label className="nf-field">ชื่อสมาชิก<input required maxLength={100} autoFocus value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} placeholder="ชื่อที่ใช้เรียก" /></label>
        <label className="nf-field">อีเมลติดต่อ<input type="email" maxLength={254} value={profile.contactEmail} onChange={(event) => setProfile((current) => ({ ...current, contactEmail: event.target.value }))} placeholder="อีเมล (ถ้ามี)" /></label>
        <label className="nf-field">เบอร์โทร<input type="tel" maxLength={40} value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} placeholder="เบอร์โทร (ถ้ามี)" /></label>
      </div>{error && <p className="nf-error" role="alert">{error}</p>}<footer className="nf-dialog-footer"><button className="nf-cancel" type="button" disabled={saving} onClick={onClose}>ยกเลิก</button><button className="nf-primary" type="submit" disabled={saving}>{saving ? "กำลังสร้าง..." : "สร้างโปรไฟล์"}</button></footer></form>
    </section>
  </div>;
}

function GroupDialog({ group, onClose, onSave }: { group: Group | null; onClose: () => void; onSave: (draft: DraftGroup) => Promise<void> }) {
  const [draft, setDraft] = useState<DraftGroup>(() => group ? {
    name: group.name, accountEmail: group.accountEmail ?? "", plan: group.plan,
    monthlyPrice: group.monthlySatang === null ? "" : String(group.monthlySatang / 100), startedOn: group.startedOn ?? "", billingDay: group.billingDay ? String(group.billingDay) : "1", renewalDate: group.renewalDate ?? "",
    profiles: group.profiles.map(({ id, name, contactEmail, phone }) => ({ profileId: id, name, contactEmail: contactEmail ?? "", phone: phone ?? "" })),
  } : emptyGroup());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const setField = (key: keyof Omit<DraftGroup, "profiles">, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSaving(true);
    try { await onSave(draft); } catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกไม่สำเร็จ"); } finally { setSaving(false); }
  }
  return <div className="nf-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className="nf-dialog" role="dialog" aria-modal="true" aria-labelledby="nf-dialog-title">
      <header className="nf-dialog-header"><div><span className="nf-dialog-icon"><Clapperboard size={18} /></span><div><h2 id="nf-dialog-title">{group ? "แก้ไขกลุ่ม Netflix" : "สร้างกลุ่ม Netflix"}</h2><p>หนึ่งกลุ่มกำหนดสมาชิกได้ไม่เกิน 5 โปรไฟล์</p></div></div><button type="button" aria-label="ปิด" disabled={saving} onClick={onClose}><X size={19} /></button></header>
      <form onSubmit={submit}>
        <div className="nf-form-grid">
          <label className="nf-field">ชื่อกลุ่ม<input required maxLength={100} autoFocus value={draft.name} onChange={(event) => setField("name", event.target.value)} placeholder="เช่น ครอบครัวเรา" /></label>
          <label className="nf-field">แพ็กเกจ<input maxLength={50} value={draft.plan} onChange={(event) => setField("plan", event.target.value)} placeholder="Premium" /></label>
          <label className="nf-field">อีเมลบัญชี<input type="email" maxLength={254} value={draft.accountEmail} onChange={(event) => setField("accountEmail", event.target.value)} placeholder="บัญชี Netflix" /></label>
          <label className="nf-field">ราคาต่อเดือน (บาท)<input type="number" min="0" max="1000000" step="0.01" value={draft.monthlyPrice} onChange={(event) => setField("monthlyPrice", event.target.value)} placeholder="เช่น 419" /></label>
          <label className="nf-field">วันที่เริ่มกลุ่ม<input type="date" required value={draft.startedOn} onChange={(event) => setField("startedOn", event.target.value)} /></label>
          <label className="nf-field">วันตัดชำระประจำเดือน<input type="number" min="1" max="31" required value={draft.billingDay} onChange={(event) => setField("billingDay", event.target.value)} placeholder="1–31" /><small>เดือนที่ไม่มีวันดังกล่าว จะใช้วันสุดท้ายของเดือน</small></label>
          <label className="nf-field">วันต่ออายุ<input type="date" value={draft.renewalDate} onChange={(event) => setField("renewalDate", event.target.value)} /></label>
        </div>
        <div className="nf-profiles-heading"><div><strong>โปรไฟล์สมาชิก</strong><span>บันทึกช่องทางติดต่อแยกตามคน</span></div><button type="button" className="nf-add-profile" disabled={draft.profiles.length >= 5} onClick={() => setDraft((current) => ({ ...current, profiles: [...current.profiles, emptyProfile()] }))}><Plus size={15} /> เพิ่มโปรไฟล์ <b>{draft.profiles.length}/5</b></button></div>
        {draft.profiles.length ? <div className="nf-profile-list">{draft.profiles.map((profile, index) => <fieldset className="nf-profile-row" key={index}><legend>โปรไฟล์ {index + 1}</legend><label className="nf-field">ชื่อสมาชิก<input required maxLength={100} value={profile.name} onChange={(event) => setDraft((current) => ({ ...current, profiles: current.profiles.map((item, i) => i === index ? { ...item, name: event.target.value } : item) }))} placeholder="ชื่อที่ใช้เรียก" /></label><label className="nf-field">อีเมลติดต่อ<input type="email" maxLength={254} value={profile.contactEmail} onChange={(event) => setDraft((current) => ({ ...current, profiles: current.profiles.map((item, i) => i === index ? { ...item, contactEmail: event.target.value } : item) }))} placeholder="อีเมล (ถ้ามี)" /></label><label className="nf-field">เบอร์โทร<input type="tel" maxLength={40} value={profile.phone} onChange={(event) => setDraft((current) => ({ ...current, profiles: current.profiles.map((item, i) => i === index ? { ...item, phone: event.target.value } : item) }))} placeholder="เบอร์โทร (ถ้ามี)" /></label><button type="button" className="nf-remove-profile" aria-label={`ลบโปรไฟล์ ${index + 1}`} onClick={() => setDraft((current) => ({ ...current, profiles: current.profiles.filter((_, i) => i !== index) }))}><Trash2 size={15} /></button></fieldset>)}</div> : <p className="nf-no-profile">ยังไม่มีโปรไฟล์ เพิ่มสมาชิกได้สูงสุด 5 คน</p>}
        {error && <p className="nf-error" role="alert">{error}</p>}
        <footer className="nf-dialog-footer"><button className="nf-cancel" type="button" disabled={saving} onClick={onClose}>ยกเลิก</button><button className="nf-primary" type="submit" disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกกลุ่ม"}</button></footer>
      </form>
    </section>
  </div>;
}

export default function NetflixGroupsPanel({ groups, initialPayments, initialInvoices, initialMonth, lifetimeIncome, lifetimeIncomeByGroup }: { groups: Group[]; initialPayments: Payment[]; initialInvoices: Invoice[]; initialMonth: string; lifetimeIncome: number; lifetimeIncomeByGroup: Record<string, number> }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Group | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profileGroup, setProfileGroup] = useState<Group | null>(null);
  const [invoiceTarget, setInvoiceTarget] = useState<{ group: Group; profile: Profile; mode: "issue" | "confirm" } | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [payments, setPayments] = useState(initialPayments);
  const [invoices, setInvoices] = useState(initialInvoices);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [message, setMessage] = useState("");
  const filtered = useMemo(() => { const term = query.trim().toLocaleLowerCase("th"); return groups.filter((group) => [group.name, group.accountEmail ?? "", group.plan, ...group.profiles.flatMap((profile) => [profile.name, profile.contactEmail ?? "", profile.phone ?? ""])].join(" ").toLocaleLowerCase("th").includes(term)); }, [groups, query]);
  async function save(draft: DraftGroup) {
    const response = await fetch(editing ? `/api/netflix/groups/${editing.id}` : "/api/netflix/groups", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || "บันทึกกลุ่มไม่สำเร็จ");
    setDialogOpen(false); setEditing(null); router.refresh();
  }
  async function createProfile(group: Group, profile: DraftProfile) {
    const response = await fetch(`/api/netflix/groups/${group.id}/profiles`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || "สร้างโปรไฟล์ไม่สำเร็จ");
    setProfileGroup(null); router.refresh();
  }
  async function changeMonth(month: string) {
    setSelectedMonth(month); setLoadingPayments(true); setMessage("");
    try {
      const response = await fetch(`/api/netflix/payments?month=${encodeURIComponent(month)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "โหลดสถานะรับเงินไม่สำเร็จ");
      setPayments(result.payments as Payment[]);
      setInvoices(result.invoices as Invoice[]);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "โหลดสถานะรับเงินไม่สำเร็จ"); }
    finally { setLoadingPayments(false); }
  }
  async function issueInvoice(profile: Profile, month: string, amountBaht: string) {
    if (!profile.id) throw new Error("ไม่พบโปรไฟล์สมาชิก");
    const response = await fetch("/api/netflix/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId: profile.id, billingMonth: month, amountBaht }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || "ออกใบแจ้งหนี้ไม่สำเร็จ");
    setInvoices((current) => [...current.filter((entry) => entry.sourceKey !== result.invoice.sourceKey), result.invoice as Invoice]);
    setInvoiceTarget(null);
  }
  async function confirmInvoice(invoice: Invoice, paidOn: string) {
    const response = await fetch("/api/netflix/invoices", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoiceId: invoice.id, paidOn }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || "ยืนยันรับเงินจริงไม่สำเร็จ");
    setPayments((current) => [...current.filter((entry) => !(entry.profileId === result.payment.profileId && entry.billingMonth === result.payment.billingMonth)), result.payment as Payment]);
    setInvoices((current) => current.map((entry) => entry.id === invoice.id ? result.invoice as Invoice : entry));
    setInvoiceTarget(null);
  }
  async function remove(group: Group) {
    if (!window.confirm(`ลบกลุ่ม “${group.name}” และโปรไฟล์สมาชิก ${group.profiles.length} รายการ?`)) return;
    const response = await fetch(`/api/netflix/groups/${group.id}`, { method: "DELETE" }); const result = await response.json();
    if (!response.ok) { setMessage(result.error || "ลบกลุ่มไม่สำเร็จ"); return; }
    setMessage(""); router.refresh();
  }
  const peopleCount = groups.reduce((sum, group) => sum + group.profiles.length, 0);
  const receivedIds = new Set(payments.flatMap((payment) => payment.profileId ? [payment.profileId] : []));
  const receivedAmount = payments.reduce((sum, payment) => sum + payment.amountSatang, 0);
  const outstandingCount = Math.max(0, peopleCount - receivedIds.size);
  return <main className="nf-page">
    <header className="nf-page-header"><div><div className="nf-breadcrumb">ระบบสมาชิก <span>/</span> Netflix</div><div className="nf-title-row"><span className="nf-title-icon"><Clapperboard size={22} /></span><div><h1>จัดการสมาชิก Netflix</h1><p>จัดกลุ่มบัญชีและดูแลสมาชิกในแต่ละโปรไฟล์</p></div></div></div><button type="button" className="nf-primary" onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus size={16} /> สร้างกลุ่ม</button></header>
    <section className="nf-metrics"><article><span className="nf-metric-icon"><Clapperboard size={18} /></span><small>กลุ่มทั้งหมด</small><strong>{groups.length}<i> กลุ่ม</i></strong></article><article><span className="nf-metric-icon nf-icon-green"><WalletCards size={18} /></span><small>รับเงินแล้ว · {selectedMonth}</small><strong>{money(receivedAmount)}</strong></article><article><span className="nf-metric-icon nf-icon-green"><WalletCards size={18} /></span><small>รายรับสะสมทั้งหมด</small><strong>{money(lifetimeIncome)}</strong></article><article><span className="nf-metric-icon nf-icon-light"><UsersRound size={18} /></span><small>รับแล้ว / ยังไม่รับ</small><strong>{receivedIds.size}<i> / {outstandingCount} คน</i></strong></article><article><span className="nf-metric-icon nf-icon-light"><UsersRound size={18} /></span><small>สมาชิกทั้งหมด</small><strong>{peopleCount}<i> โปรไฟล์</i></strong></article></section>
    <section className="nf-panel"><div className="nf-panel-header"><div><h2>กลุ่มสมาชิกและยอดรับเงิน</h2><p>บันทึกยอดที่สมาชิกจ่ายในแต่ละเดือน · กลุ่มละไม่เกิน 5 โปรไฟล์</p></div><div className="nf-toolbar"><label className="nf-month">เดือนที่ดู<input type="month" value={selectedMonth} onChange={(event) => { if (event.target.value) void changeMonth(event.target.value); }} /></label><label className="nf-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหากลุ่มหรือสมาชิก" /></label></div></div>
      {message && <p className="nf-error" role="alert">{message}</p>}
      {loadingPayments && <p className="nf-loading-payments" role="status">กำลังโหลดสถานะรับเงิน…</p>}
      <div className="nf-group-grid">{filtered.map((group) => <article className="nf-group-card" key={group.id}>
        <header className="nf-card-top"><div className="nf-card-brand">N</div><div className="nf-card-title"><h3>{group.name}</h3><span>{group.plan} {group.accountEmail ? `· ${group.accountEmail}` : "· ไม่ระบุอีเมลบัญชี"}</span></div><div className="nf-card-actions"><button type="button" aria-label={`แก้ไข ${group.name}`} onClick={() => { setEditing(group); setDialogOpen(true); }}><Pencil size={15} /></button><button type="button" aria-label={`ลบ ${group.name}`} onClick={() => void remove(group)}><Trash2 size={15} /></button></div></header>
        <div className="nf-card-stats"><span>สมาชิก <b>{group.profiles.length} / 5</b></span><span>เริ่มกลุ่ม <b>{group.startedOn || "ยังไม่ระบุ"}</b></span><span>วันตัดชำระ <b>{group.billingDay ? `ทุกวันที่ ${group.billingDay} ของเดือน` : "ยังไม่ระบุ"}</b></span><span>รายรับสะสม <b>{money(lifetimeIncomeByGroup[group.id] ?? 0)}</b></span></div>
        <div className="nf-capacity" aria-label={`ใช้แล้ว ${group.profiles.length} จาก 5 โปรไฟล์`}><span style={{ width: `${group.profiles.length * 20}%` }} /></div>
        <div className="nf-member-list">{group.profiles.map((profile, index) => { const payment = payments.find((entry) => entry.profileId === profile.id && entry.billingMonth === selectedMonth); const invoice = invoices.find((entry) => entry.profileId === profile.id && entry.sourceKey.endsWith(`:${selectedMonth}`)); const isPaid = Boolean(payment || invoice?.status === "PAID"); return <div className="nf-member" key={profile.id ?? `${group.id}-${index}`}><span className="nf-avatar">{profile.name.slice(0, 1)}</span><div><strong>{profile.name}</strong><small>{profile.contactEmail || profile.phone || "ไม่มีข้อมูลติดต่อ"}{invoice && invoice.status !== "PAID" ? ` · ครบกำหนด ${invoice.transactionOn}` : ""}</small></div><span className="nf-profile-number">โปรไฟล์ {index + 1}</span><button type="button" className={isPaid ? "nf-paid-button" : "nf-unpaid-button"} onClick={() => { if (!isPaid) setInvoiceTarget({ group, profile, mode: invoice ? "confirm" : "issue" }); }}>{isPaid ? <><b>รับแล้ว</b><small>{money(payment?.amountSatang ?? invoice?.amountSatang ?? 0)}</small></> : invoice ? "ยืนยันรับเงินจริง" : "ออกใบแจ้งหนี้"}</button></div>; })}{!group.profiles.length && <div className="nf-empty-members">ยังไม่มีสมาชิกในกลุ่มนี้</div>}</div>
        <button type="button" className="nf-add-link" disabled={group.profiles.length >= 5} onClick={() => setProfileGroup(group)}><Plus size={15} />{group.profiles.length >= 5 ? "ครบ 5 โปรไฟล์แล้ว" : "สร้างโปรไฟล์"}</button>
      </article>)}{!filtered.length && <div className="nf-empty-state"><UsersRound size={25} /><strong>{groups.length ? "ไม่พบกลุ่มที่ค้นหา" : "ยังไม่มีกลุ่ม Netflix"}</strong><span>{groups.length ? "ลองค้นหาด้วยชื่อกลุ่มหรือสมาชิก" : "สร้างกลุ่มแรกแล้วเพิ่มสมาชิกได้สูงสุด 5 โปรไฟล์"}</span>{!groups.length && <button type="button" className="nf-primary" onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus size={15} /> สร้างกลุ่ม</button>}</div>}</div>
      <footer className="nf-footer">แสดง {filtered.length} จาก {groups.length} กลุ่ม <span>รับเงินแล้ว {receivedIds.size} คน · ยอดรวม {money(receivedAmount)}</span></footer>
    </section>
    {dialogOpen && <GroupDialog key={editing?.id ?? "new"} group={editing} onClose={() => setDialogOpen(false)} onSave={save} />}
    {profileGroup && <ProfileDialog key={profileGroup.id} group={profileGroup} onClose={() => setProfileGroup(null)} onSave={createProfile} />}
    {invoiceTarget && <InvoiceDialog key={`${invoiceTarget.mode}-${invoiceTarget.profile.id}-${selectedMonth}`} group={invoiceTarget.group} profile={invoiceTarget.profile} month={selectedMonth} mode={invoiceTarget.mode} invoice={invoices.find((entry) => entry.profileId === invoiceTarget.profile.id && entry.sourceKey.endsWith(`:${selectedMonth}`))} onClose={() => setInvoiceTarget(null)} onIssue={issueInvoice} onConfirm={confirmInvoice} />}
  </main>;
}
