CREATE TABLE "NetflixPayment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "groupId" TEXT,
  "profileId" TEXT,
  "groupName" TEXT NOT NULL,
  "profileName" TEXT NOT NULL,
  "billingMonth" TEXT NOT NULL,
  "amountSatang" INTEGER NOT NULL,
  "paidOn" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "NetflixPayment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "NetflixGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "NetflixPayment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "NetflixProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NetflixPayment_profileId_billingMonth_key" ON "NetflixPayment"("profileId", "billingMonth");
CREATE INDEX "NetflixPayment_billingMonth_idx" ON "NetflixPayment"("billingMonth");
CREATE INDEX "NetflixPayment_groupId_idx" ON "NetflixPayment"("groupId");
