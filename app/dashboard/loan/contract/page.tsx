"use client";

import "../lending-ui.css";

import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { BadgeCheck, Check, ChevronDown, ChevronRight, FileText, LoaderCircle, Search, UserRound, X } from "lucide-react";

type Borrower = {
  id: string;
  borrowersCode: string;
  nickname: string | null;
  phone: string;
  nationalId: string | null;
  prefixTH: string | null;
  firstName: string;
  lastName: string | null;
  address: string | null;
  approvedLimit: number | null;
  availableLimit: number | null;
};

function borrowerName(borrower: Borrower) {
  const name = [borrower.prefixTH, borrower.firstName, borrower.lastName]
    .filter(Boolean)
    .join(" ");
  return name || borrower.nickname || "ไม่ระบุชื่อ";
}

function formatNationalId(value: string | null) {
  if (!value) return "ไม่มีข้อมูลเลขบัตร";
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 13) return value;
  return `${digits.slice(0, 1)}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits.slice(12)}`;
}

function formatBaht(satang: number | null) {
  if (satang === null) return "—";
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(satang / 100);
}

function satangFromBaht(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount <= Number.MAX_SAFE_INTEGER / 100
    ? Math.round(amount * 100)
    : null;
}

function SignatureCanvas({ value, onChange }: { value: string; onChange: (signature: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(bounds.width * scale));
    canvas.height = Math.max(1, Math.floor(bounds.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(scale, scale);
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#263c2f";
  }, []);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  function startDrawing(event: PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const canvas = event.currentTarget;
    canvas.setPointerCapture(event.pointerId);
    const context = canvas.getContext("2d");
    const { x, y } = point(event);
    context?.beginPath();
    context?.moveTo(x, y);
    drawingRef.current = true;
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    event.preventDefault();
    const { x, y } = point(event);
    const context = event.currentTarget.getContext("2d");
    context?.lineTo(x, y);
    context?.stroke();
    hasDrawnRef.current = true;
  }

  function stopDrawing(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    onChange(hasDrawnRef.current ? event.currentTarget.toDataURL("image/png") : "");
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawnRef.current = false;
    onChange("");
  }

  return <div className="contract-signature-pad lx-sign">
    <canvas ref={canvasRef} aria-label="พื้นที่เขียนลายเซ็นดิจิทัล" onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={stopDrawing} onPointerCancel={stopDrawing} />
    <div className="contract-signature-pad-footer lx-sign-foot"><span>ลงลายเซ็นในกรอบนี้</span><button type="button" onClick={clear} disabled={!value}>ล้างลายเซ็น</button></div>
  </div>;
}

type ContractDraft = {
  contractNumber: string;
  principal: string;
  interestRateChoice: "0" | "5" | "10" | "15" | "20" | "25" | "CUSTOM";
  customInterestRate: string;
  paymentOption: "INSTALLMENT" | "UPFRONT" | "AT_DUE";
  installmentMonths: string;
  periodDays: string;
  startDate: string;
  dueDate: string;
  contractType: "NONE" | "WITNESS" | "WITNESS_GUARANTOR";
  documentUrl: string;
  signedAt: string;
  witness1: string;
  witness2: string;
  guarantor: string;
  status: "DRAFT" | "AWAITING_DOCUMENT" | "READY" | "ACTIVE" | "OVERDUE" | "CLOSED";
  lateFeeWaived: boolean;
  signatureMode: "PRINT" | "DIGITAL";
  consentAccepted: boolean;
  note: string;
};

const emptyContract: ContractDraft = {
  contractNumber: "",
  principal: "",
  interestRateChoice: "0",
  customInterestRate: "",
  paymentOption: "INSTALLMENT",
  installmentMonths: "",
  periodDays: "",
  startDate: "",
  dueDate: "",
  contractType: "NONE",
  documentUrl: "",
  signedAt: "",
  witness1: "",
  witness2: "",
  guarantor: "",
  status: "DRAFT",
  lateFeeWaived: false,
  signatureMode: "PRINT",
  consentAccepted: false,
  note: "",
};

export default function Contract() {
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeBorrower, setActiveBorrower] = useState(-1);
  const borrowerSearchRef = useRef<HTMLInputElement>(null);
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [selected, setSelected] = useState<Borrower | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [contract, setContract] = useState<ContractDraft>(emptyContract);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedContractNumber, setSavedContractNumber] = useState("");
  const [digitalSignature, setDigitalSignature] = useState("");
  const [nextNumberLoading, setNextNumberLoading] = useState(false);

  const isInstallment = contract.paymentOption === "INSTALLMENT";
  const interestRate = contract.interestRateChoice === "CUSTOM"
    ? Number(contract.customInterestRate)
    : Number(contract.interestRateChoice);
  const principalSatang = satangFromBaht(contract.principal);
  const installmentMonths = Number(contract.installmentMonths);
  const interestFactor = isInstallment ? installmentMonths : 1;
  const calculatedInterest = principalSatang !== null && Number.isFinite(interestRate) && interestRate >= 0 && interestFactor > 0
    ? Math.round(principalSatang * interestRate / 100 * interestFactor)
    : null;
  const calculatedNetDisbursed = principalSatang !== null && calculatedInterest !== null
    ? contract.paymentOption === "UPFRONT" ? principalSatang - calculatedInterest : principalSatang
    : null;
  const monthlyInstallment = isInstallment && calculatedInterest !== null && principalSatang !== null && installmentMonths > 0
    ? Math.round((principalSatang + calculatedInterest) / installmentMonths)
    : null;

  function updateContract<K extends keyof ContractDraft>(key: K, value: ContractDraft[K]) {
    setContract((current) => ({ ...current, [key]: value }));
    setSaveError("");
  }

  async function saveContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    if (principalSatang === null || calculatedInterest === null || calculatedNetDisbursed === null) {
      setSaveError("กรุณากรอกเงินต้น จำนวนเดือน และอัตราดอกเบี้ยให้ถูกต้อง");
      return;
    }
    if (!Number.isFinite(interestRate)) {
      setSaveError("กรุณาระบุอัตราดอกเบี้ย");
      return;
    }
    if (contract.signatureMode === "DIGITAL" && (!contract.consentAccepted || !digitalSignature)) {
      setSaveError("กรุณาเขียนลายเซ็นและยอมรับคำยินยอมก่อนบันทึก");
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...contract,
          debtorId: selected.id,
          principal: principalSatang,
          interestRate,
          interestAmount: calculatedInterest,
          netDisbursed: calculatedNetDisbursed,
          periodDays: contract.periodDays ? Number(contract.periodDays) : null,
          installmentMonths: isInstallment ? Number(contract.installmentMonths) : null,
          repayType: isInstallment ? "INSTALLMENT" : "LUMP_SUM",
          interestMode: contract.paymentOption === "UPFRONT" ? "UPFRONT" : "ON_SCHEDULE",
          interestRateBasis: isInstallment ? "MONTHLY_FLAT" : "CONTRACT_FLAT",
          lateFeePerDay: 5000,
          lateFeeWaived: contract.lateFeeWaived,
          signatureMode: contract.signatureMode,
          signatureData: contract.signatureMode === "DIGITAL" ? digitalSignature : null,
          consentAccepted: contract.signatureMode === "DIGITAL" ? contract.consentAccepted : false,
          consentText: contract.signatureMode === "DIGITAL" ? "ข้าพเจ้ายืนยันว่าลายเซ็นดิจิทัลที่บันทึกเป็นลายเซ็นจริงของข้าพเจ้า และยินยอมใช้ลายเซ็นนี้ประกอบสัญญา" : null,
          dueDate: contract.dueDate || null,
          signedAt: contract.signedAt || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "บันทึกสัญญาไม่สำเร็จ");
      setSavedContractNumber(result.contractNumber as string);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "บันทึกสัญญาไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  function clearSearch() {
    setQuery("");
    setBorrowers([]);
    setSearched(false);
    setError("");
    setLoading(false);
  }

  function chooseBorrower(borrower: Borrower) {
    setSelected(borrower);
    setDropdownOpen(false);
    setQuery("");
    setActiveBorrower(-1);
    setContract((current) => ({ ...current, contractNumber: "", signedAt: current.signedAt || new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date()).replace(" ", "T") }));
    setNextNumberLoading(true);
    setSavedContractNumber("");
  }

  useEffect(() => {
    const term = query.trim();
    if (!dropdownOpen) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/borrowers?q=${encodeURIComponent(term)}&take=20`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("ค้นหาข้อมูลผู้กู้ไม่สำเร็จ กรุณาลองอีกครั้ง");
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error("รูปแบบข้อมูลผู้กู้ไม่ถูกต้อง");
        setBorrowers(data as Borrower[]);
        setSearched(true);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "เกิดข้อผิดพลาดในการค้นหา");
        setBorrowers([]);
        setSearched(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, dropdownOpen]);

  useEffect(() => {
    if (!selected || contract.contractNumber) return;
    const controller = new AbortController();
    fetch("/api/contracts", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "สร้างเลขที่สัญญาไม่สำเร็จ");
        setContract((current) => current.contractNumber ? current : { ...current, contractNumber: data.contractNumber });
      })
      .catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          setSaveError(cause instanceof Error ? cause.message : "สร้างเลขที่สัญญาไม่สำเร็จ");
        }
      })
      .finally(() => { if (!controller.signal.aborted) setNextNumberLoading(false); });
    return () => controller.abort();
  }, [selected, contract.contractNumber]);

  return (
    <main className="page-wrap contract-page lx-page"><div className="lx-wrap">
      <div className="contract-heading lx-head">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" /> LOAN MANAGEMENT</div>
          <h1>บันทึกสัญญากู้</h1>
          <p>ค้นหาและเลือกผู้กู้เพื่อเริ่มบันทึกสัญญา</p>
        </div>
        <div className="contract-heading-icon" aria-hidden="true"><FileText size={20} /></div>
      </div>

      <div className="lx-contract" style={!selected ? { gridTemplateColumns: "minmax(0,1fr)" } : undefined}><div className="lx-contract-main">
      <ol className="contract-steps contract-six-steps" aria-label="ขั้นตอนบันทึกสัญญา">
        {["ผู้กู้", "รายละเอียดสัญญา", "ยอดกู้", "เอกสาร", "ลงนาม", "หมายเหตุ"].map((title, index) => <li key={title} className={`contract-step ${index === 0 ? selected ? "is-ready" : "is-current" : selected ? "is-ready" : "is-locked"}`}><span className="contract-step-number">{index + 1}</span><strong>{title}</strong></li>)}
      </ol>

      <section className="contract-panel lx-panel" aria-labelledby="borrower-search-title">
        <div className="contract-panel-heading">
          <div className="contract-panel-icon"><UserRound size={18} /></div>
          <div>
            <h2 id="borrower-search-title"><span className="contract-section-number">01</span> ค้นหาและเลือกผู้กู้</h2>
            <p>ค้นหาด้วยชื่อ เลขบัตรประชาชน หรือรหัสผู้กู้</p>
          </div>
        </div>

        <div className="contract-borrower-combobox" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropdownOpen(false); }}>
        <label className="contract-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">ค้นหาชื่อ เลขบัตรประชาชน หรือรหัสผู้กู้</span>
          <input
            ref={borrowerSearchRef}
            role="combobox"
            aria-expanded={dropdownOpen}
            aria-controls="contract-borrower-options"
            aria-autocomplete="list"
            aria-activedescendant={dropdownOpen && activeBorrower >= 0 ? `borrower-option-${activeBorrower}` : undefined}
            onFocus={() => { setDropdownOpen(true); setActiveBorrower(-1); }}
            onKeyDown={event => {
              if (event.key === "Escape") { event.preventDefault(); setDropdownOpen(false); }
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault(); setDropdownOpen(true);
                setActiveBorrower(current => borrowers.length === 0 ? -1 : event.key === "ArrowDown" ? Math.min(current + 1, borrowers.length - 1) : Math.max(current - 1, 0));
              }
              if (event.key === "Enter" && dropdownOpen) { event.preventDefault(); if (!loading && borrowers[activeBorrower]) chooseBorrower(borrowers[activeBorrower]); }
            }}
            value={!dropdownOpen && selected ? `${selected.borrowersCode} · ${borrowerName(selected)}` : query}
            onChange={(event) => {
              const value = event.target.value;
              setDropdownOpen(true);
              setActiveBorrower(-1);
              setBorrowers([]);
              setLoading(true);
              setQuery(value);
              if (!value.trim()) {
                clearSearch();
              }
            }}
            placeholder="พิมพ์ชื่อ เลขบัตรประชาชน หรือรหัสผู้กู้"
            autoComplete="off"
          />
          {loading && <LoaderCircle className="contract-spinner" size={17} aria-label="กำลังค้นหา" />}
          {query && !loading && (
            <button className="contract-clear" type="button" aria-label="ล้างคำค้นหา" onClick={clearSearch}>
              <X size={16} />
            </button>
          )}
          <button type="button" className="contract-dropdown-toggle" aria-label={dropdownOpen ? "ปิดรายชื่อผู้กู้" : "เปิดรายชื่อผู้กู้"} aria-expanded={dropdownOpen} aria-controls="contract-borrower-options" onMouseDown={event => event.preventDefault()} onClick={() => {
            if (dropdownOpen) setDropdownOpen(false);
            else { setDropdownOpen(true); setActiveBorrower(-1); borrowerSearchRef.current?.focus(); }
          }}><ChevronDown size={18} aria-hidden="true" /></button>
        </label>



        {error && <div className="contract-error" role="alert">{error}</div>}
        {dropdownOpen && !error && searched && !loading && borrowers.length === 0 && (
          <div className="contract-empty">
            <span className="contract-empty-icon"><UserRound size={20} /></span>
            <strong>ไม่พบข้อมูลผู้กู้</strong>
            <span>ลองตรวจสอบคำค้นหา หรือค้นหาด้วยชื่อ เลขบัตร หรือรหัสผู้กู้</span>
          </div>
        )}
        {dropdownOpen && (
          <div className="contract-results contract-dropdown-results" id="contract-borrower-options" role="listbox" aria-label="รายชื่อผู้กู้">
            <div className="contract-results-label">{loading ? "กำลังค้นหา…" : "เลือกผู้กู้"} <span>{borrowers.length} รายการ</span></div>
            {borrowers.map((borrower, index) => {
              const isSelected = borrower.id === selected?.id;
              return (
                <button
                  className={`contract-borrower ${isSelected || activeBorrower === index ? "is-selected" : ""}`}
                  key={borrower.id}
                  type="button"
                  onClick={() => chooseBorrower(borrower)}
                  id={`borrower-option-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={event => event.preventDefault()}
                >
                  <span className="contract-borrower-avatar" aria-hidden="true">
                    {borrower.firstName?.slice(0, 1) || borrower.nickname?.slice(0, 1) || "ผ"}
                  </span>
                  <span className="contract-borrower-main">
                    <strong>{borrowerName(borrower)}</strong>
                    <small>รหัส {borrower.borrowersCode} <i /> {formatNationalId(borrower.nationalId)}</small>
                  </span>
                  <span className="contract-borrower-phone">{borrower.phone || "ไม่มีเบอร์โทร"}</span>
                  <span className="contract-borrower-action">
                    {isSelected ? <BadgeCheck size={19} /> : <ChevronRight size={19} />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        </div>
        <p className="contract-search-hint">คลิกเพื่อเลือกรายชื่อ หรือพิมพ์ชื่อ เลขบัตร และรหัสผู้กู้ · ใช้ ↑ ↓ และ Enter เพื่อเลือก</p>
      </section>

      {selected && (
        <>
          <section className="contract-selected" aria-labelledby="selected-borrower-title">
            <div className="contract-selected-heading">
              <div>
                <div className="contract-selected-kicker"><BadgeCheck size={15} /> เลือกผู้กู้แล้ว</div>
                <h2 id="selected-borrower-title">ข้อมูลผู้กู้สำหรับสัญญา</h2>
              </div>
              <button type="button" className="contract-change" onClick={() => { setDropdownOpen(true); borrowerSearchRef.current?.focus(); }}>เปลี่ยนผู้กู้</button>
            </div>
            <div className="contract-selected-content">
              <div className="contract-selected-avatar">{selected.firstName?.slice(0, 1) || selected.nickname?.slice(0, 1) || "ผ"}</div>
              <div className="contract-selected-name"><strong>{borrowerName(selected)}</strong><span>รหัสผู้กู้ {selected.borrowersCode}</span></div>
              <div className="contract-selected-detail"><small>เลขบัตรประชาชน</small><strong>{formatNationalId(selected.nationalId)}</strong></div>
              <div className="contract-selected-detail"><small>เบอร์โทรศัพท์</small><strong>{selected.phone || "—"}</strong></div>
              <div className="contract-selected-detail"><small>วงเงินคงเหลือ</small><strong>{formatBaht(selected.availableLimit ?? selected.approvedLimit)}</strong></div>
            </div>
            <div className="contract-selected-foot">สัญญาที่บันทึกจะเชื่อมกับผู้กู้รายนี้</div>
          </section>

          <section className="contract-form-panel" aria-labelledby="contract-details-title">
            <div className="contract-panel-heading">
              <div className="contract-panel-icon"><FileText size={18} /></div>
              <div>
                <h2 id="contract-details-title">รายละเอียดสัญญา</h2>
                <p>กรอกข้อมูลให้ตรงตามเงื่อนไขและตัวแปรของฐานข้อมูล</p>
              </div>
            </div>

            {savedContractNumber ? (
              <>
                <div className="contract-saved lx-saved" role="status">
                  <span><Check size={18} /></span>
                  <div><strong>บันทึกสัญญาเรียบร้อย</strong><small>เลขที่สัญญา {savedContractNumber}</small></div>
                </div>
                <article className="contract-print-sheet lx-sheet">
                  <header><strong>สัญญากู้ยืมเงิน</strong><span>เลขที่ {savedContractNumber}</span></header>
                  <p>ผู้กู้: {borrowerName(selected)} (รหัส {selected.borrowersCode})</p>
                  <p>เงินต้น {formatBaht(principalSatang)} · อัตราดอกเบี้ย {interestRate}% · ดอกเบี้ยรวม {formatBaht(calculatedInterest)}</p>
                  <p>ยอดจ่ายสุทธิ {formatBaht(calculatedNetDisbursed)} · ครบกำหนด {contract.dueDate}</p>
                  <p>วิธีชำระ: {contract.paymentOption === "INSTALLMENT" ? `ผ่อน ${contract.installmentMonths} เดือน เดือนละประมาณ ${formatBaht(monthlyInstallment)}` : contract.paymentOption === "UPFRONT" ? "หักดอกเบี้ยก่อน แล้วคืนเงินต้นวันครบกำหนด" : "ชำระเงินต้นและดอกเบี้ยวันครบกำหนด"}</p>
                  <p>ค่าปรับล่าช้า: {contract.lateFeeWaived ? "ละเว้นค่าปรับ" : "วันละ 50 บาท"}</p>
                  <p>ประเภทเอกสาร: {contract.contractType === "NONE" ? "ไม่ใช้เอกสารสัญญา" : contract.contractType === "WITNESS" ? "สัญญาพร้อมพยาน 2 คน" : "สัญญาพร้อมพยาน 2 คนและผู้ค้ำประกัน"}</p>
                  {contract.note && <p>หมายเหตุ: {contract.note}</p>}
                  <footer><span>ลงชื่อผู้กู้ __________________________</span><span>ลงชื่อพยาน __________________________</span><span>ลงชื่อพยาน __________________________</span>{contract.contractType === "WITNESS_GUARANTOR" && <span>ลงชื่อผู้ค้ำประกัน __________________________</span>}</footer>
                </article>
                <div className="contract-print-actions"><button type="button" className="secondary-button lx-btn" onClick={() => window.print()}>พิมพ์เอกสารเพื่อลงนาม</button><button type="button" className="secondary-button lx-btn" onClick={() => window.print()}>ส่งออก PDF</button></div>
              </>
            ) : (
              <form className="contract-form" onSubmit={saveContract}>
                <div className="contract-form-section">
                  <h3><span className="contract-section-number">02</span> รายละเอียดสัญญา</h3>
                  <p className="contract-section-caption">เลือกรูปแบบการชำระและกำหนดระยะเวลาก่อนคำนวณยอดกู้</p>
                  <div className="contract-form-grid">
                    <label className="contract-field lx-field"><span>เลขที่สัญญา (รันอัตโนมัติ) <b>*</b></span><input readOnly maxLength={80} value={contract.contractNumber} placeholder={nextNumberLoading ? "กำลังสร้างเลขที่..." : "รอเลขที่สัญญา"} /></label>
                    <label className="contract-field lx-field"><span>สถานะ</span><select value={contract.status} onChange={(e) => updateContract("status", e.target.value as ContractDraft["status"])}><option value="DRAFT">ร่าง</option><option value="AWAITING_DOCUMENT">รอเอกสารสัญญา</option><option value="READY">พร้อมจ่ายเงิน</option><option value="ACTIVE">กำลังดำเนินการ</option><option value="OVERDUE">เกินกำหนด</option><option value="CLOSED">ปิดสัญญา</option></select></label>
                  </div>
                  <fieldset className="contract-payment-options"><legend>เลือกรูปแบบการชำระ <b>*</b></legend>
                    <label className={contract.paymentOption === "INSTALLMENT" ? "is-active" : ""}><input type="radio" name="payment-option" checked={contract.paymentOption === "INSTALLMENT"} onChange={() => updateContract("paymentOption", "INSTALLMENT")} /><span><strong>ผ่อนชำระรายเดือน</strong><small>กำหนดจำนวนเดือน ระบบคำนวณเงินต้น ดอกเบี้ย และยอดผ่อน</small></span></label>
                    <label className={contract.paymentOption === "UPFRONT" ? "is-active" : ""}><input type="radio" name="payment-option" checked={contract.paymentOption === "UPFRONT"} onChange={() => updateContract("paymentOption", "UPFRONT")} /><span><strong>ชำระตามสัญญา — หักดอกเบี้ยก่อน</strong><small>หักดอกเบี้ยจากเงินที่จ่ายให้ผู้กู้ แล้วคืนเงินต้นตามวันครบกำหนด</small></span></label>
                    <label className={contract.paymentOption === "AT_DUE" ? "is-active" : ""}><input type="radio" name="payment-option" checked={contract.paymentOption === "AT_DUE"} onChange={() => updateContract("paymentOption", "AT_DUE")} /><span><strong>ชำระตามสัญญา — ไม่หักดอกเบี้ยก่อน</strong><small>จ่ายเงินต้นเต็มจำนวน และชำระเงินต้นพร้อมดอกเบี้ยตามวันครบกำหนด</small></span></label>
                  </fieldset>
                  <div className="contract-form-grid contract-payment-fields">
                    {isInstallment && <label className="contract-field lx-field"><span>จำนวนเดือน <b>*</b></span><input required type="number" min="1" max="360" step="1" value={contract.installmentMonths} onChange={(e) => updateContract("installmentMonths", e.target.value)} placeholder="เช่น 6" /></label>}
                    {!isInstallment && <label className="contract-field lx-field"><span>รอบชำระดอกเบี้ย (วัน) <small>ถ้ามี</small></span><input type="number" min="1" max="3650" step="1" value={contract.periodDays} onChange={(e) => updateContract("periodDays", e.target.value)} placeholder="เว้นว่างหากจ่ายครั้งเดียว" /></label>}
                    <label className="contract-field lx-field"><span>วันที่เริ่มสัญญา <b>*</b></span><input required type="date" value={contract.startDate} onChange={(e) => updateContract("startDate", e.target.value)} /></label>
                    <label className="contract-field lx-field"><span>วันครบกำหนด <b>*</b></span><input required type="date" value={contract.dueDate} onChange={(e) => updateContract("dueDate", e.target.value)} /></label>
                  </div>

                  <div className="contract-late-fee"><span><strong>ค่าปรับเกินกำหนด</strong><small>คิดวันละ 50 บาท</small></span><label><input type="checkbox" checked={contract.lateFeeWaived} onChange={(e) => updateContract("lateFeeWaived", e.target.checked)} /><span>ละเว้นค่าปรับ</span></label></div>
                </div>

                <div className="contract-form-section">
                  <h3><span className="contract-section-number">03</span> ยอดกู้และการคำนวณ</h3>
                  <p className="contract-section-caption">กรอกเงินต้นและอัตราดอกเบี้ย ระบบสรุปยอดให้โดยอัตโนมัติ</p>
                  <div className="contract-form-grid">                    <label className="contract-field lx-field"><span>เงินต้น (บาท) <b>*</b></span><input required inputMode="decimal" value={contract.principal} onChange={(e) => updateContract("principal", e.target.value)} placeholder="0.00" /></label>
                    <fieldset className="contract-field contract-rate-field"><legend>อัตราดอกเบี้ย (%) {isInstallment ? "ต่อเดือน" : "ตามสัญญา"} <b>*</b></legend><div className="contract-rate-options">{["0", "5", "10", "15", "20", "25", "CUSTOM"].map((rate) => <label key={rate} className={contract.interestRateChoice === rate ? "is-active" : ""}><input type="radio" name="interest-rate" value={rate} checked={contract.interestRateChoice === rate} onChange={() => updateContract("interestRateChoice", rate as ContractDraft["interestRateChoice"])} /><span>{rate === "CUSTOM" ? "กำหนดเอง" : `${rate}%`}</span></label>)}</div>{contract.interestRateChoice === "CUSTOM" && <input className="contract-custom-rate" required type="number" min="0" max="1000" step="0.01" value={contract.customInterestRate} onChange={(e) => updateContract("customInterestRate", e.target.value)} placeholder="ระบุอัตราดอกเบี้ย (%)" />}</fieldset>


                  </div>
                  <div className="contract-money-summary" aria-live="polite">
                    <article><span>เงินต้นตามสัญญา</span><strong>{formatBaht(principalSatang)}</strong></article>
                    <article><span>{isInstallment ? "ดอกเบี้ยรวมตามแผน (ประมาณการ)" : "ดอกเบี้ยรวมตามสัญญา"}</span><strong>{formatBaht(calculatedInterest)}</strong></article>
                    <article className="is-net"><span>ยอดจ่ายสุทธิให้ผู้กู้</span><strong>{formatBaht(calculatedNetDisbursed)}</strong></article>
                  </div>
                  {isInstallment && principalSatang !== null && <p className="contract-section-caption">ดอกเบี้ยคงที่ {formatBaht(Math.round(principalSatang * interestRate / 100))} ต่อเดือน จากเงินต้นเริ่มต้น · รับชำระหักดอกก่อน แล้วตัดเงินต้น</p>}
                  {isInstallment && monthlyInstallment !== null && <div className="contract-installment-preview"><strong>ประมาณ {formatBaht(monthlyInstallment)} / เดือน</strong><span>เงินต้นรวม {formatBaht(principalSatang)} + ดอกเบี้ยรวม {formatBaht(calculatedInterest)} ÷ {installmentMonths} เดือน</span></div>}
                </div>
                <div className="contract-form-section">
                  <h3><span className="contract-section-number">04</span> เอกสารสัญญา</h3>
                  <p className="contract-section-caption">เลือกรูปแบบเอกสารและข้อมูลผู้ค้ำตามสัญญา</p>
                  <div className="contract-form-grid">
                    <fieldset className="contract-field contract-document-field"><legend>รูปแบบเอกสาร <b>*</b></legend><div className="contract-document-options">
                      <label className={contract.contractType === "NONE" ? "is-active" : ""}><input type="radio" name="contract-type" checked={contract.contractType === "NONE"} onChange={() => updateContract("contractType", "NONE")} /><span>ไม่ใช้เอกสารสัญญา</span></label>
                      <label className={contract.contractType === "WITNESS" ? "is-active" : ""}><input type="radio" name="contract-type" checked={contract.contractType === "WITNESS"} onChange={() => updateContract("contractType", "WITNESS")} /><span>สัญญากู้ยืมพร้อมพยาน 2 คน</span></label>
                      <label className={contract.contractType === "WITNESS_GUARANTOR" ? "is-active" : ""}><input type="radio" name="contract-type" checked={contract.contractType === "WITNESS_GUARANTOR"} onChange={() => updateContract("contractType", "WITNESS_GUARANTOR")} /><span>สัญญากู้ยืมและสัญญาค้ำ พร้อมพยาน 2 คน</span></label>
                    </div></fieldset>
                    {contract.contractType === "WITNESS_GUARANTOR" && <label className="contract-field lx-field"><span>ผู้ค้ำประกัน</span><input maxLength={160} value={contract.guarantor} onChange={(e) => updateContract("guarantor", e.target.value)} /></label>}
                    <label className="contract-field lx-field"><span>ลิงก์เอกสารสัญญา</span><input type="url" maxLength={500} value={contract.documentUrl} onChange={(e) => updateContract("documentUrl", e.target.value)} placeholder="https://..." /></label>
                  </div>
                </div>
                <div className="contract-form-section">
                  <h3><span className="contract-section-number">05</span> วิธีลงนามและพยาน</h3>
                  <p className="contract-section-caption">กำหนดวิธีลงนาม วันที่ลงนาม และพยานทั้งสองคน</p>
                  <div className="contract-form-grid">                    <fieldset className="contract-field contract-signature-field"><legend>วิธีลงนาม <b>*</b></legend><div className="contract-document-options">
                      <label className={contract.signatureMode === "PRINT" ? "is-active" : ""}><input type="radio" name="signature-mode" checked={contract.signatureMode === "PRINT"} onChange={() => { updateContract("signatureMode", "PRINT"); updateContract("consentAccepted", false); setDigitalSignature(""); }} /><span>พิมพ์เอกสารเพื่อลงนาม</span></label>
                      <label className={contract.signatureMode === "DIGITAL" ? "is-active" : ""}><input type="radio" name="signature-mode" checked={contract.signatureMode === "DIGITAL"} onChange={() => updateContract("signatureMode", "DIGITAL")} /><span>เขียนลายเซ็นดิจิทัล</span></label>
                    </div></fieldset>
                    <label className="contract-field lx-field"><span>วันที่ลงนาม</span><input type="datetime-local" value={contract.signedAt} onChange={(e) => updateContract("signedAt", e.target.value)} /></label>
                    <label className="contract-field lx-field"><span>พยานคนที่ 1</span><input maxLength={160} value={contract.witness1} onChange={(e) => updateContract("witness1", e.target.value)} /></label>
                    <label className="contract-field lx-field"><span>พยานคนที่ 2</span><input maxLength={160} value={contract.witness2} onChange={(e) => updateContract("witness2", e.target.value)} /></label>


                  </div>
                  {contract.signatureMode === "DIGITAL" && <div className="contract-digital-signature"><h4>ลายเซ็นดิจิทัลและคำยินยอม</h4><SignatureCanvas value={digitalSignature} onChange={setDigitalSignature} /><label className="contract-consent"><input type="checkbox" checked={contract.consentAccepted} onChange={(e) => updateContract("consentAccepted", e.target.checked)} /><span>ข้าพเจ้ายืนยันว่าลายเซ็นดิจิทัลที่เขียนข้างต้นเป็นลายเซ็นจริงของข้าพเจ้า และยินยอมใช้ลายเซ็นนี้ประกอบสัญญาฉบับนี้</span></label></div>}
                </div>
                <div className="contract-form-section">
                  <h3><span className="contract-section-number">06</span> หมายเหตุอื่น ๆ</h3>
                  <p className="contract-section-caption">เงื่อนไขเพิ่มเติมและข้อมูลประกอบสัญญา</p>
                    <label className="contract-field contract-field-wide"><span>หมายเหตุ</span><textarea rows={3} maxLength={2000} value={contract.note} onChange={(e) => updateContract("note", e.target.value)} placeholder="ระบุเงื่อนไขหรือหมายเหตุเพิ่มเติม" /></label>
                </div>

                {saveError && <div className="contract-error" role="alert">{saveError}</div>}
                <div className="contract-form-actions">
                  <button type="button" className="secondary-button lx-btn" disabled={saving} onClick={() => { setContract(emptyContract); setSaveError(""); }}>ล้างข้อมูล</button>
                  <button type="submit" className="primary-button lx-btn primary" disabled={saving}>{saving ? <><LoaderCircle className="contract-spinner" size={15} /> กำลังบันทึก...</> : <><Check size={15} /> บันทึกสัญญา</>}</button>
                </div>
              </form>
            )}
          </section>
        </>
      )}
      </div>
      {selected && <aside className="lx-aside" aria-label="สรุปสัญญา">
        <div className="lx-ledger" aria-live="polite">
          <div className="lx-ledger-top"><small>ยอดจ่ายสุทธิให้ผู้กู้</small><strong>{formatBaht(calculatedNetDisbursed)}</strong></div>
          <dl>
            <div><dt>เลขที่สัญญา</dt><dd>{savedContractNumber || contract.contractNumber || "—"}</dd></div>
            <div><dt>รหัสผู้กู้</dt><dd>{selected.borrowersCode}</dd></div>
            <div><dt>เงินต้น</dt><dd>{formatBaht(principalSatang)}</dd></div>
            <div><dt>{isInstallment ? "ดอกเบี้ยรวมตามแผน" : "ดอกเบี้ยตามสัญญา"}</dt><dd>{formatBaht(calculatedInterest)}</dd></div>
            {isInstallment && <div><dt>ดอกเบี้ยต่อเดือน</dt><dd>{formatBaht(principalSatang === null ? null : Math.round(principalSatang * interestRate / 100))}</dd></div>}
            {isInstallment && <div><dt>ชำระต่อเดือนตามแผน</dt><dd>{formatBaht(monthlyInstallment)}</dd></div>}
            <div><dt>วันครบกำหนด</dt><dd>{contract.dueDate || "—"}</dd></div>
          </dl>
        </div>
        <div className="lx-panel lx-contract-checklist">
          <h3>ตรวจสอบก่อนบันทึก</h3>
          <ul className="lx-todo">{[{title:"เลือกผู้กู้",done:!!selected},{title:"กำหนดวันเริ่มและครบกำหนด",done:!!contract.startDate && !!contract.dueDate},{title:"กรอกยอดเงินต้น",done:principalSatang !== null && principalSatang > 0},{title:"เลือกรูปแบบเอกสาร",done:!!contract.contractType}].map(item => <li key={item.title} className={item.done ? "done" : ""}><Check size={14} aria-hidden="true" />{item.title}</li>)}</ul>
        </div>
      </aside>}
      </div></div>
    </main>
  );
}
