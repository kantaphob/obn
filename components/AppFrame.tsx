import { Suspense, type ReactNode } from "react";
import AppShortcuts from "./ui/AppShortcuts";
import Sidebar from "./Sidebar";
import { workspaceStyles as styles } from "./ui/workspace-styles";

export default function AppFrame({ children, sidebar = true }: { children: ReactNode; sidebar?: boolean }) {
  return <div className={`${styles.frame} [&:has([data-workspace-error])_[data-app-shortcuts]]:ring-[#ef7070]! [&:has([data-workspace-error])_[data-app-shortcuts]]:shadow-[0_0_18px_#ef707080]! [&:has([data-workspace-loading])_[data-app-shortcuts]]:ring-2 [&:has([data-workspace-loading])_[data-app-shortcuts]]:ring-[#f2a93b]! [&:has([data-workspace-loading])_[data-app-shortcuts]]:shadow-[0_0_18px_#f2a93b80]`}>
    <Suspense fallback={<div aria-hidden="true" className="sticky top-5 h-[calc(100dvh-40px)] w-[76px] shrink-0 rounded-[27px] bg-[#d5d6d3] shadow-[inset_1px_1px_2px_#ffffff70,7px_8px_20px_#62665e23] max-[1100px]:top-3.5 max-[1100px]:h-[calc(100dvh-28px)] max-[760px]:static max-[760px]:h-14 max-[760px]:w-full max-[760px]:rounded-[20px]" />}>
      <AppShortcuts />
    </Suspense>
    {sidebar && <Sidebar />}
    <main className={styles.main} id="workspace-content">
      {children}
    </main>
  </div>;
}
