import { BorrowerStatus, BorrowerPayoutChannel, BorrowerRiskRating } from '@/generated/prisma/enums'

export const borrowerEnumLabels = {
  status: { PENDING_REPAYMENT: 'รอส่งคืน', UNDER_REVIEW: 'พิจารณา', CLOSED: 'ปิดยอด' },
  payoutChannel: { PROMPTPAY: 'พร้อมเพย์ (PP)', BANK_TRANSFER: 'โอนผ่านบัญชีธนาคาร' },
  riskRating: { SS: 'SS', S: 'S', A: 'A', B: 'B', C: 'C', D: 'D' },
} as const

export const borrowerEnumValues = {
  status: Object.values(BorrowerStatus),
  payoutChannel: Object.values(BorrowerPayoutChannel),
  riskRating: Object.values(BorrowerRiskRating),
}

export type BorrowerEnumField = keyof typeof borrowerEnumValues
export function isBorrowerEnumField(field: string): field is BorrowerEnumField {
  return Object.hasOwn(borrowerEnumValues, field)
}
export function borrowerEnumLabel(field: BorrowerEnumField, value: string): string {
  const labels: Record<string, string> = borrowerEnumLabels[field]
  return labels[value] || value
}
