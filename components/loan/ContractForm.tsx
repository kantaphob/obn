"use client";

import ContractDocumentPreview from "@/components/loan/ContractDocumentPreview";
import { emptyDocumentSettings, makeLoanDocument, makeGuaranteeDocument, type ContractDocumentSettings } from "@/lib/contract-document";
import { formatBorrowerCode } from "@/lib/borrower-code";

import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { BadgeCheck, Check, ChevronDown, ChevronRight, FileText, LoaderCircle, Search, Upload, UserRound, X } from "lucide-react";

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

type BorrowerLimits = {
  status: string | null;
  approvedLimit: number | null;
  usedLimit: number;
  availableLimit: number | null;
};
type BorrowerLimitsState = { borrowerId: string; data?: BorrowerLimits; error?: string };
type LoanBranch = {
  branchcode: string;
  nameTH: string | null;
  nameEN: string | null;
  status: string;
  company: { nameTH: string | null; nameEN: string | null };
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

function borrowerStatusLabel(status: string | null | undefined) {
  if (status === "PENDING_REPAYMENT") return "รอชำระคืน";
  if (status === "UNDER_REVIEW") return "อยู่ระหว่างตรวจสอบ";
  if (status === "CLOSED") return "ปิดบัญชี";
  return status || "ยังไม่ระบุสถานะ";
}

function satangFromBaht(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount <= Number.MAX_SAFE_INTEGER / 100
    ? Math.round(amount * 100)
    : null;
}

function SignatureCanvas({ value, onChange, label = "ผู้กู้" }: { value: string; onChange: (signature: string) => void; label?: string }) {
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
    hasDrawnRef.current = !!value;
    if (value) { const image = new window.Image(); image.onload = () => context.drawImage(image, 0, 0, bounds.width, bounds.height); image.src = value; return () => {image.onload = null;}; }
  }, [value]);

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
    <canvas ref={canvasRef} aria-label={`พื้นที่เขียนลายเซ็น${label}`} onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={stopDrawing} onPointerCancel={stopDrawing} />
    <div className="contract-signature-pad-footer lx-sign-foot"><span>ลงลายเซ็นในกรอบนี้</span><button type="button" onClick={clear} disabled={!value}>ล้างลายเซ็น</button></div>
  </div>;
}

type ContractDraft = {
  contractNumber: string;
  reserveMoney: boolean;
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
  lateFeeWaived: boolean;
  signatureMode: "PRINT" | "DIGITAL";
  consentAccepted: boolean;
  note: string;
};

const emptyContract: ContractDraft = {
  contractNumber: "",
  reserveMoney: false,
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
  lateFeeWaived: false,
  signatureMode: "PRINT",
  consentAccepted: false,
  note: "",
};

