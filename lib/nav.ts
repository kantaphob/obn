import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  SquarePlay,
  Clapperboard,
  BarChart3,
  Boxes,
  BuildingComplex,
  BuildingComplexPlus,
  CalendarDays,
  ClipboardList,
  FileCheck2,
  FileText,
  HandCoins,
  HardHat,
  History,
  House,
  LayoutDashboard,
  Landmark,
  Package,
  Receipt,
  Ruler,
  ScrollText,
  Settings,
  ShieldCheck,
  ShieldUser,
  ShoppingCart,
  Sprout,
  Truck,
  UserRound,
  Users,
  Wallet,
  AlarmClock,
  Archive,
  KeyRound,
  Calculator,
  Store,
  type LucideIcon,
  Building2Icon,
  CreditCard,
  Trash2,
  ChartNoAxesCombined,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon; query?: Record<string, string>; children?: NavItem[] };
export type NavGroup = { title: string; items: NavItem[] };
export type SystemKey =
  | "dashboard"
  | "construction"
  | "buildin"
  | "agricultures"
  | "loan"
  | "youtube"
  | "netflix"
  | "admin";
export type System = {
  key: SystemKey;
  label: string; // ชื่อบนหัว Sidebar
  shortLabel: string; // ชื่อใน AppShortcuts
  description: string;
  href: string;
  color: string; // สีประจำระบบ (ใช้ทั้ง Sidebar และส่วนข้อมูล)
  icon: LucideIcon;
  stats: string[]; // หัวข้อ KPI ของหน้าแรกระบบ (ผูกข้อมูลจริงภายหลัง)
  groups: NavGroup[];
};

const make =
  (base: string) =>
  (path: string, label: string, icon: LucideIcon): NavItem => ({
    label,
    icon,
    href: path ? `${base}/${path}` : base,
  });

const c = make("/dashboard/construction");
const b = make("/dashboard/buildin");
const a = make("/dashboard/agriculture");
const l = make("/dashboard/loan");
const yt = make("/dashboard/youtube");
const nf = make("/dashboard/netflix");
const ad = make("/admin");

/** Shared company navigation taxonomy. Empty categories are omitted. */
export const COMPANY_MENU_CATEGORIES = [
  { key: "overview", title: "ภาพรวม" },
  { key: "customers", title: "ลูกค้า สมาชิก และคู่ค้า" },
  { key: "operations", title: "งานหลัก" },
  { key: "inventory", title: "สินค้าและวัสดุ" },
  { key: "finance", title: "การเงินและบัญชี" },
  { key: "reports", title: "รายงานและวางแผน" },
  { key: "history", title: "ประวัติและเอกสาร" },
] as const;

type CompanyMenuCategory = (typeof COMPANY_MENU_CATEGORIES)[number]["key"];

function companyMenuGroups(items: Partial<Record<CompanyMenuCategory, NavItem[]>>): NavGroup[] {
  return COMPANY_MENU_CATEGORIES.flatMap(({ key, title }) =>
    items[key]?.length ? [{ title, items: items[key]! }] : [],
  );
}

