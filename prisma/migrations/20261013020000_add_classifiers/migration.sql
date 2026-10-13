-- CreateTable
CREATE TABLE "Classifier" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "examples" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "sourceDate" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Classifier_nameTh_key" ON "Classifier"("nameTh");

-- CreateIndex
CREATE INDEX "Classifier_category_idx" ON "Classifier"("category");

