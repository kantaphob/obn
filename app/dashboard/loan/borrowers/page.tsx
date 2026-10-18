"use client";

import LoanActionButton from "@/components/loan/LoanActionButton";
import ConfirmDelete from "@/components/ui/ConfirmDelete";
import Link from "next/link";

import "../lending-ui.css";
import "./borrowers-ui.css";

import {
  borrowerEnumValues,
  borrowerEnumLabel,
  isBorrowerEnumField,
} from "@/lib/borrower-options";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Image from "next/image";
import { nationalIdDigits } from "@/lib/national-id";
import { parseIdCardOcr } from "@/lib/id-card-ocr";
import { useToast, useTrackedFetch } from "@/components/ui/ToastProvider";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  ImagePlus,
  IdCard,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import type { Bank } from "@/lib/banking-types";
import type { LocationOption, PostcodeResult } from "@/lib/postcode-types";

type Borrower = {
  workplace: string | null;
  status: string | null;
  bankAccountNumber: string | null;
  payoutChannel: string | null;
  payoutBankCode: string | null;
  registeredAt: string | null;
  facebook: string | null;
  instagram: string | null;
  line: string | null;
  hasFacebook: boolean | null;
  hasInstagram: boolean | null;
  hasLine: boolean | null;
  riskRating: string | null;
  approvedLimit: number | null;
  usedLimit: number | null;
  availableLimit: number | null;
  referrer: string | null;
  id: string;
  borrowersCode: string;
  nickname: string | null;
  phone: string;
  note: string | null;
  nationalId: string | null;
  prefixTH: string | null;
  firstName: string;
  lastName: string | null;
  firstNameEN: string | null;
  lastNameEN: string | null;
  gender: string | null;
  birthDate: string | null;
  address: string | null;
  houseNumber: string | null;
  buildingName: string | null;
  alley: string | null;
  road: string | null;
  subdistrictId: number | null;
  subdistrict: null | {
    id: number;
    nameTh: string;
    postcode: string | null;
    district: LocationOption & { province: LocationOption };
  };
  issueDate: string | null;
  expiryDate: string | null;
  photoUrl: string | null;
  idCardImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type BorrowerForm = Omit<
  Borrower,
  | "borrowersCode"
  | "id"
  | "createdAt"
  | "updatedAt"
  | "subdistrict"
  | "subdistrictId"
  | "hasFacebook"
  | "hasInstagram"
  | "hasLine"
  | "approvedLimit"
  | "usedLimit"
  | "availableLimit"
> & {
  subdistrictId: string | null;
  approvedLimit: string;
  usedLimit: string;
  availableLimit: string;
};
type ReaderState = "disconnected" | "reading" | "success";

const emptyForm: BorrowerForm = {
  workplace: "",
  status: "",
  bankAccountNumber: "",
  payoutChannel: "",
  payoutBankCode: "",
  registeredAt: "",
  facebook: "",
  instagram: "",
  line: "",
  riskRating: "",
  approvedLimit: "",
  usedLimit: "",
  availableLimit: "",
  referrer: "",
  nickname: "",
  phone: "",
  note: "",
  nationalId: "",
  prefixTH: "นาย",
  firstName: "",
  lastName: "",
  firstNameEN: "",
  lastNameEN: "",
  gender: "",
  birthDate: "",
  address: "",
  houseNumber: "",
  buildingName: "",
  alley: "",
  road: "",
  subdistrictId: null,
  issueDate: "",
  expiryDate: "",
  photoUrl: "",
  idCardImageUrl: "",
};

function borrowerDraftSnapshot(form: BorrowerForm, provinceId: string, districtId: string, postcode: string) {
  return JSON.stringify({ fields: Object.entries(form).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, value ?? ""]), provinceId, districtId, postcode });
}

function ConfirmBorrowerExit({ onStay, onDiscard }: { onStay: () => void; onDiscard: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className="borrower-exit-dialog" aria-labelledby="borrower-exit-title" aria-describedby="borrower-exit-description" onCancel={event => { event.preventDefault(); onStay(); }}>
    <AlertCircle size={28} aria-hidden="true" />
    <h2 id="borrower-exit-title">มีข้อมูลที่ยังไม่ได้บันทึก</h2>
    <p id="borrower-exit-description">หากออกตอนนี้ การเปลี่ยนแปลงจะไม่ถูกบันทึก ต้องการออกหรือกลับไปแก้ไขต่อ?</p>
    <div><button type="button" className="cancel-button lx-btn" autoFocus onClick={onStay}>กลับไปแก้ไข</button><button type="button" className="borrower-discard-button" onClick={onDiscard}>ออกโดยไม่บันทึก</button></div>
  </dialog>;
}

function cardValue(source: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const value = source[name];
    if (typeof value === "string" || typeof value === "number")
      return String(value).trim();
  }
  return "";
}

function optionLabel(option: LocationOption) {
  return option.nameTh;
}

function cardDate(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const digits = value.replace(/\D/g, "");
  if (digits.length === 8) {
    const yearFirst = Number(digits.slice(0, 4)) > 1900;
    const day = Number(yearFirst ? digits.slice(6, 8) : digits.slice(0, 2));
    const month = Number(yearFirst ? digits.slice(4, 6) : digits.slice(2, 4));
    let year = Number(yearFirst ? digits.slice(0, 4) : digits.slice(4));
    if (year > 2400) year -= 543;
    if (year > 1900 && month > 0 && month <= 12 && day > 0 && day <= 31)
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toISOString().slice(0, 10);
}

function cardGender(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["1", "m", "male", "ชาย"].includes(normalized)) return "ชาย";
  if (["2", "f", "female", "หญิง"].includes(normalized)) return "หญิง";
  return value;
}

function fullName(
  borrower: Pick<Borrower, "prefixTH" | "firstName" | "lastName"> & {
    nickname?: string | null;
  },
) {
  return borrower.firstName || borrower.lastName
    ? [borrower.prefixTH, borrower.firstName, borrower.lastName]
        .filter(Boolean)
        .join(" ")
    : borrower.nickname || "";
}

function membershipDuration(value: string | null) {
  if (!value) return "";
  const joined = new Date(value);
  const today = new Date();
  let years = today.getFullYear() - joined.getFullYear();
  let months = today.getMonth() - joined.getMonth();
  let days = today.getDate() - joined.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return years < 0
    ? "ยังไม่ถึงวันสมัคร"
    : `${years} ปี ${months} เดือน ${days} วัน`;
}

function maskNationalId(value: string | null) {
  if (!value) return "ยังไม่มีเลขบัตร";
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 13) return value;
  return `${digits.slice(0, 1)}-${digits.slice(1, 5)}-XXXXX-${digits.slice(10, 12)}-${digits.slice(12)}`;
}

function thaiDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function initials(borrower: Borrower) {
  return `${(borrower.firstName || borrower.nickname || borrower.borrowersCode).slice(0, 1)}${borrower.lastName?.slice(0, 1) || ""}`;
}

function BorrowerAvatar({ borrower }: { borrower: Borrower }) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  return (
    <span className="single-avatar overflow-hidden!">
      {borrower.photoUrl && failedPhoto !== borrower.photoUrl ? (
        <Image
          src={borrower.photoUrl}
          width={34}
          height={34}
          unoptimized
          alt=""
          className="h-full! w-full! object-cover"
          onError={() => setFailedPhoto(borrower.photoUrl)}
        />
      ) : (
        initials(borrower)
      )}
    </span>
  );
}

