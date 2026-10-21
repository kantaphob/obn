ALTER TABLE "CompanyLedgerEntry" ADD COLUMN "settlementStatus" TEXT NOT NULL DEFAULT 'PAID';
ALTER TABLE "CompanyLedgerEntry" ADD COLUMN "approvalRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CompanyLedgerEntry" ADD COLUMN "approvedAt" DATETIME;
ALTER TABLE "CompanyLedgerEntry" ADD COLUMN "approvedBy" TEXT;
ALTER TABLE "CompanyLedgerEntry" ADD COLUMN "paidAt" DATETIME;
ALTER TABLE "CompanyLedgerEntry" ADD COLUMN "paidBy" TEXT;

UPDATE "CompanyLedgerEntry" SET "paidAt" = "transactionDate" WHERE "settlementStatus" = 'PAID';

CREATE INDEX "CompanyLedgerEntry_settlementStatus_transactionDate_idx" ON "CompanyLedgerEntry"("settlementStatus", "transactionDate");
