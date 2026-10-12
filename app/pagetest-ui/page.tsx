"use client";

import { useEffect, useRef, useState } from "react";

type Viewport = "desktop" | "mobile";
type ToastStatus = "loading" | "success" | "error" | "info" | "warning";

type ToastItem = {
  id: number;
  status: ToastStatus;
  title: string;
  description?: string;
};

function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, number>>(new Map());

  function dismissToast(id: number) {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function showToast(status: ToastStatus, title: string, description?: string) {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, status, title, description }]);
    const timer = window.setTimeout(() => dismissToast(id), status === "loading" ? 2200 : 3600);
    timers.current.set(id, timer);
  }

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  return { toasts, showToast, dismissToast };
}

const toastSamples: { status: ToastStatus; label: string; title: string; description: string }[] = [
  { status: "loading", label: "กำลังโหลด", title: "กำลังโหลดข้อมูล", description: "รอสักครู่ ระบบกำลังทำงาน" },
  { status: "success", label: "สำเร็จ", title: "ดำเนินการสำเร็จ", description: "ข้อมูลได้รับการอัปเดตแล้ว" },
  { status: "error", label: "ผิดพลาด", title: "เกิดข้อผิดพลาด", description: "ไม่สามารถทำรายการได้ ลองอีกครั้ง" },
  { status: "info", label: "ข้อมูล", title: "มีข้อมูลเพิ่มเติม", description: "คุณสามารถเปิดดูรายละเอียดได้" },
  { status: "warning", label: "คำเตือน", title: "โปรดตรวจสอบข้อมูล", description: "มีบางรายการที่ยังไม่สมบูรณ์" },
];

const toastLabels: Record<ToastStatus, string> = {
  loading: "กำลังโหลด",
  success: "สำเร็จ",
  error: "ผิดพลาด",
  info: "ข้อมูล",
  warning: "คำเตือน",
};

