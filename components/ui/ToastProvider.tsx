'use client';

import { Suspense, createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';

type ToastInput = { message: string; status?: 'success' | 'error' | 'info'; action?: { label: string; onClick: () => void } };
type Toast = ToastInput & { id: number };
const ToastContext = createContext<((input: ToastInput) => void) | null>(null);
type LoadStatus = 'success' | 'error' | 'loading';
const StatusContext = createContext<{ status: LoadStatus; report: (status: LoadStatus, key?: string) => void } | null>(null);
const colors = { success: 'border-[#9ac9aa] bg-[var(--ws-soft,#f1faf3)] text-[#24683a]', error: 'border-[#e4aaaa] bg-[#fff5f5] text-[#9f3030]', info: 'border-[#a6bfd8] bg-[var(--ws-surface,#f3f8ff)] text-[#315d88]' };

function PathnameStatusProvider({
  children,
  results,
  report,
  pathnameRef,
}: {
  children: ReactNode;
  results: Record<string, LoadStatus>;
  report: (status: LoadStatus, key?: string) => void;
  pathnameRef: RefObject<string>;
}) {
  const pathname = usePathname();
  useEffect(() => { pathnameRef.current = pathname; }, [pathname, pathnameRef]);
  const scopedResults = Object.entries(results)
    .filter(([key]) => key.startsWith(`${pathname}::`))
    .map(([, value]) => value);
  const status: LoadStatus = scopedResults.includes('loading') ? 'loading' : scopedResults.includes('error') ? 'error' : 'success';

  return <StatusContext.Provider value={{ status, report }}>{children}</StatusContext.Provider>;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<Record<string, LoadStatus>>({});
  const pathnameRef = useRef('/');
  const report = useCallback((status: LoadStatus, key = 'notification') => {
    setResults(previous => {
      const pathname = pathnameRef.current;
      const next = { ...previous, [`${pathname}::${key}`]: status };
      if (status === 'success' && key !== 'notification') {
        const hasFailedRequest = Object.entries(next).some(([entry, value]) => entry.startsWith(`${pathname}::`) && entry !== `${pathname}::notification` && value === 'error');
        if (!hasFailedRequest) next[`${pathname}::notification`] = 'success';
      }
      return next;
    });
  }, []);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const sequence = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const layer = useRef<HTMLDivElement>(null);
  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts(previous => previous.filter(toast => toast.id !== id));
  }, []);
  const notify = useCallback((input: ToastInput) => {
    if (input.status === 'error' || input.status === 'success') report(input.status);
    const id = ++sequence.current;
    setToasts(previous => [...previous.slice(-3), { ...input, id }]);
    timers.current.set(id, setTimeout(() => dismiss(id), input.status === 'error' ? 8000 : 5000));
  }, [dismiss, report]);
  useEffect(() => {
    const activeTimers = timers.current;
    return () => { activeTimers.forEach(clearTimeout); activeTimers.clear(); };
  }, []);
  useEffect(() => {
    if (!layer.current) return;
    if (toasts.length && !layer.current.matches(':popover-open')) layer.current.showPopover();
    if (!toasts.length && layer.current.matches(':popover-open')) layer.current.hidePopover();
  }, [toasts]);

  return <ToastContext.Provider value={notify}><Suspense fallback={<StatusContext.Provider value={{ status: 'success', report }}>{children}</StatusContext.Provider>}><PathnameStatusProvider results={results} report={report} pathnameRef={pathnameRef}>{children}</PathnameStatusProvider></Suspense>{toasts.length > 0 && createPortal(
    <div ref={layer} popover="manual" aria-label="การแจ้งเตือน" className="fixed inset-auto top-4 right-4 m-0 w-[min(380px,calc(100vw-32px))] overflow-visible border-0 bg-transparent p-0 [pointer-events:none] backdrop:bg-transparent">
      <div className="grid gap-3">{toasts.map(({ id, message, status = 'info', action }) => {
        const Icon = status === 'success' ? CheckCircle2 : status === 'error' ? CircleAlert : Info;
        return <div key={id} role={status === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-2xl border p-4 shadow-[0_8px_30px_#0002] [pointer-events:auto] ${colors[status]}`}>
          <Icon size={21} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1"><p className="m-0 text-sm leading-relaxed break-words">{message}</p>{action && <button type="button" className="mt-2 text-xs font-semibold underline" onClick={() => { dismiss(id); action.onClick(); }}>{action.label}</button>}</div>
          <button type="button" aria-label="ปิดการแจ้งเตือน" className="grid size-7 shrink-0 place-items-center rounded-lg hover:bg-black/5 focus-visible:outline-2" onClick={() => dismiss(id)}><X size={16} /></button>
        </div>;
      })}</div>
    </div>, document.body
  )}</ToastContext.Provider>;
}

export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error('useToast requires ToastProvider');
  return notify;
}

export function useWorkspaceStatus() {
  const context = useContext(StatusContext);
  if (!context) throw new Error('useWorkspaceStatus requires ToastProvider');
  return context;
}

export function useTrackedFetch() {
  const { report } = useWorkspaceStatus();
  const active = useRef(new Map<string, number>());
  return useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    const key = `${init?.method || 'GET'}:${url.split('?')[0]}`;
    const generation = (active.current.get(key) || 0) + 1;
    active.current.set(key, generation);
    report('loading', key);
    try {
      const response = await fetch(input, init);
      if (active.current.get(key) === generation) report(response.ok ? 'success' : 'error', key);
      return response;
    } catch (error) {
      if (active.current.get(key) === generation) report(init?.signal?.aborted ? 'success' : 'error', key);
      throw error;
    }
  }, [report]);
}
