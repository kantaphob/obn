"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, LoaderCircle, Plus, Save, ShieldCheck, UsersRound } from "lucide-react";
import { rolePermissionChoices } from "@/lib/auth-roles";

type Role = { id: string; code: string; name: string; description: string; permissions: string[]; isSystem: boolean };
type RoleDraft = Pick<Role, "code" | "name" | "description" | "permissions">;

const inputClass = "h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 text-sm text-[var(--text)] outline-none transition focus:border-[#6b9a7f]";

const groups = [
  { title: "ภาพรวมและงานสินเชื่อ", description: "แดชบอร์ด ผู้กู้ สัญญา และการชำระเงิน", keys: ["dashboard:read", "borrowers:read", "borrowers:write", "contracts:read", "contracts:write", "repayments:read", "repayments:write"] },
  { title: "บัญชีและบริษัท", description: "บัญชี รายงาน บริษัท และสาขา", keys: ["accounting:read", "accounting:write", "companies:read", "companies:write"] },
  { title: "ข้อมูลหลักและประวัติ", description: "ข้อมูลอ้างอิงและประวัติการใช้งาน", keys: ["masterdata:read", "masterdata:write", "logs:read"] },
  { title: "การดูแลระบบ", description: "การเชื่อมต่อ บัญชีผู้ใช้ และบทบาท", keys: ["integrations:manage", "users:manage", "roles:manage"] },
];