function BorrowerDetails({ borrower, banks, onClose, onEdit }: { borrower: Borrower; banks: Bank[]; onClose: () => void; onEdit: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  const money = (value: number | null) => value == null ? null : new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(value / 100);
  const bank = banks.find(item => item.bankCode === borrower.payoutBankCode);
  const sections: { title: string; items: [string, string | null][] }[] = [
    { title: "ข้อมูลส่วนบุคคล", items: [
      ["เลขบัตรประชาชน", borrower.nationalId], ["ชื่อภาษาอังกฤษ", [borrower.firstNameEN, borrower.lastNameEN].filter(Boolean).join(" ")],
      ["ชื่อเล่น", borrower.nickname], ["เบอร์โทรศัพท์", borrower.phone], ["วันเกิด", borrower.birthDate ? thaiDate(borrower.birthDate) : null], ["เพศ", borrower.gender],
      ["วันออกบัตร", borrower.issueDate ? thaiDate(borrower.issueDate) : null], ["วันหมดอายุ", borrower.expiryDate ? thaiDate(borrower.expiryDate) : null], ["ที่อยู่ตามบัตร", borrower.address],
    ] },
    { title: "ทะเบียนและวงเงิน", items: [
      ["ที่ทำงาน", borrower.workplace], ["สถานะ", borrower.status ? borrowerEnumLabel("status", borrower.status) : null],
      ["วันที่สมัคร", borrower.registeredAt ? thaiDate(borrower.registeredAt) : null], ["ระยะเวลา", borrower.registeredAt ? membershipDuration(borrower.registeredAt) : null],
      ["Rank", borrower.riskRating], ["Approved Limit", money(borrower.approvedLimit)], ["Used Limit", money(borrower.usedLimit)], ["Available Limit", money(borrower.availableLimit)],
      ["ช่องรับเงิน", borrower.payoutChannel ? borrowerEnumLabel("payoutChannel", borrower.payoutChannel) : null], ["ธนาคาร", bank?.bankNameTH || borrower.payoutBankCode], ["เลขบัญชี / พร้อมเพย์", borrower.bankAccountNumber], ["คนแนะนำ", borrower.referrer],
    ] },
    { title: "Social และบันทึกเพิ่มเติม", items: [["FB", borrower.facebook], ["IG", borrower.instagram], ["Line", borrower.line], ["หมายเหตุ", borrower.note], ["แก้ไขล่าสุด", thaiDate(borrower.updatedAt)]] },
  ];
  return <dialog ref={dialogRef} className="borrower-details-dialog" aria-labelledby="borrower-details-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header className="borrower-modal-header">
      <div className="borrower-details-heading"><BorrowerAvatar borrower={borrower} /><div><h2 id="borrower-details-title">{fullName(borrower)}</h2><p>{borrower.borrowersCode} · รายละเอียดผู้กู้</p></div></div>
      <button type="button" className="modal-close" aria-label="ปิดรายละเอียดผู้กู้" onClick={onClose}><X size={18} /></button>
    </header>
    <div className="borrower-details-body">{sections.map(section => <section key={section.title}><h3>{section.title}</h3><dl>{section.items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}</dl></section>)}</div>
    <footer className="borrower-details-footer"><LoanActionButton action="edit" aria-label="แก้ไขข้อมูลผู้กู้" onClick={onEdit} /></footer>
  </dialog>;
}

export default function Borrowers() {
  const [deletingBorrower, setDeletingBorrower] = useState<Borrower | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const trackedFetch = useTrackedFetch();
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ทั้งหมด");
  const [sortOrder, setSortOrder] = useState("asc");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<Borrower | null>(null);
  const [editing, setEditing] = useState<Borrower | null>(null);
  const [form, setForm] = useState<BorrowerForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const notify = useToast();
  const setError = useCallback(
    (message: string) => {
      if (message) notify({ status: "error", message });
    },
    [notify],
  );
  const [readerState, setReaderState] = useState<ReaderState>("disconnected");
  const [readerMessage, setReaderMessage] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrText, setOcrText] = useState("");
  const [ocrError, setOcrError] = useState("");
  const ocrInputRef = useRef<HTMLInputElement>(null);
  const readBusyRef = useRef(false);
  const lastCardRef = useRef("");
  const importSessionRef = useRef(0);
  const autoReadRef = useRef<() => Promise<void>>(async () => {});
  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [districts, setDistricts] = useState<LocationOption[]>([]);
  const [subdistricts, setSubdistricts] = useState<PostcodeResult["items"]>([]);
  const [provinceId, setProvinceId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [postcode, setPostcode] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState(() => borrowerDraftSnapshot(emptyForm, "", "", ""));
  const [confirmExit, setConfirmExit] = useState(false);
  const pendingExitRef = useRef<(() => void) | null>(null);
  const allowNavigationRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const hasUnsavedChanges = modalOpen && borrowerDraftSnapshot(form, provinceId, districtId, postcode) !== savedSnapshot;

  const clearBorrowerForm = useCallback(() => {
    importSessionRef.current += 1;
    lastCardRef.current = "";
    setModalOpen(false);
    setConfirmExit(false);
    setEditing(null);
    setForm(emptyForm);
    setProvinceId(""); setDistrictId(""); setPostcode("");
    setDistricts([]); setSubdistricts([]);
    setReaderState("disconnected"); setReaderMessage("");
    setOcrError(""); setOcrText(""); setOcrProgress(0);
    setSavedSnapshot(borrowerDraftSnapshot(emptyForm, "", "", ""));
  }, []);

  const requestBorrowerExit = useCallback((afterExit?: () => void) => {
    if (saveInFlightRef.current) {
      notify({ status: "info", message: "กำลังบันทึกข้อมูล กรุณารอผลก่อนออก" });
      return;
    }
    if (hasUnsavedChanges) {
      pendingExitRef.current = afterExit || null;
      setConfirmExit(true);
    } else {
      allowNavigationRef.current = true;
      clearBorrowerForm();
      afterExit?.();
    }
  }, [hasUnsavedChanges, clearBorrowerForm, notify]);

  useEffect(() => {
    if (!modalOpen) return;
    function beforeUnload(event: BeforeUnloadEvent) {
      if (allowNavigationRef.current || (!hasUnsavedChanges && !saveInFlightRef.current)) return;
      event.preventDefault(); event.returnValue = "";
    }
    function onLink(event: MouseEvent) {
      if (allowNavigationRef.current || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest('a[href]') as HTMLAnchorElement | null : null;
      if (!link || link.target === '_blank' || link.hasAttribute('download') || link.href === window.location.href) return;
      event.preventDefault(); event.stopImmediatePropagation();
      requestBorrowerExit(() => window.location.assign(link.href));
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !confirmExit) { event.preventDefault(); requestBorrowerExit(); }
    }
    // The browser supplies its own confirmation for refresh and tab/window close.
    const navigation = (window as unknown as { navigation?: EventTarget }).navigation;
    function onNavigate(event: Event) {
      const navEvent = event as Event & { destination?: { url: string }; hashChange?: boolean; navigationType?: string };
      if (allowNavigationRef.current || !event.cancelable || navEvent.hashChange || navEvent.navigationType === 'reload' || !navEvent.destination) return;
      event.preventDefault();
      requestBorrowerExit(() => window.location.assign(navEvent.destination!.url));
    }
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', onLink, true);
    document.addEventListener('keydown', onEscape);
    navigation?.addEventListener('navigate', onNavigate);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', onLink, true);
      document.removeEventListener('keydown', onEscape);
      navigation?.removeEventListener('navigate', onNavigate);
    };
  }, [modalOpen, hasUnsavedChanges, confirmExit, requestBorrowerExit]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [banksError, setBanksError] = useState("");

  useEffect(() => {
    if (!modalOpen && !viewing) return;
    const controller = new AbortController();
    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setBanksLoading(true);
      setBanksError("");
      try {
        const response = await trackedFetch("/api/banking", { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "โหลดรายการธนาคารไม่สำเร็จ");
        if (!controller.signal.aborted) setBanks(data);
      } catch (error) {
        if (!controller.signal.aborted) setBanksError(error instanceof Error ? error.message : "โหลดรายการธนาคารไม่สำเร็จ");
      } finally {
        if (!controller.signal.aborted) setBanksLoading(false);
      }
    })();
    return () => controller.abort();
  }, [modalOpen, viewing, trackedFetch]);

  async function loadBorrowers() {
    setLoading(true);
    setError("");
    try {
      const response = await trackedFetch("/api/borrowers", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "โหลดข้อมูลผู้กู้ไม่สำเร็จ");
      setBorrowers(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "โหลดข้อมูลผู้กู้ไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await trackedFetch("/api/borrowers", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "โหลดข้อมูลผู้กู้ไม่สำเร็จ");
        if (active) setBorrowers(data);
      } catch (loadError) {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "โหลดข้อมูลผู้กู้ไม่สำเร็จ",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [setError, trackedFetch]);

  useEffect(() => {
    if (!modalOpen) return;
    void trackedFetch("/api/postcodes?page=1&pageSize=1", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: PostcodeResult) => setProvinces(result.provinces || []))
      .catch(() => setReaderMessage("โหลดข้อมูลจังหวัดไม่สำเร็จ"));
  }, [modalOpen, trackedFetch]);

  useEffect(() => {
    if (!provinceId) return;
    void trackedFetch(`/api/postcodes?provinceId=${provinceId}&page=1&pageSize=1`, {
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((result: PostcodeResult) => setDistricts(result.districts || []))
      .catch(() => setError("โหลดข้อมูลอำเภอไม่สำเร็จ"));
  }, [provinceId, setError, trackedFetch]);

  useEffect(() => {
    if (!districtId) return;
    void trackedFetch(`/api/postcodes?districtId=${districtId}&page=1&pageSize=100`, {
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((result: PostcodeResult) => setSubdistricts(result.items || []))
      .catch(() => setError("โหลดข้อมูลตำบลไม่สำเร็จ"));
  }, [districtId, setError, trackedFetch]);

  const visibleBorrowers = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("th-TH");
    return borrowers.filter((borrower) => {
      const hasId = Boolean(borrower.nationalId);
      const filterMatches =
        filter === "ทั้งหมด" || (filter === "มีเลขบัตร" ? hasId : !hasId);
      const queryMatches =
        !term ||
        [
          borrower.borrowersCode,
          fullName(borrower),
          borrower.nickname || "",
          borrower.phone,
          borrower.nationalId || "",
          borrower.workplace || "",
        ].some((value) => value.toLocaleLowerCase("th-TH").includes(term));
      return filterMatches && queryMatches;
    }).sort((a, b) => (sortOrder === "asc" ? 1 : -1) * a.borrowersCode.localeCompare(b.borrowersCode, "en", { numeric: true, sensitivity: "base" }));
  }, [borrowers, filter, query, sortOrder]);

  const pageCount = Math.max(1, Math.ceil(visibleBorrowers.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageBorrowers = visibleBorrowers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const withNationalId = borrowers.filter(
    (borrower) => borrower.nationalId,
  ).length;

  const openCreate = useCallback(() => {
    allowNavigationRef.current = false;
    pendingExitRef.current = null;
    setConfirmExit(false);
    setSavedSnapshot(borrowerDraftSnapshot(emptyForm, "", "", ""));
    setOcrError(""); setOcrText("");
    setEditing(null);
    setForm(emptyForm);
    setReaderState("disconnected");
    setReaderMessage("");
    setProvinceId("");
    setDistrictId("");
    setPostcode("");
    setError("");
    setModalOpen(true);
  }, [setError]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") !== "1") return;
    const frame = requestAnimationFrame(openCreate);
    return () => cancelAnimationFrame(frame);
  }, [openCreate]);

  function openEdit(borrower: Borrower) {
    allowNavigationRef.current = false;
    pendingExitRef.current = null;
    setConfirmExit(false);
    setOcrError(""); setOcrText("");
    setEditing(borrower);
    const nextForm: BorrowerForm = {
      workplace: borrower.workplace || "",
      status: borrower.status || "",
      bankAccountNumber: borrower.bankAccountNumber || "",
      payoutChannel: borrower.payoutChannel || "",
      payoutBankCode: borrower.payoutBankCode || "",
      registeredAt: borrower.registeredAt
        ? new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Bangkok",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(borrower.registeredAt))
        : "",
      facebook: borrower.facebook || "",
      instagram: borrower.instagram || "",
      line: borrower.line || "",
      riskRating: borrower.riskRating || "",
      approvedLimit:
        borrower.approvedLimit == null
          ? ""
          : String(borrower.approvedLimit / 100),
      usedLimit:
        borrower.usedLimit == null ? "" : String(borrower.usedLimit / 100),
      availableLimit:
        borrower.availableLimit == null
          ? ""
          : String(borrower.availableLimit / 100),
      referrer: borrower.referrer || "",
      nickname: borrower.nickname || "",
      phone: borrower.phone,
      note: borrower.note || "",
      nationalId: borrower.nationalId || "",
      prefixTH: borrower.prefixTH || "",
      firstName: borrower.firstName,
      lastName: borrower.lastName || "",
      firstNameEN: borrower.firstNameEN || "",
      lastNameEN: borrower.lastNameEN || "",
      gender: borrower.gender || "",
      birthDate: borrower.birthDate?.slice(0, 10) || "",
      houseNumber: borrower.houseNumber || "",
      buildingName: borrower.buildingName || "",
      alley: borrower.alley || "",
      road: borrower.road || "",
      subdistrictId: borrower.subdistrictId
        ? String(borrower.subdistrictId)
        : null,
      address: borrower.address || "",
      issueDate: borrower.issueDate?.slice(0, 10) || "",
      expiryDate: borrower.expiryDate?.slice(0, 10) || "",
      photoUrl: borrower.photoUrl || "",
      idCardImageUrl: borrower.idCardImageUrl || "",
    };
    setForm(nextForm);
    setSavedSnapshot(borrowerDraftSnapshot(nextForm,
      borrower.subdistrict ? String(borrower.subdistrict.district.province.id) : "",
      borrower.subdistrict ? String(borrower.subdistrict.district.id) : "",
      borrower.subdistrict?.postcode || ""));
    setProvinceId(
      borrower.subdistrict
        ? String(borrower.subdistrict.district.province.id)
        : "",
    );
    setDistrictId(
      borrower.subdistrict ? String(borrower.subdistrict.district.id) : "",
    );
    setPostcode(borrower.subdistrict?.postcode || "");
    setReaderState("disconnected");
    setReaderMessage("");
    setError("");
    setModalOpen(true);
  }

  function changeField(key: keyof BorrowerForm, value: string) {
    const nextValue = key === "nationalId" ? nationalIdDigits(value).slice(0, 13) : value;
    setForm((current) => ({ ...current, [key]: nextValue,
      ...(key === "payoutChannel" && value !== "BANK_TRANSFER" ? { payoutBankCode: "" } : {}),
    }));
  }

  function addBorrowerUploadContext(body: FormData, values: Partial<BorrowerForm> = form) {
    if (editing) body.set('borrowerId', editing.id);
    body.set('prefixTH', values.prefixTH || form.prefixTH || '');
    body.set('firstName', values.firstName || form.firstName || '');
    body.set('lastName', values.lastName || form.lastName || '');
  }

  async function saveBorrower(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveInFlightRef.current || ocrBusy || readerState === "reading") return;
    if (form.nationalId && nationalIdDigits(form.nationalId).length !== 13) {
      setError(`เลขบัตรประชาชนต้องมี 13 หลัก ขณะนี้กรอก ${nationalIdDigits(form.nationalId).length} หลัก`);
      return;
    }
    if (form.payoutChannel === "BANK_TRANSFER" && !form.payoutBankCode) {
      setError("กรุณาเลือกธนาคารสำหรับรับเงิน");
      return;
    }
    saveInFlightRef.current = true;
    setSaving(true);
    setError("");
    const addressParts = [
      form.houseNumber,
      form.buildingName,
      form.alley ? `ซอย${form.alley}` : "",
      form.road ? `ถนน${form.road}` : "",
      subdistricts.find((item) => String(item.id) === form.subdistrictId)
        ?.nameTh,
      districts.find((item) => String(item.id) === districtId)?.nameTh,
      provinces.find((item) => String(item.id) === provinceId)?.nameTh,
      postcode,
    ].filter(Boolean);
    const fullAddress = addressParts.length
      ? addressParts.join(" ")
      : form.address;
    const payload = Object.fromEntries(
      Object.entries({
        ...form,
        address: fullAddress,
        subdistrictId: form.subdistrictId ? Number(form.subdistrictId) : null,
      }).map(([key, value]) => [
        key,
        typeof value === "string" && value.trim()
          ? value.trim()
          : value === null
            ? null
            : value,
      ]),
    );
    try {
      const response = await trackedFetch(
        editing ? `/api/borrowers/${editing.id}` : "/api/borrowers",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "บันทึกข้อมูลไม่สำเร็จ");
      if (!data.id) throw new Error("ยังไม่ยืนยันผลการบันทึก กรุณาตรวจสอบรายการผู้กู้");
      allowNavigationRef.current = true;
      clearBorrowerForm();
      pendingExitRef.current = null;
      notify({
        status: "success",
        message: editing ? "แก้ไขข้อมูลผู้กู้แล้ว" : "เพิ่มข้อมูลผู้กู้แล้ว",
      });
      await loadBorrowers();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "บันทึกข้อมูลไม่สำเร็จ",
      );
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }

  async function deleteBorrower(borrower: Borrower) {
    if (deleting) return;
    setDeleting(true);
    try {
      const response = await trackedFetch(`/api/borrowers/${borrower.id}`, {
        method: "DELETE",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({reason:deleteReason}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ลบข้อมูลไม่สำเร็จ");
      setDeletingBorrower(null);
      notify({ status: "success", message: "ย้ายผู้กู้ไปถังขยะแล้ว สามารถกู้คืนได้" });
      await loadBorrowers();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "ลบข้อมูลไม่สำเร็จ",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function readCard(automatic = false) {
    if (readBusyRef.current || ocrBusy || saving || confirmExit) return;
    readBusyRef.current = true;
    const session = importSessionRef.current;
    if (!automatic) { setReaderState("reading"); setReaderMessage(""); }
    try {
      const response = await (automatic ? fetch : trackedFetch)("/api/borrowers/read-card", {
        method: "POST",
        cache: "no-store",
      });
      const result = await response.json();
      if (session !== importSessionRef.current || saveInFlightRef.current) return;
      if (!response.ok) throw new Error(result.error || "อ่านบัตรไม่สำเร็จ");
      const payload =
        result.payload?.data && typeof result.payload.data === "object"
          ? result.payload.data
          : result.payload;
      if (!payload || typeof payload !== "object" || Array.isArray(payload))
        throw new Error("รูปแบบข้อมูลจากเครื่องอ่านไม่ถูกต้อง");
      const data = payload as Record<string, unknown>;
      const next: Partial<BorrowerForm> = {
        nationalId: nationalIdDigits(cardValue(data, [
          "nationalId",
          "cid",
          "citizenId",
          "personalId",
        ])),
        prefixTH: cardValue(data, [
          "prefixTH",
          "titleTH",
          "titleTh",
          "thaiTitle",
        ]),
        firstName: cardValue(data, [
          "firstName",
          "firstNameTH",
          "firstnameTH",
          "givenNameTH",
        ]),
        lastName: cardValue(data, [
          "lastName",
          "lastNameTH",
          "lastnameTH",
          "familyNameTH",
        ]),
        firstNameEN: cardValue(data, [
          "firstNameEN",
          "firstNameEng",
          "firstnameEN",
          "givenNameEN",
        ]),
        lastNameEN: cardValue(data, [
          "lastNameEN",
          "lastNameEng",
          "lastnameEN",
          "familyNameEN",
        ]),
        birthDate: cardDate(
          cardValue(data, ["birthDate", "dateOfBirth", "dob"]),
        ),
        gender: cardGender(cardValue(data, ["gender", "sex"])),
        address: cardValue(data, ["address", "fullAddress"]),
        houseNumber: cardValue(data, ["houseNumber", "houseNo", "addressNo"]),
        buildingName: cardValue(data, ["buildingName", "building"]),
        alley: cardValue(data, ["alley", "soi"]),
        road: cardValue(data, ["road", "street"]),
        issueDate: cardDate(cardValue(data, ["issueDate", "cardIssueDate"])),
        expiryDate: cardDate(
          cardValue(data, ["expiryDate", "cardExpiryDate", "expireDate"]),
        ),
      };
      const photoBase64 = cardValue(data, [
        "photoBase64",
        "photo",
        "photoData",
        "imageBase64",
      ]);
      if (!Object.values(next).some(Boolean) && !photoBase64)
        throw new Error("เชื่อมต่อเครื่องอ่านแล้ว แต่ไม่พบข้อมูลบัตรให้อ่าน");
      const fingerprint = JSON.stringify({ ...next, photoBase64 });
      if (automatic && fingerprint === lastCardRef.current) return;
      setReaderState("reading");
      if (photoBase64) {
        const cleanBase64 = photoBase64.replace(
          /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
          "",
        );
        const binary = atob(cleanBase64);
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        const blob = new Blob([bytes], { type: "image/jpeg" });
        const fileData = new FormData();
        addBorrowerUploadContext(fileData, next);
        fileData.append(
          "image",
          new File([blob], "card-photo.jpg", { type: "image/jpeg" }),
        );
        const uploaded = await trackedFetch("/api/borrowers/images", {
          method: "POST",
          body: fileData,
        });
        const uploadedResult = await uploaded.json();
        if (!uploaded.ok)
          throw new Error(uploadedResult.error || "บันทึกรูปจากบัตรไม่สำเร็จ");
        next.photoUrl = uploadedResult.url;
      }
      if (session !== importSessionRef.current) return;
      lastCardRef.current = fingerprint;
      setForm((current) => ({
        ...current,
        ...Object.fromEntries(
          Object.entries(next).filter(([, value]) => value),
        ),
      }));
      setReaderState("success");
      setReaderMessage("อ่านข้อมูลจากบัตรเรียบร้อยแล้ว");
    } catch (readError) {
      if (session !== importSessionRef.current) return;
      lastCardRef.current = "";
      setReaderState("disconnected");
      if (automatic) return;
      setReaderMessage(
        readError instanceof Error ? readError.message : "อ่านบัตรไม่สำเร็จ",
      );
    } finally {
      readBusyRef.current = false;
    }
  }

  useEffect(() => { autoReadRef.current = () => readCard(true); });
  useEffect(() => {
    if (!modalOpen) return;
    importSessionRef.current += 1;
    lastCardRef.current = "";
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (cancelled) return;
      if (document.visibilityState === "visible") await autoReadRef.current();
      if (!cancelled) timer = setTimeout(poll, 3000);
    }
    timer = setTimeout(poll, 500);
    return () => { cancelled = true; clearTimeout(timer); importSessionRef.current += 1; };
  }, [modalOpen]);

  async function uploadOcr(file?: File) {
    if (!file || readBusyRef.current || ocrBusy || saving) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024) {
      setOcrError("เลือกภาพ JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB"); setError("เลือกภาพ JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB"); return;
    }
    const session = importSessionRef.current;
    setOcrBusy(true); setOcrProgress(0); setOcrError(""); setOcrText("");
    try {
      const { readIdCardImage } = await import('@/lib/read-id-card-image');
      const text = await readIdCardImage(file, progress=>{if(session===importSessionRef.current)setOcrProgress(progress);});
      if (session !== importSessionRef.current) return;
      if (!text.trim()) throw new Error("ไม่พบข้อความในภาพ กรุณาใช้ภาพบัตรที่ชัดเจน");
      setOcrText(text);
      const fields = parseIdCardOcr(text);
      if (!fields.nationalId && !fields.firstName && !fields.firstNameEN) throw new Error("พบข้อความ แต่ยังแยกข้อมูลบัตรไม่ได้ กรุณาครอปเฉพาะหน้าบัตรให้ตรงและชัดเจน แล้วอัปโหลดอีกครั้ง หรือดูข้อความ OCR ด้านล่างเพื่อกรอกเอง");
      const {subdistrictName,districtName,provinceName,...cardFields}=fields;
      setForm(current=>({...current,...cardFields}));
      if(subdistrictName){
        try{
          const locationResponse=await trackedFetch(`/api/postcodes?q=${encodeURIComponent(subdistrictName)}&pageSize=100`,{cache:"no-store"});
          if(locationResponse.ok){const locations:PostcodeResult=await locationResponse.json();const clean=(value:string)=>value.replace(/\s/g,"");const matches=locations.items.filter(item=>clean(item.nameTh)===clean(subdistrictName)&&(!districtName||clean(item.district.nameTh)===clean(districtName))&&(!provinceName||clean(item.district.province.nameTh)===clean(provinceName)));if(matches.length===1 && session===importSessionRef.current){const location=matches[0];setProvinceId(String(location.district.province.id));setDistrictId(String(location.district.id));setPostcode(location.postcode || "");setSubdistricts(current=>current.some(item=>item.id===location.id)?current:[...current,location]);setForm(current=>({...current,subdistrictId:String(location.id)}));}}
        }catch{/* Keep the full address for manual selection if Masterdata cannot be loaded. */}
      }
      if(session!==importSessionRef.current)return;
      const missing=[['firstName','ชื่อไทย'],['lastName','นามสกุลไทย'],['firstNameEN','ชื่ออังกฤษ'],['lastNameEN','นามสกุลอังกฤษ'],['birthDate','วันเกิด'],['issueDate','วันออกบัตร'],['expiryDate','วันหมดอายุ'],['address','ที่อยู่']].filter(([key])=>!fields[key]).map(([,label])=>label);
      if(missing.length)setOcrError(`อ่านได้บางส่วน — ยังไม่พบ ${missing.join(' / ')} กรุณาตรวจข้อความ OCR ด้านล่างหรือกรอกเพิ่มเติม`);
      const body = new FormData(); addBorrowerUploadContext(body, fields); body.append('image', file);
      const response = await trackedFetch('/api/borrowers/images', { method: 'POST', body });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error || 'บันทึกภาพบัตรไม่สำเร็จ');
      if (session !== importSessionRef.current) return;
      setForm(current => ({ ...current, ...cardFields, idCardImageUrl: saved.url }));
      setOcrText(text);
      notify({ status: 'success', message: missing.length ? 'อ่านได้บางส่วน กรุณาตรวจช่องที่ยังว่างและข้อความ OCR' : 'อ่านภาพแล้ว กรุณาตรวจสอบข้อความและข้อมูลก่อนบันทึก' });
    } catch (error) {
      if (session === importSessionRef.current) {const message=error instanceof Error?error.message:typeof error==='string'?error:'อ่านภาพไม่สำเร็จ';setOcrError(message);setError(message);}
    } finally {
      setOcrBusy(false);
    }
  }

  async function uploadPhoto(file?: File) {
    if (!file || saving) return;
    const session = importSessionRef.current;
    setUploadingPhoto(true);
    setError("");
    try {
      const body = new FormData();
      addBorrowerUploadContext(body);
      body.append("image", file);
      const response = await trackedFetch("/api/borrowers/images", {
        method: "POST",
        body,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "อัปโหลดรูปไม่สำเร็จ");
      if (session !== importSessionRef.current) return;
      changeField("photoUrl", result.url);
      notify({ status: "success", message: "อัปโหลดรูปแล้ว" });
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "อัปโหลดรูปไม่สำเร็จ",
      );
    } finally {
      setUploadingPhoto(false);
    }
  }

  function exportBorrowers() {
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = [
      [
        "รหัสผู้กู้",
        "ชื่อ",
        "เลขบัตรประชาชน",
        "โทรศัพท์",
        "ชื่อเล่น",
        "ที่อยู่",
        "วันเกิด",
        "หมายเหตุ",
      ],
      ...visibleBorrowers.map((borrower) => [
        borrower.borrowersCode,
        fullName(borrower),
        maskNationalId(borrower.nationalId),
        borrower.phone,
        borrower.nickname || "",
        borrower.address || "",
        borrower.birthDate ? thaiDate(borrower.birthDate) : "",
        borrower.note || "",
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map((cell) => quote(String(cell))).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "borrowers.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="borrowers-page lx-page">
      <div className="borrowers-topline">
        <div className="borrowers-breadcrumb">
          <span>สินเชื่อ</span>
          <ChevronRight size={14} />
          <strong>ผู้กู้</strong>
        </div>

      </div>

      <main className="borrowers-main lx-wrap">
        <div className="borrowers-heading-row lx-head">
          <div>
            <div className="borrowers-eyebrow">
              <span /> LOAN MANAGEMENT{" "}
              <span className="eyebrow-divider">/</span> BORROWERS
            </div>
            <h1>ทะเบียนผู้กู้</h1>
            <p>
              จัดการข้อมูลผู้กู้ ค้นหารายชื่อ และตรวจสอบข้อมูลก่อนทำสัญญา
            </p>
          </div>
          <button className="borrower-add-button lx-btn primary" onClick={openCreate}>
            <Plus size={17} /> เพิ่มผู้กู้
          </button>
        </div>

        <section className="borrower-overview" aria-label="สรุปทะเบียนผู้กู้">
          {[{ label: "ผู้กู้ทั้งหมด", value: borrowers.length, note: "รายในทะเบียน" }, { label: "มีเลขบัตรประชาชน", value: withNationalId, note: "มีข้อมูลเลขบัตรในระบบ" }, { label: "ยังไม่มีเลขบัตร", value: borrowers.length - withNationalId, note: "ตรวจสอบและเติมข้อมูลเมื่อพร้อม" }].map(item => <div key={item.label}><span>{item.label}</span><strong>{loading ? "—" : item.value.toLocaleString("th-TH")}</strong><small>{item.note}</small></div>)}
        </section>
        <section className="borrower-list-card lx-panel" aria-labelledby="borrower-list-title">
          <div className="borrower-list-head">
            <div>
              <h2 id="borrower-list-title">รายชื่อผู้กู้</h2>
              <p>เลือกผู้กู้เพื่อดูรายละเอียดและจัดการข้อมูล</p>
            </div>
            <div className="borrower-list-tools"><Link className="lx-btn" href="/dashboard/loan/borrowers/delete">ถังขยะผู้กู้</Link>
            <button type="button" className="export-borrowers lx-btn" disabled={loading || !visibleBorrowers.length} onClick={exportBorrowers}>
              <ArrowDownToLine size={15} /> ส่งออก CSV
            </button></div>
          </div>
          <div className="borrower-toolbar lx-filterbar">
            <div className="borrower-search">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => { setQuery(event.target.value); setPage(1); }}
                placeholder="ค้นหารหัส ชื่อ เลขบัตร หรือเบอร์โทร..."
                aria-label="ค้นหาผู้กู้"
              />
            </div>
            <label className="borrower-sort">
              <span>เรียงรหัสผู้กู้</span>
              <select value={sortOrder} onChange={event => { setSortOrder(event.target.value); setPage(1); }}>
                <option value="asc">น้อยไปมาก (1 → 9)</option>
                <option value="desc">มากไปน้อย (9 → 1)</option>
              </select>
            </label>
            <div className="lx-seg" role="group" aria-label="กรองผู้กู้">
              {[{ label: "ทั้งหมด", count: borrowers.length }, { label: "มีเลขบัตร", count: withNationalId }, { label: "ไม่มีเลขบัตร", count: borrowers.length - withNationalId }].map(item => <button key={item.label} type="button" className={filter === item.label ? "on" : ""} aria-pressed={filter === item.label} onClick={() => { setFilter(item.label); setPage(1); }}>{item.label} <b>{item.count}</b></button>)}
            </div>
          </div>
          <div className="borrower-table-wrap lx-table-wrap">
            <table className="borrower-table lx-table" aria-busy={loading}><caption className="sr-only">รายชื่อผู้กู้และข้อมูลติดต่อ เลือกชื่อเพื่อดูรายละเอียด</caption>
              <thead>
                <tr>
                  <th>ชื่อผู้กู้</th>
                  <th>เบอร์โทรศัพท์</th>
                  <th>สถานะ / วงเงินคงเหลือ</th>
                  <th>ระดับความเสี่ยง</th>
                  <th>
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="borrower-no-results" colSpan={5}>
                      <LoaderCircle
                        className="borrower-loading-icon"
                        size={22}
                      />
                      <strong>กำลังโหลดข้อมูล</strong>
                      <span>กำลังอ่านข้อมูลจากฐานข้อมูล</span>
                    </td>
                  </tr>
                ) : (
                  pageBorrowers.map((borrower) => (
                    <tr className="borrower-row" key={borrower.id}>
                      <td>
                        <div className="borrower-identity">
                          <button type="button" className="borrower-avatar-button" aria-label={`ดูข้อมูล ${fullName(borrower)}`} title="ดูข้อมูลผู้กู้" onClick={() => setViewing(borrower)}><BorrowerAvatar borrower={borrower} /></button>
                          <span className="pair-names">
                            <button type="button" className="borrower-name-link" onClick={() => setViewing(borrower)}>{fullName(borrower)}</button>
                            <small>
                              {borrower.borrowersCode}
                              {borrower.nickname
                                ? ` · ${borrower.nickname}`
                                : ""}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td>{borrower.phone || "—"}</td>
                      <td>
                        <span>
                          {borrower.status
                            ? borrowerEnumLabel("status", borrower.status)
                            : ""}
                        </span>
                        <small className="borrower-limit-caption">
                          {borrower.availableLimit == null
                            ? ""
                            : new Intl.NumberFormat("th-TH", {
                                style: "currency",
                                currency: "THB",
                              }).format(borrower.availableLimit / 100)}
                        </small>
                      </td>
                      <td><span className="borrower-rank" data-rank={borrower.riskRating || ""}>{borrower.riskRating || "—"}</span></td>
                      <td>
                        <div className="borrower-row-actions lx-actions">
                          <LoanActionButton action="edit" aria-label={`แก้ไข ${fullName(borrower)}`} onClick={() => openEdit(borrower)} />
                          <LoanActionButton action="delete" aria-label={`ลบ ${fullName(borrower)}`} onClick={() => {setDeleteReason("");setDeletingBorrower(borrower);}} />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
                {!loading && visibleBorrowers.length === 0 && (
                  <tr>
                    <td className="borrower-no-results" colSpan={5}>
                      <UsersRound size={24} />
                      <strong>
                        {borrowers.length
                          ? "ไม่พบข้อมูลที่ค้นหา"
                          : "ยังไม่มีข้อมูลผู้กู้"}
                      </strong>
                      <span>
                        {borrowers.length
                          ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง"
                          : "เริ่มต้นด้วยการเพิ่มข้อมูลผู้กู้รายแรก"}
                      </span>
                      {!borrowers.length && (
                        <button
                          className="empty-add-borrower"
                          onClick={openCreate}
                        >
                          <Plus size={14} /> เพิ่มผู้กู้
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="borrower-table-footer lx-tablefoot">
            <span role="status" aria-live="polite">{loading ? "กำลังโหลด…" : `แสดง ${visibleBorrowers.length ? (currentPage - 1) * pageSize + 1 : 0}–${Math.min(currentPage * pageSize, visibleBorrowers.length)} จาก ${visibleBorrowers.length} ราย`}</span>
            <nav aria-label="หน้ารายชื่อผู้กู้" className="borrower-pagination">
              <button type="button" aria-label="หน้าก่อนหน้า" disabled={loading || currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ArrowLeft size={15} /></button>
              <span>หน้า {currentPage} / {pageCount}</span>
              <button type="button" aria-label="หน้าถัดไป" disabled={loading || currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}><ArrowRight size={15} /></button>
            </nav>
          </div>
        </section>
        <div className="borrower-page-foot">
          <span>OBNITHI CON · LOAN SYSTEM</span>
          <span>
            ข้อมูลผู้กู้ <b>•</b> แก้ไขล่าสุดตามฐานข้อมูล
          </span>
        </div>
      </main>

      {viewing && <BorrowerDetails borrower={viewing} banks={banks} onClose={() => setViewing(null)} onEdit={() => { openEdit(viewing); setViewing(null); }} />}
      {deletingBorrower && <ConfirmDelete name={fullName(deletingBorrower)} description={`ย้าย “${fullName(deletingBorrower)}” ไปถังขยะหรือไม่? เก็บข้อมูลและวันที่ลบไว้ สามารถกู้คืนได้ สัญญาและประวัติชำระเงินจะยังอยู่`} busy={deleting} onCancel={() => setDeletingBorrower(null)} onConfirm={() => void deleteBorrower(deletingBorrower)}><label className="compact-field"><span>เหตุผลการลบ (ถ้ามี)</span><textarea value={deleteReason} maxLength={1000} rows={3} disabled={deleting} onChange={event=>setDeleteReason(event.target.value)} /></label></ConfirmDelete>}
      {confirmExit && <ConfirmBorrowerExit onStay={() => { pendingExitRef.current = null; setConfirmExit(false); }} onDiscard={() => {
        const afterExit = pendingExitRef.current;
        pendingExitRef.current = null;
        allowNavigationRef.current = true;
        clearBorrowerForm();
        afterExit?.();
      }} />}
      {modalOpen && (
        <div
          className="borrower-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) requestBorrowerExit();
          }}
        >
          <section
            className="borrower-modal borrower-crud-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="borrower-modal-title"
          >
            <header className="borrower-modal-header">
              <div>
                <div className="borrowers-eyebrow">
                  <span /> {editing ? "EDIT BORROWER" : "NEW BORROWER"}
                </div>
                <h2 id="borrower-modal-title">
                  {editing ? "แก้ไขข้อมูลผู้กู้" : "เพิ่มข้อมูลผู้กู้"}
                </h2>
                <p>เพิ่มข้อมูลผู้กู้และตรวจสอบความถูกต้องก่อนบันทึก</p>
              </div>
              <div className="borrower-modal-actions-top">
                <button
                  type="button"
                  className={`read-card-top-button borrower-icon-button reader-${readerState}`}
                  aria-label={readerState === "reading" ? "กำลังอ่านบัตร" : readerState === "success" ? "อ่านบัตรอีกครั้ง — ดึงข้อมูลเรียบร้อย" : "อ่านบัตร — ยังไม่เชื่อมต่อ"}
                  title={readerState === "reading" ? "กำลังอ่านบัตร" : readerState === "success" ? "อ่านบัตรอีกครั้ง — ดึงข้อมูลเรียบร้อย" : "อ่านบัตร — ยังไม่เชื่อมต่อ"}
                  onClick={() => void readCard()}
                  disabled={readerState === "reading" || ocrBusy || saving}
                >
                  <IdCard size={21} aria-hidden="true" /><i aria-hidden="true" />
                </button>
                <button type="button" className="borrower-ocr-button borrower-icon-button" aria-label={ocrBusy ? `กำลังอ่าน OCR ${ocrProgress}%` : "OCR — อัปโหลดภาพบัตร"} title={ocrBusy ? `กำลังอ่าน OCR ${ocrProgress}%` : "OCR — อัปโหลดภาพบัตร"} onClick={() => ocrInputRef.current?.click()} disabled={ocrBusy || readerState === "reading" || saving}>
                  {ocrBusy ? <LoaderCircle size={21} className="borrower-loading-icon" aria-hidden="true" /> : <ImagePlus size={21} aria-hidden="true" />}
                </button>
                <input ref={ocrInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => { void uploadOcr(event.target.files?.[0]); event.target.value = ""; }} />
              </div>
            </header>
            <form onSubmit={saveBorrower} className="borrower-form">
              <fieldset disabled={saving} className="borrower-form-fields">
              <div className="borrower-form-intro">
                <span>เสียบบัตรเพื่ออ่านอัตโนมัติ หรืออัปโหลดภาพผ่าน OCR</span>
                <small>ข้อมูลที่ยังไม่มี เว้นว่างได้</small>
              </div>
              {ocrBusy && <div role="status" aria-live="polite" style={{padding:"12px 0"}}>กำลัง{ocrProgress < 20 ? "เตรียมตัวอ่านภาษาไทยและอังกฤษ" : "อ่านข้อความจากภาพ"} · {ocrProgress}%<progress value={ocrProgress} max={100} aria-label="ความคืบหน้า OCR" style={{display:"block",width:"100%"}}/></div>}
              {ocrError && <div role="alert" style={{padding:"12px",color:"#b42318",background:"#fff1f0",borderRadius:8}}>{ocrError}</div>}
              <section className="borrower-input-section lx-card">
                <div className="borrower-section-title">
                  <span>01</span>
                  <div>
                    <h3>ข้อมูลผู้กู้</h3>
                    <p>ข้อมูลระบุตัวตนและชื่อของผู้กู้</p>
                  </div>
                </div>
                <div className="borrower-person-layout">
                  <div className="borrower-person-details">
                    <div className="borrower-field-row borrower-id-row">
                      <label className="compact-field national-id-field">
                        <span>เลขบัตรประชาชน</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]{13}"
                          title="กรอกเลขบัตรประชาชนเป็นตัวเลข 13 หลัก"
                          aria-describedby="national-id-count"
                          value={form.nationalId || ""}
                          onChange={(event) => {
                            event.target.setCustomValidity("");
                            changeField("nationalId", event.target.value);
                          }}
                          onInvalid={(event) => event.currentTarget.setCustomValidity(`เลขบัตรประชาชนต้องมี 13 หลัก ขณะนี้กรอก ${nationalIdDigits(event.currentTarget.value).length} หลัก`)}
                          placeholder="กรอกเลข 13 หลัก"
                        />
                        <small id="national-id-count">{nationalIdDigits(form.nationalId || "").length}/13 หลัก · ไม่บังคับ</small>
                      </label>
                    </div>
                    <div className="borrower-field-row borrower-thai-row">
                      <label className="compact-field lx-field">
                        <span>คำนำหน้า</span>
                        <select
                          value={form.prefixTH || ""}
                          onChange={(event) =>
                            changeField("prefixTH", event.target.value)
                          }
                        >
                          <option value="">เลือกคำนำหน้า</option>
                          <option>นาย</option>
                          <option>นาง</option>
                          <option>นางสาว</option>
                        </select>
                      </label>
                      <label className="compact-field lx-field">
                        <span>ชื่อภาษาไทย</span>
                        <input
                          value={form.firstName}
                          onChange={(event) =>
                            changeField("firstName", event.target.value)
                          }
                          placeholder="ชื่อ"
                        />
                      </label>
                      <label className="compact-field lx-field">
                        <span>นามสกุลภาษาไทย</span>
                        <input
                          value={form.lastName || ""}
                          onChange={(event) =>
                            changeField("lastName", event.target.value)
                          }
                          placeholder="นามสกุล"
                        />
                      </label>
                    </div>
                    <div className="borrower-field-row borrower-two-row">
                      <label className="compact-field lx-field">
                        <span>ชื่อภาษาอังกฤษ</span>
                        <input
                          value={form.firstNameEN || ""}
                          onChange={(event) =>
                            changeField("firstNameEN", event.target.value)
                          }
                          placeholder="First name"
                        />
                      </label>
                      <label className="compact-field lx-field">
                        <span>นามสกุลภาษาอังกฤษ</span>
                        <input
                          value={form.lastNameEN || ""}
                          onChange={(event) =>
                            changeField("lastNameEN", event.target.value)
                          }
                          placeholder="Last name"
                        />
                      </label>
                    </div>
                    <div className="borrower-field-row borrower-three-row">
                      <label className="compact-field lx-field">
                        <span>วันเกิด</span>
                        <input
                          type="date"
                          value={form.birthDate?.slice(0, 10) || ""}
                          onChange={(event) =>
                            changeField("birthDate", event.target.value)
                          }
                        />
                      </label>
                      <label className="compact-field lx-field">
                        <span>เพศ</span>
                        <select
                          value={form.gender || ""}
                          onChange={(event) =>
                            changeField("gender", event.target.value)
                          }
                        >
                          <option value="">เลือกเพศ</option>
                          <option value="ชาย">ชาย</option>
                          <option value="หญิง">หญิง</option>
                          <option value="ไม่ระบุ">ไม่ระบุ</option>
                        </select>
                      </label>
                      <label className="compact-field lx-field">
                        <span>ชื่อเล่น</span>
                        <input
                          value={form.nickname || ""}
                          onChange={(event) =>
                            changeField("nickname", event.target.value)
                          }
                          placeholder="ระบุชื่อเล่น (ถ้ามี)"
                        />
                      </label>
                    </div>
                  </div>
                  <aside className="borrower-photo-panel">
                    <div className="photo-field borrower-portrait">
                      <div className="photo-heading">
                        <span>
                          รูปถ่ายผู้กู้ <small>(ไม่บังคับ)</small>
                        </span>
                        {form.photoUrl && (
                          <LoanActionButton action="delete" aria-label="ลบรูปถ่ายผู้กู้" onClick={() => changeField("photoUrl", "")} />
                        )}
                      </div>
                      <label
                        className={`photo-upload ${form.photoUrl ? "has-photo" : ""}`}
                      >
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(event) =>
                            void uploadPhoto(event.target.files?.[0])
                          }
                        />
                        {form.photoUrl ? (
                          <Image
                            src={form.photoUrl}
                            width={180}
                            height={130}
                            unoptimized
                            alt="รูปถ่ายผู้กู้"
                          />
                        ) : (
                          <span className="photo-placeholder">
                            <ImagePlus size={20} />
                            <strong>
                              {uploadingPhoto
                                ? "กำลังอัปโหลดรูป..."
                                : "เพิ่มรูปถ่าย"}
                            </strong>
                            <small>JPG, PNG, WebP · ไม่เกิน 5 MB</small>
                          </span>
                        )}
                      </label>
                    </div>
                    <p>อ่านรูปจากบัตร หรือเพิ่มรูปเองได้</p>
                  </aside>
                </div>
                <div className="borrower-card-validity">
                  <div>
                    <IdCard size={17} />
                    <strong>อายุบัตรประชาชน</strong>
                  </div>
                  <div className="borrower-field-row borrower-two-row">
                    <label className="compact-field lx-field">
                      <span>วันออกบัตร</span>
                      <input
                        type="date"
                        value={form.issueDate?.slice(0, 10) || ""}
                        onChange={(event) =>
                          changeField("issueDate", event.target.value)
                        }
                      />
                    </label>
                    <label className="compact-field lx-field">
                      <span>วันหมดอายุ</span>
                      <input
                        type="date"
                        value={form.expiryDate?.slice(0, 10) || ""}
                        onChange={(event) =>
                          changeField("expiryDate", event.target.value)
                        }
                      />
                    </label>
                  </div>
                </div>
              </section>
              <section className="borrower-input-section lx-card">
                <div className="borrower-section-title">
                  <span>02</span>
                  <div>
                    <h3>ที่อยู่ตามทะเบียน</h3>
                    <p>เลือกจังหวัดก่อน เพื่อค้นหาอำเภอและตำบล</p>
                  </div>
                </div>
                <div className="borrower-field-row borrower-two-row">
                  <label className="compact-field lx-field">
                    <span>บ้านเลขที่</span>
                    <input
                      value={form.houseNumber || ""}
                      onChange={(event) =>
                        changeField("houseNumber", event.target.value)
                      }
                      placeholder="เช่น 99/1"
                    />
                  </label>
                  <label className="compact-field lx-field">
                    <span>ชื่ออาคาร</span>
                    <input
                      value={form.buildingName || ""}
                      onChange={(event) =>
                        changeField("buildingName", event.target.value)
                      }
                      placeholder="ชื่ออาคาร (ถ้ามี)"
                    />
                  </label>
                </div>
                <div className="borrower-field-row borrower-two-row">
                  <label className="compact-field lx-field">
                    <span>ซอย</span>
                    <input
                      value={form.alley || ""}
                      onChange={(event) =>
                        changeField("alley", event.target.value)
                      }
                      placeholder="ชื่อซอย"
                    />
                  </label>
                  <label className="compact-field lx-field">
                    <span>ถนน</span>
                    <input
                      value={form.road || ""}
                      onChange={(event) =>
                        changeField("road", event.target.value)
                      }
                      placeholder="ชื่อถนน"
                    />
                  </label>
                </div>
                <div className="borrower-location-group">
                  <div className="borrower-field-row borrower-two-row">
                    <label className="compact-field lx-field">
                      <span>จังหวัด</span>
                      <select
                        value={provinceId}
                        onChange={(event) => {
                          setProvinceId(event.target.value);
                          setDistrictId("");
                          setDistricts([]);
                          setSubdistricts([]);
                          setPostcode("");
                          setForm((current) => ({
                            ...current,
                            subdistrictId: null,
                          }));
                        }}
                      >
                        <option value="">เลือกจังหวัด</option>
                        {provinces.map((option) => (
                          <option key={option.id} value={option.id}>
                            {optionLabel(option)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="compact-field lx-field">
                      <span>อำเภอ</span>
                      <select
                        value={districtId}
                        disabled={!provinceId}
                        onChange={(event) => {
                          setDistrictId(event.target.value);
                          setSubdistricts([]);
                          setPostcode("");
                          setForm((current) => ({
                            ...current,
                            subdistrictId: null,
                          }));
                        }}
                      >
                        <option value="">เลือกอำเภอ</option>
                        {districts.map((option) => (
                          <option key={option.id} value={option.id}>
                            {optionLabel(option)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="borrower-field-row borrower-two-row">
                    <label className="compact-field lx-field">
                      <span>ตำบล</span>
                      <select
                        value={form.subdistrictId || ""}
                        disabled={!districtId}
                        onChange={(event) => {
                          const selected = subdistricts.find(
                            (item) => String(item.id) === event.target.value,
                          );
                          changeField("subdistrictId", event.target.value);
                          setPostcode(selected?.postcode || "");
                        }}
                      >
                        <option value="">เลือกตำบล</option>
                        {subdistricts.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.nameTh}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="compact-field lx-field">
                      <span>รหัสไปรษณีย์</span>
                      <input
                        value={postcode}
                        readOnly
                        placeholder="เลือกตำบลก่อน"
                      />
                    </label>
                  </div>
                </div>
                <details className="borrower-original-address">
                  <summary>ที่อยู่เต็มจากบัตร / ข้อมูลเพิ่มเติม</summary>
                  <label className="compact-field full-field">
                    <span>ที่อยู่ตามบัตรแบบเต็ม</span>
                    <textarea
                      rows={2}
                      value={form.address || ""}
                      onChange={(event) =>
                        changeField("address", event.target.value)
                      }
                      placeholder="บันทึกที่อยู่เต็มจากบัตรเพิ่มเติมได้"
                    />
                  </label>
                </details>
              </section>
              <section className="borrower-input-section lx-card">
                <div className="borrower-section-title">
                  <span>03</span>
                  <div>
                    <h3>ข้อมูลติดต่อและหมายเหตุ</h3>
                    <p>สำหรับติดต่อผู้กู้และบันทึกข้อมูลเพิ่มเติม</p>
                  </div>
                </div>
                <div className="borrower-contact-row">
                  <label className="compact-field lx-field">
                    <span>โทรศัพท์</span>
                    <input
                      inputMode="tel"
                      value={form.phone}
                      onChange={(event) =>
                        changeField("phone", event.target.value)
                      }
                      placeholder="08X-XXX-XXXX"
                    />
                  </label>
                </div>
                <label className="compact-field full-field">
                  <span>หมายเหตุ</span>
                  <textarea
                    rows={2}
                    value={form.note || ""}
                    onChange={(event) =>
                      changeField("note", event.target.value)
                    }
                    placeholder="บันทึกเพิ่มเติม"
                  />
                </label>
              </section>
              <section className="borrower-input-section lx-card">
                <div className="borrower-section-title">
                  <span>04</span>
                  <div>
                    <h3>ทะเบียนและวงเงิน</h3>
                    <p>ข้อมูลเดิมตามทะเบียนผู้กู้ สามารถแก้ไขเพิ่มเติมได้</p>
                  </div>
                </div>
                {editing && (
                  <p className="borrower-registration-id">
                    รหัสผู้กู้: <strong>{editing.borrowersCode}</strong>
                    {editing.registeredAt && (
                      <span>
                        {" "}
                        · ระยะเวลา {membershipDuration(editing.registeredAt)}
                      </span>
                    )}
                  </p>
                )}
                <div className="borrower-field-row borrower-two-row">
                  {(
                    [
                      { key: "workplace", label: "ที่ทำงาน" },
                      { key: "status", label: "สถานะ" },
                      {
                        key: "registeredAt",
                        label: "วันที่สมัคร",
                        type: "date",
                      },
                      { key: "referrer", label: "คนแนะนำ" },
                      { key: "riskRating", label: "Risk Rating" },
                      {
                        key: "approvedLimit",
                        label: "Approved Limit (บาท)",
                        type: "number",
                      },
                      {
                        key: "usedLimit",
                        label: "Used Limit (บาท)",
                        type: "number",
                      },
                      {
                        key: "availableLimit",
                        label: "Available Limit (บาท)",
                        type: "number",
                      },
                    ] as {
                      key: keyof BorrowerForm;
                      label: string;
                      type?: string;
                    }[]
                  ).map((field) => (
                    <label className="compact-field lx-field" key={field.key}>
                      <span>{field.label}</span>
                      {isBorrowerEnumField(field.key) ? (
                        <select
                          value={form[field.key] || ""}
                          onChange={(event) =>
                            changeField(field.key, event.target.value)
                          }
                        >
                          <option value="">เลือก{field.label}</option>
                          {borrowerEnumValues[field.key].map((value) => (
                            <option key={value} value={value}>
                              {borrowerEnumLabel(
                                field.key as
                                  | "status"
                                  | "payoutChannel"
                                  | "riskRating",
                                value,
                              )}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type || "text"}
                          min={field.type === "number" ? 0 : undefined}
                          step={field.type === "number" ? "0.01" : undefined}
                          value={form[field.key] || ""}
                          onChange={(event) =>
                            changeField(field.key, event.target.value)
                          }
                        />
                      )}
                    </label>
                  ))}
                </div>
                <div className={`borrower-field-row ${form.payoutChannel === "BANK_TRANSFER" ? "borrower-three-row" : "borrower-two-row"}`}>
                  <label className="compact-field lx-field">
                    <span>ช่องรับเงิน</span>
                    <select value={form.payoutChannel || ""} onChange={(event) => changeField("payoutChannel", event.target.value)}>
                      <option value="">เลือกช่องรับเงิน</option>
                      {borrowerEnumValues.payoutChannel.map(value => <option key={value} value={value}>{borrowerEnumLabel("payoutChannel", value)}</option>)}
                    </select>
                  </label>
                  {form.payoutChannel === "BANK_TRANSFER" && (
                    <label className="compact-field lx-field">
                      <span>ธนาคาร <span className="required">*</span></span>
                      <select value={form.payoutBankCode || ""} required disabled={banksLoading || !!banksError} onChange={(event) => changeField("payoutBankCode", event.target.value)}>
                        <option value="">{banksLoading ? "กำลังโหลดธนาคาร…" : "เลือกธนาคาร"}</option>
                        {banks.map(bank => <option key={bank.id} value={bank.bankCode}>{bank.bankNameTH} ({bank.bankShort})</option>)}
                      </select>
                      {banksError && <small role="alert">{banksError}</small>}
                      {!banksLoading && !banksError && banks.length === 0 && <small>ยังไม่มีรายการธนาคาร กรุณาเพิ่มในข้อมูลธนาคาร</small>}
                    </label>
                  )}
                  <label className="compact-field lx-field">
                    <span>{form.payoutChannel === "PROMPTPAY" ? "เลขพร้อมเพย์" : "เลขบัญชีธนาคาร"}</span>
                    <input type="text" maxLength={50} value={form.bankAccountNumber || ""} onChange={(event) => changeField("bankAccountNumber", event.target.value)} />
                  </label>
                </div>
              <div className="borrower-field-row borrower-three-row">
                  {(
                    [
                      { key: "facebook", label: "FB" },
                      { key: "instagram", label: "IG" },
                      { key: "line", label: "Line" },
                    ] as {
                      key: "facebook" | "instagram" | "line";
                      label: string;
                    }[]
                  ).map((field) => (
                    <label className="compact-field lx-field" key={field.key}>
                      <span>{field.label}</span>
                      <input
                        type="text"
                        maxLength={500}
                        value={form[field.key] || ""}
                        placeholder={
                          field.key === "line"
                            ? "Line ID หรือ ลิงก์"
                            : "ชื่อบัญชี หรือ ลิงก์โปรไฟล์"
                        }
                        onChange={(event) =>
                          changeField(field.key, event.target.value)
                        }
                      />
                    </label>
                  ))}
                </div>
              </section>
              {ocrText && <details className="borrower-ocr-review"><summary>ตรวจสอบข้อความและภาพจาก OCR</summary><p>OCR อาจอ่านคลาดเคลื่อน กรุณาตรวจสอบก่อนบันทึก</p>{form.idCardImageUrl && <Image src={form.idCardImageUrl} width={420} height={265} unoptimized alt="ภาพบัตรที่อัปโหลดสำหรับ OCR" />}<pre>{ocrText}</pre></details>}
              {readerMessage && (
                <div className={`reader-notice notice-${readerState}`}>
                  <AlertCircle size={15} />
                  <span>
                    {readerMessage}
                    <small>
                      {readerState === "success"
                        ? "ตรวจสอบข้อมูลที่อ่านได้ก่อนบันทึก"
                        : "ตรวจสอบการเชื่อมต่อ AISC Smart Card Service แล้วลองอ่านอีกครั้ง"}
                    </small>
                  </span>
                  <button
                    type="button"
                    aria-label="ปิด"
                    onClick={() => setReaderMessage("")}
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
              <div className="borrower-form-note">
                <ShieldCheck size={14} />
                <span>ข้อมูลจากบัตรสามารถแก้ไขได้ กรุณาตรวจสอบก่อนบันทึก</span>
              </div>
              <footer className="borrower-modal-footer">
                <span>
                  <ShieldCheck size={14} /> เชื่อมต่อฐานข้อมูลแล้ว
                </span>
                <div>
                  <button
                    type="button"
                    className="cancel-button lx-btn"
                    onClick={() => requestBorrowerExit()}
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="save-borrower-button lx-btn primary"
                    disabled={saving || ocrBusy || readerState === "reading"}
                  >
                    {saving ? (
                      <LoaderCircle
                        className="borrower-loading-icon"
                        size={14}
                      />
                    ) : (
                      <Check size={15} />
                    )}
                    {saving
                      ? "กำลังบันทึก..."
                      : editing
                        ? "บันทึกการแก้ไข"
                        : "บันทึกข้อมูล"}
                  </button>
                </div>
              </footer>
            </fieldset>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
