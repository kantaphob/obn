CREATE TABLE "LoanApplication" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "requestNumber" TEXT NOT NULL,
 "losNumber" TEXT,
 "requestType" TEXT NOT NULL DEFAULT 'LOAN',
 "borrowerId" TEXT NOT NULL,
 "borrowerSnapshot" TEXT NOT NULL,
 "requestedAmount" INTEGER NOT NULL,
 "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "source" TEXT NOT NULL DEFAULT 'SYSTEM',
 "contractId" TEXT,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL,
 CONSTRAINT "LoanApplication_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "borrowers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "LoanApplication_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LoanApplication_requestNumber_key" ON "LoanApplication"("requestNumber");
CREATE UNIQUE INDEX "LoanApplication_losNumber_key" ON "LoanApplication"("losNumber");
CREATE UNIQUE INDEX "LoanApplication_contractId_key" ON "LoanApplication"("contractId");
CREATE INDEX "LoanApplication_borrowerId_requestedAt_idx" ON "LoanApplication"("borrowerId", "requestedAt");
CREATE TABLE "LoanApplicationNumberSequence" (
 "year" INTEGER NOT NULL PRIMARY KEY,
 "lastNumber" INTEGER NOT NULL DEFAULT 0,
 "updatedAt" DATETIME NOT NULL
);
-- Migration identifiers distinguish reconstructed requests from original application numbers.
INSERT INTO "LoanApplication" ("id","requestNumber","requestType","borrowerId","borrowerSnapshot","requestedAmount","requestedAt","source","contractId","createdAt","updatedAt")
SELECT 'migrated-' || c."id", 'REQ-MIG-' || c."contractNumber", 'LOAN', c."debtorId",
 json_object('borrowerId',b."id",'borrowersCode',b."borrowersCode",'prefixTH',b."prefixTH",'firstName',b."firstName",'lastName',b."lastName",'phone',b."phone",'nationalId',b."nationalId",'address',b."address",'houseNumber',b."houseNumber",'buildingName',b."buildingName",'alley',b."alley",'road',b."road",'subdistrictId',b."subdistrictId",'capturedFrom','PROFILE_AT_MIGRATION'),
 c."principal",c."createdAt",'MIGRATED_CONTRACT',c."id",c."createdAt",c."updatedAt"
FROM "Contract" c JOIN "borrowers" b ON b."id"=c."debtorId";
