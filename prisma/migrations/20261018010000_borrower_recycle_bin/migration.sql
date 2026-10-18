ALTER TABLE "borrowers" ADD COLUMN "deletedAt" DATETIME;
CREATE INDEX "borrowers_deletedAt_idx" ON "borrowers"("deletedAt");
CREATE TABLE "borrowersdelete" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "borrowerId" TEXT NOT NULL,
 "borrowersCode" TEXT NOT NULL,
 "snapshot" TEXT NOT NULL,
 "reason" TEXT,
 "deletedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "restoredAt" DATETIME,
 CONSTRAINT "borrowersdelete_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "borrowers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "borrowersdelete_borrowerId_deletedAt_idx" ON "borrowersdelete"("borrowerId", "deletedAt");
CREATE INDEX "borrowersdelete_restoredAt_deletedAt_idx" ON "borrowersdelete"("restoredAt", "deletedAt");
