CREATE TABLE "YoutubeActivityLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorId" TEXT,
  "actorName" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "entityLabel" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "YoutubeActivityLog_createdAt_idx" ON "YoutubeActivityLog"("createdAt");
CREATE INDEX "YoutubeActivityLog_entityType_entityId_idx" ON "YoutubeActivityLog"("entityType", "entityId");
