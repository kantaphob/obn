import type { ReactNode } from "react";
import AppFrame from "@/components/AppFrame";

// เครื่องมือไม่มี Sidebar ของระบบ — ใช้พื้นที่เต็มหน้า
export default function ToolsLayout({ children }: { children: ReactNode }) {
  return <AppFrame sidebar={false}>{children}</AppFrame>;
}
