-- CreateTable
CREATE TABLE "borrowers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nickname" TEXT,
    "phone" TEXT NOT NULL,
    "note" TEXT,
    "nationalId" TEXT,
    "prefixTH" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "firstNameEN" TEXT,
    "lastNameEN" TEXT,
    "gender" TEXT,
    "birthDate" DATETIME,
    "address" TEXT,
    "issueDate" DATETIME,
    "expiryDate" DATETIME,
    "photoUrl" TEXT,
    "idCardImageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "borrowers_nationalId_key" ON "borrowers"("nationalId");
