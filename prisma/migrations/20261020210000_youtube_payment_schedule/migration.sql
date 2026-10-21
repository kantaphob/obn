ALTER TABLE "YoutubeBillingSeat" ADD COLUMN "nextDueDate" TEXT;
CREATE TABLE "YoutubePayment" (
  "id" TEXT NOT NULL PRIMARY KEY, "requestKey" TEXT NOT NULL,
  "groupId" TEXT, "seatId" TEXT, "groupName" TEXT NOT NULL, "memberName" TEXT NOT NULL,
  "email" TEXT, "amountSatang" INTEGER NOT NULL, "billingMonths" INTEGER NOT NULL,
  "dueDate" TEXT NOT NULL, "nextDueDate" TEXT NOT NULL, "paidOn" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "YoutubePayment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "YoutubeBillingGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "YoutubePayment_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "YoutubeBillingSeat" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "YoutubePayment_requestKey_key" ON "YoutubePayment"("requestKey");
CREATE INDEX "YoutubePayment_paidOn_idx" ON "YoutubePayment"("paidOn");
CREATE INDEX "YoutubePayment_seatId_idx" ON "YoutubePayment"("seatId");