export const SYSTEMS: Record<SystemKey, System> = {
  dashboard: {
    key: "dashboard",
    label: "ภาพรวมกลุ่มบริษัท",
    shortLabel: "Dashboard",
    description: "ดูภาพรวมทุกบริษัทในที่เดียว",
    href: "/dashboard",
    color: "#f5f3ed",
    icon: House,
    stats: [],
    groups: [
      {
        title: "ภาพรวม",
        items: [
          { label: "แดชบอร์ดรวม", href: "/dashboard", icon: LayoutDashboard },
        ],
      },
      {
        title: "บัญชีและการเงิน",
        items: [
          { label: "สมุดบัญชี", href: "/dashboard/accounts", icon: Receipt },
          { label: "งบทดลอง", href: "/dashboard/accounts/trial-balance", icon: BarChart3 },
          {
            label: "งานบัญชีประจำวัน", href: "/dashboard/accounts/daily", icon: CalendarDays,
            children: [
              { label: "รายการรับเงิน", href: "/dashboard/accounts/receipts", icon: ArrowDownLeft },
              { label: "รายการจ่ายเงิน", href: "/dashboard/accounts/payments", icon: ArrowUpRight },
              {
                label: "บัญชีลูกหนี้ (AR)", href: "/dashboard/accounts/ar", icon: HandCoins,
                children: [
                  { label: "ใบแจ้งหนี้", href: "/dashboard/accounts/ar/invoices", icon: FileText },
                  { label: "ใบเสร็จรับเงิน", href: "/dashboard/accounts/ar/receipts", icon: Receipt },
                  { label: "รับชำระเงิน", href: "/dashboard/accounts/ar/payments", icon: Wallet },
                ],
              },
              {
                label: "บัญชีเจ้าหนี้ (AP)", href: "/dashboard/accounts/ap", icon: CreditCard,
                children: [
                  { label: "ใบสั่งซื้อ", href: "/dashboard/accounts/ap/purchase-orders", icon: ShoppingCart },
                  { label: "ใบสำคัญจ่าย", href: "/dashboard/accounts/ap/vouchers", icon: FileCheck2 },
                  { label: "จ่ายชำระเงิน", href: "/dashboard/accounts/ap/payments", icon: Wallet },
                ],
              },
              { label: "เงินสดและธนาคาร", href: "/dashboard/accounts/cash-and-banks", icon: Landmark },
            ],
          },
          { label: "งานภาษีและกฎหมาย", href: "/dashboard/accounts/tax-and-legal", icon: ScrollText },
          { label: "ปิดบัญชีและงบการเงิน", href: "/dashboard/accounts/closing", icon: FileCheck2 },
          { label: "บัญชีบริหารและงบประมาณ", href: "/dashboard/accounts/budget", icon: Calculator },
          { label: "ตรวจสอบและเอกสาร", href: "/dashboard/accounts/audit", icon: ShieldCheck },
        ],
      },
      {
        title: "บุคลากร",
        items: [{ label: "พนักงาน", href: "/dashboard/employees", icon: Users }],
      },
      {
        title: "เข้าสู่ระบบบริษัท",
        items: [
          { label: "ขายการเกษตร", href: "/dashboard/agricultures", icon: Sprout },
          { label: "ปล่อยสินเชื่อ", href: "/dashboard/loan", icon: HandCoins },
        ],
      },
      {
        title: "บริหารสินทรัพย์",
        items: [
          { label: "ทรัพย์สินและ Net Worth", href: "/dashboard/wealth/assets", icon: ChartNoAxesCombined },
        ],
      },
    ],
  },

  construction: {
    key: "construction",
    label: "ก่อสร้าง",
    shortLabel: "Construction",
    description: "โครงการ ความคืบหน้างาน จัดซื้อวัสดุ และเบิกงวดงาน",
    href: "/dashboard/construction",
    color: "#f2a93b",
    icon: BuildingComplex,
    stats: [
      "โครงการที่กำลังดำเนินการ",
      "งานค้างส่งมอบ",
      "รายจ่ายเดือนนี้",
      "งวดงานรอรับเงิน",
    ],
    groups: companyMenuGroups({
      overview: [
        c("", "ภาพรวม", LayoutDashboard),
      ],
      customers: [
        c("subcontractors", "ผู้รับเหมาช่วง", Users),
      ],
      operations: [
        c("projects", "รายการโครงการ", HardHat),
        c("progress", "ความคืบหน้างาน", ClipboardList),
        c("boq", "แบบและ BOQ", Ruler),
        c("purchase-orders", "ใบสั่งซื้อ", ShoppingCart),
      ],
      inventory: [
        c("materials", "วัสดุคงคลัง", Boxes),
      ],
      finance: [
        c("ledger", "สมุดบัญชีรับ–จ่าย", BookOpen),
        c("billing", "เบิกงวดงาน", Receipt),
      ],
      reports: [
        c("costs", "ต้นทุนและกำไร", BarChart3),
      ],
    }),
  },

  buildin: {
    key: "buildin",
    label: "บิ้วอิน",
    shortLabel: "Buildin",
    description: "ใบเสนอราคา งานผลิต และตารางติดตั้งเฟอร์นิเจอร์บิ้วอิน",
    href: "/dashboard/buildin",
    color: "#4fb3d9",
    icon: BuildingComplexPlus,
    stats: [
      "ใบเสนอราคารออนุมัติ",
      "งานกำลังผลิต",
      "คิวติดตั้งสัปดาห์นี้",
      "ยอดค้างชำระ",
    ],
    groups: companyMenuGroups({
      overview: [
        b("", "ภาพรวม", LayoutDashboard),
      ],
      customers: [
        b("customers", "ลูกค้า", UserRound),
      ],
      operations: [
        b("quotations", "ใบเสนอราคา", FileText),
        b("work-orders", "ใบสั่งงาน", ClipboardList),
        b("installations", "ตารางติดตั้ง", CalendarDays),
      ],
      inventory: [
        b("materials", "วัสดุและอุปกรณ์", Boxes),
      ],
      finance: [
        b("ledger", "สมุดบัญชีรับ–จ่าย", BookOpen),
        b("invoices", "ใบแจ้งหนี้", Receipt),
        b("payments", "รับชำระเงิน", Wallet),
      ],
    }),
  },

  agricultures: {
    key: "agricultures",
    label: "ขายการเกษตร",
    shortLabel: "Agricultures",
    description: "สินค้า สต็อก ใบสั่งขาย และลูกหนี้ของร้านการเกษตร",
    href: "/dashboard/agricultures",
    color: "#7ccf6a",
    icon: Sprout,
    stats: ["ยอดขายวันนี้", "สินค้าใกล้หมด", "ใบสั่งขายรอส่ง", "ลูกหนี้คงค้าง"],
    groups: companyMenuGroups({
      overview: [
        a("", "ภาพรวม", LayoutDashboard),
      ],
      customers: [
        a("customers", "ลูกค้าและตัวแทน", Users),
      ],
      operations: [
        a("sales-orders", "ใบสั่งขาย", ShoppingCart),
        a("deliveries", "ใบส่งของ", Truck),
      ],
      inventory: [
        a("products", "สินค้า", Package),
        a("stock", "สต็อกคงเหลือ", Boxes),
        a("lots", "ล็อตและวันหมดอายุ", AlarmClock),
        a("categories", "หมวดหมู่สินค้า", Package),
        a("classifier", "ลักษณนาม", Ruler),
      ],
      finance: [
        a("ledger", "สมุดบัญชีรับ–จ่าย", BookOpen),
        a("receivables", "ลูกหนี้", HandCoins),
      ],
      reports: [
        a("reports", "รายงานยอดขาย", BarChart3),
      ],
    }),
  },

  loan: {
    key: "loan",
    label: "ปล่อยสินเชื่อ",
    shortLabel: "Loan",
    description: "ใบสมัคร สัญญา ตารางชำระ และติดตามหนี้ค้างชำระ",
    href: "/dashboard/loan",
    color: "#c58af9",
    icon: HandCoins,
    stats: [
      "ใบสมัครรออนุมัติ",
      "สัญญาที่ใช้งานอยู่",
      "ครบกำหนดชำระวันนี้",
      "ยอดค้างชำระ",
    ],
    groups: companyMenuGroups({
      overview: [
        l("", "ภาพรวม", LayoutDashboard),
        l("borrower-overview", "ภาพรวมผู้กู้", UserRound),
      ],
      customers: [
        l("borrowers", "ผู้กู้", UserRound),
        l("collaterals", "หลักประกัน", Landmark),
      ],
      operations: [
        l("contracts", "สัญญากู้", ScrollText),
        l("approvals", "พิจารณาอนุมัติ", FileCheck2),
        l("schedules", "ตารางงวด", CalendarDays),
        l("calendar", "ปฏิทินรับเงิน", CalendarDays),
        l("overdue", "ค้างชำระ", AlarmClock),
        l("collections", "งานติดตามหนี้", AlarmClock),
      ],
      finance: [
        l("ledger", "สมุดบัญชีรับ–จ่าย", BookOpen),
        l("ap", "ใบแจ้งหนี้", Receipt),
        l("ar", "ลูกหนี้", HandCoins),
        l("payments", "รับชำระและประวัติ", Receipt),
        l("capital-account", "บัญชีทุน", Receipt),
        l("accounting", "กระทบยอดและปิดรอบ", Receipt),
      ],
      reports: [
        l("profit", "ผลดำเนินงาน", BarChart3),
        l("forecast", "คาดการณ์เงินสด", BarChart3),
      ],
      history: [
        l("logs", "บันทึกการทำงาน", History),
        l("docs", "เอกสาร", FileText),
        l("deleted", "ถังขยะ", Trash2),
      ],
    }),
  },

  youtube: {
    key: "youtube",
    label: "Yture Co., Ltd.",
    shortLabel: "Yture",
    description: "พื้นที่ทำงาน Yture Co., Ltd.",
    href: "/dashboard/youtube",
    color: "#94a3b8",
    icon: SquarePlay,
    stats: [],
    groups: companyMenuGroups({
      overview: [
        yt("", "ภาพรวม", LayoutDashboard),
      ],
      customers: [
        yt("members", "รายชื่อสมาชิก", Users),
      ],
      operations: [
        yt("group", "กลุ่มและบัญชี", Users),
      ],
      finance: [
        { ...yt("ledger", "สมุดบัญชีรับ–จ่าย", BookOpen), query: { view: "records" } },
        { ...yt("invoices", "ใบแจ้งหนี้สมาชิก", Receipt), query: { view: "invoices" } },
        yt("collections", "ลูกหนี้และรับชำระสมาชิก (AR)", HandCoins),
        { ...yt("invoices", "ใบแจ้งหนี้เจ้าหนี้", Receipt), query: { view: "payables" } },
        { ...yt("ledger", "อนุมัติและจ่ายหนี้ (AP)", HandCoins), query: { view: "approvals" } },
      ],
      reports: [
        yt("reports", "รายงานเงินรับล่วงหน้า", BarChart3),
      ],
      history: [
        yt("logs", "บันทึกการทำงาน", History),
        yt("archive", "คลังรายการ", Archive),
      ],
    }),
  },
  netflix: {
    key: "netflix",
    label: "Nf Co., Ltd.",
    shortLabel: "Nf",
    description: "พื้นที่ทำงาน Nf Co., Ltd.",
    href: "/dashboard/netflix",
    color: "#94a3b8",
    icon: Clapperboard,
    stats: [ "สมาชิกทั้งหมด", "สมาชิกใหม่วันนี้", "รายได้วันนี้", "รายได้เดือนนี้"],
    groups: companyMenuGroups({
      overview: [
        nf("", "ภาพรวม", LayoutDashboard),
      ],
      customers: [
        nf("groups", "กลุ่มสมาชิก", Users),
      ],
      finance: [
        nf("ledger", "สมุดบัญชีรับ–จ่าย", BookOpen),
        nf("ap", "ใบแจ้งหนี้", Receipt),
        nf("ar", "ลูกหนี้", HandCoins),
      ],
    }),
  },
  admin: {
    key: "admin",
    label: "ผู้ดูแลระบบ",
    shortLabel: "Admin",
    description: "จัดการผู้ใช้ สิทธิ์ และการตั้งค่าของทุกบริษัท",
    href: "/admin",
    color: "#ffffff",
    icon: ShieldUser,
    stats: ["ผู้ใช้ทั้งหมด", "บทบาท", "เข้าสู่ระบบวันนี้"],
    groups: [
      {
        title: "ภาพรวม",
        items: [
          ad("", "ภาพรวมผู้ดูแล", LayoutDashboard),
        ],
      },
      {
        title: "ผู้ใช้และสิทธิ์",
        items: [
          ad("users", "ผู้ใช้", Users),
          ad("roles", "บทบาทและสิทธิ์", KeyRound),
        ],
      },
      {
        title: "บริษัทและสาขา",
        items: [
          ad("companies", "ข้อมูลบริษัท", Settings),
          ad("branches", "สาขา", Building2Icon),
        ],
      },
      {
        title: "ข้อมูลสินค้าและวัสดุ",
        items: [
          ad("things", "ข้อมูลสิ่งของและสินค้า", ClipboardList),
          ad("material", "วัสดุก่อสร้าง", Boxes),
          ad("unit", "หน่วยนับ", Ruler),
          ad("classifier", "ลักษณนาม", ScrollText),
        ],
      },
      {
        title: "ข้อมูลการเงิน",
        items: [
          ad("banking", "ข้อมูลธนาคาร", CreditCard),
          ad(
            "company-finance-categories",
            "หมวดหมู่การเงินของบริษัท",
            FileCheck2,
          ),
        ],
      },
      {
        title: "ข้อมูลที่อยู่",
        items: [
          ad("postcode", "รหัสไปรษณีย์", Landmark),
        ],
      },
      {
        title: "ตรวจสอบระบบ",
        items: [
          ad("audit-log", "บันทึกกิจกรรม", ShieldCheck),
        ],
      },
    ],
  },
};

