ALTER TABLE "CompanySequence" ADD COLUMN "ownerProvinceId" INTEGER REFERENCES "province"("province_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanySequence" ADD COLUMN "ownerDistrictId" INTEGER REFERENCES "district"("district_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanySequence" ADD COLUMN "ownerSubdistrictId" INTEGER REFERENCES "subdistrict"("subdistrict_id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "CompanySequence"
SET "ownerProvinceId" = (
  SELECT p."province_id" FROM "province" p
  WHERE p."name_th" = "CompanySequence"."ownerProvince"
  LIMIT 1
);

UPDATE "CompanySequence"
SET "ownerDistrictId" = (
  SELECT d."district_id" FROM "district" d
  JOIN "province" p ON p."province_id" = d."province_id"
  WHERE d."name_th" = "CompanySequence"."ownerDistrict"
    AND p."name_th" = "CompanySequence"."ownerProvince"
  LIMIT 1
);

UPDATE "CompanySequence"
SET "ownerSubdistrictId" = (
  SELECT s."subdistrict_id" FROM "subdistrict" s
  JOIN "district" d ON d."district_id" = s."district_id"
  JOIN "province" p ON p."province_id" = d."province_id"
  WHERE s."name_th" = "CompanySequence"."ownerSubdistrict"
    AND d."name_th" = "CompanySequence"."ownerDistrict"
    AND p."name_th" = "CompanySequence"."ownerProvince"
  LIMIT 1
);

CREATE INDEX "CompanySequence_ownerProvinceId_idx" ON "CompanySequence"("ownerProvinceId");
CREATE INDEX "CompanySequence_ownerDistrictId_idx" ON "CompanySequence"("ownerDistrictId");
CREATE INDEX "CompanySequence_ownerSubdistrictId_idx" ON "CompanySequence"("ownerSubdistrictId");
