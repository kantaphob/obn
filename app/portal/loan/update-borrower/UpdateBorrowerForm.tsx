"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { nationalIdDigits } from "@/lib/national-id";
import type { LocationOption, PostcodeResult } from "@/lib/postcode-types";

type Borrower = {
  id: string;
  borrowersCode: string;
  firstName: string;
  lastName: string | null;
  nickname: string | null;
  phone: string;
  photoUrl: string | null;
  nationalId: string | null;
  prefixTH: string | null;
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
};

type VerificationForm = {
  nationalId: string;
  prefixTH: string;
  firstName: string;
  lastName: string;
  firstNameEN: string;
  lastNameEN: string;
  birthDate: string;
  gender: string;
  houseNumber: string;
  buildingName: string;
  village: string;
  alley: string;
  road: string;
  issueDate: string;
  expiryDate: string;
  phone: string;
  photoUrl: string;
};

const emptyForm: VerificationForm = {
  nationalId: "", prefixTH: "", firstName: "", lastName: "", firstNameEN: "", lastNameEN: "",
  birthDate: "", gender: "", houseNumber: "", buildingName: "", village: "", alley: "", road: "",
  issueDate: "", expiryDate: "", phone: "", photoUrl: "",
};

function cardValue(source: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const value = source[name];
    if (typeof value === "string" || typeof value === "number") return String(value).trim();
  }
  return "";
}

