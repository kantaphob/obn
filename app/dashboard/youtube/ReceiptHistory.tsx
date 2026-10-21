"use client";
import { useEffect, useState } from "react";
import { formatBillingDate } from "@/lib/youtube-billing";
import type { PaymentRow } from "./BillingCollections";

const money = (satang: number) => `฿${(satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const methods: Record<string, string> = { BANK_TRANSFER: "โอนธนาคาร", PROMPTPAY: "พร้อมเพย์", CASH: "เงินสด", OTHER: "อื่น ๆ" };
export default function ReceiptHistory({ groupId, query, today }: { groupId: string; query: string; today: string }) {
  const [method, setMethod] = useState("ALL");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ payments: PaymentRow[]; total: number; amountSatang: number }>({ payments: [], total: 0, amountSatang: 0 });
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const params = new URLSearchParams({ group: groupId, q: query, method, from, to, page: String(page) }).toString();
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true); setError("");
      fetch(`/api/youtube/payments?${params}`, { signal: controller.signal }).then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "โหลดประวัติไม่สำเร็จ");
        if (!controller.signal.aborted) setData(result);
      }).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "โหลดไม่สำเร็จ"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [params]);
  return <div aria-busy={loading}><div className="yb-historyFilters"><select aria-label="ช่องทางรับเงิน" value={method} onChange={(event) => { setMethod(event.target.value); setPage(1); }}><option value="ALL">ทุกช่องทาง</option>{Object.entries(methods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label>ตั้งแต่<input type="date" value={from} max={to || today} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></label><label>ถึง<input type="date" value={to} min={from || undefined} max={today} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></label><a className="yu-button" href={`/api/youtube/receipts/export?${params}`}>ส่งออกทุกรายการตามตัวกรอง CSV</a></div>{error && <p role="alert">{error}</p>}{loading ? <p role="status">กำลังโหลดประวัติ…</p> : <><div className="yu-tableWrap"><table className="yu-table"><thead><tr><th>รับเงินจริง</th><th>สมาชิก / กลุ่ม</th><th>ยอดรับ</th><th>ช่องทาง / อ้างอิง</th><th>รอบที่ชำระ</th></tr></thead><tbody>{data.payments.map((payment) => <tr key={payment.id}><td>{formatBillingDate(payment.paidOn)}</td><td><strong>{payment.memberName}</strong><small>{payment.groupName} · {payment.email || "ไม่ระบุอีเมล"}</small></td><td>{money(payment.amountSatang)}</td><td>{methods[payment.paymentMethod] || payment.paymentMethod}<small>{payment.reference || "—"}</small>{payment.note && <small>{payment.note}</small>}</td><td>{formatBillingDate(payment.dueDate)}<small>{payment.billingMonths} เดือน</small></td></tr>)}</tbody></table></div>{!data.payments.length && <p className="yu-empty">ไม่พบรายการรับเงิน</p>}<div className="yu-toolbar" style={{ marginTop: 15 }}><span>รวม {data.total} รายการ · {money(data.amountSatang)}</span><div className="yu-actions"><button type="button" className="yu-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>← ก่อนหน้า</button><span>หน้า {page}</span><button type="button" className="yu-button" disabled={page * 100 >= data.total} onClick={() => setPage(page + 1)}>ถัดไป →</button></div></div></>}</div>;
}
