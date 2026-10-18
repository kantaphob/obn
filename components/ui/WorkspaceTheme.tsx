import type { CSSProperties, ReactNode } from "react";
import { SYSTEMS } from "@/lib/nav";

export default function WorkspaceTheme({ children, className, theme = "white" }: { children: ReactNode; className: string; theme?: "white" | "modern-white" | "glass-dark" }) {
  const palette = Object.fromEntries(Object.values(SYSTEMS).map(system => [`--ws-${system.key}`, system.color])) as CSSProperties;
  return <div data-workspace-theme={theme} className={className} style={palette}>{children}</div>;
}
