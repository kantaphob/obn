-- A member may have accounts in several groups. Restore identity links for
-- every matching historical seat instead of keeping only the newest one.
UPDATE "YoutubeBillingSeat" AS seat
SET "memberId" = COALESCE(
  (
    SELECT account."memberId"
    FROM "YoutubeMemberAccount" AS account
    WHERE account."id" = seat."accountId"
  ),
  (
    SELECT account."memberId"
    FROM "YoutubeMemberAccount" AS account
    WHERE lower(trim(account."email")) = lower(trim(seat."email"))
    LIMIT 1
  ),
  (
    SELECT member."id"
    FROM "YoutubeMember" AS member
    WHERE member."name" = seat."displayName"
  )
)
WHERE seat."memberId" IS NULL
  AND (
    EXISTS (
      SELECT 1 FROM "YoutubeMemberAccount" AS account
      WHERE account."id" = seat."accountId"
    )
    OR EXISTS (
      SELECT 1 FROM "YoutubeMemberAccount" AS account
      WHERE lower(trim(account."email")) = lower(trim(seat."email"))
    )
    OR EXISTS (
      SELECT 1 FROM "YoutubeMember" AS member
      WHERE member."name" = seat."displayName"
    )
  );
