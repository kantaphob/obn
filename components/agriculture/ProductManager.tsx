"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, Sprout, X } from "lucide-react";

type Product = {
  id: string;
  barcode: string | null;
  name: string;
  formula: string;
  brand: string;
  other: string;
};

const inputClass = "mt-1.5 w-full rounded-xl border border-[#d7d9d0] bg-white px-3 py-2.5 text-sm text-[#272b29] outline-none transition placeholder:text-[#a3a69f] focus:border-[#6e927e] focus:ring-2 focus:ring-[#6e927e]/15";

export function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      const response = await fetch("/api/agriculture/products", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "โหลดรายการสินค้าไม่สำเร็จ");
      setProducts(result.products);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "โหลดรายการสินค้าไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/agriculture/products", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "โหลดรายการสินค้าไม่สำเร็จ");
        return result.products as Product[];
      })
      .then((items) => { if (active) setProducts(items); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "โหลดรายการสินค้าไม่สำเร็จ"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/agriculture/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "บันทึกสินค้าไม่สำเร็จ");
      setProducts((current) => [result.product, ...current]);
      setIsOpen(false);
      formElement.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "บันทึกสินค้าไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <div className="mt-6 overflow-hidden rounded-2xl border border-[#ddded5] bg-[var(--ws-surface,#faf9f5)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ddded5] px-5 py-4">
        <div><h2 className="text-sm font-semibold text-[#272b29]">รายการสินค้า</h2><p className="mt-1 text-xs text-[#626862]">บาร์โค้ด ชื่อ สูตร แบรนด์ และข้อมูลเพิ่มเติม</p></div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setError(""); setLoading(true); void loadProducts(); }} aria-label="โหลดรายการใหม่" className="grid size-9 place-items-center rounded-xl border border-[#d7d9d0] text-[#626862] hover:bg-[var(--ws-soft,#e9ede3)]"><RefreshCw size={15} aria-hidden="true" /></button>
          <button type="button" onClick={() => { setError(""); setIsOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-[#355a4b] px-3.5 py-2.5 text-xs font-medium text-white transition hover:bg-[#294b3d]"><Plus size={15} aria-hidden="true" /> เพิ่มสินค้า</button>
        </div>
      </div>
      {error && !isOpen && <p role="alert" className="border-b border-[#f0cccc] bg-[#fff5f4] px-5 py-3 text-xs text-[#a33c32]">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-xs">
          <thead className="bg-[var(--ws-soft,#e9e8df)] text-[#626862]"><tr>{["บาร์โค้ด", "ชื่อสินค้า", "สูตร", "แบรนด์", "อื่นๆ"].map((column) => <th key={column} className="whitespace-nowrap px-5 py-3 font-medium">{column}</th>)}</tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="px-5 py-14 text-center text-[#626862]">กำลังโหลดรายการสินค้า…</td></tr> : products.length ? products.map((product) => <tr key={product.id} className="border-t border-[#e6e6de] align-top"><td className="whitespace-nowrap px-5 py-4 text-[#626862]">{product.barcode || "—"}</td><td className="px-5 py-4 font-medium text-[#272b29]">{product.name}</td><td className="px-5 py-4 text-[#626862]">{product.formula || "—"}</td><td className="px-5 py-4 text-[#626862]">{product.brand || "—"}</td><td className="max-w-[260px] whitespace-pre-wrap px-5 py-4 text-[#626862]">{product.other || "—"}</td></tr>) : <tr><td colSpan={5} className="px-5 py-16 text-center"><span className="mx-auto grid size-11 place-items-center rounded-2xl bg-[var(--ws-soft,#e9ede3)] text-[#355a4b]"><Sprout size={20} aria-hidden="true" /></span><p className="mt-3 text-sm font-medium text-[#272b29]">{error || "ยังไม่มีสินค้าในรายการ"}</p><p className="mt-1 text-xs text-[#626862]">กด “เพิ่มสินค้า” เพื่อเริ่มบันทึกข้อมูล</p></td></tr>}
          </tbody>
        </table>
      </div>
    </div>

    {isOpen && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setIsOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="product-form-title" className="my-6 w-full max-w-xl rounded-2xl border border-[#ddded5] bg-[var(--ws-surface,#faf9f5)] shadow-xl">
        <div className="flex items-start justify-between border-b border-[#ddded5] px-5 py-4"><div><p className="text-[10px] font-semibold tracking-[0.16em] text-[#6b7e6c]">AGRICULTURE / PRODUCT</p><h2 id="product-form-title" className="mt-1 text-lg font-semibold text-[#272b29]">เพิ่มสินค้า</h2></div><button type="button" disabled={saving} onClick={() => setIsOpen(false)} aria-label="ปิดหน้าต่าง" className="grid size-8 place-items-center rounded-lg text-[#626862] hover:bg-[var(--ws-soft,#e9ede3)]"><X size={17} aria-hidden="true" /></button></div>
        <form onSubmit={createProduct} className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-medium text-[#4e554e]">บาร์โค้ด<span className="ml-1 font-normal text-[#93988f]">(ไม่บังคับ)</span><input name="barcode" maxLength={80} autoComplete="off" className={inputClass} placeholder="สแกนหรือกรอกรหัสบาร์โค้ด" /></label>
            <label className="text-xs font-medium text-[#4e554e]">ชื่อสินค้า<span className="ml-1 text-[#b54b3d]">*</span><input name="name" maxLength={160} required autoFocus className={inputClass} placeholder="ระบุชื่อสินค้า" /></label>
            <label className="text-xs font-medium text-[#4e554e]">สูตร<input name="formula" maxLength={120} className={inputClass} placeholder="เช่น 15-15-15" /></label>
            <label className="text-xs font-medium text-[#4e554e]">แบรนด์<input name="brand" maxLength={120} className={inputClass} placeholder="ระบุแบรนด์" /></label>
          </div>
          <label className="block text-xs font-medium text-[#4e554e]">อื่นๆ<textarea name="other" maxLength={1000} rows={3} className={`${inputClass} resize-y`} placeholder="รายละเอียดเพิ่มเติม เช่น ขนาดบรรจุหรือหมายเหตุ" /></label>
          {error && <p role="alert" className="rounded-xl bg-[#fff5f4] px-3 py-2.5 text-xs text-[#a33c32]">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-[#e6e6de] pt-4"><button type="button" disabled={saving} onClick={() => setIsOpen(false)} className="rounded-xl border border-[#d7d9d0] px-4 py-2.5 text-xs text-[#626862] hover:bg-[var(--ws-soft,#e9ede3)]">ยกเลิก</button><button type="submit" disabled={saving} className="rounded-xl bg-[#355a4b] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#294b3d] disabled:opacity-60">{saving ? "กำลังบันทึก…" : "บันทึกสินค้า"}</button></div>
        </form>
      </section>
    </div>}
  </>;
}
