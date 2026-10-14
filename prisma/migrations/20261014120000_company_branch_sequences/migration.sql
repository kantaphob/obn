CREATE TABLE "CompanySequence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companycode" TEXT NOT NULL UNIQUE CHECK (length("companycode") = 5 AND "companycode" NOT GLOB '*[^0-9]*'),
    "logo" TEXT,
    "nameTH" TEXT,
    "nameEN" TEXT,
    "TaxIdentificationNumber" TEXT,
    "aboutus" TEXT,
    "companyoverview" TEXT,
    "address" TEXT,
    "postcode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "type" TEXT NOT NULL CHECK ("type" IN ('COMPANY', 'BRANCH')),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE' CHECK ("status" IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE "BranchCodeSequence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companycode" TEXT NOT NULL,
    "branchcode" TEXT NOT NULL UNIQUE CHECK (length("branchcode") = 5 AND "branchcode" NOT GLOB '*[^0-9]*'),
    "logo" TEXT,
    "nameTH" TEXT,
    "nameEN" TEXT,
    "TaxIdentificationNumber" TEXT,
    "aboutus" TEXT,
    "companyoverview" TEXT,
    "address" TEXT,
    "postcode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "type" TEXT NOT NULL CHECK ("type" IN ('COMPANY', 'BRANCH')),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE' CHECK ("status" IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT "BranchCodeSequence_companycode_fkey" FOREIGN KEY ("companycode") REFERENCES "CompanySequence" ("companycode") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BranchCodeSequence_companycode_idx" ON "BranchCodeSequence"("companycode");
