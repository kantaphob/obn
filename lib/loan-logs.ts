import type { Prisma } from '@/generated/prisma/client';

type LoanLogEntry = {
  userId?: string;
  borrowerId: string;
  contractId?: string | null;
  arId?: string | null;
  apId?: string | null;
  targetId?: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | string;
  type: 'BORROWER' | 'CONTRACT' | 'PAYMENT' | 'REPAYMENT' | 'MANUAL' | string;
  note?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
};

const sensitiveField = /national.?id|bank.?account|payout.?bank|address|photo|image|signature|evidence|consenttext/i;

function redact(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, field]) => [
    key,
    sensitiveField.test(key) ? '[ซ่อนข้อมูลส่วนบุคคล]' : redact(field),
  ]));
}

function snapshot(value: unknown) {
  if (value === undefined || value === null) return null;
  return JSON.stringify(redact(value));
}

export async function writeLoanLog(tx: Prisma.TransactionClient, entry: LoanLogEntry) {
  return tx.loanlogs.create({
    data: {
      userId: entry.userId?.trim() || 'guest',
      borrowerId: entry.borrowerId,
      contractId: entry.contractId ?? null,
      arId: entry.arId ?? null,
      apId: entry.apId ?? null,
      targetId: entry.targetId ?? null,
      action: entry.action,
      type: entry.type,
      note: entry.note ?? null,
      beforeData: snapshot(entry.beforeData),
      afterData: snapshot(entry.afterData),
    },
  });
}
