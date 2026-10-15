ALTER TABLE "CompanyLedgerEntry" ADD COLUMN "documentNumber" TEXT;
ALTER TABLE "CompanyLedgerEntry" ADD COLUMN "companyCode" TEXT;
ALTER TABLE "CompanyLedgerEntry" ADD COLUMN "branchCode" TEXT;

CREATE UNIQUE INDEX "CompanyLedgerEntry_documentNumber_key" ON "CompanyLedgerEntry"("documentNumber");

CREATE TABLE "CompanyLedgerNumberSequence" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyCode" TEXT NOT NULL,
  "branchCode" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "lastNumber" INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX "CompanyLedgerNumberSequence_companyCode_branchCode_year_key"
  ON "CompanyLedgerNumberSequence"("companyCode", "branchCode", "year");
