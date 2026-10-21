CREATE TABLE "WealthAssetNumberSequence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyCode" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "WealthAssetNumberSequence_companyCode_key" UNIQUE ("companyCode")
);

CREATE TABLE "WealthAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetCode" TEXT NOT NULL,
    "companyCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "acquisitionDate" DATETIME,
    "acquisitionCost" BIGINT NOT NULL DEFAULT 0,
    "currentValue" BIGINT NOT NULL DEFAULT 0,
    "ownershipBps" INTEGER NOT NULL DEFAULT 10000,
    "valuationDate" DATETIME,
    "valuationSource" TEXT,
    "detailsJson" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WealthAsset_assetCode_key" UNIQUE ("assetCode"),
    CONSTRAINT "WealthAsset_companyCode_fkey" FOREIGN KEY ("companyCode") REFERENCES "CompanySequence" ("companycode") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "WealthAsset_companyCode_status_idx" ON "WealthAsset"("companyCode", "status");
CREATE INDEX "WealthAsset_category_status_idx" ON "WealthAsset"("category", "status");

CREATE TABLE "WealthAssetValuation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "value" BIGINT NOT NULL,
    "valuationDate" DATETIME NOT NULL,
    "source" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WealthAssetValuation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "WealthAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "WealthAssetValuation_assetId_valuationDate_idx" ON "WealthAssetValuation"("assetId", "valuationDate");
