ALTER TABLE "Contract" ADD COLUMN "previousContractNumber" TEXT;
ALTER TABLE "Contract" ADD COLUMN "renumberedAt" DATETIME;
CREATE UNIQUE INDEX "Contract_previousContractNumber_key" ON "Contract"("previousContractNumber");
