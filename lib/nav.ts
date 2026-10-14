import {
  BarChart3, Boxes, BuildingComplex, BuildingComplexPlus, CalendarDays,
  ClipboardList, FileCheck2, FileText, HandCoins, HardHat, House,
  LayoutDashboard, Landmark, Package, Receipt, Ruler, ScrollText,
  Settings, ShieldCheck, ShieldUser, ShoppingCart, Sprout, Truck,
  UserRound, Users, Wallet, AlarmClock, KeyRound, Calculator, Store,
  type LucideIcon,
  Building2Icon,
  CreditCard,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon };
export type NavGroup = { title: string; items: NavItem[] };
export type SystemKey = "dashboard" | "construction" | "buildin" | "agricultures" | "loan" | "admin";
export type System = {
  key: SystemKey;
  label: string;        // ชื่อบนหัว Sidebar
  shortLabel: string;   // ชื่อใน AppShortcuts
  description: string;
  href: string;
  color: string;        // สีประจำระบบ (ใช้ทั้ง Sidebar และส่วนข้อมูล)
  icon: LucideIcon;
  stats: string[];      // หัวข้อ KPI ของหน้าแรกระบบ (ผูกข้อมูลจริงภายหลัง)
  groups: NavGroup[];
};

const make = (base: string) => (path: string, label: string, icon: LucideIcon): NavItem => ({
  label, icon, href: path ? `${base}/${path}` : base,
});

const c = make("/dashboard/construction");
const b = make("/dashboard/buildin");
const a = make("/dashboard/agricultures");
const l = make("/dashboard/loan");
const ad = make("/admin");

