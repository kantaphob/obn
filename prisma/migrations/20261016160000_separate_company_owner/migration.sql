CREATE TABLE "CompanyOwner" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyCode" TEXT NOT NULL UNIQUE,
  "ownerNationalId" TEXT,
  "ownerPrefix" TEXT,
  "ownerFirstName" TEXT,
  "ownerLastName" TEXT,
  "ownerPhone" TEXT,
  "ownerEmail" TEXT,
  "ownerAddress" TEXT,
  "ownerMoo" TEXT,
  "ownerSoi" TEXT,
  "ownerRoad" TEXT,
  "ownerProvince" TEXT,
  "ownerDistrict" TEXT,
  "ownerSubdistrict" TEXT,
  "ownerProvinceId" INTEGER,
  "ownerDistrictId" INTEGER,
  "ownerSubdistrictId" INTEGER,
  "ownerDocumentUrl" TEXT,
  "ownerDocumentName" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyOwner_companyCode_fkey" FOREIGN KEY ("companyCode") REFERENCES "CompanySequence" ("companycode") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompanyOwner_ownerProvinceId_fkey" FOREIGN KEY ("ownerProvinceId") REFERENCES "province" ("province_id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CompanyOwner_ownerDistrictId_fkey" FOREIGN KEY ("ownerDistrictId") REFERENCES "district" ("district_id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CompanyOwner_ownerSubdistrictId_fkey" FOREIGN KEY ("ownerSubdistrictId") REFERENCES "subdistrict" ("subdistrict_id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "CompanyOwner" (
  "id", "companyCode", "ownerNationalId", "ownerFirstName", "ownerLastName", "ownerPhone", "ownerEmail",
  "ownerAddress", "ownerMoo", "ownerSoi", "ownerRoad", "ownerProvince", "ownerDistrict", "ownerSubdistrict",
  "ownerProvinceId", "ownerDistrictId", "ownerSubdistrictId", "ownerDocumentUrl", "ownerDocumentName"
)
SELECT
  lower(hex(randomblob(16))), "companycode", "ownerNationalId", "ownerFirstName", "ownerLastName", "ownerPhone", "ownerEmail",
  "ownerAddress", "ownerMoo", "ownerSoi", "ownerRoad", "ownerProvince", "ownerDistrict", "ownerSubdistrict",
  "ownerProvinceId", "ownerDistrictId", "ownerSubdistrictId", "ownerDocumentUrl", "ownerDocumentName"
FROM "CompanySequence"
WHERE "ownerNationalId" IS NOT NULL OR "ownerFirstName" IS NOT NULL OR "ownerLastName" IS NOT NULL
   OR "ownerPhone" IS NOT NULL OR "ownerEmail" IS NOT NULL OR "ownerAddress" IS NOT NULL
   OR "ownerDocumentUrl" IS NOT NULL OR "ownerDocumentName" IS NOT NULL OR "ownerProvince" IS NOT NULL
   OR "ownerDistrict" IS NOT NULL OR "ownerSubdistrict" IS NOT NULL OR "ownerMoo" IS NOT NULL
   OR "ownerSoi" IS NOT NULL OR "ownerRoad" IS NOT NULL;

CREATE INDEX "CompanyOwner_ownerProvinceId_idx" ON "CompanyOwner"("ownerProvinceId");
CREATE INDEX "CompanyOwner_ownerDistrictId_idx" ON "CompanyOwner"("ownerDistrictId");
CREATE INDEX "CompanyOwner_ownerSubdistrictId_idx" ON "CompanyOwner"("ownerSubdistrictId");
