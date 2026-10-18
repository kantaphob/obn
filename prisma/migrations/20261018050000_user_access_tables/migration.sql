ALTER TABLE "User" ADD COLUMN "accessConfigured" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "UserCompanyAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "companyCode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserCompanyAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserCompanyAccess_companyCode_fkey" FOREIGN KEY ("companyCode") REFERENCES "CompanySequence" ("companycode") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UserCompanyAccess_userId_companyCode_key" ON "UserCompanyAccess"("userId", "companyCode");
CREATE INDEX "UserCompanyAccess_companyCode_idx" ON "UserCompanyAccess"("companyCode");

CREATE TABLE "UserAppAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "appKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAppAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UserAppAccess_userId_appKey_key" ON "UserAppAccess"("userId", "appKey");
CREATE INDEX "UserAppAccess_appKey_idx" ON "UserAppAccess"("appKey");

CREATE TABLE "UserMenuAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserMenuAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UserMenuAccess_userId_href_key" ON "UserMenuAccess"("userId", "href");
CREATE INDEX "UserMenuAccess_href_idx" ON "UserMenuAccess"("href");
