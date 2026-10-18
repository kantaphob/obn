"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CreditCard,
  LoaderCircle,
  MapPin,
  Phone,
  ScanLine,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { nationalIdDigits } from "@/lib/national-id";
import type { LocationOption, PostcodeResult } from "@/lib/postcode-types";

type BorrowerFormData = {
  nationalId: string;
  prefixTH: string;
  firstName: string;
  lastName: string;
  firstNameEN: string;
  lastNameEN: string;
  birthDate: string;
  gender: string;
  address: string;
  houseNumber: string;
  buildingName: string;
  alley: string;
  road: string;
  issueDate: string;
  expiryDate: string;
  phone: string;
  photoUrl: string;
};

const emptyForm: BorrowerFormData = {
  nationalId: "", prefixTH: "", firstName: "", lastName: "", firstNameEN: "", lastNameEN: "",
  birthDate: "", gender: "", address: "", houseNumber: "", buildingName: "", alley: "", road: "",
  issueDate: "", expiryDate: "", phone: "", photoUrl: "",
};

function cardValue(source: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const value = source[name];
    if (typeof value === "string" || typeof value === "number") return String(value).trim();
  }
  return "";
}

function cardImageValue(source: Record<string, unknown>) {
  for (const name of ["photoBase64", "photo", "photoData", "imageBase64", "image", "picture", "cardPhoto"]) {
    const value = source[name];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const image = value as Record<string, unknown>;
      for (const key of ["base64", "data", "content"]) {
        if (typeof image[key] === "string" && image[key].trim()) return image[key].trim();
      }
    }
  }
  return "";
}

function parseCardAddress(value: string) {
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

function genderLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["1", "m", "male", "ชาย"].includes(normalized)) return "ชาย";
  if (["2", "f", "female", "หญิง"].includes(normalized)) return "หญิง";
  return value;
}

