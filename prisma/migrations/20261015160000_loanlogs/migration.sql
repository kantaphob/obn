CREATE TABLE "loanlogs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "borrowerId" TEXT NOT NULL,
    "contractId" TEXT,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "loanlogs_borrowerId_idx" ON "loanlogs"("borrowerId");
CREATE INDEX "loanlogs_contractId_idx" ON "loanlogs"("contractId");
