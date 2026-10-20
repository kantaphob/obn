CREATE TABLE "YoutubeMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "YoutubeMemberAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "YoutubeMemberAccount_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "YoutubeMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "YoutubeBillingSeat" ADD COLUMN "accountId" TEXT REFERENCES "YoutubeMemberAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "YoutubeMember_name_key" ON "YoutubeMember"("name");
CREATE UNIQUE INDEX "YoutubeMemberAccount_email_key" ON "YoutubeMemberAccount"("email");
CREATE INDEX "YoutubeMemberAccount_memberId_idx" ON "YoutubeMemberAccount"("memberId");
CREATE INDEX "YoutubeBillingSeat_accountId_idx" ON "YoutubeBillingSeat"("accountId");
