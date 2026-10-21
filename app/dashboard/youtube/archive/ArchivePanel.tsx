"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "../workspace.css";
type Item = { id: string; name: string };
export default function ArchivePanel({ groups, members, canWrite }: { groups: Item[]; members: Item[]; canWrite: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function restore(item: Item, type: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/youtube/archive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, type }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "กู้คืนไม่สำเร็จ");
      setMessage(`กู้คืน ${item.name} แล้ว`); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "เชื่อมต่อไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <main className="yu-shell"><Link className="yu-button yu-backToGroups" href="/dashboard/youtube/group">← กลับไปหน้ากลุ่มทั้งหมด</Link><header className="yu-heading"><div><h1>คลังกลุ่มและสมาชิก</h1><p>ข้อมูลที่พักใช้งานยังคงมีประวัติและกู้คืนได้ · กู้คืนกลุ่มแล้วรอบชำระเดิมจะกลับมาแสดง</p></div></header>{message && <p role="status">{message}</p>}{[{ title: "กลุ่ม", type: "GROUP", items: groups }, { title: "สมาชิก", type: "MEMBER", items: members }].map((section) => <section className="yu-card" key={section.type} style={{ marginBottom: 20 }}><h2>{section.title}</h2>{section.items.map((item) => <div className="yu-taskRow" key={item.id}><strong>{item.name}</strong><button type="button" className="yu-button" disabled={!canWrite || busy} onClick={() => void restore(item, section.type)}>กู้คืน</button></div>)}{!section.items.length && <p className="yu-muted">ไม่มีข้อมูลในคลัง</p>}</section>)}</main>;
}
