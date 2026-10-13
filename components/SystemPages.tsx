import Link from "next/link";
import { ArrowRight, FolderOpen } from "lucide-react";
import { SYSTEMS, type System } from "@/lib/nav";
import { workspaceStyles as styles } from "./ui/workspace-styles";
import CompanyDirectory from "./CompanyDirectory";

export function SystemHome({ system }: { system: System }) {
  return <div className={styles.page}>
    <header className={styles.pageHeader}><p className={styles.eyebrow}>ภาพรวม / OVERVIEW</p><h1>{system.label}</h1><p>{system.description}</p></header>
    <section className={styles.stats} aria-label="ตัวเลขสำคัญ">{system.stats.map(label => <div key={label} className={styles.stat}><span>{label}</span><strong>—</strong><small>ยังไม่เชื่อมต่อข้อมูล</small></div>)}</section>
    <section className={styles.sections}>{system.groups.filter(group => group.title !== "ภาพรวม").map(group => <div key={group.title}><h2 className={styles.sectionTitle}>{group.title}<span>{group.items.length} เมนู</span></h2><div className={styles.quickGrid}>{group.items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={styles.quickLink}><Icon size={21} strokeWidth={1.5} aria-hidden="true" /><span>{label}</span><ArrowUpRight size={17} aria-hidden="true" /></Link>)}</div></div>)}</section>
  </div>;
}

export function SubPage({ system, group, label }: { system: System; group: string; label: string }) {
  return <div className={styles.page}>
    <header className={styles.pageHeader}><p className={styles.eyebrow}><Link href={system.href}>{system.label}</Link> / {group}</p><h1>{label}</h1><p>จัดการข้อมูล{label}ในพื้นที่ทำงานของคุณ</p></header>
    <section className={styles.empty}><span className={styles.cardIcon}><FolderOpen size={30} strokeWidth={1.4} /></span><h2>พื้นที่สำหรับ{label}</h2><p>หน้านี้ยังไม่เชื่อมต่อข้อมูล ระบบจะแสดงรายการที่นี่เมื่อพร้อมใช้งาน</p><Link className={styles.backLink} href={system.href}>กลับไปภาพรวม <ArrowRight size={17} /></Link></section>
  </div>;
}

export function GroupOverview() {
  return <CompanyDirectory />;
}