export default function ContractForm({ embedded = false, draftId, onClose, onSaved }: {
  embedded?: boolean;
  draftId?: string;
  onClose?: () => void;
  onSaved?: () => void;
} = {}) {
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeBorrower, setActiveBorrower] = useState(-1);
  const borrowerSearchRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [selected, setSelected] = useState<Borrower | null>(null);
  const [borrowerLimits, setBorrowerLimits] = useState<BorrowerLimitsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [contract, setContract] = useState<ContractDraft>(emptyContract);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedContractNumber, setSavedContractNumber] = useState("");
  const [savedContractStatus, setSavedContractStatus] = useState("");
  const [digitalSignature, setDigitalSignature] = useState("");
  const [nextNumberLoading, setNextNumberLoading] = useState(false);
  const [documents, setDocuments] = useState<ContractDocumentSettings>(emptyDocumentSettings);
  const [companyLookupBusy, setCompanyLookupBusy] = useState(false);
  const [companyLookupError, setCompanyLookupError] = useState("");
  const [loanBranches, setLoanBranches] = useState<LoanBranch[]>([]);
  const [branchLoading, setBranchLoading] = useState(true);
  const [branchLoadError, setBranchLoadError] = useState("");
  const [contractTypeOpen, setContractTypeOpen] = useState(false);
  const [showDocument, setShowDocument] = useState(false);
  const [stage, setStage] = useState<"FORM"|"BORROWER"|"WITNESSES"|"REVIEW">("FORM");
  const [confirmed, setConfirmed] = useState(false);
  const [savedContractId, setSavedContractId] = useState("");
  const [signedDocumentUploaded, setSignedDocumentUploaded] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const draftIdRef = useRef("");
  const draftSavingRef = useRef<Promise<void>>(Promise.resolve());
  const draftQueueRef = useRef<Promise<void>>(Promise.resolve());
  const latestDraftRef = useRef<{id:string;borrowerId:string;data:{contract:ContractDraft;digitalSignature:string;documents:ContractDocumentSettings}} | null>(null);
  const savedDraftJsonRef = useRef("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadLoanBranches() {
      try {
        const response = await fetch("/api/branch-sequences", { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "โหลดสาขาไม่สำเร็จ");
        const activeBranches = (data as LoanBranch[]).filter(branch => branch.status === "ACTIVE");
        setLoanBranches(activeBranches);
        setDocuments(current => current.branchCode || activeBranches.length !== 1
          ? current
          : { ...current, branchCode: activeBranches[0].branchcode });
        setBranchLoadError("");
      } catch (cause) {
        if (!controller.signal.aborted) setBranchLoadError(cause instanceof Error ? cause.message : "โหลดสาขาไม่สำเร็จ");
      } finally {
        if (!controller.signal.aborted) setBranchLoading(false);
      }
    }
    void loadLoanBranches();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const requestedId = draftId || new URLSearchParams(window.location.search).get("draft");
    let recovery: {id:string;borrowerId:string;data:{contract:ContractDraft;digitalSignature:string;documents:ContractDocumentSettings}} | null = null;
    try {const stored=sessionStorage.getItem("loan-contract-draft-recovery");if(stored)recovery=JSON.parse(stored);}catch{}
    const id = requestedId || (!embedded ? recovery?.id : undefined);
    if (!id) return;
    let active = true;
    void (async () => { try {
      let data;
      if (!requestedId && recovery) data=recovery;
      else { const response = await fetch(`/api/contracts/drafts?id=${encodeURIComponent(id)}`, {cache:"no-store"});data=await response.json();if(!response.ok)throw new Error(data.error); }
      // A finalized draft must never be restored from stale local recovery.
      const verification=await fetch(`/api/contracts/drafts?id=${encodeURIComponent(id)}`,{cache:"no-store"});
      if(verification.ok){const current=await verification.json();if(current.finalizedContractId){sessionStorage.removeItem("loan-contract-draft-recovery");throw new Error("ร่างนี้บันทึกเป็นสัญญาแล้ว");}}
      if (data.finalizedContractId) throw new Error("ร่างนี้บันทึกเป็นสัญญาแล้ว กรุณาดูในหน้าสัญญากู้");
      const borrowerResponse = await fetch(`/api/borrowers/${data.borrowerId}`, {cache:"no-store"});
      if (!borrowerResponse.ok) throw new Error("ไม่พบผู้กู้ของร่างนี้");
      const borrower = await borrowerResponse.json(); if (!active) return;
      draftIdRef.current = id;
      setSelected(borrower); setContract({...emptyContract,...data.data.contract});
      setDigitalSignature(data.data.digitalSignature || ""); setDocuments({...emptyDocumentSettings,...data.data.documents});
    } catch(error) { if(active) setSaveError(error instanceof Error ? error.message : "เปิดร่างไม่สำเร็จ"); }})();
    return () => {active=false;};
  }, [embedded, draftId]);

  useEffect(() => {
    if (!selected || saving || savedContractNumber) return;
    if (!draftIdRef.current) draftIdRef.current = crypto.randomUUID();
    const payload = {id:draftIdRef.current,borrowerId:selected.id,data:{contract,digitalSignature,documents}};
    latestDraftRef.current=payload;
    try {sessionStorage.setItem("loan-contract-draft-recovery",JSON.stringify(payload));}catch{}
    const timer = window.setTimeout(() => {
      if (!draftIdRef.current) draftIdRef.current = crypto.randomUUID();
      const work = draftQueueRef.current.catch(() => {}).then(async () => {
        const response = await fetch("/api/contracts/drafts", {method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "เก็บร่างไม่สำเร็จ");
        savedDraftJsonRef.current=JSON.stringify(payload);
      });
      draftQueueRef.current = work;
      draftSavingRef.current = work.catch(error => {setSaveError(error instanceof Error ? error.message : "เก็บร่างไม่สำเร็จ");});
    }, 700);
    return () => window.clearTimeout(timer);
  }, [selected,contract,digitalSignature,documents,saving,savedContractNumber]);

  useEffect(() => {
    if (!selected || savedContractNumber) return;
    const guard = (event:BeforeUnloadEvent) => {if(latestDraftRef.current && JSON.stringify(latestDraftRef.current)!==savedDraftJsonRef.current){event.preventDefault();event.returnValue="";}};
    const toList = (event:MouseEvent) => {
      const link=event.target instanceof Element ? event.target.closest("a[href]") as HTMLAnchorElement | null : null;
      if(!link || event.ctrlKey || event.metaKey || link.target==="_blank" || new URL(link.href).pathname!=="/dashboard/loan/contracts")return;
      const payload=latestDraftRef.current;
      if(!payload || JSON.stringify(payload)===savedDraftJsonRef.current)return;
      event.preventDefault();event.stopImmediatePropagation();
      void(async()=>{try{await draftSavingRef.current;const response=await fetch("/api/contracts/drafts",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});if(!response.ok)throw new Error("เก็บร่างก่อนออกไม่สำเร็จ");savedDraftJsonRef.current=JSON.stringify(payload);window.location.assign(link.href);}catch(error){setSaveError(error instanceof Error ? error.message : "เก็บร่างไม่สำเร็จ");}})();
    };
    window.addEventListener("beforeunload",guard);document.addEventListener("click",toList,true);
    return()=>{window.removeEventListener("beforeunload",guard);document.removeEventListener("click",toList,true);};
  },[selected,savedContractNumber]);

  async function uploadAttachment(file?:File) {
    if (!file) return;
    setAttachmentBusy(true);setSaveError("");
    try { const body=new FormData();body.append("file",file);const response=await fetch("/api/contracts/attachments",{method:"POST",body});const data=await response.json();if(!response.ok)throw new Error(data.error);setDocuments(current=>({...current,attachments:[...current.attachments,{url:data.url,name:file.name}]})); }
    catch(error){setSaveError(error instanceof Error ? error.message : "แนบเอกสารไม่สำเร็จ");}finally{setAttachmentBusy(false);}
  }

  async function uploadDelivery(file?:File){
    if(!file||!savedContractId)return;
    setAttachmentBusy(true);setSaveError("");
    try{const body=new FormData();body.append("file",file);const response=await fetch(`/api/contracts/${savedContractId}/delivery-evidence`,{method:"POST",body});const data=await response.json();if(!response.ok)throw new Error(data.error);setDocuments(current=>({...current,attachments:[...current.attachments,data.attachment]}));}catch(error){setSaveError(error instanceof Error?error.message:"แนบสลิปไม่สำเร็จ");}finally{setAttachmentBusy(false);}
  }

  async function uploadSignedDocument(file?:File){
    if(!file||!savedContractId)return;
    setAttachmentBusy(true);setSaveError("");
    try{const body=new FormData();body.append("file",file);const response=await fetch(`/api/contracts/${savedContractId}/signed-document`,{method:"POST",body});const data=await response.json();if(!response.ok)throw new Error(data.error);setSignedDocumentUploaded(true);setDocuments(current=>({...current,attachments:[...current.attachments,data.attachment]}));}catch(error){setSaveError(error instanceof Error?error.message:"แนบสัญญาที่ลงนามแล้วไม่สำเร็จ");}finally{setAttachmentBusy(false);}
  }

  const isInstallment = contract.paymentOption === "INSTALLMENT";
  const todayInBangkok = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const isReservation = contract.reserveMoney || (!!contract.startDate && contract.startDate > todayInBangkok);
  const showingReservation = savedContractStatus ? savedContractStatus === "RESERVED" : isReservation;
  const interestRate = contract.interestRateChoice === "CUSTOM"
    ? Number(contract.customInterestRate)
    : Number(contract.interestRateChoice);
  const principalSatang = satangFromBaht(contract.principal);
  const installmentMonths = Number(contract.installmentMonths);
  const interestFactor = isInstallment ? installmentMonths : 1;
  const calculatedInterest = principalSatang !== null && Number.isFinite(interestRate) && interestRate >= 0 && interestFactor > 0
    ? Math.round(principalSatang * interestRate / 100 * interestFactor)
    : null;
  const calculatedNetDisbursed = principalSatang === null ? null
    : contract.paymentOption === "UPFRONT" ? calculatedInterest === null ? null : principalSatang - calculatedInterest
    : principalSatang;
  const monthlyInstallment = isInstallment && calculatedInterest !== null && principalSatang !== null && installmentMonths > 0
    ? Math.round((principalSatang + calculatedInterest) / installmentMonths)
    : null;

  function updateContract<K extends keyof ContractDraft>(key: K, value: ContractDraft[K]) {
    setContract((current) => ({ ...current, [key]: value }));
    setSaveError("");
  }

  async function lookupLenderCompany() {
    const companyCode = documents.companyCode.trim();
    if (!companyCode) {
      setCompanyLookupError("กรุณากรอกรหัสบริษัท");
      return;
    }
    setCompanyLookupBusy(true);
    setCompanyLookupError("");
    try {
      const response = await fetch(`/api/companies?code=${encodeURIComponent(companyCode)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "ค้นหาข้อมูลบริษัทไม่สำเร็จ");
      const company = result as { companyCode: string; name: string; taxId: string; address: string; postcode: string; phone: string };
      setDocuments(current => ({
        ...current,
        companyCode: company.companyCode,
        lenderName: company.name,
        lenderId: company.taxId,
        lenderAddress: [company.address, company.postcode].filter(Boolean).join(" "),
        lenderPhone: company.phone,
        lenderSignature: "",
        loanText: "",
        guaranteeText: "",
      }));
    } catch (cause) {
      setCompanyLookupError(cause instanceof Error ? cause.message : "ค้นหาข้อมูลบริษัทไม่สำเร็จ");
    } finally {
      setCompanyLookupBusy(false);
    }
  }

  async function saveContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    if (stage === "FORM" && (principalSatang === null || principalSatang <= 0 || calculatedInterest === null || !contract.startDate || !contract.dueDate || contract.dueDate < contract.startDate || calculatedNetDisbursed === null || calculatedNetDisbursed < 0)){setSaveError("กรุณาตรวจเงินต้น ระยะเวลา และยอดจ่ายสุทธิให้ถูกต้อง");return;}
    if (stage === "FORM" && contract.reserveMoney && contract.startDate <= todayInBangkok) {setSaveError("การจองเงินต้องกำหนดวันเริ่มสัญญาเป็นวันถัดไปหรือหลังจากนั้น");return;}
    if (stage === "FORM") {
      if (branchLoading) {setSaveError("กำลังโหลดข้อมูลสาขา กรุณารอสักครู่");return;}
      if (loanBranches.length > 0 && !loanBranches.some(branch => branch.branchcode === documents.branchCode)) {setSaveError("กรุณาเลือกสาขาที่ตั้งสัญญา");return;}
      if (contract.contractType !== "NONE" && (!documents.companyCode.trim() || !documents.lenderName.trim())) {setSaveError("กรุณากรอก Companycode และเรียกข้อมูลผู้ให้กู้ก่อน");return;}
      setStage(contract.contractType === "NONE" ? "REVIEW" : "BORROWER");setConfirmed(false);return;
    }
    if(stage !== "REVIEW" || !confirmed){setSaveError("กรุณาตรวจข้อมูลและยืนยันก่อนบันทึก");return;}
    if (principalSatang === null || calculatedInterest === null || calculatedNetDisbursed === null) {
      setSaveError("กรุณากรอกเงินต้น จำนวนเดือน และอัตราดอกเบี้ยให้ถูกต้อง");
      return;
    }
    if (!Number.isFinite(interestRate)) {
      setSaveError("กรุณาระบุอัตราดอกเบี้ย");
      return;
    }
    if (contract.contractType !== "NONE" && contract.signatureMode === "DIGITAL" && (!contract.consentAccepted || !digitalSignature)) {
      setSaveError("กรุณาเขียนลายเซ็นและยอมรับคำยินยอมก่อนบันทึก");
      return;
    }

    if (contract.signatureMode === "DIGITAL" && contract.contractType !== "NONE" && (!contract.witness1.trim() || !contract.witness2.trim() || !documents.witness1Signature || !documents.witness2Signature)) {setSaveError("กรุณาระบุชื่อและลายเซ็นพยานทั้งสองคน");return;}
    if (contract.signatureMode === "DIGITAL" && contract.contractType === "WITNESS_GUARANTOR" && (!contract.guarantor.trim() || !documents.guarantorSignature)) {setSaveError("กรุณาระบุชื่อและลายเซ็นผู้ค้ำประกัน");return;}
    setSaving(true);
    setSaveError("");
    try {
      await draftSavingRef.current;
      // Ensure a just-typed draft is persisted before final creation, even before the debounce fires.
      if(!draftIdRef.current)draftIdRef.current=crypto.randomUUID();
      const draftResponse=await fetch("/api/contracts/drafts",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:draftIdRef.current,borrowerId:selected.id,data:{contract,digitalSignature,documents}})});
      if(!draftResponse.ok){const failed=await draftResponse.json();throw new Error(failed.error || "เก็บร่างก่อนบันทึกไม่สำเร็จ");}
      const response = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...contract,
          draftId: draftIdRef.current || null,
          documentData: {...documents, loanText: contract.contractType === "NONE" ? "" : documents.loanText || makeLoanDocument(documents, documentLoan), guaranteeText: contract.contractType === "WITNESS_GUARANTOR" ? documents.guaranteeText || makeGuaranteeDocument(documents,documentLoan,contract.guarantor) : ""},
          debtorId: selected.id,
          principal: principalSatang,
          interestRate,
          interestAmount: calculatedInterest,
          netDisbursed: calculatedNetDisbursed,
          periodDays: contract.paymentOption === "AT_DUE" && contract.periodDays ? Number(contract.periodDays) : null,
          installmentMonths: isInstallment ? Number(contract.installmentMonths) : null,
          repayType: isInstallment ? "INSTALLMENT" : "LUMP_SUM",
          interestMode: contract.paymentOption === "UPFRONT" ? "UPFRONT" : "ON_SCHEDULE",
          interestRateBasis: isInstallment ? "MONTHLY_FLAT" : "CONTRACT_FLAT",
          lateFeePerDay: 5000,
          lateFeeWaived: contract.lateFeeWaived,
          signatureMode: contract.contractType === "NONE" ? "PRINT" : contract.signatureMode,
          signatureData: contract.signatureMode === "DIGITAL" ? digitalSignature : null,
          consentAccepted: contract.signatureMode === "DIGITAL" ? contract.consentAccepted : false,
          consentText: contract.signatureMode === "DIGITAL" ? "ข้าพเจ้ายืนยันว่าลายเซ็นดิจิทัลที่บันทึกเป็นลายเซ็นจริงของข้าพเจ้า และยินยอมใช้ลายเซ็นนี้ประกอบสัญญา" : null,
          dueDate: contract.dueDate || null,
          signedAt: contract.signedAt ? `${contract.signedAt}:00+07:00` : null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "บันทึกสัญญาไม่สำเร็จ");
      setSavedContractNumber(result.contractNumber as string);
      setSavedContractStatus(typeof result.status === "string" ? result.status : "");
      setSavedContractId(result.id);
      onSaved?.();
      if(result.documentData)setDocuments({...emptyDocumentSettings,...JSON.parse(result.documentData)});
      latestDraftRef.current=null;savedDraftJsonRef.current="";
      sessionStorage.removeItem("loan-contract-draft-recovery");
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "บันทึกสัญญาไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  async function closeEmbeddedForm() {
    if (!onClose) return;
    const payload = latestDraftRef.current;
    if (!savedContractNumber && payload && JSON.stringify(payload) !== savedDraftJsonRef.current) {
      try {
        await draftSavingRef.current;
        const response = await fetch("/api/contracts/drafts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "บันทึกร่างก่อนปิดหน้าต่างไม่สำเร็จ");
        savedDraftJsonRef.current = JSON.stringify(payload);
      } catch (cause) {
        setSaveError(cause instanceof Error ? cause.message : "บันทึกร่างก่อนปิดหน้าต่างไม่สำเร็จ");
        return;
      }
    }
    onClose();
  }

  function clearSearch() {
    setQuery("");
    setBorrowers([]);
    setSearched(false);
    setError("");
    setLoading(false);
  }

  function chooseBorrower(borrower: Borrower) {
    setStage("FORM");setConfirmed(false);setSavedContractId("");
    if (selected?.id !== borrower.id) {draftIdRef.current="";setDocuments(emptyDocumentSettings);setDigitalSignature("");}
    setSelected(borrower);
    setDropdownOpen(false);
    setQuery("");
    setActiveBorrower(-1);
    setContract((current) => ({ ...current, contractNumber: "", signedAt: current.signedAt || new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date()).replace(" ", "T") }));
    setNextNumberLoading(true);
    setSavedContractNumber("");
  }

  useEffect(() => {
    if (!selected) return;
    const borrowerId = selected.id;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/borrowers/${encodeURIComponent(borrowerId)}/limits`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "โหลดวงเงินผู้กู้ไม่สำเร็จ");
        setBorrowerLimits({ borrowerId, data: result as BorrowerLimits });
      } catch (cause) {
        if (!controller.signal.aborted) setBorrowerLimits({ borrowerId, error: cause instanceof Error ? cause.message : "โหลดวงเงินผู้กู้ไม่สำเร็จ" });
      }
    })();
    return () => controller.abort();
  }, [selected]);

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

  const documentLoan = {number:savedContractNumber || contract.contractNumber,borrowerName:selected?borrowerName(selected):"",borrowerId:selected?.nationalId||"",borrowerAddress:selected?.address||"",borrowerPhone:selected?.phone||"",principal:principalSatang,rate:interestRate,monthly:isInstallment,months:isInstallment?contract.installmentMonths:"",startDate:contract.startDate,dueDate:contract.dueDate,paymentOption:contract.paymentOption};
  const signers = [{role:"ผู้ให้กู้",name:documents.lenderName,signature:contract.signatureMode==="DIGITAL"?documents.lenderSignature:""},{role:"ผู้กู้",name:selected?borrowerName(selected):"",signature:contract.signatureMode === "DIGITAL" ? digitalSignature : ""},...(contract.contractType!=="NONE"?[{role:"พยานคนที่ 1",name:contract.witness1,signature:contract.signatureMode === "DIGITAL" ? documents.witness1Signature : ""},{role:"พยานคนที่ 2",name:contract.witness2,signature:contract.signatureMode === "DIGITAL" ? documents.witness2Signature : ""}]:[]),...(contract.contractType==="WITNESS_GUARANTOR"?[{role:"ผู้ค้ำประกัน",name:contract.guarantor,signature:contract.signatureMode === "DIGITAL" ? documents.guarantorSignature : ""}]:[])];

  const limitsForSelected = selected && borrowerLimits?.borrowerId === selected.id ? borrowerLimits : null;
  const limitsLoading = !!selected && !limitsForSelected;
  const RootElement = embedded ? "div" : "main";

  return (
    <RootElement className="page-wrap contract-page lx-page"><div className="lx-wrap">
      {showDocument && <ContractDocumentPreview loanText={documents.loanText || makeLoanDocument(documents,documentLoan)} guaranteeText={contract.contractType==="WITNESS_GUARANTOR" ? documents.guaranteeText || makeGuaranteeDocument(documents,documentLoan,contract.guarantor) : undefined} signers={signers} attachments={documents.attachments} draft={!savedContractNumber} onClose={()=>setShowDocument(false)}/>}
      <div className="contract-heading lx-head">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" /> LOAN MANAGEMENT</div>
          <h1>{embedded ? "สร้างสัญญากู้" : "บันทึกสัญญากู้"}</h1>
          <p>ค้นหาและเลือกผู้กู้เพื่อเริ่มบันทึกสัญญา</p>
        </div>
        {embedded
          ? <button type="button" className="contract-modal-close lx-btn" onClick={()=>void closeEmbeddedForm()} disabled={saving || attachmentBusy}><X size={16} aria-hidden="true"/> ปิด</button>
          : <div className="contract-heading-icon" aria-hidden="true"><FileText size={20} /></div>}
      </div>

      <div className={`lx-contract ${!selected ? "grid-cols-1!" : ""}`}><div className="lx-contract-main">


      <section className="contract-panel lx-panel" aria-labelledby="borrower-search-title">
        <div className="contract-panel-heading">
          <div>
            <h2 id="borrower-search-title">ค้นหาและเลือกผู้กู้</h2>
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
            value={!dropdownOpen && selected ? `${formatBorrowerCode(selected.borrowersCode)} · ${borrowerName(selected)}` : query}
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
                    <small>รหัส {formatBorrowerCode(borrower.borrowersCode)} <i /> {formatNationalId(borrower.nationalId)}</small>
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
              <div className="contract-selected-name"><strong>{borrowerName(selected)}</strong><span>รหัสผู้กู้ {formatBorrowerCode(selected.borrowersCode)}</span></div>
              <div className="contract-selected-detail"><small>เลขบัตรประชาชน</small><strong>{formatNationalId(selected.nationalId)}</strong></div>
              <div className="contract-selected-detail"><small>เบอร์โทรศัพท์</small><strong>{selected.phone || "—"}</strong></div>
            </div>
            <div className="contract-borrower-limit-panel" aria-live="polite">
              <div className="contract-borrower-limit-heading"><strong>สถานะ / วงเงินคงเหลือของผู้กู้</strong><span>สถานะ: {limitsLoading ? "กำลังโหลด…" : borrowerStatusLabel(limitsForSelected?.data?.status)}</span></div>
              <div className="contract-borrower-limits">
                <div><small>Approved Limit (บาท)</small><strong>{limitsLoading ? "…" : formatBaht(limitsForSelected?.data?.approvedLimit ?? null)}</strong></div>
                <div><small>Used Limit (บาท)</small><strong>{limitsLoading ? "…" : formatBaht(limitsForSelected?.data?.usedLimit ?? 0)}</strong></div>
                <div><small>Available Limit (บาท)</small><strong>{limitsLoading ? "…" : formatBaht(limitsForSelected?.data?.availableLimit ?? null)}</strong></div>
              </div>
              {limitsForSelected?.error && <small className="contract-borrower-limit-error" role="alert">{limitsForSelected.error}</small>}
            </div>
            <div className="contract-selected-foot">สัญญาที่บันทึกจะเชื่อมกับผู้กู้รายนี้</div>
          </section>

          <section className="contract-form-panel" aria-labelledby="contract-details-title">
            <div className="contract-panel-heading">
              <div>
                <h2 id="contract-details-title">ข้อมูลการทำสัญญา</h2>
                <p>กำหนดเงื่อนไข ยอดเงิน และเอกสารที่จะใช้</p>
              </div>
            </div>

            {savedContractNumber ? (
              <>
                <div className="contract-saved lx-saved" role="status">
                  <span><Check size={18} /></span>
                  <div><strong>{showingReservation ? "บันทึกการจองเงินเรียบร้อย" : "บันทึกสัญญาเรียบร้อย"}</strong><small>เลขที่สัญญา {savedContractNumber}{showingReservation ? " · ยังไม่มีรายการจ่ายเงิน" : ""}</small></div>
                </div>
                <article className="contract-print-sheet lx-sheet">
                  <header><strong>สัญญากู้ยืมเงิน</strong><span>เลขที่ {savedContractNumber}</span></header>
                  <p>ผู้กู้: {borrowerName(selected)} (รหัส {formatBorrowerCode(selected.borrowersCode)})</p>
                  <p>เงินต้น {formatBaht(principalSatang)} · อัตราดอกเบี้ย {interestRate}% · ดอกเบี้ยรวม {formatBaht(calculatedInterest)}</p>
                  <p>ยอดจ่ายสุทธิ {formatBaht(calculatedNetDisbursed)} · ครบกำหนด {contract.dueDate}</p>
                  <p>วิธีชำระ: {contract.paymentOption === "INSTALLMENT" ? `ผ่อน ${contract.installmentMonths} เดือน เดือนละประมาณ ${formatBaht(monthlyInstallment)}` : contract.paymentOption === "UPFRONT" ? "หักดอกเบี้ยก่อน แล้วคืนเงินต้นวันครบกำหนด" : "ชำระเงินต้นและดอกเบี้ยวันครบกำหนด"}</p>
                  <p>ค่าปรับล่าช้า: {contract.lateFeeWaived ? "ละเว้นค่าปรับ" : "วันละ 50 บาท"}</p>
                  <p>ประเภทเอกสาร: {contract.contractType === "NONE" ? "ไม่ใช้เอกสารสัญญา" : contract.contractType === "WITNESS" ? "สัญญาพร้อมพยาน 2 คน" : "สัญญาพร้อมพยาน 2 คนและผู้ค้ำประกัน"}</p>
                  {contract.note && <p>หมายเหตุ: {contract.note}</p>}
                  <footer><span>ลงชื่อผู้กู้ __________________________</span><span>ลงชื่อพยาน __________________________</span><span>ลงชื่อพยาน __________________________</span>{contract.contractType === "WITNESS_GUARANTOR" && <span>ลงชื่อผู้ค้ำประกัน __________________________</span>}</footer>
                </article>
                {contract.contractType!=="NONE" && <div className="contract-print-actions"><button type="button" className="secondary-button lx-btn" onClick={() => setShowDocument(true)}>พิมพ์เอกสารเพื่อลงนาม</button><button type="button" className="secondary-button lx-btn" onClick={() => setShowDocument(true)}>ส่งออก PDF</button></div>}
                {contract.contractType!=="NONE" && contract.signatureMode==="PRINT" && !contract.signedAt && !signedDocumentUploaded && <section className="contract-review-card"><h3>สำเนาสัญญาที่ลงนามแล้ว</h3><p>เมื่อลงนามบนเอกสารแล้ว แนบสำเนาที่นี่เพื่อเปลี่ยนสถานะเป็นพร้อมจ่ายเงิน</p><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={attachmentBusy} onChange={event=>{void uploadSignedDocument(event.target.files?.[0]);event.target.value="";}}/></section>}
                {signedDocumentUploaded && <p className="contract-signed-document-note" role="status">{showingReservation ? "รับสำเนาสัญญาที่ลงนามแล้ว จะพร้อมจ่ายเมื่อถึงวันเริ่มสัญญา" : "รับสำเนาสัญญาที่ลงนามแล้ว สถานะพร้อมจ่ายเงิน"}</p>}
                <section className="contract-review-card"><h3>หลักฐานส่งมอบเงิน</h3><p>แนบสลิปหลังทำสัญญาสำเร็จ เพื่อเก็บเป็นหลักฐานการจ่ายเงินจริง</p><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={attachmentBusy} onChange={event=>{void uploadDelivery(event.target.files?.[0]);event.target.value="";}}/>{documents.attachments.map(file=><p key={file.url}><a href={file.url} target="_blank" rel="noreferrer">{file.name}</a></p>)}{saveError && <p role="alert">{saveError}</p>}</section>
              </>
            ) : (
              <form className="contract-form" onSubmit={saveContract}>
                <div hidden={stage !== "FORM"}><div className="contract-form-section">
                  <h3>รายละเอียดสัญญา</h3>
                  <p className="contract-section-caption">เลือกรูปแบบการชำระและกำหนดระยะเวลาก่อนคำนวณยอดกู้</p>
                  <div className="contract-form-grid">
                    <label className="contract-field lx-field contract-number-field"><span>เลขที่สัญญา (รันอัตโนมัติ) <b>*</b></span><input readOnly maxLength={80} value={contract.contractNumber} placeholder={nextNumberLoading ? "กำลังสร้างเลขที่..." : "รอเลขที่สัญญา"} /></label>
                    <label className="contract-field lx-field"><span>สาขาที่ตั้งสัญญา {loanBranches.length > 0 && <b>*</b>}</span><select value={documents.branchCode} disabled={branchLoading || loanBranches.length === 0} onChange={event => setDocuments(current => ({ ...current, branchCode: event.target.value }))}><option value="">{branchLoading ? "กำลังโหลดสาขา…" : loanBranches.length === 0 ? "ยังไม่มีสาขาที่ใช้งาน" : "เลือกสาขา"}</option>{loanBranches.map(branch => <option value={branch.branchcode} key={branch.branchcode}>{branch.nameTH || branch.nameEN || branch.branchcode} · {branch.branchcode} · {branch.company.nameTH || branch.company.nameEN || "ไม่ระบุบริษัท"}</option>)}</select>{branchLoadError && <small role="status">{branchLoadError}</small>}</label>
                  </div>
                  <fieldset className="contract-payment-options"><legend>การจ่ายเงิน</legend>
                    <label className={!contract.reserveMoney ? "is-active" : ""}><input type="radio" name="reserve-money" checked={!contract.reserveMoney} onChange={() => updateContract("reserveMoney", false)} /><span><strong>สร้างสัญญาปกติ</strong><small>ดำเนินการตามวันที่เริ่มสัญญาและขั้นตอนเอกสาร</small></span></label>
                    <label className={contract.reserveMoney ? "is-active" : ""}><input type="radio" name="reserve-money" checked={contract.reserveMoney} onChange={() => updateContract("reserveMoney", true)} /><span><strong>จองเงินไว้ก่อน</strong><small>ยังไม่บันทึกรายการจ่ายเงิน เมื่อถึงวันเริ่มสัญญาจะเปลี่ยนเป็นพร้อมจ่ายอัตโนมัติ</small></span></label>
                  </fieldset>
                  <fieldset className="contract-payment-options"><legend>เลือกรูปแบบการชำระ <b>*</b></legend>
                    <label className={isInstallment ? "is-active" : ""}><input type="radio" name="payment-category" checked={isInstallment} onChange={() => {updateContract("paymentOption", "INSTALLMENT");updateContract("periodDays", "");}} /><span><strong>ผ่อนชำระรายเดือน</strong><small>กำหนดจำนวนเดือน ระบบคำนวณเงินต้น ดอกเบี้ย และยอดผ่อน</small></span></label>
                    <label className={!isInstallment ? "is-active" : ""}><input type="radio" name="payment-category" checked={!isInstallment} onChange={() => {if(isInstallment)updateContract("paymentOption", "AT_DUE");}} /><span><strong>ชำระตามสัญญา</strong><small>เลือกว่าจะหักดอกเบี้ยก่อน หรือชำระเงินต้นและดอกเบี้ยตามกำหนด</small></span></label>
                  </fieldset>
                  {!isInstallment && <fieldset className="contract-payment-options contract-payment-suboptions"><legend>วิธีชำระตามสัญญา</legend>
                    <label className={contract.paymentOption === "UPFRONT" ? "is-active" : ""}><input type="radio" name="payment-option" checked={contract.paymentOption === "UPFRONT"} onChange={() => {updateContract("paymentOption", "UPFRONT");updateContract("periodDays", "");}} /><span><strong>หักดอกเบี้ยก่อน</strong><small>หักดอกเบี้ยจากเงินที่จ่ายให้ผู้กู้ แล้วคืนเงินต้นตามวันครบกำหนด</small></span></label>
                    <label className={contract.paymentOption === "AT_DUE" ? "is-active" : ""}><input type="radio" name="payment-option" checked={contract.paymentOption === "AT_DUE"} onChange={() => updateContract("paymentOption", "AT_DUE")} /><span><strong>ไม่หักดอกเบี้ยก่อน</strong><small>จ่ายเงินต้นเต็มจำนวน และชำระเงินต้นพร้อมดอกเบี้ยตามวันครบกำหนด</small></span></label>
                  </fieldset>}
                  <div className="contract-form-grid contract-payment-fields">
                    {isInstallment && <label className="contract-field lx-field"><span>จำนวนเดือน <b>*</b></span><input required type="number" min="1" max="360" step="1" value={contract.installmentMonths} onChange={(e) => updateContract("installmentMonths", e.target.value)} placeholder="เช่น 6" /></label>}
                    {contract.paymentOption === "AT_DUE" && <label className="contract-field lx-field"><span>รอบชำระดอกเบี้ย (วัน) <small>ถ้ามี</small></span><input type="number" min="1" max="3650" step="1" value={contract.periodDays} onChange={(e) => updateContract("periodDays", e.target.value)} placeholder="เช่น 30 วัน" /><small className="contract-cycle-help">แนวทางอ้างอิง: รอบบัญชีประมาณ 30 วัน และกำหนดชำระหลังสรุปยอด 15–20 วัน (บางแห่งอาจ 15–25 วัน) รวมช่วงประมาณ 45–50 วัน วันจริงให้ยึดเงื่อนไขในสัญญา</small></label>}
                    <label className="contract-field lx-field"><span>วันที่เริ่มสัญญา <b>*</b></span><input required type="date" value={contract.startDate} onChange={(e) => updateContract("startDate", e.target.value)} /></label>
                    <label className="contract-field lx-field"><span>วันครบกำหนด <b>*</b></span><input required type="date" value={contract.dueDate} onChange={(e) => updateContract("dueDate", e.target.value)} /></label>
                  </div>


                </div>

                <div className="contract-form-section">
                  <h3>ยอดกู้และการคำนวณ</h3>
                  <p className="contract-section-caption">กรอกเงินต้นและอัตราดอกเบี้ย ระบบสรุปยอดให้โดยอัตโนมัติ</p>
                  <div className="contract-form-grid">                    <label className="contract-field lx-field"><span>เงินต้น (บาท) <b>*</b></span><input required inputMode="decimal" value={contract.principal} onChange={(e) => { const numeric=e.target.value.replace(/[^0-9.]/g, ""); const parts=numeric.split("."); updateContract("principal",parts[0]+(parts.length>1?"."+parts.slice(1).join("").slice(0,2):"")); }} placeholder="0.00" /></label>
                    <label className="contract-field lx-field"><span>อัตราดอกเบี้ย (%) {isInstallment ? "ต่อเดือน" : "ตามสัญญา"} <b>*</b></span><select value={contract.interestRateChoice} onChange={event=>updateContract("interestRateChoice",event.target.value as ContractDraft["interestRateChoice"])}>{["0","5","10","15","20","25","CUSTOM"].map(rate=><option key={rate} value={rate}>{rate==="CUSTOM"?"กำหนดเอง":`${rate}%`}</option>)}</select>{contract.interestRateChoice==="CUSTOM" && <input required type="number" min="0" max="1000" step="0.01" value={contract.customInterestRate} onChange={event=>updateContract("customInterestRate",event.target.value)} placeholder="ระบุอัตราดอกเบี้ย"/>}</label>


                  </div>
                  <div className="contract-money-summary" aria-live="polite">
                    <article><span>เงินต้นตามสัญญา</span><strong>{formatBaht(principalSatang)}</strong></article>
                    <article><span>{isInstallment ? "ดอกเบี้ยรวมตามแผน (ประมาณการ)" : "ดอกเบี้ยรวมตามสัญญา"}</span><strong>{formatBaht(calculatedInterest)}</strong></article>
                    <article className="is-net"><span>ยอดจ่ายสุทธิให้ผู้กู้</span><strong>{formatBaht(calculatedNetDisbursed)}</strong></article>
                  </div>

                  {isInstallment && monthlyInstallment !== null && <div className="contract-installment-preview"><strong>ประมาณ {formatBaht(monthlyInstallment)} / เดือน</strong><span>เงินต้นรวม {formatBaht(principalSatang)} + ดอกเบี้ยรวม {formatBaht(calculatedInterest)} ÷ {installmentMonths} เดือน</span></div>}
                </div>
                <div className="contract-form-section">
                  <h3>เอกสารสัญญา</h3>
                  <p className="contract-section-caption">เลือกรูปแบบเอกสาร แนบไฟล์ประกอบ และเพิ่มลิงก์สัญญาถ้ามี</p>
                  <div className="contract-document-stack">
                    <div className="contract-field lx-field contract-document-type"><span id="contract-type-label">รูปแบบเอกสาร <b>*</b></span><button type="button" className="contract-type-dropdown-toggle" aria-expanded={contractTypeOpen} aria-controls="contract-type-options" aria-labelledby="contract-type-label" onClick={()=>setContractTypeOpen(open=>!open)}><span>{contract.contractType==="NONE"?"ไม่ใช้เอกสารสัญญา":contract.contractType==="WITNESS"?"สัญญากู้ยืมพร้อมพยาน 2 คน":"สัญญากู้ยืมและสัญญาค้ำ พร้อมพยาน 2 คน"}</span><ChevronDown size={17} aria-hidden="true"/></button>{contractTypeOpen && <div id="contract-type-options" className="contract-type-dropdown-options contract-document-options" role="radiogroup" aria-labelledby="contract-type-label">{([{value:"NONE",label:"ไม่ใช้เอกสารสัญญา"},{value:"WITNESS",label:"สัญญากู้ยืมพร้อมพยาน 2 คน"},{value:"WITNESS_GUARANTOR",label:"สัญญากู้ยืมและสัญญาค้ำ พร้อมพยาน 2 คน"}] as const).map(option=><label key={option.value} className={contract.contractType===option.value?"is-active":""}><input type="radio" name="contract-type" checked={contract.contractType===option.value} onChange={()=>{updateContract("contractType",option.value);setContractTypeOpen(false);}}/><span>{option.label}</span></label>)}</div>}</div>
                    <div className="contract-upload-field"><span>เอกสารประกอบ (JPG/PNG/WebP/PDF)</span><input ref={attachmentInputRef} className="contract-file-input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={attachmentBusy || documents.attachments.length>=20} aria-label="เลือกเอกสารประกอบสัญญา" onChange={event=>{void uploadAttachment(event.target.files?.[0]);event.target.value="";}}/><button type="button" className="lx-btn" disabled={attachmentBusy || documents.attachments.length>=20} onClick={()=>attachmentInputRef.current?.click()}><Upload size={16}/>{attachmentBusy?"กำลังอัปโหลด…":"อัปโหลดเอกสาร"}</button>{documents.attachments.map(file=><div key={file.url} className="contract-attachment-row"><a href={file.url} target="_blank" rel="noreferrer">{file.name}</a><button type="button" className="lx-link" onClick={()=>setDocuments(current=>({...current,attachments:current.attachments.filter(item=>item.url!==file.url)}))}>นำออกจากร่าง</button></div>)}</div>
                    <label className="contract-field lx-field contract-document-url"><span>ลิงก์เอกสารสัญญา (ถ้ามี)</span><input type="url" maxLength={500} value={contract.documentUrl} onChange={(e) => updateContract("documentUrl", e.target.value)} placeholder="https://..." /></label>
                    {contract.contractType === "WITNESS_GUARANTOR" && <label className="contract-field lx-field"><span>ผู้ค้ำประกัน</span><input maxLength={160} value={contract.guarantor} onChange={(e) => updateContract("guarantor", e.target.value)} /></label>}
                    {contract.contractType!=="NONE" && <label className="contract-field lx-field contract-signature-mode"><span>วิธีลงนาม</span><select value={contract.signatureMode} onChange={event=>{updateContract("signatureMode",event.target.value as ContractDraft["signatureMode"]);updateContract("consentAccepted",false);}}><option value="PRINT">พิมพ์เอกสารเพื่อลงนาม</option><option value="DIGITAL">เขียนลายเซ็นดิจิทัล</option></select></label>}
                  </div>
                </div>
                {contract.contractType!=="NONE" && <div className="contract-form-section">
                  <h3>เอกสารและสถานที่ทำสัญญา</h3>
                  <label className="contract-field lx-field"><span>แบบเอกสาร</span><select value={documents.kind} onChange={event=>setDocuments(current=>({...current,kind:event.target.value as ContractDocumentSettings["kind"],loanText:"",guaranteeText:""}))}><option value="NEW_LOAN">สัญญากู้ยืมเงินใหม่</option><option value="AMENDMENT">เอกสารแนบท้ายแก้ไขสัญญาเดิม</option></select></label>
                  <p className="contract-section-caption">แบบแนบท้ายใช้แก้ไขหนี้เดิม ไม่ยืนยันการจ่ายเงินกู้ใหม่ อัตราต่อปีในเอกสารไม่ถูกนำไปเปลี่ยนสูตรรับชำระโดยอัตโนมัติ</p>
                  <div className="contract-form-grid">{([{key:"place",label:"สถานที่ทำสัญญา"},{key:"collateral",label:"ทรัพย์สินที่ใช้เป็นประกัน (ถ้ามี)"},...(documents.kind==="AMENDMENT"?[{key:"originalNumber",label:"เลขที่สัญญาเดิม"},{key:"originalDate",label:"วันที่สัญญาเดิม"},{key:"annualRate",label:"อัตราดอกเบี้ยในแบบแนบท้าย (% ต่อปี)"},{key:"principalPaid",label:"เงินต้นชำระแล้ว (บาท)"},{key:"lawfulInterest",label:"ดอกเบี้ยที่ชอบด้วยกฎหมายค้าง (บาท)"}]:[]),...(contract.contractType==="WITNESS_GUARANTOR"?[{key:"guarantorId",label:"เลขบัตรผู้ค้ำ"},{key:"guarantorAddress",label:"ที่อยู่ผู้ค้ำ"},{key:"guarantorPhone",label:"โทรศัพท์ผู้ค้ำ"},{key:"guarantorAge",label:"อายุผู้ค้ำ"},{key:"guaranteeLimit",label:"วงเงินรับผิดรวมสูงสุด (บาท)"}]:[])] as {key:keyof ContractDocumentSettings;label:string}[]).map(field=><label key={field.key} className="contract-field lx-field"><span>{field.label}</span><input value={typeof documents[field.key]==="string"?documents[field.key] as string:""} onChange={event=>setDocuments(current=>({...current,[field.key]:event.target.value}))}/></label>)}</div>
                  <div className="contract-lender-lookup">
                    <label className="contract-field lx-field"><span>Companycode</span><input value={documents.companyCode} maxLength={80} onChange={event=>{const companyCode=event.target.value;setDocuments(current=>({...current,companyCode,lenderName:"",lenderId:"",lenderAddress:"",lenderPhone:"",lenderSignature:"",loanText:"",guaranteeText:""}));setCompanyLookupError("");}} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();void lookupLenderCompany();}}} placeholder="กรอกรหัสบริษัท"/></label>
                    <button type="button" className="lx-btn" disabled={companyLookupBusy || !documents.companyCode.trim()} onClick={()=>void lookupLenderCompany()}>{companyLookupBusy?<LoaderCircle size={16} className="animate-spin"/>:<Search size={16}/>}เรียกข้อมูลบริษัท</button>
                  </div>
                  {companyLookupError && <p className="contract-company-error" role="alert">{companyLookupError}</p>}
                  {(documents.lenderName || documents.lenderId || documents.lenderAddress || documents.lenderPhone) && <section className="contract-company-card" aria-label="ข้อมูลผู้ให้กู้"><h4>ข้อมูลผู้ให้กู้</h4><dl><div><dt>ชื่อ</dt><dd>{documents.lenderName || "—"}</dd></div><div><dt>เลขที่บัตร / เลขประจำตัวผู้เสียภาษี</dt><dd>{documents.lenderId || "—"}</dd></div><div><dt>ที่อยู่</dt><dd>{documents.lenderAddress || "—"}</dd></div><div><dt>เบอร์โทร</dt><dd>{documents.lenderPhone || "—"}</dd></div></dl></section>}
                  <details className="contract-document-editor"><summary>ตรวจและแก้ไขข้อความเอกสาร</summary><p>เมื่อแก้ข้อความแล้ว ระบบจะใช้ข้อความนี้เป็นฉบับพิมพ์ ควรตรวจยอดและชื่อทุกครั้ง</p><label className="contract-field lx-field"><span>สัญญากู้ / แบบแนบท้าย</span><textarea rows={16} value={documents.loanText || makeLoanDocument(documents,documentLoan)} onChange={event=>setDocuments(current=>({...current,loanText:event.target.value}))}/></label>{contract.contractType==="WITNESS_GUARANTOR" && <label className="contract-field lx-field"><span>สัญญาค้ำประกัน</span><textarea rows={12} value={documents.guaranteeText || makeGuaranteeDocument(documents,documentLoan,contract.guarantor)} onChange={event=>setDocuments(current=>({...current,guaranteeText:event.target.value}))}/></label>}<button type="button" className="lx-btn" onClick={()=>setDocuments(current=>({...current,loanText:"",guaranteeText:""}))}>สร้างข้อความใหม่จากข้อมูลปัจจุบัน</button></details>
                </div>}
                <div className="contract-form-section"><h3>หมายเหตุอื่น ๆ</h3><label className="contract-field lx-field"><textarea rows={3} maxLength={2000} value={contract.note} onChange={e=>updateContract("note",e.target.value)} placeholder="เงื่อนไขเพิ่มเติม"/></label></div>
                </div>
                {contract.contractType!=="NONE" && stage==="BORROWER" && <div className="contract-form-section"><h3>ผู้กู้ยืมและการลงนาม</h3><div className="contract-review-card"><strong>{borrowerName(selected)}</strong><p>{selected.borrowersCode} · {formatNationalId(selected.nationalId)} · {selected.phone||"—"}</p><p>{selected.address||"ยังไม่มีที่อยู่"}</p><p>เงินต้น {formatBaht(principalSatang)} · ดอกเบี้ยรวม {formatBaht(calculatedInterest)} · ยอดจ่ายสุทธิ {formatBaht(calculatedNetDisbursed)}</p><p>เริ่ม {contract.startDate} · ครบกำหนด {contract.dueDate}</p></div><label className="contract-field lx-field"><span>วันที่ลงนาม</span><input type="datetime-local" value={contract.signedAt} onChange={e=>updateContract("signedAt",e.target.value)}/></label>{contract.signatureMode==="DIGITAL" && <><SignatureCanvas value={digitalSignature} onChange={setDigitalSignature}/><label className="contract-consent"><input type="checkbox" checked={contract.consentAccepted} onChange={e=>updateContract("consentAccepted",e.target.checked)}/><span>ผู้กู้ยืนยันว่าเป็นลายเซ็นของตนและยินยอมใช้ประกอบสัญญา</span></label></>}<div className="contract-document-actions"><button type="button" className="lx-btn" onClick={()=>setStage("FORM")}>ย้อนกลับแก้ไขสัญญา</button><button type="button" className="lx-btn primary" onClick={()=>{if(contract.signatureMode==="DIGITAL" && (!digitalSignature||!contract.consentAccepted)){setSaveError("กรุณาลงนามและยืนยันคำยินยอมผู้กู้");return;}setSaveError("");setStage("WITNESSES");}}>ถัดไป · ข้อมูลพยาน</button></div></div>}
                {contract.contractType!=="NONE" && stage==="WITNESSES" && <div className="contract-form-section"><h3>ข้อมูลและลายเซ็นพยาน</h3><p className="contract-section-caption">กรอกข้อมูลแต่ละคน แล้วลงนามในช่องของคนนั้น</p><div className="contract-witness-grid">{([1,2] as const).map(n=><section className="contract-review-card" key={n}><h4>พยานคนที่ {n}</h4><label className="contract-field lx-field"><span>ชื่อ–นามสกุล *</span><input value={contract[n===1?"witness1":"witness2"]} maxLength={160} onChange={e=>updateContract(n===1?"witness1":"witness2",e.target.value)}/></label>{(["Id","Phone","Address"] as const).map(suffix=>{const key=`witness${n}${suffix}` as keyof ContractDocumentSettings;return <label className="contract-field lx-field" key={key}><span>{suffix==="Id"?"เลขบัตรประชาชน":suffix==="Phone"?"โทรศัพท์":"ที่อยู่"}</span><input value={documents[key] as string} onChange={e=>setDocuments(current=>({...current,[key]:e.target.value}))}/></label>;})}{contract.signatureMode==="DIGITAL" && <SignatureCanvas label={`พยานคนที่ ${n}`} value={documents[n===1?"witness1Signature":"witness2Signature"]} onChange={value=>setDocuments(current=>({...current,[n===1?"witness1Signature":"witness2Signature"]:value}))}/>}</section>)}</div>{contract.contractType==="WITNESS_GUARANTOR" && <section className="contract-review-card"><h4>ผู้ค้ำประกัน · {contract.guarantor||"ยังไม่ระบุชื่อ"}</h4><p>{documents.guarantorId} · {documents.guarantorAddress}</p>{contract.signatureMode==="DIGITAL" && <SignatureCanvas label="ผู้ค้ำประกัน" value={documents.guarantorSignature} onChange={value=>setDocuments(current=>({...current,guarantorSignature:value}))}/>}</section>}<div className="contract-document-actions"><button type="button" className="lx-btn" onClick={()=>setStage("BORROWER")}>ย้อนกลับ · ผู้กู้</button><button type="button" className="lx-btn primary" onClick={()=>{if(!contract.witness1.trim()||!contract.witness2.trim()||(contract.signatureMode==="DIGITAL" && (!documents.witness1Signature||!documents.witness2Signature))||(contract.contractType==="WITNESS_GUARANTOR" && (!contract.guarantor.trim()||(contract.signatureMode==="DIGITAL"&&!documents.guarantorSignature)))){setSaveError("กรอกชื่อและลงนามพยาน / ผู้ค้ำให้ครบตามวิธีลงนาม");return;}setSaveError("");setConfirmed(false);setStage("REVIEW");}}>ถัดไป · สรุปข้อมูล</button></div></div>}
                  {stage==="REVIEW" && <div className="contract-form-section"><h3>สรุปข้อมูลก่อนบันทึก</h3><div className="contract-review-card"><h4>{contract.contractNumber} · {borrowerName(selected)}</h4><p>เงินต้น {formatBaht(principalSatang)} · อัตราดอกเบี้ย {interestRate}% {isInstallment?"ต่อเดือน":"ตามสัญญา"}</p><p>ดอกเบี้ยรวม {formatBaht(calculatedInterest)} · จ่ายสุทธิ {formatBaht(calculatedNetDisbursed)}</p><p>สถานะเมื่อบันทึก: {isReservation ? "จองสัญญา · ยังไม่จ่ายเงิน" : "ดำเนินการตามขั้นตอนปกติ"}</p><p>เริ่ม {contract.startDate} · ครบกำหนด {contract.dueDate}</p><p>{contract.contractType==="NONE"?"ไม่ใช้เอกสารสัญญา":`พยาน: ${contract.witness1} และ ${contract.witness2}`}</p>{contract.guarantor && <p>ผู้ค้ำ: {contract.guarantor}</p>}<p>วิธีลงนาม: {contract.contractType==="NONE"?"ไม่ใช้เอกสาร":contract.signatureMode==="DIGITAL"?"ลายเซ็นดิจิทัล":"พิมพ์เพื่อลงนาม"}</p><p>สถานที่: {documents.place||"เว้นว่าง"}</p><p>หมายเหตุ: {contract.note||"—"}</p></div>{contract.contractType!=="NONE" && <div className="contract-document-actions"><button type="button" className="lx-btn" onClick={()=>setShowDocument(true)}>ตรวจเอกสาร / พิมพ์</button><button type="button" className="lx-btn" onClick={()=>setShowDocument(true)}>บันทึก PDF</button></div>}<label className="contract-consent"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>ตรวจสอบข้อมูลและเอกสารแล้ว ขอยืนยันว่าข้อมูลเป็นความจริง</span></label><button type="button" className="lx-btn" onClick={()=>{setConfirmed(false);setStage("FORM");}}>ย้อนกลับแก้ไขข้อมูล</button></div>}
                {saveError && <div className="contract-error" role="alert">{saveError}</div>}
                <div className="contract-form-actions">
                  <button type="button" className="secondary-button lx-btn" disabled={saving} onClick={() => { draftIdRef.current="";setStage("FORM");setConfirmed(false);setContract(emptyContract);setDigitalSignature("");setDocuments(emptyDocumentSettings);setSaveError(""); }}>ล้างข้อมูล</button>
                  <button type="submit" className="primary-button lx-btn primary" disabled={saving || attachmentBusy || (stage==="REVIEW"&&!confirmed)} hidden={stage!=="FORM"&&stage!=="REVIEW"}>{saving ? <><LoaderCircle className="contract-spinner" size={15} /> กำลังบันทึก...</> : <><Check size={15} /> {stage==="FORM"?"ถัดไป": "ยืนยันและบันทึกสัญญา"}</>}</button>
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
            <div><dt>รหัสผู้กู้</dt><dd>{formatBorrowerCode(selected.borrowersCode)}</dd></div>
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
    </RootElement>
  );
}
