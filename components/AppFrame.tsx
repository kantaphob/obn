import { Suspense, type ReactNode } from "react";
import WorkspaceTheme from "./ui/WorkspaceTheme";
import "./ui/workspace-theme.css";
import AppShortcuts from "./ui/AppShortcuts";
import Sidebar from "./Sidebar";
import AuthSessionControl from "./AuthSessionControl";
import { UserAccessProvider, WorkspaceAccessGate } from "./UserAccessProvider";
import { workspaceStyles as styles } from "./ui/workspace-styles";

export default function AppFrame({ children, sidebar = true, theme = "white" }: { children: ReactNode; sidebar?: boolean; theme?: "white" | "modern-white" | "glass-dark" }) {
  return <UserAccessProvider><WorkspaceTheme theme={theme} className={`${styles.frame} [&:has([data-workspace-error])_[data-app-shortcuts]]:ring-[#ef7070]! [&:has([data-workspace-error])_[data-app-shortcuts]]:shadow-[0_0_18px_#ef707080]! [&:has([data-workspace-loading])_[data-app-shortcuts]]:ring-2 [&:has([data-workspace-loading])_[data-app-shortcuts]]:ring-[#f2a93b]! [&:has([data-workspace-loading])_[data-app-shortcuts]]:shadow-[0_0_18px_#f2a93b80]`}>
    <Suspense fallback={<div aria-hidden="true" className="sticky top-5 h-[calc(100dvh-40px)] w-[76px] shrink-0 rounded-[27px] bg-[#d5d6d3] shadow-[inset_1px_1px_2px_#ffffff70,7px_8px_20px_#62665e23] max-[1100px]:top-3.5 max-[1100px]:h-[calc(100dvh-28px)] max-[760px]:static max-[760px]:h-14 max-[760px]:w-full max-[760px]:rounded-[20px]" />}>
      <AppShortcuts />
    </Suspense>
    {sidebar && <Suspense fallback={<div aria-hidden="true" className={`${styles.sidebar} animate-pulse`} />}><Sidebar /></Suspense>}
    <main className={`${styles.main} [&:has(.loan-theme)]:[background:#f8f3fc] [&:has(.loan-theme)]:[--text:#2d1c43] [&:has(.loan-theme)]:[--muted:#776587] [&:has(.loan-theme)]:[border-color:#eadcf5]`} id="workspace-content">
      <AuthSessionControl />
      <Suspense fallback={<div aria-live="polite" className="mx-auto mt-12 max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--muted)]">กำลังตรวจสอบสิทธิ์การเข้าถึง…</div>}>
        <WorkspaceAccessGate>{children}</WorkspaceAccessGate>
      </Suspense>
    </main>
  </WorkspaceTheme></UserAccessProvider>;
}
