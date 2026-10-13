-- CreateTable
CREATE TABLE "province" (
    "province_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "district" (
    "district_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "province_id" INTEGER NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    CONSTRAINT "district_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "province" ("province_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "subdistrict" (
    "subdistrict_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "district_id" INTEGER NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "lat" REAL,
    "long" REAL,
    "zipcode" TEXT,
    CONSTRAINT "subdistrict_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "district" ("district_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "district_province_id_idx" ON "district"("province_id");

-- CreateIndex
CREATE INDEX "subdistrict_district_id_idx" ON "subdistrict"("district_id");

-- CreateIndex
CREATE INDEX "subdistrict_zipcode_idx" ON "subdistrict"("zipcode");

