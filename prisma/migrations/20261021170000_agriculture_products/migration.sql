CREATE TABLE "AgricultureProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "formula" TEXT NOT NULL DEFAULT '',
    "brand" TEXT NOT NULL DEFAULT '',
    "other" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "AgricultureProduct_barcode_key" ON "AgricultureProduct"("barcode");
CREATE INDEX "AgricultureProduct_name_idx" ON "AgricultureProduct"("name");
CREATE INDEX "AgricultureProduct_brand_idx" ON "AgricultureProduct"("brand");
