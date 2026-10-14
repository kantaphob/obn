CREATE TABLE "Banking" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "bankCode" TEXT NOT NULL,
 "bankShort" TEXT NOT NULL,
 "bankFull" TEXT NOT NULL,
 "bankNameTH" TEXT NOT NULL,
 "bankNameEN" TEXT NOT NULL
);
CREATE UNIQUE INDEX "Banking_bankCode_key" ON "Banking"("bankCode");
CREATE INDEX "Banking_bankCode_idx" ON "Banking"("bankCode");
