CREATE TABLE "CompanyLedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "transactionDate" DATETIME NOT NULL,
    "party" TEXT NOT NULL DEFAULT '',
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "reference" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "CompanyLedgerEntry_transactionDate_idx" ON "CompanyLedgerEntry"("transactionDate");
CREATE INDEX "CompanyLedgerEntry_type_transactionDate_idx" ON "CompanyLedgerEntry"("type", "transactionDate");
CREATE INDEX "CompanyLedgerEntry_category_idx" ON "CompanyLedgerEntry"("category");
