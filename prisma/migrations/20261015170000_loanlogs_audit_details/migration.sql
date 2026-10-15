ALTER TABLE "loanlogs" ADD COLUMN "userId" TEXT NOT NULL DEFAULT 'guest';
ALTER TABLE "loanlogs" ADD COLUMN "arId" TEXT;
ALTER TABLE "loanlogs" ADD COLUMN "apId" TEXT;
ALTER TABLE "loanlogs" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "loanlogs" ADD COLUMN "targetId" TEXT;
ALTER TABLE "loanlogs" ADD COLUMN "beforeData" TEXT;
ALTER TABLE "loanlogs" ADD COLUMN "afterData" TEXT;

CREATE INDEX "loanlogs_borrowerId_createdAt_idx" ON "loanlogs"("borrowerId", "createdAt");
CREATE INDEX "loanlogs_contractId_createdAt_idx" ON "loanlogs"("contractId", "createdAt");
CREATE INDEX "loanlogs_arId_idx" ON "loanlogs"("arId");
CREATE INDEX "loanlogs_apId_idx" ON "loanlogs"("apId");
CREATE INDEX "loanlogs_type_targetId_idx" ON "loanlogs"("type", "targetId");
CREATE INDEX "loanlogs_userId_createdAt_idx" ON "loanlogs"("userId", "createdAt");