/** หาว่า URL ปัจจุบันอยู่ในระบบไหน */
export function getSystem(pathname: string): System {
  if (pathname === "/admin" || pathname.startsWith("/admin/"))
    return SYSTEMS.admin;
  const seg = pathname.startsWith("/dashboard/")
    ? pathname.split("/")[2]
    : undefined;
  if (seg === "agriculture") return SYSTEMS.agricultures;
  if (seg && seg in SYSTEMS && seg !== "dashboard" && seg !== "admin")
    return SYSTEMS[seg as SystemKey];
  return SYSTEMS.dashboard;
}

export const COMPANY_KEYS: SystemKey[] = [
  "construction",
  "buildin",
  "agricultures",
  "loan",
  "youtube",
  "netflix",
];

/** Flatten navigation for route lookup and icon-only sidebars. */
export function flattenNavItems(items: NavItem[]): NavItem[] {
  return items.flatMap(item => [item, ...flattenNavItems(item.children ?? [])]);
}

export function findItem(system: System, href: string) {
  for (const group of system.groups) {
    const item = flattenNavItems(group.items).find((i) => i.href === href);
    if (item) return { group, item };
  }
  return null;
}

/** ปุ่มเครื่องมือ (กลุ่มที่ 3 ใน AppShortcuts) */
export const TOOLS = [
  {
    key: "pos",
    label: "ขาย POS",
    shortLabel: "POS",
    href: "/tools/pos",
    icon: Store,
  },
  {
    key: "documents",
    label: "Document",
    shortLabel: "Doc",
    href: "/tools/documents",
    icon: FileText,
  },
  {
    key: "calculator",
    label: "เครื่องมือคำนวณ",
    shortLabel: "Calc",
    href: "/tools/calculator",
    icon: Calculator,
  },
] as const;
