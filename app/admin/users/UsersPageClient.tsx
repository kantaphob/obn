"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { SYSTEMS, TOOLS, flattenNavItems } from "@/lib/nav";

type User = {
  id: string;
  userprofileId: string | null;
  username: string | null;
  name: string;
  email: string;
  role: string | null;
  banned: boolean | null;
  status: "active" | "suspended" | "pending";
  createdAt: string;
  updatedAt: string;
  firstName: string;
  lastName: string;
  phone: string;
  avatar: string;
  accessConfigured: boolean;
  companyCodes: string[];
  appKeys: string[];
  navigationHrefs: string[];
};
type Role = { code: string; name: string };
type CompanyOption = { companycode: string; nameTH: string | null; nameEN: string | null };

type ModalState =
  | { type: "create" }
  | { type: "edit"; user: User }
  | { type: "delete"; user: User }
  | null;

type FormValues = {
  name: string;
  username: string;
  email: string;
  password: string;
  role: string;
  firstName: string;
  lastName: string;
  phone: string;
  avatar: string;
  companyCodes: string[];
  appKeys: string[];
  navigationHrefs: string[];
};

const inputClass =
  "h-11 rounded-xl border border-[var(--border)] bg-transparent px-3 text-[var(--text)]";

/* ---------- Modal พื้นฐาน ---------- */
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl sm:rounded-2xl sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold text-[var(--text)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="-mr-2 -mt-1 h-9 w-9 rounded-lg text-xl text-[var(--muted)] hover:bg-black/5"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- ฟอร์มเพิ่ม / แก้ไข ---------- */
function UserFormModal({
  user,
  roles,
  companies,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  user?: User;
  roles: Role[];
  companies: CompanyOption[];
  busy: boolean;
  error: string;
  onSubmit: (values: FormValues) => void;
  onClose: () => void;
}) {
  const isEdit = Boolean(user);
  const [values, setValues] = useState<FormValues>({
    name: user?.name ?? "",
    username: user?.username ?? "",
    email: user?.email ?? "",
    password: "",
    role: user?.role || roles[0]?.code || "staff",
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    phone: user?.phone ?? "",
    avatar: user?.avatar ?? "",
    companyCodes: user?.companyCodes ?? [],
    appKeys: user?.appKeys ?? [],
    navigationHrefs: user?.navigationHrefs ?? [],
  });
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const set = (key: keyof FormValues) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  const toggle = (key: "companyCodes" | "appKeys" | "navigationHrefs", value: string, checked: boolean) =>
    setValues((current) => ({ ...current, [key]: checked ? [...new Set([...current[key], value])] : current[key].filter((entry) => entry !== value) }));

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <Modal title={isEdit ? "แก้ไขบัญชี" : "เพิ่มบัญชีพนักงาน"} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4">
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-[#fff0ef] px-4 py-3 text-sm text-[#a33631]"
          >
            {error}
          </p>
        )}
        <label className="grid gap-2 text-sm font-semibold">
          ชื่อที่แสดง
          <input
            ref={firstRef}
            required
            value={values.name}
            onChange={(e) => set("name")(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Username
          <input
            required={!isEdit || !user?.username}
            minLength={3}
            maxLength={30}
            pattern="[A-Za-z0-9_]+"
            autoComplete="username"
            value={values.username}
            onChange={(e) => set("username")(e.target.value)}
            className={inputClass}
          />
          <span className="text-xs font-normal text-[var(--muted)]">3–30 ตัวอักษร ใช้ a-z, 0-9 และ _</span>
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          อีเมล
          <input
            required
            type="email"
            value={values.email}
            onChange={(e) => set("email")(e.target.value)}
            className={inputClass}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">ชื่อจริง<input value={values.firstName} onChange={(e) => set("firstName")(e.target.value)} className={inputClass} /></label>
          <label className="grid gap-2 text-sm font-semibold">นามสกุล<input value={values.lastName} onChange={(e) => set("lastName")(e.target.value)} className={inputClass} /></label>
          <label className="grid gap-2 text-sm font-semibold">เบอร์โทรศัพท์<input type="tel" autoComplete="tel" value={values.phone} onChange={(e) => set("phone")(e.target.value)} className={inputClass} /></label>
          <label className="grid gap-2 text-sm font-semibold">ลิงก์รูปโปรไฟล์<input type="url" value={values.avatar} onChange={(e) => set("avatar")(e.target.value)} className={inputClass} /></label>
        </div>
        <label className="grid gap-2 text-sm font-semibold">
          {isEdit ? "รหัสผ่านใหม่" : "รหัสผ่านเริ่มต้น"}
          <input
            required={!isEdit}
            type="password"
            minLength={8}
            autoComplete="new-password"
            value={values.password}
            onChange={(e) => set("password")(e.target.value)}
            className={inputClass}
          />
          <span className="text-xs font-normal text-[var(--muted)]">
            {isEdit
              ? "เว้นว่างไว้หากไม่ต้องการเปลี่ยน (อย่างน้อย 8 ตัวอักษร)"
              : "อย่างน้อย 8 ตัวอักษร"}
          </span>
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Role
          <select
            value={values.role}
            onChange={(e) => set("role")(e.target.value)}
            className={`${inputClass} bg-[var(--surface)]`}
          >
            {roles.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <section className="grid gap-3 rounded-xl border border-[var(--border)] p-4">
          <h3 className="font-bold">บริษัทที่เข้าถึงได้</h3>
          <p className="text-xs text-[var(--muted)]">กำหนดว่าบัญชีนี้จะเห็นข้อมูลบริษัทและสาขาใด</p>
          {companies.length ? <div className="grid gap-2 sm:grid-cols-2">
            {companies.map((company) => <label key={company.companycode} className="flex items-center gap-2 text-sm font-normal">
              <input type="checkbox" checked={values.companyCodes.includes(company.companycode)} onChange={(event) => toggle("companyCodes", company.companycode, event.target.checked)} />
              <span>{company.companycode} · {company.nameTH || company.nameEN || "ไม่ระบุชื่อ"}</span>
            </label>)}
          </div> : <p className="text-sm text-[var(--muted)]">ยังไม่มีบริษัทให้เลือก</p>}
        </section>
        <section className="grid gap-3 rounded-xl border border-[var(--border)] p-4">
          <h3 className="font-bold">App Shortcut ที่มองเห็นและเข้าใช้ได้</h3>
          <p className="text-xs text-[var(--muted)]">Role ยังคงควบคุมสิทธิ์อ่าน/แก้ไขข้อมูล ส่วนนี้กำหนดแอปที่เปิดใช้ได้</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.values(SYSTEMS).map((system) => <label key={system.key} className="flex items-center gap-2 text-sm font-normal">
              <input type="checkbox" checked={values.appKeys.includes(system.key)} onChange={(event) => toggle("appKeys", system.key, event.target.checked)} />
              {system.shortLabel}
            </label>)}
            {TOOLS.map((tool) => <label key={tool.key} className="flex items-center gap-2 text-sm font-normal">
              <input type="checkbox" checked={values.appKeys.includes(`tool:${tool.key}`)} onChange={(event) => toggle("appKeys", `tool:${tool.key}`, event.target.checked)} />
              {tool.label}
            </label>)}
          </div>
        </section>
        <section className="grid gap-3 rounded-xl border border-[var(--border)] p-4">
          <h3 className="font-bold">รายการใน Sidebar</h3>
          <div className="grid max-h-64 gap-3 overflow-y-auto pr-2 sm:grid-cols-2">
            {Object.values(SYSTEMS).map((system) => {
              const items = system.groups.flatMap((group) => flattenNavItems(group.items));
              return <fieldset key={system.key} className="rounded-lg border border-[var(--border)] p-3">
                <legend className="px-1 text-sm font-semibold">{system.label}</legend>
                <div className="grid gap-2">
                  {items.map((item) => <label key={`${system.key}:${item.href}`} className="flex items-center gap-2 text-xs font-normal">
                    <input type="checkbox" checked={values.navigationHrefs.includes(item.href)} onChange={(event) => toggle("navigationHrefs", item.href, event.target.checked)} />
                    <span>{item.label}</span>
                  </label>)}
                </div>
              </fieldset>;
            })}
          </div>
        </section>
        <div className="mt-1 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-[var(--border)] px-5 font-semibold"
          >
            ยกเลิก
          </button>
          <button
            disabled={busy || !roles.length}
            className="h-11 rounded-xl bg-[#315d4b] px-5 font-bold text-white disabled:opacity-50"
          >
            {busy ? "กำลังบันทึก…" : isEdit ? "บันทึกการแก้ไข" : "สร้างบัญชี"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- ยืนยันการลบ ---------- */
function DeleteModal({
  user,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  user: User;
  busy: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title="ลบบัญชีผู้ใช้" onClose={onClose}>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-[#fff0ef] px-4 py-3 text-sm text-[#a33631]"
        >
          {error}
        </p>
      )}
      <p className="text-[var(--text)]">
        ต้องการลบบัญชี <strong>{user.name}</strong> ({user.email}) ใช่หรือไม่?
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        การลบไม่สามารถย้อนกลับได้ หากเพียงต้องการหยุดการใช้งานชั่วคราว
        ให้เลือก “ระงับบัญชี” แทน
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="h-11 rounded-xl border border-[var(--border)] px-5 font-semibold"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="h-11 rounded-xl bg-[#a33631] px-5 font-bold text-white disabled:opacity-50"
        >
          {busy ? "กำลังลบ…" : "ลบบัญชี"}
        </button>
      </div>
    </Modal>
  );
}

/* ---------- หน้าหลัก ---------- */
export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [modalError, setModalError] = useState("");
  const [busy, setBusy] = useState(false);

  const roleName = (code: string | null) =>
    roles.find((item) => item.code === (code || "staff"))?.name ??
    code ??
    "staff";

  const load = useCallback(async () => {
    const [userResponse, roleResponse] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/admin/roles"),
    ]);
    if (!userResponse.ok || !roleResponse.ok) {
      setError(
        "จัดการบัญชีได้เฉพาะเจ้าของระบบ กรุณาตรวจสอบ Role ของบัญชีที่เข้าสู่ระบบ",
      );
      return;
    }
    const userData = await userResponse.json() as { users: User[]; companies: CompanyOption[] };
    setUsers(userData.users);
    setCompanies(userData.companies);
    setRoles((await roleResponse.json()) as Role[]);
    setError("");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const closeModal = useCallback(() => {
    setModal(null);
    setModalError("");
  }, []);

  function openModal(next: ModalState) {
    setModalError("");
    setNotice("");
    setModal(next);
  }

  async function request(
    url: string,
    method: string,
    body: Record<string, unknown> | undefined,
    fallbackError: string,
  ) {
    setBusy(true);
    setModalError("");
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setModalError(result.error || fallbackError);
      return false;
    }
    return true;
  }

  async function handleCreate(values: FormValues) {
    const ok = await request(
      "/api/admin/users",
      "POST",
      { ...values },
      "สร้างบัญชีไม่สำเร็จ",
    );
    if (!ok) return;
    closeModal();
    setNotice("สร้างบัญชีผู้ใช้เรียบร้อยแล้ว");
    await load();
  }

  async function handleEdit(user: User, values: FormValues) {
    // ส่งเฉพาะข้อมูลที่เปลี่ยนจริง
    const patch: Record<string, unknown> = {};
    if (values.name !== user.name) patch.name = values.name;
    if (values.username !== (user.username || "")) patch.username = values.username;
    if (values.email !== user.email) patch.email = values.email;
    if (values.role !== (user.role || "staff")) patch.role = values.role;
    if (values.password) patch.password = values.password;
    if (values.firstName !== user.firstName) patch.firstName = values.firstName;
    if (values.lastName !== user.lastName) patch.lastName = values.lastName;
    if (values.phone !== user.phone) patch.phone = values.phone;
    if (values.avatar !== user.avatar) patch.avatar = values.avatar;
    const sameItems = (left: string[], right: string[]) => [...left].sort().join("\0") === [...right].sort().join("\0");
    if (!sameItems(values.companyCodes, user.companyCodes)) patch.companyCodes = values.companyCodes;
    if (!sameItems(values.appKeys, user.appKeys)) patch.appKeys = values.appKeys;
    if (!sameItems(values.navigationHrefs, user.navigationHrefs)) patch.navigationHrefs = values.navigationHrefs;

    if (Object.keys(patch).length === 0) {
      closeModal();
      return;
    }
    const ok = await request(
      `/api/admin/users/${user.id}`,
      "PATCH",
      patch,
      "แก้ไขบัญชีไม่สำเร็จ",
    );
    if (!ok) return;
    closeModal();
    setNotice("ปรับปรุงบัญชีเรียบร้อยแล้ว");
    await load();
  }

  async function handleDelete(user: User) {
    const ok = await request(
      `/api/admin/users/${user.id}`,
      "DELETE",
      undefined,
      "ลบบัญชีไม่สำเร็จ",
    );
    if (!ok) return;
    closeModal();
    setNotice("ลบบัญชีเรียบร้อยแล้ว");
    await load();
  }

  async function toggleBan(user: User) {
    setError("");
    setNotice("");
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ banned: !user.banned }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error || "แก้ไขบัญชีไม่สำเร็จ");
      return;
    }
    setNotice(user.banned ? "เปิดใช้งานบัญชีแล้ว" : "ระงับบัญชีแล้ว");
    await load();
  }

  return (
    <section className="mx-auto max-w-6xl p-5 sm:p-8">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[var(--muted)]">
            การตั้งค่าระบบ
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[var(--text)]">
            บัญชีผู้ใช้งาน
          </h1>
          <p className="mt-2 text-[var(--muted)]">
            กำหนด Role บริษัท แอปที่เข้าใช้ได้ และรายการ Sidebar ของแต่ละบัญชี
          </p>
        </div>
        <button
          type="button"
          onClick={() => openModal({ type: "create" })}
          disabled={!roles.length}
          className="h-11 rounded-xl bg-[#315d4b] px-5 font-bold text-white disabled:opacity-50"
        >
          + เพิ่มบัญชี
        </button>
      </header>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-[#fff0ef] px-4 py-3 text-sm text-[#a33631]"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"
        >
          {notice}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="font-bold">
            บัญชีทั้งหมด{" "}
            <span className="font-normal text-[var(--muted)]">
              ({users.length})
            </span>
          </h2>
        </div>

        {users.length === 0 ? (
          <p className="p-6 text-sm text-[var(--muted)]">
            ยังไม่มีบัญชี หรือไม่สามารถโหลดรายการได้
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] table-fixed text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    บัญชีผู้ใช้
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    บริษัท
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    แอป / เมนู
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    อีเมล
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Role
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    สถานะ
                  </th>
                  <th scope="col" className="sticky right-0 w-[260px] bg-[var(--surface)] px-5 py-3 text-right font-semibold">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="max-w-[200px] truncate px-5 py-3 font-semibold text-[var(--text)]">
                      <span className="block truncate">{user.name}</span>
                      <span className="mt-1 block truncate text-xs font-normal text-[var(--muted)]">{user.username ? `@${user.username}` : "ยังไม่กำหนด Username"}</span>
                      <span className="block truncate text-xs font-normal text-[var(--muted)]">{[user.firstName, user.lastName].filter(Boolean).join(" ") || "ยังไม่ระบุชื่อจริง"}</span>
                    </td>
                    <td className="max-w-[160px] truncate px-5 py-3" title={companies.filter((company) => user.companyCodes.includes(company.companycode)).map((company) => company.companycode).join(", ")}>
                      {(() => {
                        const codes = companies.filter((company) => user.companyCodes.includes(company.companycode)).map((company) => company.companycode);
                        return codes.length > 2 ? `${codes.slice(0, 2).join(", ")} +${codes.length - 2}` : codes.join(", ") || "ยังไม่กำหนด";
                      })()}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-[var(--muted)]">{user.appKeys.length} แอป · {user.navigationHrefs.length} เมนู</td>
                    <td className="px-5 py-3 text-[var(--muted)]">
                      {user.email}
                    </td>
                    <td className="px-5 py-3 text-[var(--text)]">
                      {roleName(user.role)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                          user.status !== "active"
                            ? "bg-[#fff0ef] text-[#a33631]"
                            : "bg-[#e6f3ec] text-[#28633f]"
                        }`}
                      >
                        {user.status === "suspended" ? "ถูกระงับ" : user.status === "pending" ? "รอยืนยัน" : "ใช้งานอยู่"}
                      </span>
                    </td>
                    <td className="sticky right-0 bg-[var(--surface)] px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openModal({ type: "edit", user })}
                          className="h-9 rounded-lg border border-[var(--border)] px-3 font-semibold text-[var(--text)]"
                        >
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleBan(user)}
                          className={`h-9 rounded-lg border px-3 font-semibold ${
                            user.banned
                              ? "border-[#9acbb0] text-[#28633f]"
                              : "border-[#e0aaa7] text-[#a33631]"
                          }`}
                        >
                          {user.banned ? "เปิดใช้งาน" : "ระงับ"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openModal({ type: "delete", user })}
                          className="h-9 rounded-lg bg-[#a33631] px-3 font-semibold text-white"
                        >
                          ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal?.type === "create" && (
        <UserFormModal
          roles={roles}
          companies={companies}
          busy={busy}
          error={modalError}
          onSubmit={(values) => void handleCreate(values)}
          onClose={closeModal}
        />
      )}
      {modal?.type === "edit" && (
        <UserFormModal
          user={modal.user}
          roles={roles}
          companies={companies}
          busy={busy}
          error={modalError}
          onSubmit={(values) => void handleEdit(modal.user, values)}
          onClose={closeModal}
        />
      )}
      {modal?.type === "delete" && (
        <DeleteModal
          user={modal.user}
          busy={busy}
          error={modalError}
          onConfirm={() => void handleDelete(modal.user)}
          onClose={closeModal}
        />
      )}
    </section>
  );
}
