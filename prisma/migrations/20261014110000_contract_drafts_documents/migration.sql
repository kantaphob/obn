ALTER TABLE "Contract" ADD COLUMN "documentData" TEXT;
CREATE TABLE "LoanContractDraft" ("id" TEXT NOT NULL PRIMARY KEY, "borrowerId" TEXT NOT NULL, "dataJson" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL);
CREATE INDEX "LoanContractDraft_borrowerId_idx" ON "LoanContractDraft"("borrowerId");
