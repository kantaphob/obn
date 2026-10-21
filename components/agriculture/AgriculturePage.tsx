import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Sprout } from "lucide-react";
import { workspaceStyles as styles } from "@/components/ui/workspace-styles";
import { ProductManager } from "@/components/agriculture/ProductManager";

const base = "/dashboard/agriculture";

const pages = {
  products: {
    section: "สินค้าและสต็อก",
    title: "สินค้า",
    description: "จัดการรายการสินค้า หน่วยนับ ราคา และหมวดหมู่สินค้าเกษตร",
    columns: ["รหัสสินค้า", "ชื่อสินค้า", "หมวดหมู่", "หน่วย", "ราคาขาย", "สถานะ"],
    empty: "เมื่อเพิ่มสินค้าแล้ว รายการสินค้าจะแสดงที่นี่",
    links: [["หมวดหมู่", "categories"], ["ประเภท", "types"], ["สต็อกคงเหลือ", "stock"]],
  },
  stock: {
    section: "สินค้าและสต็อก",
    title: "สต็อกคงเหลือ",
    description: "ตรวจสอบจำนวนสินค้าคงเหลือและรายการที่ต้องเติมสต็อก",
    columns: ["สินค้า", "หมวดหมู่", "คงเหลือ", "หน่วย", "จุดสั่งซื้อ", "สถานะ"],
    empty: "ยังไม่มีข้อมูลสต็อก กรุณาเพิ่มสินค้าและบันทึกรับเข้า",
    links: [["สินค้า", "products"], ["ล็อตและวันหมดอายุ", "lots"]],
  },
  lots: {
    section: "สินค้าและสต็อก",
    title: "ล็อตและวันหมดอายุ",
    description: "ติดตามล็อตสินค้า วันรับเข้า และวันหมดอายุเพื่อหมุนเวียนสินค้าได้ทันเวลา",
    columns: ["เลขที่ล็อต", "สินค้า", "วันที่รับเข้า", "วันหมดอายุ", "จำนวนคงเหลือ", "สถานะ"],
    empty: "ยังไม่มีล็อตสินค้าเพิ่มเข้าระบบ",
    links: [["สินค้า", "products"], ["สต็อกคงเหลือ", "stock"]],
  },
  categories: {
    section: "สินค้าและสต็อก",
    title: "หมวดหมู่",
    description: "จัดกลุ่มสินค้าเพื่อให้ค้นหาและสรุปรายการได้ง่ายขึ้น",
    columns: ["รหัสหมวดหมู่", "ชื่อหมวดหมู่", "รายละเอียด", "จำนวนสินค้า", "สถานะ"],
    empty: "ยังไม่มีหมวดหมู่สินค้า",
    links: [["สินค้า", "products"], ["ประเภท", "types"]],
  },
  types: {
    section: "สินค้าและสต็อก",
    title: "ประเภท",
    description: "จัดการประเภทสินค้าเกษตรให้สอดคล้องกับการจัดหมวดหมู่ของร้าน",
    columns: ["รหัสประเภท", "ชื่อประเภท", "หมวดหมู่", "รายละเอียด", "สถานะ"],
    empty: "ยังไม่มีประเภทสินค้า",
    links: [["สินค้า", "products"], ["หมวดหมู่", "categories"]],
  },
  "sales-orders": {
    section: "งานขาย",
    title: "ใบสั่งขาย",
    description: "ติดตามคำสั่งซื้อ ยอดรวม และสถานะการเตรียมสินค้า",
    columns: ["เลขที่ใบสั่งขาย", "วันที่", "ลูกค้า", "จำนวนรายการ", "ยอดรวม", "สถานะ"],
    empty: "ยังไม่มีใบสั่งขาย",
    links: [["ลูกค้าและตัวแทน", "customers"], ["ใบส่งของ", "deliveries"], ["รายงานยอดขาย", "reports"]],
  },
  customers: {
    section: "งานขาย",
    title: "ลูกค้าและตัวแทน",
    description: "จัดการข้อมูลลูกค้าและตัวแทนจำหน่ายที่ใช้ในเอกสารขาย",
    columns: ["รหัสลูกค้า", "ชื่อ/ชื่อกิจการ", "ประเภท", "เบอร์โทร", "อีเมล", "สถานะ"],
    empty: "ยังไม่มีข้อมูลลูกค้าหรือตัวแทน",
    links: [["ใบสั่งขาย", "sales-orders"], ["ลูกหนี้", "receivables"]],
  },
  deliveries: {
    section: "งานขาย",
    title: "ใบส่งของ",
    description: "จัดเตรียมและติดตามการส่งสินค้าตามใบสั่งขาย",
    columns: ["เลขที่ใบส่งของ", "วันที่ส่ง", "ลูกค้า", "อ้างอิงใบสั่งขาย", "ผู้จัดส่ง", "สถานะ"],
    empty: "ยังไม่มีใบส่งของ",
    links: [["ใบสั่งขาย", "sales-orders"], ["ลูกค้าและตัวแทน", "customers"]],
  },
  receivables: {
    section: "การเงิน",
    title: "ลูกหนี้",
    description: "ติดตามยอดค้างรับ วันครบกำหนด และสถานะการชำระเงินของลูกค้า",
    columns: ["เลขที่เอกสาร", "ลูกค้า", "วันที่ออก", "วันครบกำหนด", "ยอดค้างรับ", "สถานะ"],
    empty: "ยังไม่มีรายการลูกหนี้",
    links: [["ลูกค้าและตัวแทน", "customers"], ["ใบสั่งขาย", "sales-orders"], ["รายงานยอดขาย", "reports"]],
  },
  reports: {
    section: "การเงิน",
    title: "รายงานยอดขาย",
    description: "สรุปยอดขายและแนวโน้มตามช่วงเวลา สินค้า และลูกค้า",
    columns: ["ช่วงเวลา", "จำนวนใบสั่งขาย", "ยอดขายรวม", "ยอดรับชำระ", "ยอดค้างรับ"],
    empty: "รายงานจะแสดงเมื่อมีข้อมูลใบสั่งขายและการรับชำระ",
    links: [["ใบสั่งขาย", "sales-orders"], ["ลูกหนี้", "receivables"]],
  },
} as const;

