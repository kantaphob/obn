-- CreateTable
CREATE TABLE "ContractNumberSequence" (
    "year" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractNumber" TEXT NOT NULL,
    "debtorId" TEXT NOT NULL,
    "principal" INTEGER NOT NULL,
    "interestRate" REAL NOT NULL,
    "interestAmount" INTEGER NOT NULL,
    "netDisbursed" INTEGER NOT NULL,
    "repayType" TEXT NOT NULL,
    "interestMode" TEXT NOT NULL,
    "interestRateBasis" TEXT NOT NULL DEFAULT 'CONTRACT_FLAT',
    "installmentMonths" INTEGER,
    "periodDays" INTEGER,
    "startDate" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "contractType" TEXT NOT NULL DEFAULT 'NONE',
    "documentUrl" TEXT,
    "signedAt" DATETIME,
    "signatureMode" TEXT NOT NULL DEFAULT 'PRINT',
    "signatureUrl" TEXT,
    "consentAccepted" BOOLEAN NOT NULL DEFAULT false,
    "consentedAt" DATETIME,
    "consentText" TEXT,
    "witness1" TEXT,
    "witness2" TEXT,
    "guarantor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "lateFeePerDay" INTEGER NOT NULL DEFAULT 5000,
    "lateFeeWaived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contract_debtorId_fkey" FOREIGN KEY ("debtorId") REFERENCES "borrowers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Contract" ("contractNumber", "contractType", "createdAt", "debtorId", "documentUrl", "dueDate", "guarantor", "id", "interestAmount", "interestMode", "interestRate", "netDisbursed", "note", "periodDays", "principal", "repayType", "signedAt", "startDate", "status", "updatedAt", "witness1", "witness2") SELECT "contractNumber", "contractType", "createdAt", "debtorId", "documentUrl", "dueDate", "guarantor", "id", "interestAmount", "interestMode", "interestRate", "netDisbursed", "note", "periodDays", "principal", "repayType", "signedAt", "startDate", "status", "updatedAt", "witness1", "witness2" FROM "Contract";
DROP TABLE "Contract";
ALTER TABLE "new_Contract" RENAME TO "Contract";
CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");
CREATE INDEX "Contract_debtorId_idx" ON "Contract"("debtorId");
CREATE INDEX "Contract_status_dueDate_idx" ON "Contract"("status", "dueDate");
CREATE TABLE "new_InterestSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "periodNo" INTEGER NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "amount" INTEGER NOT NULL,
    "principalAmount" INTEGER NOT NULL DEFAULT 0,
    "interestAmount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "InterestSchedule_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InterestSchedule" ("amount", "contractId", "dueDate", "id", "periodNo", "status") SELECT "amount", "contractId", "dueDate", "id", "periodNo", "status" FROM "InterestSchedule";
DROP TABLE "InterestSchedule";
ALTER TABLE "new_InterestSchedule" RENAME TO "InterestSchedule";
CREATE UNIQUE INDEX "InterestSchedule_contractId_periodNo_key" ON "InterestSchedule"("contractId", "periodNo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