export default function PageTestUI() {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [previewVersion, setPreviewVersion] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(true);
  const reloadRequested = useRef(false);
  const { toasts, showToast, dismissToast } = useToast();

  function refreshPreview() {
    setPreviewLoading(true);
    reloadRequested.current = true;
    showToast("loading", "กำลังโหลดหน้า", "กำลังรีเฟรชพรีวิวเว็บไซต์");
    setPreviewVersion((version) => version + 1);
  }

  function finishPreviewLoad() {
    setPreviewLoading(false);
    if (reloadRequested.current) {
      reloadRequested.current = false;
      showToast("success", "โหลดหน้าเสร็จแล้ว", "พรีวิวพร้อมใช้งาน");
    }
  }

  function openInWindow() {
    window.open("/", "_blank", "noopener,noreferrer,width=1440,height=960");
  }

  return (
    <main className="page-test-shell">
      <header className="page-test-header">
        <a className="page-test-brand" href="/" aria-label="OBNITHI CON หน้าหลัก">
          <span className="page-test-brand-mark" aria-hidden="true">O</span>
          <span>OBNITHI <b>CON</b></span>
        </a>
        <div className="page-test-header-context">
          <span className="page-test-context-dot" />
          พื้นที่ทดลอง UI
        </div>
        <a className="page-test-back-link" href="/">กลับหน้าหลัก <span aria-hidden="true">↗</span></a>
      </header>

      <section className="page-test-content">
        <div className="page-test-intro">
          <div>
            <div className="page-test-eyebrow"><span /> PREVIEW WORKSPACE</div>
            <h1>ทดลองหน้าจอก่อนใช้งาน</h1>
            <p>เปิดดูหน้าจัดการข้อมูลในกรอบตัวอย่าง หรือแยกไปทดลองในหน้าต่างใหม่</p>
          </div>
          <div className="page-test-safe-note"><span aria-hidden="true">✦</span> โหมดตัวอย่าง · ข้อมูลที่บันทึกจะอยู่ในระบบจริง</div>
        </div>

        <section className="page-test-toast-lab" aria-labelledby="toast-lab-title">
          <div className="page-test-toast-lab-copy">
            <span className="page-test-toast-lab-icon" aria-hidden="true">✳</span>
            <span><strong id="toast-lab-title">Toast สถานะ</strong><small>ทดลองแจ้งเตือนแต่ละรูปแบบ · แสดงที่มุมขวาบน</small></span>
          </div>
          <div className="page-test-toast-samples">
            {toastSamples.map((sample) => (
              <button
                key={sample.status}
                type="button"
                className={`page-test-toast-sample ${sample.status}`}
                onClick={() => showToast(sample.status, sample.title, sample.description)}
              >
                <span />{sample.label}
              </button>
            ))}
          </div>
        </section>

        <div className="page-test-toolbar">
          <div className="page-test-target">
            <span className="page-test-target-icon" aria-hidden="true">⌘</span>
            <span><small>หน้าเป้าหมาย</small><strong>/</strong></span>
          </div>
          <div className="page-test-toolbar-actions">
            <div className="page-test-view-switch" aria-label="ขนาดหน้าตัวอย่าง">
              <button
                type="button"
                className={viewport === "desktop" ? "selected" : ""}
                onClick={() => setViewport("desktop")}
                aria-pressed={viewport === "desktop"}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="3" width="15" height="10.5" rx="1.5" /><path d="M7 17h6M10 13.5V17" /></svg>
                เดสก์ท็อป
              </button>
              <button
                type="button"
                className={viewport === "mobile" ? "selected" : ""}
                onClick={() => setViewport("mobile")}
                aria-pressed={viewport === "mobile"}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5.5" y="2" width="9" height="16" rx="2" /><path d="M8.5 15.5h3" /></svg>
                มือถือ
              </button>
            </div>
            <button
              className="page-test-refresh"
              type="button"
              onClick={refreshPreview}
              aria-label="รีเฟรชหน้าตัวอย่าง"
              title="รีเฟรชหน้าตัวอย่าง"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16.5 7.5A6.8 6.8 0 0 0 4.7 5.2L3 7m0 0V3.8M3 7h3.2M3.5 12.5a6.8 6.8 0 0 0 11.8 2.3L17 13m0 0v3.2M17 13h-3.2" /></svg>
            </button>
            <button className="page-test-launch" type="button" onClick={openInWindow}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M11 3h6v6M17 3l-8 8" /><path d="M15 11v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" /></svg>
              เปิดในหน้าต่างใหม่
            </button>
          </div>
        </div>

        <section className="page-test-preview-card" aria-label="หน้าตัวอย่าง">
          <div className="page-test-window-bar">
            <div className="page-test-window-dots" aria-hidden="true"><i /><i /><i /></div>
            <div className="page-test-address"><span aria-hidden="true">⌑</span> localhost:3000/</div>
            <div className={`page-test-window-label ${previewLoading ? "is-loading" : ""}`}><span /> {previewLoading ? "กำลังโหลด" : "พร้อมแสดงผล"}</div>
          </div>
          <div className="page-test-viewport-stage">
            <div className={`page-test-frame-wrap ${viewport}`}>
              {previewLoading && <div className="page-test-loading" role="status"><span className="page-test-spinner" /><strong>กำลังโหลดหน้าตัวอย่าง</strong><small>กำลังเชื่อมต่อกับหน้าเว็บไซต์</small></div>}
              <iframe
                key={previewVersion}
                src="/"
                title="ตัวอย่างเว็บไซต์ OBNITHI CON"
                className="page-test-iframe"
                onLoad={finishPreviewLoad}
              />
            </div>
          </div>
        </section>

        <footer className="page-test-footer">
          <span><i /> พรีวิวกำลังแสดงหน้าเว็บไซต์ OBNITHI CON</span>
          <span>เลือกขนาดจอเพื่อดูการจัดวาง</span>
        </footer>
      </section>
      <div className="page-test-toast-stack" aria-live="polite" aria-relevant="additions removals">
        {toasts.map((toast) => (
          <div key={toast.id} className={`page-test-toast ${toast.status}`} role={toast.status === "error" ? "alert" : "status"}>
            <span className="page-test-toast-symbol" aria-hidden="true">
              {toast.status === "loading" ? <i /> : toast.status === "success" ? "✓" : toast.status === "error" ? "!" : toast.status === "warning" ? "⚠" : "i"}
            </span>
            <span className="page-test-toast-copy"><strong>{toast.title}</strong>{toast.description && <small>{toast.description}</small>}</span>
            <span className="page-test-toast-kind">{toastLabels[toast.status]}</span>
            <button type="button" onClick={() => dismissToast(toast.id)} aria-label="ปิดการแจ้งเตือน">×</button>
          </div>
        ))}
      </div>
    </main>
  );
}
