"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Search, Trash2, UsersRound, X } from "lucide-react";
import CreateGroupButton from "../CreateGroupButton";
import "../youtube.css";
import "./group.css";

const styles = new Proxy<Record<string, string>>({}, { get: (_target, name) => `yg-${String(name)}` });
const slotLabels = ["บัญชีหลัก", "บัญชีรอง 1", "บัญชีรอง 2", "บัญชีรอง 3", "บัญชีรอง 4", "บัญชีรอง 5"];
type MemberOption = { value: string; memberId: string; accountId: string; name: string; email: string; billingMonths: number | null; priceSatang: number | null };
type GroupSeat = { id: string; position: number; accountId: string | null; displayName: string | null; email: string | null; billingMonths: number | null; priceSatang: number | null; paymentStatus: string };
type BillingGroup = { id: string; importKey: string; name: string; dueDay: number | null; status: string; seats: GroupSeat[] };
type GroupInput = { name: string; dueDay: number; accounts: { memberId: string; accountId: string; cycleMonths: number; priceBaht: string }[] };

function GroupEditor({ group, memberOptions, onClose, onSave }: {
  group: BillingGroup;
  memberOptions: MemberOption[];
  onClose: () => void;
  onSave: (input: GroupInput) => Promise<void>;
}) {
  const [name, setName] = useState(group.name);
  const [dueDay, setDueDay] = useState(group.dueDay ?? 1);
  const [accounts, setAccounts] = useState(() => slotLabels.map((_, index) => {
    const seat = group.seats.find((entry) => entry.position === index + 1);
    const option = memberOptions.find((entry) => entry.accountId && entry.accountId === seat?.accountId)
      ?? memberOptions.find((entry) => entry.accountId && entry.email.toLocaleLowerCase("en") === seat?.email?.toLocaleLowerCase("en"))
      ?? memberOptions.find((entry) => !entry.accountId && entry.name === seat?.displayName);
    return {
      optionValue: option?.value ?? "",
      memberId: option?.memberId ?? "",
      accountId: option?.accountId ?? "",
      cycleMonths: seat?.billingMonths ?? 1,
      priceBaht: seat?.priceSatang === null || seat?.priceSatang === undefined ? "" : (seat.priceSatang / 100).toFixed(2),
    };
  }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedCount = accounts.filter((account) => account.memberId).length;
  const totalBaht = accounts.reduce((total, account) => total + (account.memberId ? (Number(account.priceBaht) || 0) : 0), 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({ name, dueDay, accounts });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "บันทึกกลุ่มไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="youtube-edit-group-title">
      <header className={styles.header}><div><span className={styles.icon}><UsersRound size={18} /></span><div><h2 id="youtube-edit-group-title">แก้ไขกลุ่มและจัดการสมาชิก</h2><p>เพิ่ม เปลี่ยน หรือนำสมาชิกออกจากกลุ่มได้สูงสุด 6 บัญชี</p></div></div><button type="button" aria-label="ปิด" onClick={onClose} disabled={saving}><X size={18} /></button></header>
      <form onSubmit={submit}>
        <div className={styles.groupFields}>
          <label className={styles.field}>ชื่อกลุ่ม<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className={styles.field}>วันเรียกเก็บในเดือน<input type="number" required min={1} max={31} value={dueDay} onChange={(event) => setDueDay(Number(event.target.value))} /></label>
        </div>
        <div className={styles.totalSummary}><span>ยอดจ่ายรวมตามราคาที่ตั้ง</span><strong>฿{totalBaht.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><small>รวมราคาของสมาชิกที่เลือกใน 6 ช่อง</small></div>
        <div className={styles.sectionHeading}><strong>สมาชิกและรอบชำระ</strong><span>{selectedCount} / 6 บัญชี · ช่องว่างคือสมาชิกที่นำออกแล้ว</span></div>
        <p className={styles.historyNote}>เลือกสมาชิกที่มีบัญชีเพื่อผูกอีเมล หรือเลือก “ไม่ผูกบัญชี YouTube” หากยังไม่ต้องการระบุอีเมล</p>
        <div className={styles.slots}>
          {slotLabels.map((label, index) => <div className={styles.slot} key={label}>
            <span className={styles.slotName}>{label}</span>
            <label className={styles.field}>สมาชิก / บัญชี<select value={accounts[index].optionValue} onChange={(event) => {
              const option = memberOptions.find((member) => member.value === event.target.value);
              setAccounts((current) => current.map((entry, slot) => slot === index ? {
                ...entry,
                optionValue: option?.value ?? "",
                memberId: option?.memberId ?? "",
                accountId: option?.accountId ?? "",
                cycleMonths: option?.billingMonths && [1, 3, 5].includes(option.billingMonths) ? option.billingMonths : entry.cycleMonths,
                priceBaht: entry.priceBaht || (option?.priceSatang ? (option.priceSatang / 100).toFixed(2) : ""),
              } : entry));
            }}><option value="">ว่าง / นำสมาชิกออก</option>{memberOptions.filter((option) => !accounts.some((entry, slot) => slot !== index && entry.optionValue === option.value)).map((option) => <option key={option.value} value={option.value}>{option.name} · {option.email || "ไม่ผูกบัญชี YouTube"}</option>)}</select></label>
            <label className={styles.field}>รอบชำระ<select value={accounts[index].cycleMonths} disabled={!accounts[index].memberId} onChange={(event) => setAccounts((current) => current.map((entry, slot) => slot === index ? { ...entry, cycleMonths: Number(event.target.value) } : entry))}><option value={1}>ทุก 1 เดือน</option><option value={3}>ทุก 3 เดือน</option><option value={5}>ทุก 5 เดือน</option></select></label>
            <label className={styles.field}>ราคา (บาท)<input type="number" min="0.01" max="1000000" step="0.01" required={Boolean(accounts[index].memberId)} disabled={!accounts[index].memberId} value={accounts[index].priceBaht} onChange={(event) => setAccounts((current) => current.map((entry, slot) => slot === index ? { ...entry, priceBaht: event.target.value } : entry))} placeholder="เช่น 67" /></label>
          </div>)}
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <footer className={styles.footer}><button type="button" className={styles.cancel} onClick={onClose} disabled={saving}>ยกเลิก</button><button type="submit" className="yt-primaryButton" disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกกลุ่มและสมาชิก"}</button></footer>
      </form>
    </section>
  </div>;
}

export default function GroupManagementPanel({ groups, memberOptions }: { groups: BillingGroup[]; memberOptions: MemberOption[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editingGroup, setEditingGroup] = useState<BillingGroup | null>(null);
  const [actionError, setActionError] = useState("");
  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th");
    return groups.filter((group) => [group.name, ...group.seats.flatMap((seat) => [seat.displayName ?? "", seat.email ?? ""])].join(" ").toLocaleLowerCase("th").includes(normalized));
  }, [groups, query]);

  async function saveGroup(input: GroupInput) {
    const response = await fetch(`/api/youtube/groups/${editingGroup?.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "บันทึกกลุ่มไม่สำเร็จ");
    setEditingGroup(null);
    router.refresh();
  }

  async function deleteGroup(group: BillingGroup) {
    const confirmed = window.confirm(`ลบกลุ่ม “${group.name}” และสมาชิกในกลุ่มทั้งหมดหรือไม่? ประวัติช่องและข้อมูลชำระของกลุ่มนี้จะถูกลบ`);
    if (!confirmed) return;
    setActionError("");
    const response = await fetch(`/api/youtube/groups/${group.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) {
      setActionError(result.error || "ลบกลุ่มไม่สำเร็จ");
      return;
    }
    router.refresh();
  }

  return <main className={styles.page}>
    <header className={styles.pageHeader}><div><div className={styles.breadcrumb}>YouTube <span>/</span> กลุ่ม</div><div className={styles.titleRow}><span className={styles.titleIcon}><UsersRound size={22} /></span><div><h1>จัดการกลุ่ม YouTube</h1><p>เพิ่ม ลบ แก้ไขกลุ่ม และจัดสมาชิก รอบชำระ กับราคาในแต่ละบัญชี</p></div></div></div><CreateGroupButton memberOptions={memberOptions} /></header>
    <section className={styles.summary}><span>{groups.length} กลุ่ม</span><span>{groups.reduce((count, group) => count + group.seats.filter((seat) => seat.accountId || seat.email).length, 0)} บัญชีสมาชิกในกลุ่ม</span><span>บัญชีละรอบชำระและราคาแยกกันได้</span></section>
    {actionError && <p className={styles.error} role="alert">{actionError}</p>}
    <section className={styles.panel}>
      <div className={styles.panelHeader}><div><h2>กลุ่มทั้งหมด</h2><p>จัดการสมาชิกได้จากปุ่ม “จัดการสมาชิก” ของแต่ละกลุ่ม</p></div></div>
      <label className={styles.search}><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อกลุ่ม สมาชิก หรืออีเมล" /></label>
      <div className={styles.groupList}>
        {filteredGroups.map((group) => {
          const occupied = group.seats.filter((seat) => seat.displayName || seat.email).length;
          const totalSatang = group.seats.reduce((total, seat) => total + ((seat.displayName || seat.email) ? (seat.priceSatang ?? 0) : 0), 0);
          return <article className={styles.groupCard} key={group.id}>
            <div className={styles.groupHead}><div><h3>{group.name}</h3><p>{group.dueDay ? `เรียกเก็บทุกวันที่ ${group.dueDay}` : "ยังไม่กำหนดวันเรียกเก็บ"} · {occupied} / 6 บัญชี</p></div><span className={group.status === "ACTIVE" ? styles.active : styles.pending}>{group.status === "ACTIVE" ? "ใช้งาน" : "ข้อมูลไม่ครบ"}</span></div>
            <div className={styles.groupTotal}><span>ยอดจ่ายรวมตามราคาที่ตั้ง</span><strong>฿{(totalSatang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
            <div className={styles.memberList}>{group.seats.filter((seat) => seat.displayName || seat.email).map((seat) => <div className={styles.memberChip} key={seat.id}><strong>{seat.displayName || `บัญชี ${seat.position}`}</strong><span>{seat.email || "ยังไม่มีอีเมลบัญชี YouTube"}</span><small>{seat.billingMonths ? `ทุก ${seat.billingMonths} เดือน` : "ไม่ระบุรอบ"} · {seat.priceSatang === null ? "ไม่ระบุราคา" : `${(seat.priceSatang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`}</small></div>)}{occupied === 0 && <span className={styles.noMembers}>ยังไม่มีสมาชิกในกลุ่ม</span>}</div>
            <footer className={styles.groupActions}><button type="button" className={styles.editButton} onClick={() => setEditingGroup(group)}><Pencil size={14} />จัดการสมาชิก / แก้ไขกลุ่ม</button><button type="button" className={styles.deleteButton} onClick={() => void deleteGroup(group)}><Trash2 size={14} />ลบกลุ่ม</button></footer>
          </article>;
        })}
        {!filteredGroups.length && <div className={styles.empty}><UsersRound size={25} /><strong>{groups.length ? "ไม่พบกลุ่มที่ค้นหา" : "ยังไม่มีกลุ่ม"}</strong><span>{groups.length ? "ลองค้นหาด้วยชื่อกลุ่มหรือสมาชิกอีกครั้ง" : "กด “สร้างกลุ่มใหม่” เพื่อเพิ่มกลุ่ม YouTube"}</span></div>}
      </div>
      <footer className={styles.panelFooter}>แสดง {filteredGroups.length} จาก {groups.length} กลุ่ม</footer>
    </section>
    {editingGroup && <GroupEditor key={editingGroup.id} group={editingGroup} memberOptions={memberOptions} onClose={() => setEditingGroup(null)} onSave={saveGroup} />}
  </main>;
}
