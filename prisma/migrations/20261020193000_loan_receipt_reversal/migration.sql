ALTER TABLE "Repayment" ADD COLUMN "reversedAt" DATETIME;
ALTER TABLE "Repayment" ADD COLUMN "reversedBy" TEXT;
ALTER TABLE "Repayment" ADD COLUMN "reversalReason" TEXT;
ALTER TABLE "CompanyLedgerEntry" ADD COLUMN "receiptBreakdown" TEXT;
