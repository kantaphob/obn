export const WEALTH_ASSET_CATEGORIES = [
  { value: "CASH", label: "เงินสดและเงินฝาก" },
  { value: "GOLD", label: "ออมทอง / ทองคำ" },
  { value: "STOCK", label: "หุ้น" },
  { value: "FUND", label: "กองทุน / ETF" },
  { value: "PROPERTY", label: "บ้าน / อาคาร" },
  { value: "VEHICLE", label: "รถยนต์ / ยานพาหนะ" },
  { value: "EQUIPMENT", label: "เครื่องจักร / อุปกรณ์" },
  { value: "LAND", label: "ที่ดิน" },
  { value: "OTHER", label: "สินทรัพย์อื่น" },
] as const;

export type WealthAssetCategory = typeof WEALTH_ASSET_CATEGORIES[number]["value"];

export function isWealthAssetCategory(value: unknown): value is WealthAssetCategory {
  return typeof value === "string" && WEALTH_ASSET_CATEGORIES.some((category) => category.value === value);
}

export function wealthAssetCategoryLabel(value: string) {
  return WEALTH_ASSET_CATEGORIES.find((category) => category.value === value)?.label ?? "สินทรัพย์อื่น";
}

export function parseWealthAssetDetails(value: string | null): Record<string, string> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch {
    return {};
  }
}

export function ownedSatang(value: number, ownershipBps: number) {
  return Math.round(value * ownershipBps / 10_000);
}