export default function NewBorrowerForm() {
  const [form, setForm] = useState(emptyForm);
  const [reading, setReading] = useState(false);
  const [cardVerified, setCardVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [borrowerCode, setBorrowerCode] = useState("");
  const [cardAddress, setCardAddress] = useState("");
  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [districts, setDistricts] = useState<LocationOption[]>([]);
  const [subdistricts, setSubdistricts] = useState<PostcodeResult["items"]>([]);
  const [provinceId, setProvinceId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [subdistrictId, setSubdistrictId] = useState("");
  const [postcode, setPostcode] = useState("");
  const [addressError, setAddressError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/postcodes?page=1&pageSize=1", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "โหลดข้อมูลจังหวัดไม่สำเร็จ");
        if (active) setProvinces((result as PostcodeResult).provinces || []);
      })
      .catch((loadError: unknown) => {
        if (active) setAddressError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลที่อยู่ไม่สำเร็จ");
      });
    return () => { active = false; };
  }, []);

  async function loadDistricts(selectedProvinceId: string) {
    setDistricts([]); setSubdistricts([]); setDistrictId(""); setSubdistrictId(""); setPostcode("");
    if (!selectedProvinceId) return;
    try {
      const response = await fetch(`/api/postcodes?page=1&pageSize=1&provinceId=${selectedProvinceId}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "โหลดข้อมูลอำเภอไม่สำเร็จ");
      setDistricts((result as PostcodeResult).districts || []);
      setAddressError("");
    } catch (loadError) {
      setAddressError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลอำเภอไม่สำเร็จ");
    }
  }

  async function loadSubdistricts(selectedDistrictId: string) {
    setSubdistricts([]); setSubdistrictId(""); setPostcode("");
    if (!selectedDistrictId) return;
    try {
      const response = await fetch(`/api/postcodes?page=1&pageSize=100&districtId=${selectedDistrictId}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "โหลดข้อมูลตำบลไม่สำเร็จ");
      setSubdistricts((result as PostcodeResult).items || []);
      setAddressError("");
    } catch (loadError) {
      setAddressError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลตำบลไม่สำเร็จ");
    }
  }

  async function loadCardAddressLocation(location: ReturnType<typeof parseCardAddress>) {
    const query = location.subdistrict || location.district || location.province;
    if (!query) return;
    try {
      const response = await fetch(`/api/postcodes?page=1&pageSize=100&q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const result = await response.json() as PostcodeResult & { error?: string };
      if (!response.ok) throw new Error(result.error || "ค้นหาตำบลจากที่อยู่บนบัตรไม่สำเร็จ");
      const normalized = (name: string) => name.trim().replace(/^(ตำบล|แขวง|อำเภอ|เขต|จังหวัด)\s*/, "");
      const match = result.items.find((item) =>
        (!location.subdistrict || normalized(item.nameTh) === normalized(location.subdistrict)) &&
        (!location.district || normalized(item.district.nameTh) === normalized(location.district)) &&
        (!location.province || normalized(item.district.province.nameTh) === normalized(location.province))
      );
      if (!match) return;

      const districtResponse = await fetch(`/api/postcodes?page=1&pageSize=1&provinceId=${match.district.province.id}`, { cache: "no-store" });
      const districtResult = await districtResponse.json() as PostcodeResult & { error?: string };
      if (!districtResponse.ok) throw new Error(districtResult.error || "โหลดข้อมูลอำเภอไม่สำเร็จ");
      const subdistrictResponse = await fetch(`/api/postcodes?page=1&pageSize=100&districtId=${match.district.id}`, { cache: "no-store" });
      const subdistrictResult = await subdistrictResponse.json() as PostcodeResult & { error?: string };
      if (!subdistrictResponse.ok) throw new Error(subdistrictResult.error || "โหลดข้อมูลตำบลไม่สำเร็จ");

      setProvinces(result.provinces || []);
      setDistricts(districtResult.districts || []);
      setSubdistricts(subdistrictResult.items || []);
      setProvinceId(String(match.district.province.id));
      setDistrictId(String(match.district.id));
      setSubdistrictId(location.subdistrict ? String(match.id) : "");
      setPostcode(location.subdistrict ? match.postcode || "" : "");
      setAddressError("");
    } catch (loadError) {
      setAddressError(loadError instanceof Error ? loadError.message : "ค้นหาที่อยู่จากบัตรไม่สำเร็จ");
    }
  }

  function update(field: keyof BorrowerFormData, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function readCard() {
    if (reading || saving) return;
    setReading(true);
    setCardVerified(false);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/borrowers/read-card", { method: "POST", cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "อ่านข้อมูลจากบัตรไม่สำเร็จ");
      const rootPayload = result.payload;
      const payload = rootPayload?.data && typeof rootPayload.data === "object" ? rootPayload.data : rootPayload;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("รูปแบบข้อมูลจากเครื่องอ่านไม่ถูกต้อง");
      const data = {
        ...(rootPayload && typeof rootPayload === "object" && !Array.isArray(rootPayload) ? rootPayload : {}),
        ...(payload as Record<string, unknown>),
      } as Record<string, unknown>;
      const nationalId = nationalIdDigits(cardValue(data, ["nationalId", "cid", "citizenId", "personalId"]));
      const firstName = cardValue(data, ["firstName", "firstNameTH", "firstnameTH", "givenNameTH"]);
      if (nationalId.length !== 13 || !firstName) throw new Error("ข้อมูลจากบัตรไม่ครบ กรุณาเสียบบัตรใหม่และลองอ่านอีกครั้ง");
      const rawCardAddress = cardValue(data, ["address", "fullAddress", "addressTH", "fullAddressTH", "thaiAddress", "addressText"]);
      const parsedAddressText = parseCardAddress(rawCardAddress);
      const parsedAddress = {
        ...parsedAddressText,
        subdistrict: cardValue(data, ["subdistrict", "subdistrictName", "tambon"]) || parsedAddressText.subdistrict,
        district: cardValue(data, ["district", "districtName", "amphoe"]) || parsedAddressText.district,
        province: cardValue(data, ["province", "provinceName", "changwat"]) || parsedAddressText.province,
      };

      const duplicateResponse = await fetch(`/api/borrowers?q=${encodeURIComponent(nationalId)}&take=50`, { cache: "no-store" });
      const duplicateResult = await duplicateResponse.json();
      if (!duplicateResponse.ok) throw new Error(duplicateResult.error || "ตรวจสอบข้อมูลผู้กู้เดิมไม่สำเร็จ");
      const duplicates = Array.isArray(duplicateResult) ? duplicateResult as Array<{ nationalId?: string | null; borrowersCode?: string }> : [];
      const existing = duplicates.find((borrower) => nationalIdDigits(borrower.nationalId || "") === nationalId);
      if (existing) {
        setForm({ ...emptyForm, nationalId, firstName });
        setCardAddress(rawCardAddress);
        setNotice(`เลขบัตรนี้มีในทะเบียนผู้กู้แล้ว${existing.borrowersCode ? ` (${existing.borrowersCode})` : ""} กรุณาใช้เมนูผู้กู้เดิมเพื่อตรวจสอบข้อมูล`);
        return;
      }

      let photoUrl = "";
      const photoBase64 = cardImageValue(data);
      if (photoBase64) {
        const dataUrl = photoBase64.match(/^data:(image\/(?:jpeg|png|webp));base64,(.*)$/i);
        const cleanBase64 = dataUrl ? dataUrl[2] : photoBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/i, "");
        const imageType = dataUrl?.[1].toLowerCase() || "image/jpeg";
        const binary = atob(cleanBase64);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        const formData = new FormData();
        const extension = imageType === "image/png" ? "png" : imageType === "image/webp" ? "webp" : "jpg";
        formData.append("image", new File([bytes], `card-photo.${extension}`, { type: imageType }));
        const uploadResponse = await fetch("/api/borrowers/images", { method: "POST", body: formData, cache: "no-store" });
        const uploadResult = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(uploadResult.error || "บันทึกรูปจากบัตรไม่สำเร็จ");
        photoUrl = typeof uploadResult.url === "string" ? uploadResult.url : "";
      }

      const next: BorrowerFormData = {
        nationalId,
        prefixTH: cardValue(data, ["prefixTH", "titleTH", "titleTh", "thaiTitle"]),
        firstName,
        lastName: cardValue(data, ["lastName", "lastNameTH", "lastnameTH", "familyNameTH"]),
        firstNameEN: cardValue(data, ["firstNameEN", "firstNameEng", "firstnameEN", "givenNameEN"]),
        lastNameEN: cardValue(data, ["lastNameEN", "lastNameEng", "lastnameEN", "familyNameEN"]),
        birthDate: cardDate(cardValue(data, ["birthDate", "dateOfBirth", "dob"])),
        gender: genderLabel(cardValue(data, ["gender", "sex"])),
        address: cardValue(data, ["village", "moo", "villageNo"]) || parsedAddress.village,
        houseNumber: cardValue(data, ["houseNumber", "houseNo", "addressNo"]) || parsedAddress.houseNumber,
        buildingName: cardValue(data, ["buildingName", "building"]),
        alley: cardValue(data, ["alley", "soi"]) || parsedAddress.alley,
        road: cardValue(data, ["road", "street"]) || parsedAddress.road,
        issueDate: cardDate(cardValue(data, ["issueDate", "cardIssueDate"])),
        expiryDate: cardDate(cardValue(data, ["expiryDate", "cardExpiryDate", "expireDate"])),
        phone: form.phone,
        photoUrl: photoUrl || form.photoUrl,
      };
      setForm(next);
      setCardAddress(rawCardAddress);
      await loadCardAddressLocation(parsedAddress);
      setCardVerified(true);
      setNotice(photoUrl || form.photoUrl
        ? "อ่านข้อมูลและรูปจากบัตรแล้ว กรุณาตรวจทานข้อมูลและกรอกเบอร์โทรศัพท์ก่อนบันทึก"
        : "อ่านข้อมูลจากบัตรแล้ว แต่เครื่องอ่านไม่ได้ส่งรูปถ่ายมา กรุณาตรวจสอบเครื่องอ่านหรือบริการอ่านบัตรก่อนบันทึก");
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "อ่านข้อมูลจากบัตรไม่สำเร็จ");
    } finally {
      setReading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cardVerified) {
      setError("กรุณาอ่านและยืนยันข้อมูลจากบัตรประชาชนก่อน");
      return;
    }
    if (nationalIdDigits(form.nationalId).length !== 13) {
      setError("เลขบัตรประชาชนต้องมี 13 หลัก");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const selectedSubdistrict = subdistricts.find((item) => String(item.id) === subdistrictId);
      const selectedDistrict = districts.find((item) => String(item.id) === districtId);
      const selectedProvince = provinces.find((item) => String(item.id) === provinceId);
      const fullAddress = [
        form.houseNumber,
        form.buildingName,
        form.address ? `หมู่${form.address}` : "",
        form.alley ? `ซอย${form.alley}` : "",
        form.road ? `ถนน${form.road}` : "",
        selectedSubdistrict?.nameTh,
        selectedDistrict?.nameTh,
        selectedProvince?.nameTh,
        postcode,
      ].filter(Boolean).join(" ") || cardAddress;
      const response = await fetch("/api/borrowers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nationalId: form.nationalId,
          prefixTH: form.prefixTH,
          firstName: form.firstName,
          lastName: form.lastName,
          firstNameEN: form.firstNameEN,
          lastNameEN: form.lastNameEN,
          phone: form.phone,
          birthDate: form.birthDate,
          gender: form.gender,
          address: fullAddress,
          houseNumber: form.houseNumber,
          buildingName: form.buildingName,
          alley: form.alley,
          road: form.road,
          issueDate: form.issueDate,
          expiryDate: form.expiryDate,
          photoUrl: form.photoUrl,
          subdistrictId: subdistrictId ? Number(subdistrictId) : null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "บันทึกข้อมูลผู้กู้ไม่สำเร็จ");
      setBorrowerCode(result.borrowersCode || "");
      setCardVerified(false);
      setNotice("บันทึกข้อมูลผู้กู้ใหม่เรียบร้อยแล้ว");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "บันทึกข้อมูลผู้กู้ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  function startAnother() {
    setForm(emptyForm);
    setCardVerified(false);
    setBorrowerCode("");
    setError("");
    setNotice("");
    setCardAddress("");
    setProvinceId(""); setDistrictId(""); setSubdistrictId(""); setPostcode("");
    setDistricts([]); setSubdistricts([]);
  }

  return (
    <main className="min-h-dvh bg-[#f5f7f4] px-4 py-6 text-[#26352d] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-7 flex items-center justify-between gap-3">
          <Link href="/portal" className="inline-flex items-center gap-2 text-sm font-medium text-[#557160] hover:text-[#315d4b]"><ArrowLeft size={17} /> กลับไปเลือกบริษัท</Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#e1e8e1] bg-white px-3 py-2 text-[11px] text-[#718076]"><CreditCard size={15} /> Loan-OBN</span>
        </header>

        <section className="overflow-hidden rounded-[26px] border border-[#e1e9e2] bg-white shadow-[0_18px_50px_#203a2b0d]">
          <div className="border-b border-[#edf1ed] px-5 py-7 sm:px-9 sm:py-9">
            <p className="mb-2 text-[10px] font-bold tracking-[.2em] text-[#63816c]">NEW BORROWER · IDENTITY VERIFICATION</p>
            <h1 className="mb-2 text-2xl font-semibold tracking-tight sm:text-3xl">ลงทะเบียนผู้กู้ใหม่</h1>
            <p className="mb-0 max-w-2xl text-sm leading-6 text-[#718076]">อ่านข้อมูลจากบัตรประชาชนเพื่อตรวจสอบว่าเป็นผู้กู้ใหม่ แล้วตรวจทานและกรอกข้อมูลติดต่อก่อนบันทึก</p>
          </div>

          {borrowerCode ? (
            <div className="px-5 py-12 text-center sm:px-9">
              <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-[#e9f5ec] text-[#3d7951]"><BadgeCheck size={28} /></span>
              <h2 className="mb-2 text-xl font-semibold">ลงทะเบียนสำเร็จ</h2>
              <p className="mb-1 text-sm text-[#718076]">รหัสผู้กู้</p>
              <p className="mb-6 text-xl font-bold tracking-wider text-[#315d4b]">{borrowerCode}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button type="button" onClick={startAnother} className="rounded-xl bg-[#315d4b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#244a39]">ลงทะเบียนผู้กู้รายใหม่</button>
                <Link href="/portal" className="rounded-xl border border-[#dce6dd] px-5 py-3 text-sm font-semibold text-[#557160] hover:bg-[#f7faf7]">กลับ Portal</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="px-5 py-6 sm:px-9 sm:py-8">
              <section className="mb-7 rounded-2xl border border-[#dcebe0] bg-[#f7fbf7] p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-xl bg-white text-[#477257] shadow-sm"><ScanLine size={21} /></span>
                    <div><h2 className="mb-1 text-sm font-semibold">ยืนยันตัวตนด้วยบัตรประชาชน</h2><p className="mb-0 text-xs text-[#7e8b81]">เสียบบัตรกับเครื่องอ่าน แล้วกดอ่านข้อมูลจากบัตร</p></div>
                  </div>
                  <button type="button" onClick={() => void readCard()} disabled={reading || saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#315d4b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#244a39] disabled:cursor-wait disabled:opacity-60">
                    {reading ? <LoaderCircle size={17} className="animate-spin" /> : <CreditCard size={17} />}
                    {reading ? "กำลังอ่านบัตร…" : cardVerified ? "อ่านบัตรอีกครั้ง" : "อ่านบัตรประชาชน"}
                  </button>
                </div>
                {cardVerified && <p className="mb-0 mt-4 flex items-center gap-2 text-xs font-medium text-[#39754d]"><ShieldCheck size={16} /> ยืนยันเลขบัตรแล้ว และไม่พบเลขนี้ในทะเบียนผู้กู้</p>}
              </section>

              {error && <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-[#f2ceca] bg-[#fff5f4] p-3.5 text-sm text-[#a33631]"><AlertCircle size={17} className="mt-0.5 shrink-0" />{error}</div>}
              {notice && <div role="status" className={`mb-5 rounded-xl border p-3.5 text-sm ${cardVerified ? "border-[#cce4d1] bg-[#f1f8f2] text-[#39754d]" : "border-[#e5e9e4] bg-[#f8faf8] text-[#607168]"}`}>{notice}</div>}

              <section className="mb-7">
                <div className="mb-4 flex items-center gap-2"><UserRound size={17} className="text-[#63816c]" /><h2 className="mb-0 text-sm font-semibold">ข้อมูลจากบัตรประชาชน</h2><span className="text-[10px] text-[#98a39a]">ตรวจทานและแก้ไขได้</span></div>
                {form.photoUrl && <div className="mb-4 flex items-center gap-4 rounded-xl border border-[#e1e9e2] bg-[#f8faf8] p-3.5"><Image src={form.photoUrl} alt="รูปถ่ายจากบัตรประชาชน" width={72} height={88} unoptimized className="h-[88px] w-[72px] rounded-lg object-cover" /><div><p className="mb-1 text-xs font-semibold text-[#526158]">รูปถ่ายจากบัตรประชาชน</p><p className="mb-0 text-[11px] text-[#718076]">โหลดจากบัตรแล้ว สามารถตรวจสอบรูปก่อนบันทึก</p></div></div>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-medium text-[#526158]">เลขประจำตัวประชาชน
                    <input value={form.nationalId} onChange={(event) => { update("nationalId", nationalIdDigits(event.target.value).slice(0, 13)); setCardVerified(false); }} inputMode="numeric" maxLength={13} required className="h-11 rounded-xl border border-[#dce5dd] bg-white px-3.5 text-sm tracking-wider outline-none focus:border-[#6a9878] focus:ring-2 focus:ring-[#6a987825]" placeholder="อ่านจากบัตรประชาชน" />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-[#526158]">คำนำหน้า
                    <select value={form.prefixTH} onChange={(event) => update("prefixTH", event.target.value)} className="h-11 rounded-xl border border-[#dce5dd] bg-white px-3.5 text-sm outline-none focus:border-[#6a9878]"><option value="">เลือกคำนำหน้า</option><option>นาย</option><option>นาง</option><option>นางสาว</option><option>อื่น ๆ</option></select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-[#526158]">ชื่อ *
                    <input value={form.firstName} onChange={(event) => update("firstName", event.target.value)} required maxLength={100} className="h-11 rounded-xl border border-[#dce5dd] bg-white px-3.5 text-sm outline-none focus:border-[#6a9878]" />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-[#526158]">นามสกุล
                    <input value={form.lastName} onChange={(event) => update("lastName", event.target.value)} maxLength={100} className="h-11 rounded-xl border border-[#dce5dd] bg-white px-3.5 text-sm outline-none focus:border-[#6a9878]" />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-[#526158]">ชื่อภาษาอังกฤษ
                    <input value={form.firstNameEN} onChange={(event) => update("firstNameEN", event.target.value)} maxLength={100} className="h-11 rounded-xl border border-[#dce5dd] bg-white px-3.5 text-sm outline-none focus:border-[#6a9878]" />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-[#526158]">นามสกุลภาษาอังกฤษ
                    <input value={form.lastNameEN} onChange={(event) => update("lastNameEN", event.target.value)} maxLength={100} className="h-11 rounded-xl border border-[#dce5dd] bg-white px-3.5 text-sm outline-none focus:border-[#6a9878]" />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-[#526158]">วันเกิด
                    <span className="relative"><CalendarDays size={16} className="absolute left-3 top-3 text-[#92a095]" /><input type="date" value={form.birthDate} onChange={(event) => update("birthDate", event.target.value)} className="h-11 w-full rounded-xl border border-[#dce5dd] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#6a9878]" /></span>
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-[#526158]">เพศ
                    <input value={form.gender} onChange={(event) => update("gender", event.target.value)} maxLength={30} className="h-11 rounded-xl border border-[#dce5dd] bg-white px-3.5 text-sm outline-none focus:border-[#6a9878]" />
                  </label>
                </div>
              </section>

              <section className="mb-7 border-t border-[#edf1ed] pt-6">
                <div className="mb-4 flex items-center gap-2"><MapPin size={17} className="text-[#63816c]" /><h2 className="mb-0 text-sm font-semibold">ที่อยู่ตามบัตร</h2></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-medium text-[#526158]">บ้านเลขที่<input value={form.houseNumber} onChange={(event) => update("houseNumber", event.target.value)} maxLength={100} className="h-11 rounded-xl border border-[#dce5dd] px-3.5 text-sm outline-none focus:border-[#6a9878]" /></label>
                  <label className="grid gap-1.5 text-xs font-medium text-[#526158]">อาคาร<input value={form.buildingName} onChange={(event) => update("buildingName", event.target.value)} maxLength={150} className="h-11 rounded-xl border border-[#dce5dd] px-3.5 text-sm outline-none focus:border-[#6a9878]" /></label>
                  <label className="grid gap-1.5 text-xs font-medium text-[#526158]">หมู่ / หมู่บ้าน<input value={form.address} onChange={(event) => update("address", event.target.value)} maxLength={1000} className="h-11 rounded-xl border border-[#dce5dd] px-3.5 text-sm outline-none focus:border-[#6a9878]" placeholder="ข้อมูลที่อยู่เพิ่มเติมจากบัตร" /></label>
                  <label className="grid gap-1.5 text-xs font-medium text-[#526158]">ซอย<input value={form.alley} onChange={(event) => update("alley", event.target.value)} maxLength={150} className="h-11 rounded-xl border border-[#dce5dd] px-3.5 text-sm outline-none focus:border-[#6a9878]" /></label>
                  <label className="grid gap-1.5 text-xs font-medium text-[#526158] sm:col-span-2">ถนน<input value={form.road} onChange={(event) => update("road", event.target.value)} maxLength={150} className="h-11 rounded-xl border border-[#dce5dd] px-3.5 text-sm outline-none focus:border-[#6a9878]" /></label>
                  <label className="grid gap-1.5 text-xs font-medium text-[#526158]">ตำบล / แขวง
                    <select value={subdistrictId} disabled={!districtId} onChange={(event) => { const id = event.target.value; setSubdistrictId(id); setPostcode(subdistricts.find((item) => String(item.id) === id)?.postcode || ""); }} className="h-11 rounded-xl border border-[#dce5dd] bg-white px-3.5 text-sm outline-none focus:border-[#6a9878] disabled:bg-[#f6f8f6]">
                      <option value="">{districtId ? "เลือกตำบล / แขวง" : "เลือกอำเภอ / เขต ก่อน"}</option>
                      {subdistricts.map((item) => <option key={item.id} value={item.id}>{item.nameTh}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-[#526158]">อำเภอ / เขต
                    <select value={districtId} disabled={!provinceId} onChange={(event) => { const id = event.target.value; setDistrictId(id); void loadSubdistricts(id); }} className="h-11 rounded-xl border border-[#dce5dd] bg-white px-3.5 text-sm outline-none focus:border-[#6a9878] disabled:bg-[#f6f8f6]">
                      <option value="">{provinceId ? "เลือกอำเภอ / เขต" : "เลือกจังหวัดก่อน"}</option>
                      {districts.map((item) => <option key={item.id} value={item.id}>{item.nameTh}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-[#526158]">จังหวัด
                    <select value={provinceId} onChange={(event) => { const id = event.target.value; setProvinceId(id); void loadDistricts(id); }} className="h-11 rounded-xl border border-[#dce5dd] bg-white px-3.5 text-sm outline-none focus:border-[#6a9878]">
                      <option value="">เลือกจังหวัด</option>
                      {provinces.map((item) => <option key={item.id} value={item.id}>{item.nameTh}</option>)}
                    </select>
                  </label>
                  <p className="mb-0 text-[11px] text-[#718076] sm:col-span-2">รหัสไปรษณีย์ {postcode || "จะเติมให้อัตโนมัติเมื่อเลือกตำบล"}</p>
                  {cardAddress && <div className="rounded-xl bg-[#f6f8f6] p-3.5 text-xs leading-5 text-[#6f7e73] sm:col-span-2"><strong className="mb-1 block text-[#526158]">ที่อยู่ที่อ่านได้จากบัตร</strong>{cardAddress}</div>}
                  {addressError && <p role="alert" className="mb-0 text-xs text-[#a33631] sm:col-span-2">{addressError}</p>}
                </div>
              </section>

              <section className="mb-7 border-t border-[#edf1ed] pt-6">
                <div className="mb-4 flex items-center gap-2"><Phone size={17} className="text-[#63816c]" /><h2 className="mb-0 text-sm font-semibold">ข้อมูลติดต่อ</h2></div>
                <label className="grid max-w-md gap-1.5 text-xs font-medium text-[#526158]">เบอร์โทรศัพท์ *
                  <input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} required maxLength={30} className="h-11 rounded-xl border border-[#dce5dd] px-3.5 text-sm outline-none focus:border-[#6a9878]" placeholder="กรอกเบอร์โทรศัพท์ผู้กู้" />
                </label>
              </section>

              <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[#edf1ed] pt-5">
                <p className="mb-0 max-w-lg text-[11px] leading-5 text-[#87948a]">การบันทึกจะเพิ่มข้อมูลผู้กู้ในระบบสินเชื่อ โปรดตรวจสอบชื่อและเลขบัตรให้ตรงกับบัตรจริง</p>
                <button type="submit" disabled={saving || reading || !cardVerified} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#315d4b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#244a39] disabled:cursor-not-allowed disabled:opacity-50">
                  {saving ? <LoaderCircle size={17} className="animate-spin" /> : <BadgeCheck size={17} />}
                  {saving ? "กำลังบันทึก…" : "ยืนยันและบันทึกผู้กู้"}
                </button>
              </footer>
            </form>
          )}
        </section>
        <p className="mt-5 text-center text-[10px] text-[#97a198]">ข้อมูลส่วนบุคคลใช้เพื่อการลงทะเบียนและบริหารสัญญาสินเชื่อ</p>
      </div>
    </main>
  );
}
