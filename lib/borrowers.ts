import { normalizeNationalId } from './national-id'
import { borrowerEnumValues } from './borrower-options'
import type { BorrowerStatus, BorrowerPayoutChannel, BorrowerRiskRating } from '@/generated/prisma/enums'
import { prisma } from './prisma'

const optionalTextFields = [
  'workplace', 'bankAccountNumber', 'payoutBankCode', 'referrer', 'facebook', 'instagram', 'line',
  'nickname',
  'note',
  'prefixTH',
  'lastName',
  'firstNameEN',
  'lastNameEN',
  'gender',
  'address',
  'houseNumber',
  'buildingName',
  'alley',
  'road',
  'photoUrl',
  'idCardImageUrl',
] as const

const dateFields = ['birthDate', 'issueDate', 'expiryDate', 'registeredAt'] as const

type BorrowerInput = {
  facebook?: string | null
  instagram?: string | null
  line?: string | null
  workplace?: string | null
  status?: BorrowerStatus | null
  bankAccountNumber?: string | null
  payoutChannel?: BorrowerPayoutChannel | null
  payoutBankCode?: string | null
  registeredAt?: Date | null
  hasFacebook?: boolean | null
  hasInstagram?: boolean | null
  hasLine?: boolean | null
  riskRating?: BorrowerRiskRating | null
  approvedLimit?: number | null
  usedLimit?: number | null
  availableLimit?: number | null
  referrer?: string | null
  nickname?: string | null
  phone?: string
  note?: string | null
  nationalId?: string | null
  prefixTH?: string | null
  firstName?: string
  lastName?: string | null
  firstNameEN?: string | null
  lastNameEN?: string | null
  gender?: string | null
  birthDate?: Date | null
  address?: string | null
  houseNumber?: string | null
  buildingName?: string | null
  alley?: string | null
  road?: string | null
  subdistrictId?: number | null
  issueDate?: Date | null
  expiryDate?: Date | null
  photoUrl?: string | null
  idCardImageUrl?: string | null
}

const textLimits: Record<string, number> = {
  workplace: 200, status: 100, bankAccountNumber: 50, payoutBankCode: 3, payoutChannel: 100, riskRating: 20, referrer: 200,
  facebook: 500, instagram: 500, line: 500,
  nickname: 100,
  phone: 30,
  note: 2000,
  prefixTH: 30,
  firstName: 100,
  lastName: 100,
  firstNameEN: 100,
  lastNameEN: 100,
  gender: 30,
  address: 1000,
  houseNumber: 100,
  buildingName: 150,
  alley: 150,
  road: 150,
  photoUrl: 500,
  idCardImageUrl: 500,
}

