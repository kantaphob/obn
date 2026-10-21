CREATE TABLE "NetflixGroup" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "accountEmail" TEXT,
  "plan" TEXT NOT NULL DEFAULT 'Premium',
  "monthlySatang" INTEGER,
  "renewalDate" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "NetflixProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "groupId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "contactEmail" TEXT,
  "phone" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "NetflixProfile_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "NetflixGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "NetflixGroup_status_idx" ON "NetflixGroup"("status");
CREATE UNIQUE INDEX "NetflixProfile_groupId_position_key" ON "NetflixProfile"("groupId", "position");
CREATE INDEX "NetflixProfile_groupId_idx" ON "NetflixProfile"("groupId");
