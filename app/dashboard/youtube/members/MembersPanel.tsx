"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Mail, Pencil, Plus, Search, Trash2, UsersRound, X } from "lucide-react";
import "./members.css";
import "../workspace.css";

const styles = new Proxy<Record<string, string>>({}, {
  get: (_target, name) => "ym-" + String(name),
});

type DirectoryMember = {
  id: string;
  updatedAt: Date | string;
  name: string;
  contactEmail: string | null;
  phone: string | null;
  line: string | null;
  facebook: string | null;
  instagram: string | null;
  accounts: { id: string; email: string }[];
  groups: { id: string; name: string }[];
};

function MemberDialog({ member, onClose, onSave }: {
  member: DirectoryMember | null;
  onClose: () => void;
  onSave: (input: { name: string; contactEmail: string; phone: string; line: string; facebook: string; instagram: string }) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const [name, setName] = useState(member?.name ?? "");
  const [contactEmail, setContactEmail] = useState(member?.contactEmail ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [line, setLine] = useState(member?.line ?? "");
  const [facebook, setFacebook] = useState(member?.facebook ?? "");
  const [instagram, setInstagram] = useState(member?.instagram ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({ name, contactEmail, phone, line, facebook, instagram });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "บันทึกสมาชิกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="youtube-member-dialog-title" onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}>
        <header className={styles.dialogHeader}><div><span className={styles.dialogIcon}><UsersRound size={18} /></span><div><h2 id="youtube-member-dialog-title">{member ? "แก้ไขสมาชิก" : "เพิ่มสมาชิก"}</h2><p>แก้ไขข้อมูลสมาชิกและข้อมูลติดต่อได้</p></div></div><button type="button" onClick={onClose} aria-label="ปิด" disabled={saving}><X size={19} /></button></header>
        <form onSubmit={submit}>
          <div className={styles.formGrid}>
            <label className={styles.field}>ชื่อสมาชิก<input required maxLength={150} autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="ชื่อหรือชื่อที่ใช้เรียก" /></label>
            <label className={styles.field}>อีเมลติดต่อ<input type="email" maxLength={254} value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="อีเมลสำหรับติดต่อ" /></label>
            <details className={styles.extraFields}>
              <summary>ข้อมูลติดต่อเพิ่มเติม (ถ้ามี)</summary>
              <div className={styles.formGrid}>
                <label className={styles.field}>เบอร์ติดต่อ<input type="tel" maxLength={200} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="เบอร์โทรศัพท์" /></label>
                <label className={styles.field}>Line<input maxLength={200} value={line} onChange={(event) => setLine(event.target.value)} placeholder="ชื่อผู้ใช้หรือ URL" /></label>
                <label className={styles.field}>Facebook<input maxLength={200} value={facebook} onChange={(event) => setFacebook(event.target.value)} placeholder="ชื่อบัญชีหรือ URL" /></label>
                <label className={styles.field}>Instagram<input maxLength={200} value={instagram} onChange={(event) => setInstagram(event.target.value)} placeholder="ชื่อบัญชีหรือ URL" /></label>
              </div>
            </details>
          </div>
          {error && <p className={styles.formError} role="alert">{error}</p>}
          <footer className={styles.dialogFooter}><button type="button" className={styles.cancelButton} onClick={onClose} disabled={saving}>ยกเลิก</button><button type="submit" className={styles.primaryButton} disabled={saving}><UsersRound size={15} />{saving ? "กำลังบันทึก..." : "บันทึกสมาชิก"}</button></footer>
        </form>
    </dialog>
  );
}

export default function MembersPanel({ members, canWrite }: { members: DirectoryMember[]; canWrite: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [dialogMember, setDialogMember] = useState<DirectoryMember | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const visibleMembers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th");
    return members.filter((member) => [member.name, ...member.groups.map((group) => group.name)]
      .concat([member.contactEmail, member.phone, member.line, member.facebook, member.instagram, ...member.accounts.map((account) => account.email)].filter(Boolean) as string[])
      .join(" ").toLocaleLowerCase("th").includes(normalized));
  }, [members, query]);
  const membersInGroups = members.filter((member) => member.groups.length > 0).length;

  async function saveMember(input: { name: string; contactEmail: string; phone: string; line: string; facebook: string; instagram: string }) {
    const url = dialogMember ? `/api/youtube/members/${dialogMember.id}` : "/api/youtube/members";
    const response = await fetch(url, {
      method: dialogMember ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, version: dialogMember ? new Date(dialogMember.updatedAt).toISOString() : undefined }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "บันทึกสมาชิกไม่สำเร็จ");
    setDialogOpen(false);
    setDialogMember(null);
    router.refresh();
  }

  async function deleteMember(member: DirectoryMember) {
    const confirmed = window.confirm(`เก็บสมาชิกเข้าคลัง “${member.name}” หรือไม่?`);
    if (!confirmed) return;
    setActionError("");
    const response = await fetch(`/api/youtube/members/${member.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: new Date(member.updatedAt).toISOString() }) });
    const result = await response.json();
    if (!response.ok) {
      setActionError(result.error || "เก็บสมาชิกเข้าคลังไม่สำเร็จ");
      return;
    }
    router.refresh();
  }

  return (
    <main className={`${styles.page} yu-shell`}>
      <header className={styles.pageHeader}>
        <div><div className={styles.breadcrumb}>YouTube <span>/</span> รายชื่อสมาชิก</div><h1>รายชื่อสมาชิก</h1><p>ข้อมูลติดต่อของแต่ละคน · การจัดบัญชีและราคาอยู่ที่หน้ากลุ่ม</p></div>
        <button type="button" className={styles.primaryButton} disabled={!canWrite} onClick={() => { setDialogMember(null); setDialogOpen(true); }}><Plus size={16} /> เพิ่มสมาชิก</button>
      </header>
      <section className={styles.metrics}>
        <article className={styles.metricCard}><span className={styles.metricIcon}><UsersRound size={19} /></span><span className={styles.metricLabel}>สมาชิกทั้งหมด</span><strong>{members.length}<small> คน</small></strong><span className={styles.metricFoot}>ชื่อสมาชิกไม่ซ้ำกัน</span></article>
        <article className={styles.metricCard}><span className={styles.metricIcon + " " + styles.greenIcon}><UsersRound size={19} /></span><span className={styles.metricLabel}>สมาชิกในกลุ่ม</span><strong>{membersInGroups}<small> คน</small></strong><span className={styles.metricFoot}>สมาชิกหนึ่งคนอยู่ได้หลายกลุ่ม</span></article>
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>สมุดรายชื่อ</h2><p>สมาชิกคนเดียวมีได้หลายบัญชีและหลายกลุ่ม</p></div><Link className="yu-button" href="/dashboard/youtube/group">จัดเข้ากลุ่ม →</Link></div>
        {actionError && <p className={styles.formError} role="alert">{actionError}</p>}
        <div className={styles.toolbar}>
          <label className={styles.search}><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อหรืออีเมล" /></label>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}><thead><tr><th>สมาชิก</th><th>บัญชี YouTube · อ่านอย่างเดียว</th><th>ข้อมูลติดต่อ</th><th>กลุ่ม</th><th>จัดการ</th></tr></thead>
            <tbody>{visibleMembers.map((member) => <tr key={member.id}>
              <td><div className={styles.person}><span className={styles.avatar}>{member.name.slice(0, 1)}</span><div><strong>{member.name}</strong><span>รหัสสมาชิก · {member.id.slice(-6).toUpperCase()}</span></div></div></td>
              <td><div className={styles.memberAccounts} aria-label="อีเมลบัญชี YouTube อ่านอย่างเดียว">{member.accounts.length ? member.accounts.map((account) => <span key={account.id}><Mail size={12} />{account.email}</span>) : <span className={styles.noAccount}>ยังไม่มีบัญชี YouTube</span>}<small>จัดการบัญชีที่หน้ากลุ่ม</small></div></td>
              <td><div className={styles.contactDetails}>
                {member.contactEmail && <span><Mail size={12} />{member.contactEmail}</span>}
                {member.phone && <span>{member.phone}</span>}
                {(member.line || member.facebook || member.instagram) && <span className={styles.socialDetails}>{[member.line && `Line: ${member.line}`, member.facebook && `FB: ${member.facebook}`, member.instagram && `IG: ${member.instagram}`].filter(Boolean).join(" · ")}</span>}
                {!member.contactEmail && !member.phone && !member.line && !member.facebook && !member.instagram && <span className={styles.noAccount}>ยังไม่มีข้อมูลติดต่อ</span>}
              </div></td>
              <td>{member.groups.length ? <div className={styles.groupList}>{member.groups.map((group) => <span key={group.id}>{group.name}</span>)}</div> : <span className={styles.noAccount}>ยังไม่อยู่ในกลุ่ม</span>}</td>
              <td><div className={styles.rowActions}><button type="button" className={styles.iconButton} disabled={!canWrite} onClick={() => { setDialogMember(member); setDialogOpen(true); }} aria-label={`แก้ไข ${member.name}`}><Pencil size={14} />แก้ไข</button><button type="button" className={styles.iconButton + " " + styles.deleteButton} onClick={() => void deleteMember(member)} aria-label={`เก็บ ${member.name} เข้าคลัง`} disabled={!canWrite || member.groups.length > 0} title={member.groups.length ? "นำสมาชิกออกจากกลุ่มที่ใช้งานก่อน" : "เก็บเข้าคลังและกู้คืนได้"}><Trash2 size={14} />เก็บเข้าคลัง</button></div></td>
            </tr>)}</tbody>
          </table>
          {visibleMembers.length === 0 && <div className={styles.empty}><UsersRound size={24} /><strong>ไม่พบสมาชิก</strong><span>ลองค้นหาด้วยชื่อหรืออีเมลอีกครั้ง</span></div>}
        </div>
        <footer className={styles.tableFooter}><span>แสดง {visibleMembers.length} จาก {members.length} คน</span><span>สมาชิกในกลุ่ม {membersInGroups} คน</span></footer>
      </section>
      <div className={styles.draftNote}><span>ข้อมูลฐานข้อมูล</span> เก็บสมาชิกเข้าคลังแล้ว ประวัติในกลุ่มเดิมจะยังเก็บชื่อและอีเมลที่บันทึกไว้</div>
      {dialogOpen && <MemberDialog key={dialogMember?.id ?? "new"} member={dialogMember} onClose={() => setDialogOpen(false)} onSave={saveMember} />}
    </main>
  );
}
