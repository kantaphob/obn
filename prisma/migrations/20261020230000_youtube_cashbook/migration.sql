CREATE TABLE "YoutubeLedgerEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sourceKey" TEXT NOT NULL, "source" TEXT NOT NULL, "type" TEXT NOT NULL,
  "groupId" TEXT, "groupName" TEXT, "title" TEXT NOT NULL, "party" TEXT,
  "amountSatang" INTEGER NOT NULL, "transactionOn" TEXT NOT NULL, "dueDate" TEXT,
  "paymentMethod" TEXT NOT NULL DEFAULT 'OTHER', "reference" TEXT, "note" TEXT, "confirmedBy" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "YoutubeLedgerEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "YoutubeBillingGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "YoutubeLedgerEntry_sourceKey_key" ON "YoutubeLedgerEntry"("sourceKey");
CREATE INDEX "YoutubeLedgerEntry_transactionOn_idx" ON "YoutubeLedgerEntry"("transactionOn");
CREATE INDEX "YoutubeLedgerEntry_groupId_idx" ON "YoutubeLedgerEntry"("groupId");
CREATE INDEX "YoutubeLedgerEntry_type_idx" ON "YoutubeLedgerEntry"("type");
-- Previously recorded member receipts are actual income; scheduled group charges remain unconfirmed.
INSERT INTO "YoutubeLedgerEntry" ("id", "sourceKey", "source", "type", "groupId", "groupName", "title", "party", "amountSatang", "transactionOn", "dueDate", "paymentMethod", "reference", "note", "createdAt")
SELECT 'yt-ledger-' || "id", 'member-payment:' || "id", 'MEMBER_PAYMENT', 'INCOME', "groupId", "groupName", 'รับค่าสมาชิก YouTube', "memberName", "amountSatang", "paidOn", "dueDate", "paymentMethod", "reference", "note", "createdAt" FROM "YoutubePayment";
