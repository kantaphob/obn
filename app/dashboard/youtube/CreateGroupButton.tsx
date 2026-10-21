"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import GroupForm, { type GroupInput, type MemberOption } from "./GroupForm";

export default function CreateGroupButton({ memberOptions, today, canWrite = true }: { canWrite?: boolean; memberOptions: MemberOption[]; today: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  async function save(input: GroupInput) {
    const response = await fetch("/api/youtube/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "สร้างกลุ่มไม่สำเร็จ");
    setOpen(false); router.refresh();
  }
  return <><button type="button" className="yu-button yu-primary" disabled={!canWrite} onClick={() => setOpen(true)}><Plus size={17} />สร้างกลุ่ม</button>{open && <GroupForm section="create" memberOptions={memberOptions} today={today} onClose={() => setOpen(false)} onSave={save} />}</>;
}
