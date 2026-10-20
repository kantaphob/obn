"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, X } from "lucide-react";

const styles = new Proxy<Record<string, string>>({}, {
  get: (_target, name) => `yt-${String(name)}`,
});

const slotLabels = ["บัญชีหลัก", "บัญชีรอง 1", "บัญชีรอง 2", "บัญชีรอง 3", "บัญชีรอง 4", "บัญชีรอง 5"];
type MemberOption = { value: string; memberId: string; accountId: string; name: string; email: string; billingMonths: number | null; priceSatang: number | null };
type AccountEntry = { optionValue: string; memberId: string; accountId: string; displayName: string; email: string; cycleMonths: number; priceBaht: string };
const emptyAccounts = (): AccountEntry[] => slotLabels.map(() => ({ optionValue: "", memberId: "", accountId: "", displayName: "", email: "", cycleMonths: 1, priceBaht: "" }));

function distributePrice(accounts: AccountEntry[], groupPriceBaht: string) {
  const totalSatang = Math.round(Number(groupPriceBaht) * 100);
  const chosenIndices = accounts.flatMap((account, index) => account.memberId ? [index] : []);
  if (!Number.isFinite(totalSatang) || totalSatang <= 0 || !chosenIndices.length) return accounts;
  const baseSatang = Math.floor(totalSatang / chosenIndices.length);
  const remainder = totalSatang - baseSatang * chosenIndices.length;
  let memberIndex = 0;
  return accounts.map((account) => {
    if (!account.memberId) return account;
    const priceBaht = ((baseSatang + (memberIndex < remainder ? 1 : 0)) / 100).toFixed(2);
    memberIndex += 1;
    return { ...account, priceBaht };
  });
}

export default function CreateGroupButton({ memberOptions }: { memberOptions: MemberOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dueDay, setDueDay] = useState(1);
  const [groupPriceBaht, setGroupPriceBaht] = useState("");
  const [accounts, setAccounts] = useState(emptyAccounts);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedCount = accounts.filter((account) => account.memberId).length;
  const totalBaht = accounts.reduce((total, account) => total + (account.memberId ? (Number(account.priceBaht) || 0) : 0), 0);

  function close() {
    if (saving) return;
    setOpen(false);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/youtube/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, dueDay, accounts }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "บันทึกกลุ่มไม่สำเร็จ");
      setOpen(false);
      setName("");
      setGroupPriceBaht("");
      setAccounts(emptyAccounts());
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "บันทึกกลุ่มไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <button className={styles.primaryButton} type="button" onClick={() => setOpen(true)}><Plus size={17} /> สร้างกลุ่มใหม่</button>
    {open && <div className={styles.createBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className={styles.createDialog} role="dialog" aria-modal="true" aria-labelledby="youtube-create-group-title">
        <header className={styles.createHeader}>
          <div><span className={styles.createIcon}><Plus size={18} /></span><div><h2 id="youtube-create-group-title">สร้างกลุ่ม YouTube</h2><p>กำหนดราคารวมและเลือกสมาชิกได้สูงสุด 6 คน</p></div></div>
          <button type="button" aria-label="ปิดหน้าต่าง" onClick={close}><X size={19} /></button>
        </header>
        <form onSubmit={submit}>
          <div className={styles.createFormGrid}>
            <label className={styles.createField}>ชื่อกลุ่ม<input required maxLength={100} autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="เช่น บ้านเรา · YouTube Premium" /></label>
            <label className={styles.createField}>วันเรียกเก็บในเดือน<input type="number" min={1} max={31} required value={dueDay} onChange={(event) => setDueDay(Number(event.target.value))} /></label>
            <label className={styles.createField}>ราคารวม (บาท)<input type="number" min="0.01" max="1000000" step="0.01" required value={groupPriceBaht} onChange={(event) => {
              const value = event.target.value;
              setGroupPriceBaht(value);
              setAccounts((current) => distributePrice(current, value));
            }} placeholder="เช่น 400" /></label>
          </div>
          <div className={styles.createSectionTitle}><strong>ข้อมูลสมาชิกและรอบชำระ</strong><span>หารราคารวมตามจำนวนที่เลือก ({selectedCount}/6 คน)</span></div>
          <div className={styles.createAccountsGrid}>
            {slotLabels.map((label, index) => <div className={styles.createAccountRow} key={label}>
              <span className={styles.createSlotLabel}>{label}</span>
              <label className={styles.createField}>เลือกสมาชิก<select required={index === 0} value={accounts[index].optionValue} onChange={(event) => {
                const member = memberOptions.find((option) => option.value === event.target.value);
                setAccounts((current) => distributePrice(current.map((account, slot) => slot === index ? {
                  ...account,
                  optionValue: member?.value ?? "",
                  memberId: member?.memberId ?? "",
                  accountId: member?.accountId ?? "",
                  displayName: member?.name ?? "",
                  email: member?.email ?? "",
                  cycleMonths: member?.billingMonths && [1, 3, 5].includes(member.billingMonths) ? member.billingMonths : 1,
                  priceBaht: member?.priceSatang !== null && member?.priceSatang !== undefined ? String(member.priceSatang / 100) : "",
                } : account), groupPriceBaht));
              }}><option value="">เลือกสมาชิก</option>{memberOptions.filter((member) => !accounts.some((account, slot) => slot !== index && account.optionValue === member.value)).map((member) => <option key={member.value} value={member.value}>{member.name} · {member.email || "ไม่ผูกบัญชี YouTube"}</option>)}</select></label>
              <label className={styles.createField}>รอบเก็บ<select value={accounts[index].cycleMonths} onChange={(event) => setAccounts((current) => current.map((account, slot) => slot === index ? { ...account, cycleMonths: Number(event.target.value) } : account))}><option value={1}>ทุก 1 เดือน</option><option value={3}>ทุก 3 เดือน</option><option value={5}>ทุก 5 เดือน</option></select></label>
              <label className={styles.createField}>ราคา (บาท)<input type="number" min="0.01" max="1000000" step="0.01" required={Boolean(accounts[index].memberId)} disabled={!accounts[index].memberId} value={accounts[index].priceBaht} onChange={(event) => setAccounts((current) => current.map((account, slot) => slot === index ? { ...account, priceBaht: event.target.value } : account))} placeholder="เช่น 67" /></label>
            </div>)}
          </div>
          <div className={styles.createTotal}><span>ยอดจ่ายรวมตามราคาที่ตั้ง</span><strong>฿{totalBaht.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><small>รวมราคาเฉพาะสมาชิกที่เลือก</small></div>
          {error && <p className={styles.createError} role="alert">{error}</p>}
          <footer className={styles.createFooter}><button type="button" className={styles.createCancel} onClick={close} disabled={saving}>ยกเลิก</button><button type="submit" className={styles.primaryButton} disabled={saving}><Check size={16} />{saving ? "กำลังบันทึก..." : "บันทึกกลุ่ม"}</button></footer>
        </form>
      </section>
    </div>}
  </>;
}
