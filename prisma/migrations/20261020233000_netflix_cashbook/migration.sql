CREATE TABLE "NetflixLedgerEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sourceKey" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "type" TEXT NOT NULL,
  "groupId" TEXT,
  "groupName" TEXT,
  "profileId" TEXT,
  "profileName" TEXT,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT '',
  "party" TEXT,
  "amountSatang" INTEGER NOT NULL,
  "transactionOn" TEXT NOT NULL,
  "paymentMethod" TEXT NOT NULL DEFAULT 'OTHER',
  "reference" TEXT,
  "note" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "NetflixLedgerEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "NetflixGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "NetflixLedgerEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "NetflixProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NetflixLedgerEntry_sourceKey_key" ON "NetflixLedgerEntry"("sourceKey");
CREATE INDEX "NetflixLedgerEntry_transactionOn_idx" ON "NetflixLedgerEntry"("transactionOn");
CREATE INDEX "NetflixLedgerEntry_groupId_idx" ON "NetflixLedgerEntry"("groupId");
CREATE INDEX "NetflixLedgerEntry_type_idx" ON "NetflixLedgerEntry"("type");

INSERT INTO "NetflixLedgerEntry" (
  "id", "sourceKey", "source", "type", "groupId", "groupName", "profileId", "profileName",
  "title", "category", "party", "amountSatang", "transactionOn", "paymentMethod", "note", "createdAt", "updatedAt"
)
SELECT
  'netflix-payment-' || "id",
  'profile-month:' || COALESCE("profileId", 'orphan-' || "id") || ':' || "billingMonth",
  'PROFILE_PAYMENT', 'INCOME', "groupId", "groupName", "profileId", "profileName",
  'รับชำระ Netflix ประจำเดือน ' || "billingMonth", 'ค่าบริการสมาชิก', "profileName", "amountSatang", "paidOn", 'OTHER',
  'รายการรับเงินจากประวัติสมาชิก', "createdAt", CURRENT_TIMESTAMP
FROM "NetflixPayment";
