-- AlterTable
ALTER TABLE "CompanyLedgerEntry" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "CompanyLedgerEntry" ADD COLUMN "investorId" TEXT;
ALTER TABLE "CompanyLedgerEntry" ADD COLUMN "investorSnapshot" TEXT;
ALTER TABLE "CompanyLedgerEntry" ADD COLUMN "reversalOfId" TEXT;
ALTER TABLE "CompanyLedgerEntry" ADD COLUMN "reversalOfType" TEXT;

-- CreateTable
CREATE TABLE "LoanInvestor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nationalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LoanFollowUp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "assigneeId" TEXT,
    "assigneeName" TEXT,
    "promisedAt" DATETIME,
    "promisedAmount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdBy" TEXT NOT NULL,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LoanCapitalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestKey" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "companyCode" TEXT NOT NULL,
    "branchCode" TEXT NOT NULL,
    "investorId" TEXT,
    "investorSnapshot" TEXT,
    "method" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "reviewNote" TEXT,
    "ledgerEntryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LoanAccountingPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyCode" TEXT NOT NULL,
    "throughDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CLOSED',
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "reopenedBy" TEXT,
    "reopenedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LoanReconciliation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyCode" TEXT NOT NULL,
    "asOf" DATETIME NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "statementAmount" INTEGER NOT NULL,
    "ledgerAmount" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "LoanInvestor_nationalId_key" ON "LoanInvestor"("nationalId");

-- CreateIndex
CREATE INDEX "LoanFollowUp_contractId_createdAt_idx" ON "LoanFollowUp"("contractId", "createdAt");

-- CreateIndex
CREATE INDEX "LoanFollowUp_status_promisedAt_idx" ON "LoanFollowUp"("status", "promisedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoanCapitalRequest_requestKey_key" ON "LoanCapitalRequest"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "LoanCapitalRequest_ledgerEntryId_key" ON "LoanCapitalRequest"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "LoanCapitalRequest_status_createdAt_idx" ON "LoanCapitalRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "LoanAccountingPeriod_companyCode_status_throughDate_idx" ON "LoanAccountingPeriod"("companyCode", "status", "throughDate");

-- CreateIndex
CREATE INDEX "LoanReconciliation_companyCode_asOf_idx" ON "LoanReconciliation"("companyCode", "asOf");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyLedgerEntry_reversalOfId_key" ON "CompanyLedgerEntry"("reversalOfId");