function cardPhoto(source: Record<string, unknown>) {
  for (const name of ["photoBase64", "photo", "photoData", "imageBase64", "image", "picture", "cardPhoto"]) {
    const value = source[name];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const object = value as Record<string, unknown>;
      for (const key of ["base64", "data", "content"]) {
        if (typeof object[key] === "string" && object[key].trim()) return object[key].trim();
      }
    }
  }
  return "";
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
    if (year > 1900 && month > 0 && month <= 12 && day > 0 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function addressParts(value: string) {
  const address = value.replace(/[#,\n]+/g, " ").replace(/\s+/g, " ").trim();
  const extract = (pattern: RegExp) => pattern.exec(address)?.[1]?.trim().replace(/[,.]+$/g, "") || "";
  return {
    houseNumber: extract(/(?:^|\s)(\d+[\d/.-]*)/),
    village: extract(/(?:^|\s)หมู่(?:ที่)?\s*([^\s]+)/),
    alley: extract(/(?:^|\s)ซอย\s*([^\s]+)/),
    road: extract(/(?:^|\s)ถนน\s*([^\s]+)/),
    subdistrict: extract(/(?:ตำบล|แขวง|ต\.)\s*(.+?)(?=\s*(?:อำเภอ|เขต|อ\.|จังหวัด|จ\.|$))/),
    district: extract(/(?:อำเภอ|เขต|อ\.)\s*(.+?)(?=\s*(?:จังหวัด|จ\.|$))/),
    province: extract(/(?:จังหวัด|จ\.)\s*(.+)$/),
  };
}

function displayName(borrower: Borrower) {
  return [borrower.prefixTH, borrower.firstName, borrower.lastName].filter(Boolean).join(" ") || borrower.nickname || "ไม่ระบุชื่อ";
}

export default function UpdateBorrowerForm() {
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<VerificationForm>(emptyForm);
  const [rawAddress, setRawAddress] = useState("");
  const [provinceId, setProvinceId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [subdistrictId, setSubdistrictId] = useState("");
  const [postcode, setPostcode] = useState("");
  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [districts, setDistricts] = useState<LocationOption[]>([]);
  const [subdistricts, setSubdistricts] = useState<PostcodeResult["items"]>([]);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cardRead, setCardRead] = useState(false);
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selected = borrowers.find((borrower) => borrower.id === selectedId) || null;
  const unverifiedBorrowers = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("th-TH");
    return borrowers.filter((borrower) => {
      if (borrower.nationalId) return false;
      if (!term) return true;
      return [borrower.borrowersCode, displayName(borrower), borrower.nickname || "", borrower.phone]
        .some((value) => value.toLocaleLowerCase("th-TH").includes(term));
    });
  }, [borrowers, query]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const borrowerResponse = await fetch("/api/borrowers", { cache: "no-store" });
        const borrowerResult = await borrowerResponse.json();
        if (!borrowerResponse.ok) throw new Error(borrowerResult.error || "โหลดรายชื่อผู้กู้ไม่สำเร็จ");
        if (!active) return;
        setBorrowers(borrowerResult as Borrower[]);
        try {
          const postcodeResponse = await fetch("/api/postcodes?page=1&pageSize=1", { cache: "no-store" });
          const postcodeResult = await postcodeResponse.json();
          if (!postcodeResponse.ok) throw new Error(postcodeResult.error || "โหลดข้อมูลที่อยู่ไม่สำเร็จ");
          if (active) setProvinces((postcodeResult as PostcodeResult).provinces || []);
        } catch (postcodeError) {
          if (active) setError(postcodeError instanceof Error ? postcodeError.message : "โหลดข้อมูลที่อยู่ไม่สำเร็จ");
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function loadDistrictOptions(selectedProvinceId: string) {
    setDistricts([]);
    setSubdistricts([]);
    if (!selectedProvinceId) return;
    const response = await fetch(`/api/postcodes?page=1&pageSize=1&provinceId=${selectedProvinceId}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "โหลดข้อมูลอำเภอไม่สำเร็จ");
    setDistricts((result as PostcodeResult).districts || []);
  }

  async function loadSubdistrictOptions(selectedDistrictId: string) {
    setSubdistricts([]);
    if (!selectedDistrictId) return;
    const response = await fetch(`/api/postcodes?page=1&pageSize=100&districtId=${selectedDistrictId}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "โหลดข้อมูลตำบลไม่สำเร็จ");
    setSubdistricts((result as PostcodeResult).items || []);
  }

  async function chooseBorrower(id: string) {
    const borrower = borrowers.find((item) => item.id === id);
    setSelectedId(id);
    const oldAddress = addressParts(borrower?.address || "");
    setForm({
      ...emptyForm,
      phone: borrower?.phone || "",
      houseNumber: borrower?.houseNumber || oldAddress.houseNumber,
      buildingName: borrower?.buildingName || "",
      village: oldAddress.village,
      alley: borrower?.alley || oldAddress.alley,
      road: borrower?.road || oldAddress.road,
    });
    setRawAddress(borrower?.address || "");
    setCardRead(false);
    setIdentityConfirmed(false);
    setError("");
    setNotice("");
    setProvinceId(borrower?.subdistrict ? String(borrower.subdistrict.district.province.id) : "");
    setDistrictId(borrower?.subdistrict ? String(borrower.subdistrict.district.id) : "");
    setSubdistrictId(borrower?.subdistrict ? String(borrower.subdistrict.id) : "");
    setPostcode(borrower?.subdistrict?.postcode || "");
    if (borrower?.subdistrict) {
      try {
        await loadDistrictOptions(String(borrower.subdistrict.district.province.id));
        await loadSubdistrictOptions(String(borrower.subdistrict.district.id));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลที่อยู่ไม่สำเร็จ");
      }
    } else {
      setDistricts([]);
      setSubdistricts([]);
    }
  }

  async function matchAddress(location: ReturnType<typeof addressParts>) {
    const q = location.subdistrict || location.district || location.province;
    if (!q) return;
    try {
      const response = await fetch(`/api/postcodes?page=1&pageSize=100&q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const result = await response.json() as PostcodeResult & { error?: string };
      if (!response.ok) throw new Error(result.error || "ค้นหาที่อยู่จากบัตรไม่สำเร็จ");
      const clean = (value: string) => value.trim().replace(/^(ตำบล|แขวง|อำเภอ|เขต|จังหวัด)\s*/, "");
      const item = result.items.find((candidate) =>
        (!location.subdistrict || clean(candidate.nameTh) === clean(location.subdistrict)) &&
        (!location.district || clean(candidate.district.nameTh) === clean(location.district)) &&
        (!location.province || clean(candidate.district.province.nameTh) === clean(location.province))
      );
      if (!item) return;
      const [districtResponse, subdistrictResponse] = await Promise.all([
        fetch(`/api/postcodes?page=1&pageSize=1&provinceId=${item.district.province.id}`, { cache: "no-store" }),
        fetch(`/api/postcodes?page=1&pageSize=100&districtId=${item.district.id}`, { cache: "no-store" }),
      ]);
      const districtResult = await districtResponse.json() as PostcodeResult & { error?: string };
      const subdistrictResult = await subdistrictResponse.json() as PostcodeResult & { error?: string };
      if (!districtResponse.ok) throw new Error(districtResult.error || "โหลดข้อมูลอำเภอไม่สำเร็จ");
      if (!subdistrictResponse.ok) throw new Error(subdistrictResult.error || "โหลดข้อมูลตำบลไม่สำเร็จ");
      setProvinces(result.provinces || []);
      setDistricts(districtResult.districts || []);
      setSubdistricts(subdistrictResult.items || []);
      setProvinceId(String(item.district.province.id));
      setDistrictId(String(item.district.id));
      setSubdistrictId(location.subdistrict ? String(item.id) : "");
      setPostcode(location.subdistrict ? item.postcode || "" : "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "จับคู่ที่อยู่จากบัตรไม่สำเร็จ");
    }
  }

  async function readCard() {
    if (!selected || reading || saving) return;
    setReading(true);
    setCardRead(false);
    setIdentityConfirmed(false);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/borrowers/read-card", { method: "POST", cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "อ่านข้อมูลจากบัตรไม่สำเร็จ");
      const root = result.payload;
      const nested = root?.data && typeof root.data === "object" ? root.data : root;
      if (!nested || typeof nested !== "object" || Array.isArray(nested)) throw new Error("รูปแบบข้อมูลจากเครื่องอ่านไม่ถูกต้อง");
      const data = {
        ...(root && typeof root === "object" && !Array.isArray(root) ? root : {}),
        ...(nested as Record<string, unknown>),
      } as Record<string, unknown>;
      const nationalId = nationalIdDigits(cardValue(data, ["nationalId", "cid", "citizenId", "personalId"]));
      const firstName = cardValue(data, ["firstName", "firstNameTH", "firstnameTH", "givenNameTH"]);
      if (nationalId.length !== 13 || !firstName) throw new Error("ข้อมูลจากบัตรไม่ครบ กรุณาเสียบบัตรใหม่แล้วลองอีกครั้ง");

      const duplicateResponse = await fetch(`/api/borrowers?q=${encodeURIComponent(nationalId)}&take=50`, { cache: "no-store" });
      const duplicateResult = await duplicateResponse.json();
      if (!duplicateResponse.ok) throw new Error(duplicateResult.error || "ตรวจสอบเลขบัตรกับทะเบียนไม่สำเร็จ");
      const duplicate = (duplicateResult as Borrower[]).find((item) => nationalIdDigits(item.nationalId || "") === nationalId);
      if (duplicate && duplicate.id !== selected.id) throw new Error(`เลขบัตรนี้ผูกกับผู้กู้ ${duplicate.borrowersCode} อยู่แล้ว กรุณาตรวจสอบรายการก่อน`);

      const cardAddressText = cardValue(data, ["address", "fullAddress", "addressTH", "fullAddressTH", "thaiAddress", "addressText"]);
      const parsed = addressParts(cardAddressText);
      const address = {
        ...parsed,
        subdistrict: cardValue(data, ["subdistrict", "subdistrictName", "tambon"]) || parsed.subdistrict,
        district: cardValue(data, ["district", "districtName", "amphoe"]) || parsed.district,
        province: cardValue(data, ["province", "provinceName", "changwat"]) || parsed.province,
      };

      let photoUrl = "";
      const photo = cardPhoto(data);
      if (photo) {
        const dataUrl = photo.match(/^data:(image\/(?:jpeg|png|webp));base64,(.*)$/i);
        const base64 = dataUrl ? dataUrl[2] : photo.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/i, "");
        const mime = dataUrl?.[1].toLowerCase() || "image/jpeg";
        const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
        const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
        const upload = new FormData();
        upload.set("borrowerId", selected.id);
        upload.set("image", new File([bytes], `card-photo.${extension}`, { type: mime }));
        const uploadResponse = await fetch("/api/borrowers/images", { method: "POST", body: upload, cache: "no-store" });
        const uploadResult = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(uploadResult.error || "บันทึกรูปจากบัตรไม่สำเร็จ");
        photoUrl = typeof uploadResult.url === "string" ? uploadResult.url : "";
      }

      setForm({
        nationalId,
        prefixTH: cardValue(data, ["prefixTH", "titleTH", "titleTh", "thaiTitle"]),
        firstName,
        lastName: cardValue(data, ["lastName", "lastNameTH", "lastnameTH", "familyNameTH"]),
        firstNameEN: cardValue(data, ["firstNameEN", "firstNameEng", "firstnameEN", "givenNameEN"]),
        lastNameEN: cardValue(data, ["lastNameEN", "lastNameEng", "lastnameEN", "familyNameEN"]),
        birthDate: cardDate(cardValue(data, ["birthDate", "dateOfBirth", "dob"])),
        gender: cardValue(data, ["gender", "sex"]),
        houseNumber: cardValue(data, ["houseNumber", "houseNo", "addressNo"]) || address.houseNumber || selected.houseNumber || "",
        buildingName: cardValue(data, ["buildingName", "building"]) || selected.buildingName || "",
        village: cardValue(data, ["village", "moo", "villageNo"]) || address.village || addressParts(selected.address || "").village,
        alley: cardValue(data, ["alley", "soi"]) || address.alley || selected.alley || "",
        road: cardValue(data, ["road", "street"]) || address.road || selected.road || "",
        issueDate: cardDate(cardValue(data, ["issueDate", "cardIssueDate"])),
        expiryDate: cardDate(cardValue(data, ["expiryDate", "cardExpiryDate", "expireDate"])),
        phone: selected.phone || "",
        photoUrl: photoUrl || selected.photoUrl || "",
      });
      setRawAddress(cardAddressText);
      await matchAddress(address);
      setCardRead(true);
      setNotice(photoUrl ? "อ่านข้อมูลและรูปจากบัตรแล้ว กรุณาตรวจสอบชื่อกับผู้กู้ที่เลือก" : "อ่านข้อมูลจากบัตรแล้ว กรุณาตรวจสอบชื่อกับผู้กู้ที่เลือก");
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "อ่านข้อมูลจากบัตรไม่สำเร็จ");
    } finally {
      setReading(false);
    }
  }

  function update(field: keyof VerificationForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === "nationalId" || field === "firstName" || field === "lastName") setIdentityConfirmed(false);
  }

  async function saveVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !cardRead) {
      setError("กรุณาเลือกผู้กู้เดิมและอ่านบัตรประชาชนก่อน");
      return;
    }
    if (nationalIdDigits(form.nationalId).length !== 13) {
      setError("เลขบัตรประชาชนต้องมี 13 หลัก");
      return;
    }
    if (!identityConfirmed) {
      setError("กรุณายืนยันว่าบุคคลบนบัตรเป็นผู้กู้ที่เลือก");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const subdistrict = subdistricts.find((item) => String(item.id) === subdistrictId);
      const district = districts.find((item) => String(item.id) === districtId);
      const province = provinces.find((item) => String(item.id) === provinceId);
      const fullAddress = [
        form.houseNumber,
        form.buildingName,
        form.village ? `หมู่${form.village}` : "",
        form.alley ? `ซอย${form.alley}` : "",
        form.road ? `ถนน${form.road}` : "",
        subdistrict?.nameTh,
        district?.nameTh,
        province?.nameTh,
        postcode,
      ].filter(Boolean).join(" ") || rawAddress || selected.address || "";
      const response = await fetch(`/api/borrowers/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nationalId: form.nationalId,
          prefixTH: form.prefixTH,
          firstName: form.firstName,
          lastName: form.lastName,
          firstNameEN: form.firstNameEN,
          lastNameEN: form.lastNameEN,
          birthDate: form.birthDate,
          gender: form.gender,
          address: fullAddress,
          houseNumber: form.houseNumber,
          buildingName: form.buildingName,
          alley: form.alley,
          road: form.road,
          subdistrictId: subdistrictId ? Number(subdistrictId) : null,
          issueDate: form.issueDate,
          expiryDate: form.expiryDate,
          photoUrl: form.photoUrl,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "ยืนยันข้อมูลผู้กู้ไม่สำเร็จ");
      setBorrowers((current) => current.filter((item) => item.id !== selected.id));
      setSelectedId("");
      setForm(emptyForm);
      setRawAddress("");
      setProvinceId(""); setDistrictId(""); setSubdistrictId(""); setPostcode("");
      setDistricts([]); setSubdistricts([]);
      setCardRead(false); setIdentityConfirmed(false);
      setNotice(`ยืนยันข้อมูลผู้กู้ ${result.borrowersCode || selected.borrowersCode} เรียบร้อยแล้ว`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "ยืนยันข้อมูลผู้กู้ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = "h-11 rounded-xl border border-[#dce5dd] bg-white px-3.5 text-sm outline-none focus:border-[#6a9878]";

  return (
    <main className="min-h-dvh bg-[#f5f7f4] px-4 py-6 text-[#26352d] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex items-center justify-between gap-3">
          <Link href="/portal" className="inline-flex items-center gap-2 text-sm font-medium text-[#557160] hover:text-[#315d4b]"><ArrowLeft size={17} /> กลับ Portal</Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#e1e8e1] bg-white px-3 py-2 text-[11px] text-[#718076]"><CreditCard size={15} /> Loan-OBN</span>
        </header>

        <section className="overflow-hidden rounded-[26px] border border-[#e1e9e2] bg-white shadow-[0_18px_50px_#203a2b0d]">
          <div className="border-b border-[#edf1ed] px-5 py-7 sm:px-9 sm:py-9">
            <p className="mb-2 text-[10px] font-bold tracking-[.2em] text-[#63816c]">EXISTING BORROWER · IDENTITY VERIFICATION</p>
            <h1 className="mb-2 text-2xl font-semibold tracking-tight sm:text-3xl">ยืนยันตัวตนผู้กู้เดิม</h1>
            <p className="mb-0 max-w-2xl text-sm leading-6 text-[#718076]">เลือกผู้กู้ที่ยังไม่มีเลขบัตรประชาชน อ่านบัตรเพื่อตรวจสอบข้อมูล แล้วบันทึกเข้าทะเบียนผู้กู้เดิม</p>
          </div>

          <div className="grid gap-6 px-5 py-6 sm:px-9 sm:py-8 lg:grid-cols-[minmax(260px,0.78fr)_minmax(0,1.5fr)]">
            <aside className="self-start rounded-2xl border border-[#e3ebe4] bg-[#fafcf9] p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="mb-0 text-sm font-semibold">ผู้กู้ที่ยังไม่ยืนยัน</h2>
                <span className="rounded-full bg-[#edf4ee] px-2.5 py-1 text-[10px] font-semibold text-[#557160]">{unverifiedBorrowers.length} ราย</span>
              </div>
              <label className="relative mb-3 block">
                <Search size={16} className="absolute left-3 top-3 text-[#8b998e]" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} className={`${fieldClass} w-full pl-9`} placeholder="ค้นหารหัส ชื่อ หรือเบอร์โทร" />
              </label>
              {loading ? <p className="mb-0 py-5 text-center text-xs text-[#7e8b81]">กำลังโหลดรายชื่อ…</p> : unverifiedBorrowers.length ? (
                <div className="max-h-[460px] space-y-2 overflow-auto">
                  {unverifiedBorrowers.map((borrower) => (
                    <button key={borrower.id} type="button" onClick={() => void chooseBorrower(borrower.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedId === borrower.id ? "border-[#86aa8f] bg-[#f0f7f1]" : "border-[#e8ede7] bg-white hover:border-[#bdcfbf]"}`}>
                      <span className="block text-xs font-semibold text-[#35483a]">{displayName(borrower)}</span>
                      <span className="mt-1 block text-[10px] text-[#7e8b81]">{borrower.borrowersCode} · {borrower.phone || "ไม่มีเบอร์โทร"}</span>
                    </button>
                  ))}
                </div>
              ) : <div className="rounded-xl border border-dashed border-[#d6e1d7] bg-white px-3 py-6 text-center text-xs text-[#718076]">{query ? "ไม่พบผู้กู้ที่ตรงกับคำค้น" : "ไม่มีผู้กู้ที่รอยืนยันตัวตน"}</div>}
              <p className="mb-0 mt-3 text-[10px] leading-5 text-[#87948a]">รายการนี้แสดงเฉพาะผู้กู้ที่ยังไม่มีเลขประจำตัวประชาชน</p>
            </aside>

            <section className="min-w-0">
              {error && <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-[#f2ceca] bg-[#fff5f4] p-3.5 text-sm text-[#a33631]"><AlertCircle size={17} className="mt-0.5 shrink-0" />{error}</div>}
              {notice && <div role="status" className="mb-4 rounded-xl border border-[#cce4d1] bg-[#f1f8f2] p-3.5 text-sm text-[#39754d]">{notice}</div>}

              {!selected ? (
                <div className="grid min-h-60 place-items-center rounded-2xl border border-dashed border-[#d6e1d7] px-5 text-center">
                  <div><span className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-[#f0f5f0] text-[#63816c]"><UserRound size={22} /></span><h2 className="mb-1 text-sm font-semibold">เลือกผู้กู้จากรายการ</h2><p className="mb-0 text-xs leading-5 text-[#7e8b81]">เมื่อเลือกแล้วจึงอ่านบัตรและผูกข้อมูลกับทะเบียนเดิม</p></div>
                </div>
              ) : (
                <>
                  <div className="mb-5 rounded-2xl border border-[#dcebe0] bg-[#f7fbf7] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div><p className="mb-1 text-[10px] font-bold tracking-[.14em] text-[#7b8c7e]">ผู้กู้ที่เลือก</p><h2 className="mb-1 text-base font-semibold">{displayName(selected)}</h2><p className="mb-0 text-xs text-[#718076]">{selected.borrowersCode} · {selected.phone || "ไม่มีเบอร์โทร"}</p></div>
                      <button type="button" onClick={() => void readCard()} disabled={reading || saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#315d4b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#244a39] disabled:cursor-wait disabled:opacity-60">
                        {reading ? <LoaderCircle size={17} className="animate-spin" /> : <CreditCard size={17} />}{reading ? "กำลังอ่านบัตร…" : cardRead ? "อ่านบัตรอีกครั้ง" : "อ่านบัตรประชาชน"}
                      </button>
                    </div>
                  </div>

                  {cardRead && <form onSubmit={saveVerification}>
                    <section className="mb-5">
                      <div className="mb-3 flex items-center gap-2"><ShieldCheck size={17} className="text-[#63816c]" /><h3 className="mb-0 text-sm font-semibold">ข้อมูลจากบัตรประชาชน</h3><span className="text-[10px] text-[#98a39a]">ตรวจทานและแก้ไขได้</span></div>
                      {form.photoUrl && <div className="mb-4 flex items-center gap-4 rounded-xl border border-[#e1e9e2] bg-[#f8faf8] p-3"><Image src={form.photoUrl} alt="รูปจากบัตรประชาชน" width={64} height={80} unoptimized className="h-20 w-16 rounded-lg object-cover" /><span className="text-xs font-medium text-[#526158]">รูปถ่ายจากบัตรประชาชน</span></div>}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1.5 text-xs font-medium text-[#526158]">เลขประจำตัวประชาชน<input value={form.nationalId} onChange={(event) => update("nationalId", nationalIdDigits(event.target.value).slice(0, 13))} inputMode="numeric" maxLength={13} required className={fieldClass} /></label>
                        <label className="grid gap-1.5 text-xs font-medium text-[#526158]">คำนำหน้า<select value={form.prefixTH} onChange={(event) => update("prefixTH", event.target.value)} className={fieldClass}><option value="">เลือกคำนำหน้า</option><option>นาย</option><option>นาง</option><option>นางสาว</option><option>อื่น ๆ</option></select></label>
                        <label className="grid gap-1.5 text-xs font-medium text-[#526158]">ชื่อ<input value={form.firstName} onChange={(event) => update("firstName", event.target.value)} required className={fieldClass} /></label>
                        <label className="grid gap-1.5 text-xs font-medium text-[#526158]">นามสกุล<input value={form.lastName} onChange={(event) => update("lastName", event.target.value)} className={fieldClass} /></label>
                        <label className="grid gap-1.5 text-xs font-medium text-[#526158]">ชื่อภาษาอังกฤษ<input value={form.firstNameEN} onChange={(event) => update("firstNameEN", event.target.value)} className={fieldClass} /></label>
                        <label className="grid gap-1.5 text-xs font-medium text-[#526158]">นามสกุลภาษาอังกฤษ<input value={form.lastNameEN} onChange={(event) => update("lastNameEN", event.target.value)} className={fieldClass} /></label>
                        <label className="grid gap-1.5 text-xs font-medium text-[#526158]">วันเกิด<input type="date" value={form.birthDate} onChange={(event) => update("birthDate", event.target.value)} className={fieldClass} /></label>
                        <label className="grid gap-1.5 text-xs font-medium text-[#526158]">เพศ<input value={form.gender} onChange={(event) => update("gender", event.target.value)} className={fieldClass} /></label>
                      </div>
                    </section>

                    <section className="mb-5 border-t border-[#edf1ed] pt-5">
                      <div className="mb-3 flex items-center gap-2"><span className="text-sm text-[#63816c]">⌖</span><h3 className="mb-0 text-sm font-semibold">ที่อยู่ตามบัตร</h3></div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1.5 text-xs font-medium text-[#526158]">บ้านเลขที่<input value={form.houseNumber} onChange={(event) => update("houseNumber", event.target.value)} className={fieldClass} /></label>
                        <label className="grid gap-1.5 text-xs font-medium text-[#526158]">อาคาร<input value={form.buildingName} onChange={(event) => update("buildingName", event.target.value)} className={fieldClass} /></label>
                        <label className="grid gap-1.5 text-xs font-medium text-[#526158]">หมู่ / หมู่บ้าน<input value={form.village} onChange={(event) => update("village", event.target.value)} className={fieldClass} /></label>
                        <label className="grid gap-1.5 text-xs font-medium text-[#526158]">ซอย<input value={form.alley} onChange={(event) => update("alley", event.target.value)} className={fieldClass} /></label>
                        <label className="grid gap-1.5 text-xs font-medium text-[#526158] sm:col-span-2">ถนน<input value={form.road} onChange={(event) => update("road", event.target.value)} className={fieldClass} /></label>
                        <label className="grid gap-1.5 text-xs font-medium text-[#526158]">ตำบล / แขวง<select value={subdistrictId} disabled={!districtId} onChange={(event) => { const id = event.target.value; setSubdistrictId(id); setPostcode(subdistricts.find((item) => String(item.id) === id)?.postcode || ""); }} className={`${fieldClass} disabled:bg-[#f6f8f6]`}><option value="">{districtId ? "เลือกตำบล / แขวง" : "เลือกอำเภอ / เขต ก่อน"}</option>{subdistricts.map((item) => <option key={item.id} value={item.id}>{item.nameTh}</option>)}</select></label>
                        <label className="grid gap-1.5 text-xs font-medium text-[#526158]">อำเภอ / เขต<select value={districtId} disabled={!provinceId} onChange={(event) => { const id = event.target.value; setDistrictId(id); setSubdistrictId(""); setPostcode(""); void loadSubdistrictOptions(id).catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลตำบลไม่สำเร็จ")); }} className={`${fieldClass} disabled:bg-[#f6f8f6]`}><option value="">{provinceId ? "เลือกอำเภอ / เขต" : "เลือกจังหวัดก่อน"}</option>{districts.map((item) => <option key={item.id} value={item.id}>{item.nameTh}</option>)}</select></label>
                        <label className="grid gap-1.5 text-xs font-medium text-[#526158]">จังหวัด<select value={provinceId} onChange={(event) => { const id = event.target.value; setProvinceId(id); setDistrictId(""); setSubdistrictId(""); setPostcode(""); void loadDistrictOptions(id).catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลอำเภอไม่สำเร็จ")); }} className={fieldClass}><option value="">เลือกจังหวัด</option>{provinces.map((item) => <option key={item.id} value={item.id}>{item.nameTh}</option>)}</select></label>
                        <p className="mb-0 self-center text-[11px] text-[#718076]">รหัสไปรษณีย์ {postcode || "จะเติมให้อัตโนมัติเมื่อเลือกตำบล"}</p>
                        {rawAddress && <p className="mb-0 rounded-xl bg-[#f6f8f6] p-3 text-xs leading-5 text-[#6f7e73] sm:col-span-2"><strong className="mb-1 block text-[#526158]">ที่อยู่ที่อ่านได้จากบัตร</strong>{rawAddress}</p>}
                      </div>
                    </section>

                    <section className="mb-5 border-t border-[#edf1ed] pt-5">
                      <label className="grid max-w-md gap-1.5 text-xs font-medium text-[#526158]">เบอร์โทรศัพท์<input type="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} className={fieldClass} /></label>
                    </section>

                    <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[#dcebe0] bg-[#f7fbf7] p-3.5 text-xs leading-5 text-[#526158]"><input type="checkbox" checked={identityConfirmed} onChange={(event) => setIdentityConfirmed(event.target.checked)} className="mt-0.5 accent-[#315d4b]" /><span>ตรวจสอบแล้วว่าบุคคลบนบัตรประชาชนเป็นผู้กู้เดิมที่เลือก และข้อมูลถูกต้อง</span></label>
                    <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[#edf1ed] pt-5">
                      <p className="mb-0 max-w-md text-[11px] leading-5 text-[#87948a]">การบันทึกจะเพิ่มเลขบัตรและข้อมูลที่ตรวจทานแล้วเข้าทะเบียนผู้กู้เดิม</p>
                      <button type="submit" disabled={saving || reading || !identityConfirmed} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#315d4b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#244a39] disabled:cursor-not-allowed disabled:opacity-50">{saving ? <LoaderCircle size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}{saving ? "กำลังบันทึก…" : "ยืนยันและอัปเดตผู้กู้เดิม"}</button>
                    </footer>
                  </form>}
                </>
              )}
            </section>
          </div>
        </section>
        <p className="mt-5 text-center text-[10px] text-[#97a198]">หากไม่พบรายชื่อผู้กู้ กรุณาใช้เมนูผู้กู้ใหม่หรือสอบถามผู้ดูแลระบบ</p>
      </div>
    </main>
  );
}
