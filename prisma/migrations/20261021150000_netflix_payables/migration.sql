ALTER TABLE "NetflixLedgerEntry" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PAID';
ALTER TABLE "NetflixLedgerEntry" ADD COLUMN "approvalRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NetflixLedgerEntry" ADD COLUMN "approvedAt" DATETIME;
ALTER TABLE "NetflixLedgerEntry" ADD COLUMN "approvedBy" TEXT;
ALTER TABLE "NetflixLedgerEntry" ADD COLUMN "paidAt" DATETIME;
ALTER TABLE "NetflixLedgerEntry" ADD COLUMN "paidBy" TEXT;

UPDATE "NetflixLedgerEntry" SET "paidAt" = CURRENT_TIMESTAMP WHERE "status" = 'PAID';

CREATE INDEX "NetflixLedgerEntry_status_transactionOn_idx" ON "NetflixLedgerEntry"("status", "transactionOn");
