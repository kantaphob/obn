ALTER TABLE "CompanyOwner" ADD COLUMN "ownerPostcode" TEXT;

UPDATE "CompanyOwner"
SET "ownerPostcode" = (
  SELECT "zipcode" FROM "subdistrict"
  WHERE "subdistrict_id" = "CompanyOwner"."ownerSubdistrictId"
)
WHERE "ownerSubdistrictId" IS NOT NULL;
