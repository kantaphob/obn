"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Mail, Pencil, Plus, Search, Trash2, UsersRound, X } from "lucide-react";
import "./members.css";

const styles = new Proxy<Record<string, string>>({}, {
  get: (_target, name) => "ym-" + String(name),
});

type DirectoryMember = {
  id: string;
  name: string;
  contactEmail: string | null;
  phone: string | null;
  line: string | null;
  facebook: string | null;
  instagram: string | null;
  accounts: { id: string; email: string }[];
  groups: string[];
};

function MemberDialog({ member, onClose, onSave }: {
  member: DirectoryMember | null;
  onClose: () => void;
  onSave: (input: { name: string; contactEmail: string; phone: string; line: string; facebook: string; instagram: string; emails: string[] }) => Promise<void>;
}) {
  const [name, setName] = useState(member?.name ?? "");
  const [contactEmail, setContactEmail] = useState(member?.contactEmail ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [line, setLine] = useState(member?.line ?? "");
  const [facebook, setFacebook] = useState(member?.facebook ?? "");
  const [instagram, setInstagram] = useState(member?.instagram ?? "");
  const [emailsText, setEmailsText] = useState(member?.accounts.map((account) => account.email).join("\n") ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({ name, contactEmail, phone, line, facebook, instagram, emails: emailsText.split(/[\n,]/).map((email) => email.trim()).filter(Boolean) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "บันทึกสมาชิกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="youtube-member-dialog-title">
        <header className={styles.dialogHeader}><div><span className={styles.dialogIcon}><UsersRound size={18} /></span><div><h2 id="youtube-member-dialog-title">{member ? "แก้ไขสมาชิก" : "เพิ่มสมาชิก"}</h2><p>สมาชิกหนึ่งคนผูกอีเมลบัญชี YouTube ได้หลายบัญชี</p></div></div><button type="button" onClick={onClose} aria-label="ปิด" disabled={saving}><X size={19} /></button></header>
        <form onSubmit={submit}>
          <div className={styles.formGrid}>
            <label className={styles.field}>ชื่อสมาชิก<input required maxLength={150} autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="ชื่อหรือชื่อที่ใช้เรียก" /></label>
            <label className={styles.field}>อีเมลติดต่อ<input type="email" maxLength={254} value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="อีเมลสำหรับติดต่อ" /></label>
            <label className={styles.field}>เบอร์ติดต่อ<input type="tel" maxLength={200} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="เบอร์โทรศัพท์" /></label>
            <label className={styles.field}>Line<input maxLength={200} value={line} onChange={(event) => setLine(event.target.value)} placeholder="ชื่อผู้ใช้หรือ URL" /></label>
            <label className={styles.field}>Facebook<input maxLength={200} value={facebook} onChange={(event) => setFacebook(event.target.value)} placeholder="ชื่อบัญชีหรือ URL" /></label>
            <label className={styles.field}>Instagram<input maxLength={200} value={instagram} onChange={(event) => setInstagram(event.target.value)} placeholder="ชื่อบัญชีหรือ URL" /></label>
            <label className={styles.field + " " + styles.emailField}>อีเมลบัญชี YouTube<textarea value={emailsText} onChange={(event) => setEmailsText(event.target.value)} placeholder="หนึ่งอีเมลต่อบรรทัด (เว้นว่างได้)" rows={5} /><span>อีเมลที่ผูกกับสมาชิกคนอื่นแล้วจะใช้ซ้ำไม่ได้</span></label>
          </div>
          {error && <p className={styles.formError} role="alert">{error}</p>}
          <footer className={styles.dialogFooter}><button type="button" className={styles.cancelButton} onClick={onClose} disabled={saving}>ยกเลิก</button><button type="submit" className={styles.primaryButton} disabled={saving}><UsersRound size={15} />{saving ? "กำลังบันทึก..." : "บันทึกสมาชิก"}</button></footer>
        </form>
      </section>
    </div>
  );
}

export default function MembersPanel({ members }: { members: DirectoryMember[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [dialogMember, setDialogMember] = useState<DirectoryMember | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const visibleMembers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th");
    return members.filter((member) => [member.name, ...member.accounts.map((account) => account.email), ...member.groups]
      .concat([member.contactEmail, member.phone, member.line, member.facebook, member.instagram].filter(Boolean) as string[])
      .join(" ").toLocaleLowerCase("th").includes(normalized));
  }, [members, query]);
  const accountCount = members.reduce((total, member) => total + member.accounts.length, 0);
  const membersWithoutAccounts = members.filter((member) => member.accounts.length === 0).length;

  async function saveMember(input: { name: string; contactEmail: string; phone: string; line: string; facebook: string; instagram: string; emails: string[] }) {
    const url = dialogMember ? `/api/youtube/members/${dialogMember.id}` : "/api/youtube/members";
    const response = await fetch(url, {
      method: dialogMember ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "บันทึกสมาชิกไม่สำเร็จ");
    setDialogOpen(false);
    setDialogMember(null);
    router.refresh();
  }

  async function deleteMember(member: DirectoryMember) {
    const confirmed = window.confirm(`ลบสมาชิก “${member.name}” และอีเมลบัญชี ${member.accounts.length} รายการ?\nข้อมูลชื่อและอีเมลในประวัติกลุ่มเดิมจะยังคงอยู่`);
    if (!confirmed) return;
    setActionError("");
    const response = await fetch(`/api/youtube/members/${member.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) {
      setActionError(result.error || "ลบสมาชิกไม่สำเร็จ");
      return;
    }
    router.refresh();
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div><div className={styles.breadcrumb}>YouTube <span>/</span> สมาชิก</div><h1>สมาชิก</h1><p>รายชื่อสมาชิกและบัญชี YouTube ที่ผูกไว้ สามารถเลือกบัญชีเหล่านี้ตอนสร้างกลุ่ม</p></div>
        <button type="button" className={styles.primaryButton} onClick={() => { setDialogMember(null); setDialogOpen(true); }}><Plus size={16} /> เพิ่มสมาชิก</button>
      </header>
      <section className={styles.metrics}>
        <article className={styles.metricCard}><span className={styles.metricIcon}><UsersRound size={19} /></span><span className={styles.metricLabel}>สมาชิกทั้งหมด</span><strong>{members.length}<small> คน</small></strong><span className={styles.metricFoot}>ชื่อสมาชิกไม่ซ้ำกัน</span></article>
        <article className={styles.metricCard}><span className={styles.metricIcon + " " + styles.greenIcon}><Mail size={19} /></span><span className={styles.metricLabel}>บัญชี YouTube</span><strong>{accountCount}<small> บัญชี</small></strong><span className={styles.metricFoot}>สมาชิกหนึ่งคนผูกได้หลายบัญชี</span></article>
        <article className={styles.metricCard}><span className={styles.metricIcon + " " + styles.orangeIcon}><UsersRound size={19} /></span><span className={styles.metricLabel}>ยังไม่มีอีเมลบัญชี</span><strong>{membersWithoutAccounts}<small> คน</small></strong><span className={styles.metricFoot}>เพิ่มบัญชีภายหลังได้</span></article>
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>รายชื่อสมาชิก</h2><p>ชื่อซ้ำถูกรวมเป็นสมาชิกคนเดียว และแสดงบัญชีที่ผูกไว้ทั้งหมด</p></div></div>
        {actionError && <p className={styles.formError} role="alert">{actionError}</p>}
        <div className={styles.toolbar}>
          <label className={styles.search}><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อหรืออีเมลบัญชี" /></label>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}><thead><tr><th>สมาชิก</th><th>บัญชี YouTube</th><th>ข้อมูลติดต่อ</th><th>กลุ่ม</th><th>จำนวนบัญชี / จัดการ</th></tr></thead>
            <tbody>{visibleMembers.map((member) => <tr key={member.id}>
              <td><div className={styles.person}><span className={styles.avatar}>{member.name.slice(0, 1)}</span><div><strong>{member.name}</strong><span>รหัสสมาชิก · {member.id.slice(-6).toUpperCase()}</span></div></div></td>
              <td>{member.accounts.length ? <div className={styles.memberAccounts}>{member.accounts.map((account) => <span key={account.id}>{account.email}</span>)}</div> : <span className={styles.noAccount}>ยังไม่มีอีเมลบัญชี</span>}</td>
              <td><div className={styles.contactDetails}>
                {member.contactEmail && <span><Mail size={12} />{member.contactEmail}</span>}
                {member.phone && <span>{member.phone}</span>}
                {(member.line || member.facebook || member.instagram) && <span className={styles.socialDetails}>{[member.line && `Line: ${member.line}`, member.facebook && `FB: ${member.facebook}`, member.instagram && `IG: ${member.instagram}`].filter(Boolean).join(" · ")}</span>}
                {!member.contactEmail && !member.phone && !member.line && !member.facebook && !member.instagram && <span className={styles.noAccount}>ยังไม่มีข้อมูลติดต่อ</span>}
              </div></td>
              <td>{member.groups.length ? <div className={styles.groupList}>{member.groups.map((group) => <span key={group}>{group}</span>)}</div> : <span className={styles.noAccount}>ยังไม่อยู่ในกลุ่ม</span>}</td>
              <td><div className={styles.rowActions}><span className={styles.seatPill}>{member.accounts.length} บัญชี</span><button type="button" className={styles.iconButton} onClick={() => { setDialogMember(member); setDialogOpen(true); }} aria-label={`แก้ไข ${member.name}`}><Pencil size={14} />แก้ไข</button><button type="button" className={styles.iconButton + " " + styles.deleteButton} onClick={() => void deleteMember(member)} aria-label={`ลบ ${member.name}`}><Trash2 size={14} />ลบ</button></div></td>
            </tr>)}</tbody>
          </table>
          {visibleMembers.length === 0 && <div className={styles.empty}><UsersRound size={24} /><strong>ไม่พบสมาชิก</strong><span>ลองค้นหาด้วยชื่อหรืออีเมลอีกครั้ง</span></div>}
        </div>
        <footer className={styles.tableFooter}><span>แสดง {visibleMembers.length} จาก {members.length} คน</span><span>รวม {accountCount} บัญชี YouTube</span></footer>
      </section>
      <div className={styles.draftNote}><span>ข้อมูลฐานข้อมูล</span> ลบสมาชิกแล้ว ประวัติในกลุ่มเดิมจะยังเก็บชื่อและอีเมลที่บันทึกไว้</div>
      {dialogOpen && <MemberDialog key={dialogMember?.id ?? "new"} member={dialogMember} onClose={() => setDialogOpen(false)} onSave={saveMember} />}
    </main>
  );
}