export function parseBorrowerInput(value: unknown, partial = false):
  | { data: BorrowerInput }
  | { error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { error: 'ข้อมูลที่ส่งมาไม่ถูกต้อง' }
  }

  const input = value as Record<string, unknown>
  const data: BorrowerInput = {}

  for (const field of [...optionalTextFields, 'phone', 'firstName'] as const) {
    if (!(field in input)) continue
    const raw = input[field]
    if (typeof raw !== 'string' && raw !== null) {
      return { error: `รูปแบบข้อมูล ${field} ไม่ถูกต้อง` }
    }
    const text = typeof raw === 'string' ? raw.trim().slice(0, textLimits[field]) : ''
    if (field === 'phone' || field === 'firstName') {
      data[field] = text
    } else {
      data[field] = text || null
    }
  }

  for (const field of ['status', 'payoutChannel', 'riskRating'] as const) {
    if (!(field in input)) continue
    const raw = input[field]
    if (raw === null || raw === '') { data[field] = null; continue }
    if (typeof raw !== 'string' || !(borrowerEnumValues[field] as readonly string[]).includes(raw)) {
      return { error: `ตัวเลือก ${field} ไม่ถูกต้อง` }
    }
    Object.assign(data, { [field]: raw })
  }

  if ('payoutBankCode' in input) {
    const raw = typeof input.payoutBankCode === 'string' ? input.payoutBankCode.trim() : input.payoutBankCode
    if (raw === null || raw === '') data.payoutBankCode = null
    else if (typeof raw !== 'string' || !/^\d{3}$/.test(raw)) return { error: 'กรุณาเลือกธนาคารจากรายการ' }
    else data.payoutBankCode = raw
  }

  if ('nationalId' in input) {
    if (typeof input.nationalId !== 'string' && input.nationalId !== null) {
      return { error: 'รูปแบบเลขบัตรประชาชนไม่ถูกต้อง' }
    }
    const normalized = typeof input.nationalId === 'string' ? normalizeNationalId(input.nationalId).trim() : ''
    if (/[^0-9\s-]/.test(normalized)) return { error: 'เลขบัตรประชาชนกรอกได้เฉพาะตัวเลข 13 หลัก' }
    const digits = normalized.replace(/[\s-]/g, '')
    if (digits && digits.length !== 13) return { error: 'เลขบัตรประชาชนต้องมี 13 หลัก' }
    data.nationalId = digits || null
  }

  for (const field of dateFields) {
    if (!(field in input)) continue
    const raw = input[field]
    if (raw !== null && typeof raw !== 'string') return { error: `รูปแบบวันที่ ${field} ไม่ถูกต้อง` }
    if (!raw) {
      data[field] = null
      continue
    }
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) return { error: `วันที่ ${field} ไม่ถูกต้อง` }
    data[field] = date
  }

  if ('subdistrictId' in input) {
    const raw = input.subdistrictId
    if (raw === null || raw === '') data.subdistrictId = null
    else {
      const id = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN
      if (!Number.isSafeInteger(id) || id < 1) return { error: 'ตำบลที่เลือกไม่ถูกต้อง' }
      data.subdistrictId = id
    }
  }

  for (const field of ['hasFacebook', 'hasInstagram', 'hasLine'] as const) {
    if (!(field in input)) continue
    const raw = input[field]
    if (raw === null || raw === '') data[field] = null
    else if (raw === true || raw === 'true') data[field] = true
    else if (raw === false || raw === 'false') data[field] = false
    else return { error: `รูปแบบข้อมูล ${field} ไม่ถูกต้อง` }
  }
  for (const field of ['approvedLimit', 'usedLimit', 'availableLimit'] as const) {
    if (!(field in input)) continue
    const raw = input[field]
    if (raw === null || raw === '') { data[field] = null; continue }
    if ((typeof raw !== 'number' && typeof raw !== 'string') || !/^\d+(\.\d{1,2})?$/.test(String(raw))) return { error: 'วงเงินต้องเป็นจำนวนเงินตั้งแต่ 0 และมีทศนิยมไม่เกิน 2 ตำแหน่ง' }
    const cents = Math.round(Number(raw) * 100)
    if (!Number.isSafeInteger(cents) || cents > 2147483647) return { error: 'วงเงินเกินขอบเขตที่รองรับ' }
    data[field] = cents
  }
  if (!partial && !data.firstName && !data.nickname) return { error: 'กรุณาระบุชื่อหรือชื่อเล่นอย่างน้อยหนึ่งช่อง' }
  return { data }
}

export function isPrismaCode(error: unknown, code: string) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

export async function validateBorrowerPayout(
  channel: BorrowerPayoutChannel | null | undefined,
  bankCode: string | null | undefined,
) {
  if (channel === 'BANK_TRANSFER' && !bankCode) return 'กรุณาเลือกธนาคารสำหรับรับเงิน'
  if (channel === 'PROMPTPAY' && bankCode) return 'พร้อมเพย์ไม่ต้องเลือกธนาคาร'
  if (!channel && bankCode) return 'กรุณาเลือกช่องทางรับเงินก่อนเลือกธนาคาร'
  if (bankCode) {
    const bank = await prisma.banking.findUnique({ where: { bankCode }, select: { bankCode: true } })
    if (!bank) return 'ไม่พบธนาคารที่เลือก กรุณาเลือกจากรายการธนาคาร'
  }
  return null
}
