-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "branchCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractNumber" TEXT NOT NULL,
    "debtorId" TEXT NOT NULL,
    "principal" INTEGER NOT NULL,
    "interestRate" REAL NOT NULL,
    "interestAmount" INTEGER NOT NULL,
    "netDisbursed" INTEGER NOT NULL,
    "repayType" TEXT NOT NULL,
    "interestMode" TEXT NOT NULL,
    "periodDays" INTEGER,
    "startDate" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "contractType" TEXT NOT NULL DEFAULT 'NONE',
    "documentUrl" TEXT,
    "signedAt" DATETIME,
    "witness1" TEXT,
    "witness2" TEXT,
    "guarantor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contract_debtorId_fkey" FOREIGN KEY ("debtorId") REFERENCES "borrowers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InterestSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "periodNo" INTEGER NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "InterestSchedule_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT,
    "scheduleId" TEXT,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAt" DATETIME NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "InterestSchedule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_borrowers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nickname" TEXT,
    "phone" TEXT NOT NULL,
    "note" TEXT,
    "workplace" TEXT,
    "status" TEXT,
    "bankAccountNumber" TEXT,
    "payoutChannel" TEXT,
    "payoutBankCode" TEXT,
    "registeredAt" DATETIME,
    "facebook" TEXT,
    "instagram" TEXT,
    "line" TEXT,
    "hasFacebook" BOOLEAN,
    "hasInstagram" BOOLEAN,
    "hasLine" BOOLEAN,
    "riskRating" TEXT,
    "approvedLimit" INTEGER,
    "usedLimit" INTEGER,
    "availableLimit" INTEGER,
    "referrer" TEXT,
    "nationalId" TEXT,
    "prefixTH" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "firstNameEN" TEXT,
    "lastNameEN" TEXT,
    "gender" TEXT,
    "birthDate" DATETIME,
    "address" TEXT,
    "houseNumber" TEXT,
    "buildingName" TEXT,
    "alley" TEXT,
    "road" TEXT,
    "subdistrictId" INTEGER,
    "issueDate" DATETIME,
    "expiryDate" DATETIME,
    "photoUrl" TEXT,
    "idCardImageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "borrowers_payoutBankCode_fkey" FOREIGN KEY ("payoutBankCode") REFERENCES "Banking" ("bankCode") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "borrowers_subdistrictId_fkey" FOREIGN KEY ("subdistrictId") REFERENCES "subdistrict" ("subdistrict_id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_borrowers" ("address", "alley", "approvedLimit", "availableLimit", "bankAccountNumber", "birthDate", "buildingName", "createdAt", "expiryDate", "facebook", "firstName", "firstNameEN", "gender", "hasFacebook", "hasInstagram", "hasLine", "houseNumber", "id", "idCardImageUrl", "instagram", "issueDate", "lastName", "lastNameEN", "line", "nationalId", "nickname", "note", "payoutChannel", "phone", "photoUrl", "prefixTH", "referrer", "registeredAt", "riskRating", "road", "status", "subdistrictId", "updatedAt", "usedLimit", "workplace") SELECT "address", "alley", "approvedLimit", "availableLimit", "bankAccountNumber", "birthDate", "buildingName", "createdAt", "expiryDate", "facebook", "firstName", "firstNameEN", "gender", "hasFacebook", "hasInstagram", "hasLine", "houseNumber", "id", "idCardImageUrl", "instagram", "issueDate", "lastName", "lastNameEN", "line", "nationalId", "nickname", "note", "payoutChannel", "phone", "photoUrl", "prefixTH", "referrer", "registeredAt", "riskRating", "road", "status", "subdistrictId", "updatedAt", "usedLimit", "workplace" FROM "borrowers";
DROP TABLE "borrowers";
ALTER TABLE "new_borrowers" RENAME TO "borrowers";
CREATE UNIQUE INDEX "borrowers_nationalId_key" ON "borrowers"("nationalId");
CREATE INDEX "borrowers_payoutBankCode_idx" ON "borrowers"("payoutBankCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Company_companyCode_key" ON "Company"("companyCode");

-- CreateIndex
CREATE INDEX "Company_taxId_idx" ON "Company"("taxId");

-- CreateIndex
CREATE INDEX "Company_postcode_idx" ON "Company"("postcode");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_branchCode_key" ON "Branch"("branchCode");

-- CreateIndex
CREATE INDEX "Branch_companyId_idx" ON "Branch"("companyId");

-- CreateIndex
CREATE INDEX "Branch_postcode_idx" ON "Branch"("postcode");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");

-- CreateIndex
CREATE INDEX "Contract_debtorId_idx" ON "Contract"("debtorId");

-- CreateIndex
CREATE INDEX "Contract_status_dueDate_idx" ON "Contract"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "InterestSchedule_contractId_periodNo_key" ON "InterestSchedule"("contractId", "periodNo");

-- CreateIndex
CREATE INDEX "Payment_contractId_idx" ON "Payment"("contractId");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

-- Preserve existing borrower payment preferences while switching to database-backed banks.
UPDATE "borrowers"
SET "payoutChannel" = 'BANK_TRANSFER', "payoutBankCode" = '004'
WHERE "payoutChannel" IN ('KBANK', 'K-Bank');

UPDATE "borrowers"
SET "payoutChannel" = 'BANK_TRANSFER', "payoutBankCode" = '014'
WHERE "payoutChannel" = 'SCB';
