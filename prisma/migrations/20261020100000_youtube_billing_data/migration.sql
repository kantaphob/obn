CREATE TABLE "YoutubeBillingGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dueDay" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "YoutubeBillingGroup_importKey_key" ON "YoutubeBillingGroup"("importKey");
CREATE INDEX "YoutubeBillingGroup_status_idx" ON "YoutubeBillingGroup"("status");

CREATE TABLE "YoutubeBillingSeat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "sourceRowKey" TEXT NOT NULL,
    "displayName" TEXT,
    "email" TEXT,
    "contactMethod" TEXT,
    "billingMonths" INTEGER,
    "sourceStatus" TEXT,
    "priceSatang" INTEGER,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNRECORDED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "YoutubeBillingSeat_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "YoutubeBillingGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "YoutubeBillingSeat_sourceRowKey_key" ON "YoutubeBillingSeat"("sourceRowKey");
CREATE UNIQUE INDEX "YoutubeBillingSeat_groupId_position_key" ON "YoutubeBillingSeat"("groupId", "position");
CREATE INDEX "YoutubeBillingSeat_groupId_idx" ON "YoutubeBillingSeat"("groupId");
CREATE INDEX "YoutubeBillingSeat_email_idx" ON "YoutubeBillingSeat"("email");
CREATE INDEX "YoutubeBillingSeat_paymentStatus_idx" ON "YoutubeBillingSeat"("paymentStatus");