function blankDraft(): RoleDraft { return { code: "", name: "", description: "", permissions: [] }; }

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState<RoleDraft | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const current = roles.find((role) => role.code === selected);
  const editable = draft ?? (current ? { code: current.code, name: current.name, description: current.description, permissions: current.permissions } : null);
  const dirty = useMemo(() => {
    if (creating) return true;
    if (!current || !draft) return false;
    return draft.name !== current.name || draft.description !== current.description || [...draft.permissions].sort().join("|") !== [...current.permissions].sort().join("|");
  }, [creating, current, draft]);
  const permissionCount = (role: Role) => role.permissions.includes("*") ? rolePermissionChoices.length : role.permissions.length;

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/roles");
      if (!response.ok) throw new Error(response.status === 403 ? "บัญชีนี้ไม่มีสิทธิ์จัดการบทบาทและสิทธิ์" : "โหลดข้อมูลบทบาทไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      const data = await response.json() as Role[];
      setRoles(data);
      setSelected((value) => value && data.some((role) => role.code === value) ? value : data[0]?.code ?? "");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function selectRole(code: string) {
    setSelected(code);
    setDraft(null);
    setCreating(false);
    setNotice("");
    setError("");
  }

  function startCreate() {
    setDraft(blankDraft());
    setCreating(true);
    setNotice("");
    setError("");
  }

  function togglePermission(key: string) {
    if (!editable || current?.code === "owner") return;
    const permissions = editable.permissions.includes(key)
      ? editable.permissions.filter((item) => item !== key)
      : [...editable.permissions, key];
    setDraft({ ...editable, permissions });
  }

  async function save() {
    if (!editable) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/roles", {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editable),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      setNotice(creating ? "สร้างบทบาทและกำหนดสิทธิ์เรียบร้อยแล้ว" : "บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว");
      setSelected(editable.code);
      setDraft(null);
      setCreating(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  function cancelEdit() {
    setDraft(null);
    setCreating(false);
    setError("");
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-7 sm:py-9 lg:px-10">
      <header className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#54806a]"><span className="size-1.5 rounded-full bg-[#6aa27f]" />การตั้งค่าระบบ</p>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-[34px]">หน้าที่และสิทธิ์การใช้งาน</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">สร้างบทบาทสำหรับทีม แล้วเลือกส่วนงานที่แต่ละบทบาทสามารถดูหรือแก้ไขได้</p>
        </div>
        <button type="button" onClick={startCreate} disabled={creating || loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#315d4b] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#274c3d] disabled:cursor-not-allowed disabled:opacity-50"><Plus size={17} />สร้างบทบาท</button>
      </header>

      {notice && <p role="status" className="mb-5 rounded-xl border border-[#cfe4d4] bg-[#f2faf4] px-4 py-3 text-sm text-[#315d4b]">{notice}</p>}
      {error && <p role="alert" className="mb-5 rounded-xl border border-[#efcfca] bg-[#fff6f4] px-4 py-3 text-sm text-[#9c453c]">{error}</p>}

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4"><span className="grid size-10 place-items-center rounded-xl bg-[#edf5ef] text-[#4c8062]"><KeyRound size={19} /></span><span><span className="block text-xs text-[var(--muted)]">บทบาททั้งหมด</span><strong className="mt-0.5 block text-xl text-[var(--text)]">{roles.length}</strong></span></div>
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4"><span className="grid size-10 place-items-center rounded-xl bg-[#f1eff9] text-[#7868a3]"><ShieldCheck size={19} /></span><span><span className="block text-xs text-[var(--muted)]">ชุดสิทธิ์ที่กำหนด</span><strong className="mt-0.5 block text-xl text-[var(--text)]">{rolePermissionChoices.length}</strong></span></div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-4 py-4"><h2 className="font-bold text-[var(--text)]">บทบาทในระบบ</h2><p className="mt-1 text-xs text-[var(--muted)]">เลือกบทบาทเพื่อจัดการสิทธิ์</p></div>
          {loading ? <div className="flex items-center gap-2 p-5 text-sm text-[var(--muted)]"><LoaderCircle size={16} className="animate-spin" />กำลังโหลดบทบาท…</div> : roles.length === 0 ? <p className="p-5 text-sm text-[var(--muted)]">ยังไม่มีบทบาทในระบบ</p> : <nav aria-label="รายการบทบาท" className="grid gap-1 p-2">{roles.map((role) => <button key={role.code} type="button" onClick={() => selectRole(role.code)} aria-current={selected === role.code ? "true" : undefined} className={`rounded-xl px-3.5 py-3 text-left transition ${selected === role.code && !creating ? "bg-[#edf5ef] text-[#315d4b]" : "text-[var(--text)] hover:bg-black/[0.035]"}`}><span className="flex items-center justify-between gap-2"><strong className="text-sm">{role.name}</strong><span className="rounded-full bg-black/[0.045] px-2 py-0.5 text-[10px] text-[var(--muted)]">{role.isSystem ? "มาตรฐาน" : "กำหนดเอง"}</span></span><span className="mt-1 flex items-center justify-between gap-2 text-xs text-[var(--muted)]"><code>{role.code}</code><span>{permissionCount(role)} สิทธิ์</span></span></button>)}</nav>}
          <div className="border-t border-[var(--border)] px-4 py-3 text-xs leading-5 text-[var(--muted)]"><UsersRound size={14} className="mr-1 inline" />บทบาทที่สร้างใหม่เลือกใช้ได้ตอนจัดการบัญชีผู้ใช้</div>
        </aside>

        <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          {!editable ? <div className="grid min-h-72 place-items-center p-8 text-center text-sm text-[var(--muted)]">เลือกบทบาทจากรายการเพื่อดูและแก้ไขสิทธิ์</div> : <>
            <div className="border-b border-[var(--border)] px-5 py-5 sm:px-7">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="mb-1 flex items-center gap-2 text-xs text-[var(--muted)]"><KeyRound size={14} />{creating ? "บทบาทใหม่" : current?.isSystem ? "บทบาทมาตรฐาน" : "บทบาทกำหนดเอง"}</div><h2 className="text-xl font-bold text-[var(--text)]">{creating ? "กำหนดบทบาทใหม่" : current?.name}</h2><p className="mt-1 text-sm text-[var(--muted)]">กำหนดชื่อและเลือกสิทธิ์สำหรับบทบาทนี้</p></div>{!creating && current?.code === "owner" && <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800"><ShieldCheck size={14} />สิทธิ์เจ้าของระบบ</span>}</div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-semibold text-[var(--muted)]">ชื่อบทบาท<input required maxLength={80} value={editable.name} disabled={!creating && current?.code === "owner"} onChange={(event) => setDraft({ ...editable, name: event.target.value })} placeholder="เช่น เจ้าหน้าที่สินเชื่อ" className={`${inputClass} text-[var(--text)] disabled:opacity-60`} /></label><label className="grid gap-1.5 text-xs font-semibold text-[var(--muted)]">รหัสบทบาท<input required maxLength={32} pattern="[a-z][a-z0-9_-]*" title="ใช้ a-z ตัวพิมพ์เล็ก ตัวเลข - หรือ _ และขึ้นต้นด้วยตัวอักษร" value={editable.code} readOnly={!creating} onChange={(event) => setDraft({ ...editable, code: event.target.value.toLowerCase() })} placeholder="เช่น loan_officer" className={`${inputClass} font-mono ${!creating ? "bg-black/[0.035]" : ""}`} /></label><label className="grid gap-1.5 text-xs font-semibold text-[var(--muted)] sm:col-span-2">รายละเอียด<input maxLength={240} value={editable.description} disabled={!creating && current?.code === "owner"} onChange={(event) => setDraft({ ...editable, description: event.target.value })} placeholder="อธิบายหน้าที่ของบทบาทนี้" className={`${inputClass} text-[var(--text)] disabled:opacity-60`} /></label></div>
            </div>

            <div className="px-5 py-5 sm:px-7"><div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><h3 className="font-bold text-[var(--text)]">สิทธิ์การใช้งาน</h3><p className="mt-1 text-xs text-[var(--muted)]">สิทธิ์แก้ไขจะรวมสิทธิ์ดูข้อมูลในหมวดเดียวกัน</p></div><span className="rounded-full bg-[#f1f4f1] px-3 py-1 text-xs font-semibold text-[#52675a]">{current?.code === "owner" ? "ทั้งหมด" : editable.permissions.length} รายการ</span></div>
              <div className="grid gap-3">{groups.map((group) => <fieldset key={group.title} className="rounded-xl border border-[var(--border)] p-3.5 sm:p-4" disabled={!creating && current?.code === "owner"}><legend className="px-1 text-sm font-bold text-[var(--text)]">{group.title}</legend><p className="-mt-1 mb-3 text-xs text-[var(--muted)]">{group.description}</p><div className="grid gap-2 sm:grid-cols-2">{group.keys.map((key) => { const item = rolePermissionChoices.find((choice) => choice.key === key); if (!item) return null; const checked = editable.permissions.includes("*") || editable.permissions.includes(key); return <label key={key} className={`flex cursor-pointer items-start gap-3 rounded-lg border border-transparent p-2.5 transition ${checked ? "bg-[#f3f8f4]" : "hover:bg-black/[0.025]"} ${current?.code === "owner" ? "cursor-not-allowed opacity-65" : ""}`}><input type="checkbox" disabled={current?.code === "owner"} checked={checked} onChange={() => togglePermission(key)} className="mt-0.5 size-4 accent-[#315d4b]" /><span className="min-w-0"><span className="block text-sm font-medium text-[var(--text)]">{item.label}</span><code className="text-[11px] text-[var(--muted)]">{key}</code></span></label>; })}</div></fieldset>)}</div>
            </div>

            <footer className="flex flex-col-reverse gap-3 border-t border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7"><span className="text-xs text-[var(--muted)]">{current?.code === "owner" ? "เจ้าของระบบมีสิทธิ์เต็มรูปแบบและไม่สามารถแก้ไขได้" : creating ? "บทบาทจะพร้อมใช้งานหลังบันทึก" : dirty ? "มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก" : "บันทึกแล้ว"}</span><div className="flex justify-end gap-2">{(creating || dirty) && <button type="button" onClick={cancelEdit} disabled={busy} className="h-10 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--text)] hover:bg-black/[0.035] disabled:opacity-50">ยกเลิก</button>}<button type="button" onClick={save} disabled={busy || current?.code === "owner" || !dirty || !editable.name.trim() || (creating && !editable.code.trim())} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#315d4b] px-4 text-sm font-bold text-white transition hover:bg-[#274c3d] disabled:cursor-not-allowed disabled:opacity-50">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}{busy ? "กำลังบันทึก…" : creating ? "สร้างบทบาท" : "บันทึกการเปลี่ยนแปลง"}</button></div></footer>
          </>}
        </section>
      </div>
    </main>
  );
}
