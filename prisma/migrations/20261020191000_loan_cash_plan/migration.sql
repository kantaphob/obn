CREATE TABLE "LoanCashPlan" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "companyCode" TEXT NOT NULL,
 "direction" TEXT NOT NULL,
 "title" TEXT NOT NULL,
 "amount" INTEGER NOT NULL,
 "dueDate" DATETIME NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'OPEN',
 "createdBy" TEXT NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "LoanCashPlan_companyCode_status_dueDate_idx" ON "LoanCashPlan"("companyCode", "status", "dueDate");
