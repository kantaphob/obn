'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { LoaderCircle, Trash2 } from 'lucide-react';

export default function ConfirmDelete({ name, busy, onConfirm, onCancel, description, children }: {
  name: string;
  description?: string;
  children?: ReactNode;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return <dialog data-confirm-delete ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} aria-busy={busy} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }} className="fixed inset-0 m-auto w-[min(420px,calc(100vw-32px))] rounded-[24px] border border-white/70 bg-[var(--ws-soft,#f5f3ed)] p-6 text-[#272b29] shadow-[0_16px_60px_#0004] backdrop:bg-black/40">
    <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-red-100 text-red-700"><Trash2 size={23} aria-hidden="true" /></span>
    <h2 id={`${id}-title`} className="m-0 text-xl font-semibold">ยืนยันการลบ</h2>
    <p id={`${id}-description`} className="mt-3 text-sm leading-relaxed">{description || <>ต้องการลบ “{name}” หรือไม่? ข้อมูลจะถูกลบออกจากระบบ</>}</p>
    {children}
    <div className="mt-6 flex justify-end gap-3">
      <button type="button" autoFocus disabled={busy} onClick={onCancel} className="min-h-11 rounded-xl border border-[#c9c8bf] bg-white/70 px-5 text-sm disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2">ยกเลิก</button>
      <button type="button" disabled={busy} onClick={onConfirm} className="flex min-h-11 items-center gap-2 rounded-xl bg-[#ae3232] px-5 text-sm text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">{busy && <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}{busy ? 'กำลังลบ…' : 'ยืนยันการลบ'}</button>
    </div>
  </dialog>;
}