export const SYSTEMS: Record<SystemKey, System> = {
  dashboard: {
    key: "dashboard", label: "ภาพรวมกลุ่มบริษัท", shortLabel: "Dashboard",
    description: "ดูภาพรวมทุกบริษัทในที่เดียว", href: "/dashboard",
    color: "#f5f3ed", icon: House, stats: [],
    groups: [
      { title: "ภาพรวม", items: [{ label: "แดชบอร์ดรวม", href: "/dashboard", icon: LayoutDashboard }] },
      {
        title: "เข้าสู่ระบบบริษัท",
        items: [
          { label: "ก่อสร้าง", href: "/dashboard/construction", icon: BuildingComplex },
          { label: "บิ้วอิน", href: "/dashboard/buildin", icon: BuildingComplexPlus },
          { label: "ขายการเกษตร", href: "/dashboard/agricultures", icon: Sprout },
          { label: "ปล่อยสินเชื่อ", href: "/dashboard/loan", icon: HandCoins },
        ],
      },
    ],
  },

  construction: {
    key: "construction", label: "ก่อสร้าง", shortLabel: "Construction",
    description: "โครงการ ความคืบหน้างาน จัดซื้อวัสดุ และเบิกงวดงาน",
    href: "/dashboard/construction", color: "#f2a93b", icon: BuildingComplex,
    stats: ["โครงการที่กำลังดำเนินการ", "งานค้างส่งมอบ", "รายจ่ายเดือนนี้", "งวดงานรอรับเงิน"],
    groups: [
      { title: "ภาพรวม", items: [c("", "ภาพรวมก่อสร้าง", LayoutDashboard)] },
      { title: "โครงการ", items: [
        c("projects", "รายการโครงการ", HardHat),
        c("progress", "ความคืบหน้างาน", ClipboardList),
        c("boq", "แบบและ BOQ", Ruler),
      ] },
      { title: "จัดซื้อและวัสดุ", items: [
        c("purchase-orders", "ใบสั่งซื้อ", ShoppingCart),
        c("materials", "วัสดุคงคลัง", Boxes),
        c("subcontractors", "ผู้รับเหมาช่วง", Users),
      ] },
      { title: "การเงิน", items: [
        c("billing", "เบิกงวดงาน", Receipt),
        c("costs", "ต้นทุนและกำไร", BarChart3),
      ] },
    ],
  },

  buildin: {
    key: "buildin", label: "บิ้วอิน", shortLabel: "Buildin",
    description: "ใบเสนอราคา งานผลิต และตารางติดตั้งเฟอร์นิเจอร์บิ้วอิน",
    href: "/dashboard/buildin", color: "#4fb3d9", icon: BuildingComplexPlus,
    stats: ["ใบเสนอราคารออนุมัติ", "งานกำลังผลิต", "คิวติดตั้งสัปดาห์นี้", "ยอดค้างชำระ"],
    groups: [
      { title: "ภาพรวม", items: [b("", "ภาพรวมบิ้วอิน", LayoutDashboard)] },
      { title: "งานขาย", items: [
        b("quotations", "ใบเสนอราคา", FileText),
        b("customers", "ลูกค้า", UserRound),
      ] },
      { title: "งานผลิตและติดตั้ง", items: [
        b("work-orders", "ใบสั่งงาน", ClipboardList),
        b("installations", "ตารางติดตั้ง", CalendarDays),
        b("materials", "วัสดุและอุปกรณ์", Boxes),
      ] },
      { title: "การเงิน", items: [
        b("invoices", "ใบแจ้งหนี้", Receipt),
        b("payments", "รับชำระเงิน", Wallet),
      ] },
    ],
  },

  agricultures: {
    key: "agricultures", label: "ขายการเกษตร", shortLabel: "Agricultures",
    description: "สินค้า สต็อก ใบสั่งขาย และลูกหนี้ของร้านการเกษตร",
    href: "/dashboard/agricultures", color: "#7ccf6a", icon: Sprout,
    stats: ["ยอดขายวันนี้", "สินค้าใกล้หมด", "ใบสั่งขายรอส่ง", "ลูกหนี้คงค้าง"],
    groups: [
      { title: "ภาพรวม", items: [a("", "ภาพรวมการเกษตร", LayoutDashboard)] },
      { title: "สินค้าและสต็อก", items: [
        a("products", "สินค้า", Package),
        a("stock", "สต็อกคงเหลือ", Boxes),
        a("lots", "ล็อตและวันหมดอายุ", AlarmClock),
      ] },
      { title: "งานขาย", items: [
        a("sales-orders", "ใบสั่งขาย", ShoppingCart),
        a("customers", "ลูกค้าและตัวแทน", Users),
        a("deliveries", "ใบส่งของ", Truck),
      ] },
      { title: "การเงิน", items: [
        a("receivables", "ลูกหนี้", Receipt),
        a("reports", "รายงานยอดขาย", BarChart3),
      ] },
    ],
  },

  loan: {
    key: "loan", label: "ปล่อยสินเชื่อ", shortLabel: "Loan",
    description: "ใบสมัคร สัญญา ตารางชำระ และติดตามหนี้ค้างชำระ",
    href: "/dashboard/loan", color: "#c58af9", icon: HandCoins,
    stats: ["ใบสมัครรออนุมัติ", "สัญญาที่ใช้งานอยู่", "ครบกำหนดชำระวันนี้", "ยอดค้างชำระ"],
    groups: [
      { title: "ภาพรวม", items: [l("", "ภาพรวมสินเชื่อ", LayoutDashboard)] },
      { title: "สินเชื่อ", items: [
        l("contract", "ใบสมัคร", FileText),
        l("approvals", "พิจารณาอนุมัติ", FileCheck2),
        l("contracts", "สัญญากู้", ScrollText),
      ] },
      { title: "ชำระเงิน", items: [
        l("cashierpayments", "cashierpayments", CalendarDays),
        l("payments", "รับชำระและประวัติ", CalendarDays),
      ] },
      { title: "ติดตามหนี้", items: [
        l("schedules", "ตารางชำระ", CalendarDays),
        l("overdue", "ค้างชำระ", AlarmClock),
      ] },
      { title: "ลูกค้า", items: [
        l("borrowers", "ผู้กู้", UserRound),
        l("collaterals", "หลักประกัน", Landmark),
      ] },
    ],
  },

  admin: {
    key: "admin", label: "ผู้ดูแลระบบ", shortLabel: "Admin",
    description: "จัดการผู้ใช้ สิทธิ์ และการตั้งค่าของทุกบริษัท",
    href: "/admin", color: "#ffffff", icon: ShieldUser,
    stats: ["ผู้ใช้ทั้งหมด", "บทบาท", "เข้าสู่ระบบวันนี้"],
    groups: [
      { title: "ภาพรวม", items: [ad("", "ภาพรวมผู้ดูแล", LayoutDashboard)] },
      { title: "ผู้ใช้และสิทธิ์", items: [
        ad("users", "ผู้ใช้", Users),
        ad("roles", "บทบาทและสิทธิ์", KeyRound),
      ] },
      { title: "ข้อมูลหลัก", items: [
        ad("things", "ข้อมูลสิ่งของและสินค้า", ClipboardList),
        ad("material", "วัสดุก่อสร้าง", Boxes),
        ad("unit", "หน่วยนับ", Ruler),
        ad("classifier", "ลักษณนาม", ScrollText),
        ad("banking", "ข้อมูลธนาคาร", CreditCard),
        ad("postcode", "รหัสไปรษณีย์", Landmark),
      ] },
      { title: "ระบบ", items: [
        ad("companies", "ข้อมูลบริษัท", Settings),
        ad("branches", "สาขา", Building2Icon),
        ad("audit-log", "บันทึกกิจกรรม", ShieldCheck),
      ] },
    ],
  },
};

/** หาว่า URL ปัจจุบันอยู่ในระบบไหน */
export function getSystem(pathname: string): System {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return SYSTEMS.admin;
  const seg = pathname.startsWith("/dashboard/") ? pathname.split("/")[2] : undefined;
  if (seg && seg in SYSTEMS && seg !== "dashboard" && seg !== "admin") return SYSTEMS[seg as SystemKey];
  return SYSTEMS.dashboard;
}

export const COMPANY_KEYS: SystemKey[] = ["construction", "buildin", "agricultures", "loan"];

export function findItem(system: System, href: string) {
  for (const group of system.groups) {
    const item = group.items.find((i) => i.href === href);
    if (item) return { group, item };
  }
  return null;
}

/** ปุ่มเครื่องมือ (กลุ่มที่ 3 ใน AppShortcuts) */
export const TOOLS = [
  { key: "pos", label: "ขาย POS", shortLabel: "POS", href: "/tools/pos", icon: Store },
  { key: "documents", label: "Document", shortLabel: "Doc", href: "/tools/documents", icon: FileText },
  { key: "calculator", label: "เครื่องมือคำนวณ", shortLabel: "Calc", href: "/tools/calculator", icon: Calculator },
] as const;
