-- CreateTable
CREATE TABLE "Unit" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "standard" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "sourceDate" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Material" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "recommendedUnitCode" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "sourceDate" TEXT NOT NULL,
    CONSTRAINT "Material_recommendedUnitCode_fkey" FOREIGN KEY ("recommendedUnitCode") REFERENCES "Unit" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Unit_category_idx" ON "Unit"("category");

-- CreateIndex
CREATE INDEX "Material_category_idx" ON "Material"("category");

-- CreateIndex
CREATE INDEX "Material_recommendedUnitCode_idx" ON "Material"("recommendedUnitCode");

