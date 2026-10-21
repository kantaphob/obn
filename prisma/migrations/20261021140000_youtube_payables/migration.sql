CREATE TABLE "YoutubePayable" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sourceKey" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "groupId" TEXT,
  "groupName" TEXT,
  "title" TEXT NOT NULL,
  "party" TEXT,
  "amountSatang" INTEGER NOT NULL,
  "dueDate" TEXT,
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  "createdBy" TEXT,
  "approvedBy" TEXT,
  "approvedAt" DATETIME,
  "paidEntryId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "YoutubePayable_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "YoutubeBillingGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "YoutubePayable_sourceKey_key" ON "YoutubePayable"("sourceKey");
CREATE UNIQUE INDEX "YoutubePayable_paidEntryId_key" ON "YoutubePayable"("paidEntryId");
CREATE INDEX "YoutubePayable_status_dueDate_idx" ON "YoutubePayable"("status", "dueDate");
CREATE INDEX "YoutubePayable_groupId_idx" ON "YoutubePayable"("groupId");
