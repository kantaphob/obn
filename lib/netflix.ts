export function parseNetflixGroup(body: unknown) {
  if (!body || typeof body !== "object") return { error: "กรุณากรอกข้อมูลกลุ่ม" } as const;
  const data = body as Record<string, unknown>;
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const accountEmail = typeof data.accountEmail === "string" ? data.accountEmail.trim().toLowerCase() : "";
  const plan = typeof data.plan === "string" ? data.plan.trim() : "Premium";
  const startedOn = typeof data.startedOn === "string" ? data.startedOn : "";
  const billingDay = data.billingDay === "" || data.billingDay === null || data.billingDay === undefined ? null : Number(data.billingDay);
  const renewalDate = typeof data.renewalDate === "string" ? data.renewalDate : "";
  const price = data.monthlyPrice === "" || data.monthlyPrice === null || data.monthlyPrice === undefined ? null : Number(data.monthlyPrice);
  const rawProfiles = Array.isArray(data.profiles) ? data.profiles : [];
  if (!name || name.length > 100) return { error: "กรุณาระบุชื่อกลุ่มไม่เกิน 100 ตัวอักษร" } as const;
  if (plan.length > 50) return { error: "ชื่อแพ็กเกจยาวเกินไป" } as const;
  const parsedStartedOn = /^\d{4}-\d{2}-\d{2}$/.test(startedOn) ? new Date(`${startedOn}T00:00:00.000Z`) : null;
  if (!parsedStartedOn || Number.isNaN(parsedStartedOn.getTime()) || parsedStartedOn.toISOString().slice(0, 10) !== startedOn) return { error: "กรุณาระบุวันที่เริ่มกลุ่มให้ถูกต้อง" } as const;
  if (billingDay === null || !Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) return { error: "กรุณาระบุวันตัดชำระระหว่างวันที่ 1–31" } as const;
  if (accountEmail && !/^\S+@\S+\.\S+$/.test(accountEmail)) return { error: "รูปแบบอีเมลบัญชีไม่ถูกต้อง" } as const;
  if (price !== null && (!Number.isFinite(price) || price < 0 || price > 1000000)) return { error: "ราคาต่อเดือนต้องอยู่ระหว่าง 0–1,000,000 บาท" } as const;
  if (renewalDate && !/^\d{4}-\d{2}-\d{2}$/.test(renewalDate)) return { error: "วันต่ออายุไม่ถูกต้อง" } as const;
  if (rawProfiles.length > 5) return { error: "หนึ่งกลุ่มมีโปรไฟล์ได้สูงสุด 5 คน" } as const;
  const profiles = rawProfiles.map((raw) => {
    const entry = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    return {
      profileId: typeof entry.profileId === "string" ? entry.profileId : "",
      name: typeof entry.name === "string" ? entry.name.trim() : "",
      contactEmail: typeof entry.contactEmail === "string" ? entry.contactEmail.trim().toLowerCase() : "",
      phone: typeof entry.phone === "string" ? entry.phone.trim() : "",
    };
  });
  if (profiles.some((profile) => !profile.name || profile.name.length > 100 || profile.contactEmail.length > 254 || profile.phone.length > 40)) {
    return { error: "กรุณากรอกชื่อโปรไฟล์ และตรวจสอบอีเมลหรือเบอร์โทร" } as const;
  }
  if (profiles.some((profile) => profile.contactEmail && !/^\S+@\S+\.\S+$/.test(profile.contactEmail))) return { error: "รูปแบบอีเมลสมาชิกไม่ถูกต้อง" } as const;
  return { value: { name, accountEmail: accountEmail || null, plan: plan || "Premium", startedOn, billingDay, renewalDate: renewalDate || null, monthlySatang: price === null ? null : Math.round(price * 100), profiles } } as const;
}
