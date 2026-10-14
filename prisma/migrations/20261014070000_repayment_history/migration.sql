CREATE TABLE "Repayment" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "requestKey" TEXT NOT NULL,
 "receiptNumber" TEXT NOT NULL,
 "contractId" TEXT NOT NULL,
 "paidAt" DATETIME NOT NULL,
 "amount" INTEGER NOT NULL,
 "interestPaid" INTEGER NOT NULL,
 "penaltyPaid" INTEGER NOT NULL,
 "principalPaid" INTEGER NOT NULL,
 "principalBefore" INTEGER NOT NULL,
 "interestBefore" INTEGER NOT NULL,
 "penaltyBefore" INTEGER NOT NULL,
 "principalRemaining" INTEGER NOT NULL,
 "interestRemaining" INTEGER NOT NULL,
 "penaltyRemaining" INTEGER NOT NULL,
 "totalRemaining" INTEGER NOT NULL,
 "method" TEXT NOT NULL,
 "evidenceUrl" TEXT,
 "note" TEXT,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Repayment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Repayment_requestKey_key" ON "Repayment"("requestKey");
CREATE UNIQUE INDEX "Repayment_receiptNumber_key" ON "Repayment"("receiptNumber");
CREATE INDEX "Repayment_contractId_paidAt_idx" ON "Repayment"("contractId", "paidAt");
