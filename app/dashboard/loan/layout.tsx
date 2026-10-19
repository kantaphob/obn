import type { ReactNode } from "react";
import "./theme.css";
import "./ui-kit.css";

export const instant = false;

export default function LoanLayout({ children }: { children: ReactNode }) {
  return <div className="loan-theme">{children}</div>;
}
