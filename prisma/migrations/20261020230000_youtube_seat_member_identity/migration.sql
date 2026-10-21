ALTER TABLE "YoutubeBillingSeat" ADD COLUMN "memberId" TEXT REFERENCES "YoutubeMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "YoutubeBillingSeat_memberId_idx" ON "YoutubeBillingSeat"("memberId");

WITH ranked_memberships AS (
  SELECT
    s."id" AS "seatId",
    COALESCE(a."memberId", m."id") AS "memberId",
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(a."memberId", m."id")
      ORDER BY
        CASE WHEN g."startedOn" IS NULL THEN 0 ELSE 1 END DESC,
        g."startedOn" DESC,
        g."createdAt" DESC,
        s."position" ASC
    ) AS "membershipRank"
  FROM "YoutubeBillingSeat" s
  JOIN "YoutubeBillingGroup" g ON g."id" = s."groupId"
  LEFT JOIN "YoutubeMemberAccount" a ON a."id" = s."accountId"
  LEFT JOIN "YoutubeMember" m ON m."name" = s."displayName"
  WHERE a."memberId" IS NOT NULL OR m."id" IS NOT NULL
), current_memberships AS (
  SELECT "seatId", "memberId"
  FROM ranked_memberships
  WHERE "membershipRank" = 1
)
UPDATE "YoutubeBillingSeat"
SET "memberId" = (
  SELECT current_memberships."memberId"
  FROM current_memberships
  WHERE current_memberships."seatId" = "YoutubeBillingSeat"."id"
)
WHERE "id" IN (SELECT "seatId" FROM current_memberships);
