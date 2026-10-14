PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_borrowers" (
    "borrowersCode" TEXT NOT NULL,
"id" TEXT NOT NULL PRIMARY KEY,
    "nickname" TEXT,
    "phone" TEXT NOT NULL,
    "note" TEXT,
    "workplace" TEXT,
    "status" TEXT,
    "bankAccountNumber" TEXT,
    "payoutChannel" TEXT,
    "payoutBankCode" TEXT,
    "registeredAt" DATETIME,
    "facebook" TEXT,
    "instagram" TEXT,
    "line" TEXT,
    "hasFacebook" BOOLEAN,
    "hasInstagram" BOOLEAN,
    "hasLine" BOOLEAN,
    "riskRating" TEXT,
    "approvedLimit" INTEGER,
    "usedLimit" INTEGER,
    "availableLimit" INTEGER,
    "referrer" TEXT,
    "nationalId" TEXT,
    "prefixTH" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "firstNameEN" TEXT,
    "lastNameEN" TEXT,
    "gender" TEXT,
    "birthDate" DATETIME,
    "address" TEXT,
    "houseNumber" TEXT,
    "buildingName" TEXT,
    "alley" TEXT,
    "road" TEXT,
    "subdistrictId" INTEGER,
    "issueDate" DATETIME,
    "expiryDate" DATETIME,
    "photoUrl" TEXT,
    "idCardImageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "borrowers_payoutBankCode_fkey" FOREIGN KEY ("payoutBankCode") REFERENCES "Banking" ("bankCode") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "borrowers_subdistrictId_fkey" FOREIGN KEY ("subdistrictId") REFERENCES "subdistrict" ("subdistrict_id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_borrowers" ("borrowersCode", "id", "nickname", "phone", "note", "workplace", "status", "bankAccountNumber", "payoutChannel", "payoutBankCode", "registeredAt", "facebook", "instagram", "line", "hasFacebook", "hasInstagram", "hasLine", "riskRating", "approvedLimit", "usedLimit", "availableLimit", "referrer", "nationalId", "prefixTH", "firstName", "lastName", "firstNameEN", "lastNameEN", "gender", "birthDate", "address", "houseNumber", "buildingName", "alley", "road", "subdistrictId", "issueDate", "expiryDate", "photoUrl", "idCardImageUrl", "createdAt", "updatedAt") SELECT printf('bo%06d', ROW_NUMBER() OVER (ORDER BY "createdAt", "id")), "id", "nickname", "phone", "note", "workplace", "status", "bankAccountNumber", "payoutChannel", "payoutBankCode", "registeredAt", "facebook", "instagram", "line", "hasFacebook", "hasInstagram", "hasLine", "riskRating", "approvedLimit", "usedLimit", "availableLimit", "referrer", "nationalId", "prefixTH", "firstName", "lastName", "firstNameEN", "lastNameEN", "gender", "birthDate", "address", "houseNumber", "buildingName", "alley", "road", "subdistrictId", "issueDate", "expiryDate", "photoUrl", "idCardImageUrl", "createdAt", "updatedAt" FROM "borrowers";
DROP TABLE "borrowers";
ALTER TABLE "new_borrowers" RENAME TO "borrowers";
CREATE UNIQUE INDEX "borrowers_nationalId_key" ON "borrowers"("nationalId");
CREATE INDEX "borrowers_payoutBankCode_idx" ON "borrowers"("payoutBankCode");
CREATE UNIQUE INDEX "borrowers_borrowersCode_key" ON "borrowers"("borrowersCode");
CREATE TABLE "BorrowerCodeSequence" ("id" INTEGER NOT NULL PRIMARY KEY, "value" INTEGER NOT NULL);
INSERT INTO "BorrowerCodeSequence" ("id", "value") SELECT 1, COUNT(*) FROM "borrowers";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