type AgriculturePageKey = keyof typeof pages;

export function AgricultureOverview() {
  const groups = [
    { title: "สินค้าและสต็อก", items: [["สินค้า", "products"], ["สต็อกคงเหลือ", "stock"], ["ล็อตและวันหมดอายุ", "lots"], ["หมวดหมู่", "categories"], ["ประเภท", "types"]] },
    { title: "งานขาย", items: [["ใบสั่งขาย", "sales-orders"], ["ลูกค้าและตัวแทน", "customers"], ["ใบส่งของ", "deliveries"]] },
    { title: "การเงิน", items: [["ลูกหนี้", "receivables"], ["รายงานยอดขาย", "reports"]] },
  ] as const;

  return <section className={styles.page}>
    <p className={styles.eyebrow}>AGRICULTURE / OVERVIEW</p>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-[clamp(24px,2.5vw,36px)] font-medium tracking-tight text-[#272b29]">ภาพรวมการเกษตร</h1><p className="mt-2 max-w-2xl text-[13px] text-[#626862]">พื้นที่จัดการสินค้า สต็อก งานขาย และลูกหนี้ของร้านการเกษตร</p></div>
      <span className="rounded-xl border border-[#d7d9d0] bg-[var(--ws-surface,#faf9f5)] px-3 py-2 text-xs text-[#626862]">ภาพรวมระบบ</span>
    </div>
    <section aria-label="ตัวชี้วัด" className="mt-7 grid grid-cols-2 gap-3 min-[1400px]:grid-cols-4 max-[440px]:grid-cols-1">
      {["ยอดขายวันนี้", "สินค้าใกล้หมด", "ใบสั่งขายรอส่ง", "ลูกหนี้คงค้าง"].map((label) => <article key={label} className={styles.stat}><span>{label}</span><strong className="text-[#a3a69f]!">—</strong><small>ยังไม่มีข้อมูล</small></article>)}
    </section>
    <section className="mt-10 space-y-8">
      {groups.map((group) => <div key={group.title}><h2 className={`${styles.sectionTitle} mb-3!`}>{group.title}<span>{group.items.length} เมนู</span></h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{group.items.map(([label, href]) => <Link key={href} href={`${base}/${href}`} className="group flex items-center gap-3 rounded-xl border border-[#ddded5] bg-[var(--ws-surface,#faf9f5)] p-4 transition hover:bg-[var(--ws-soft,#e9ede3)]"><span className="grid size-10 place-items-center rounded-xl bg-[var(--ws-soft,#e9ede3)] text-[#355a4b]"><Sprout size={19} aria-hidden="true" /></span><span className="flex-1 text-sm font-medium text-[#272b29]">{label}</span><ArrowUpRight size={17} className="text-[#73796f] transition group-hover:text-[#355a4b]" aria-hidden="true" /></Link>)}</div></div>)}
    </section>
  </section>;
}

export function AgricultureSection({ page }: { page: AgriculturePageKey }) {
  const config = pages[page];
  if (page === "products") return <section className={styles.page}>
    <Link href={base} className="mb-5 inline-flex items-center gap-2 text-xs text-[#626862] hover:text-[#355a4b]"><ArrowLeft size={15} aria-hidden="true" /> กลับภาพรวมการเกษตร</Link>
    <p className={styles.eyebrow}>AGRICULTURE / {config.section}</p>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-[clamp(24px,2.5vw,36px)] font-medium tracking-tight text-[#272b29]">{config.title}</h1><p className="mt-2 max-w-2xl text-[13px] text-[#626862]">จัดการรายการสินค้า บาร์โค้ด สูตร และแบรนด์</p></div><span className="rounded-xl border border-[#d7d9d0] bg-[var(--ws-surface,#faf9f5)] px-3 py-2 text-xs text-[#626862]">รายการสินค้า</span></div>
    <ProductManager />
    <section className="mt-7"><h2 className="mb-3 text-sm font-semibold text-[#272b29]">เมนูที่เกี่ยวข้อง</h2><div className="flex flex-wrap gap-2">{config.links.map(([label, href]) => <Link key={href} href={`${base}/${href}`} className="rounded-xl border border-[#d7d9d0] bg-[var(--ws-surface,#faf9f5)] px-3.5 py-2 text-xs text-[#626862] transition hover:bg-[var(--ws-soft,#e9ede3)] hover:text-[#355a4b]">{label}<ArrowUpRight className="ml-1 inline" size={13} aria-hidden="true" /></Link>)}</div></section>
  </section>;
  return <section className={styles.page}>
    <Link href={base} className="mb-5 inline-flex items-center gap-2 text-xs text-[#626862] hover:text-[#355a4b]"><ArrowLeft size={15} aria-hidden="true" /> กลับภาพรวมการเกษตร</Link>
    <p className={styles.eyebrow}>AGRICULTURE / {config.section}</p>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-[clamp(24px,2.5vw,36px)] font-medium tracking-tight text-[#272b29]">{config.title}</h1><p className="mt-2 max-w-2xl text-[13px] text-[#626862]">{config.description}</p></div><span className="rounded-xl border border-[#d7d9d0] bg-[var(--ws-surface,#faf9f5)] px-3 py-2 text-xs text-[#626862]">0 รายการ</span></div>
    <section className="mt-6 overflow-hidden rounded-2xl border border-[#ddded5] bg-[var(--ws-surface,#faf9f5)]" aria-label={`รายการ${config.title}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ddded5] px-5 py-4"><div><h2 className="text-sm font-semibold text-[#272b29]">รายการ{config.title}</h2><p className="mt-1 text-xs text-[#626862]">ข้อมูลจะแสดงที่นี่เมื่อเริ่มบันทึกรายการ</p></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[680px] border-collapse text-left text-xs"><thead className="bg-[var(--ws-soft,#e9e8df)] text-[#626862]"><tr>{config.columns.map((column) => <th key={column} className="whitespace-nowrap px-5 py-3 font-medium">{column}</th>)}</tr></thead><tbody><tr><td colSpan={config.columns.length} className="px-5 py-16 text-center"><span className="mx-auto grid size-11 place-items-center rounded-2xl bg-[var(--ws-soft,#e9ede3)] text-[#355a4b]"><Sprout size={20} aria-hidden="true" /></span><p className="mt-3 text-sm font-medium text-[#272b29]">{config.empty}</p><p className="mt-1 text-xs text-[#626862]">เริ่มจากเมนูที่เกี่ยวข้องด้านล่าง</p></td></tr></tbody></table></div>
    </section>
    <section className="mt-7"><h2 className="mb-3 text-sm font-semibold text-[#272b29]">เมนูที่เกี่ยวข้อง</h2><div className="flex flex-wrap gap-2">{config.links.map(([label, href]) => <Link key={href} href={`${base}/${href}`} className="rounded-xl border border-[#d7d9d0] bg-[var(--ws-surface,#faf9f5)] px-3.5 py-2 text-xs text-[#626862] transition hover:bg-[var(--ws-soft,#e9ede3)] hover:text-[#355a4b]">{label}<ArrowUpRight className="ml-1 inline" size={13} aria-hidden="true" /></Link>)}</div></section>
  </section>;
}
