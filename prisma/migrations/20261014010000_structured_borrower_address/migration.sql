-- AlterTable
ALTER TABLE "borrowers" ADD COLUMN "houseNumber" TEXT;
ALTER TABLE "borrowers" ADD COLUMN "buildingName" TEXT;
ALTER TABLE "borrowers" ADD COLUMN "alley" TEXT;
ALTER TABLE "borrowers" ADD COLUMN "road" TEXT;
ALTER TABLE "borrowers" ADD COLUMN "subdistrictId" INTEGER REFERENCES "subdistrict"("subdistrict_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "borrowers_subdistrictId_idx" ON "borrowers"("subdistrictId");
