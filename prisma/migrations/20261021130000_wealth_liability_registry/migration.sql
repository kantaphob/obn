CREATE TABLE "WealthLiabilityNumberSequence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyCode" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "WealthLiabilityNumberSequence_companyCode_key" UNIQUE ("companyCode")
);

CREATE TABLE "WealthLiability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "liabilityCode" TEXT NOT NULL,
    "companyCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "lender" TEXT NOT NULL DEFAULT '',
    "originalAmount" BIGINT NOT NULL DEFAULT 0,
    "outstandingAmount" BIGINT NOT NULL DEFAULT 0,
    "interestRateBps" INTEGER,
    "startDate" DATETIME,
    "nextDueDate" DATETIME,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WealthLiability_liabilityCode_key" UNIQUE ("liabilityCode"),
    CONSTRAINT "WealthLiability_companyCode_fkey" FOREIGN KEY ("companyCode") REFERENCES "CompanySequence" ("companycode") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "WealthLiability_companyCode_status_idx" ON "WealthLiability"("companyCode", "status");
CREATE INDEX "WealthLiability_category_status_idx" ON "WealthLiability"("category", "status");

CREATE TABLE "WealthLiabilityBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "liabilityId" TEXT NOT NULL,
    "outstandingAmount" BIGINT NOT NULL,
    "balanceDate" DATETIME NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WealthLiabilityBalance_liabilityId_fkey" FOREIGN KEY ("liabilityId") REFERENCES "WealthLiability" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "WealthLiabilityBalance_liabilityId_balanceDate_idx" ON "WealthLiabilityBalance"("liabilityId", "balanceDate");
