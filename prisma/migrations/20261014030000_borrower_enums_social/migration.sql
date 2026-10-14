ALTER TABLE "borrowers" ADD COLUMN "facebook" TEXT;
ALTER TABLE "borrowers" ADD COLUMN "instagram" TEXT;
ALTER TABLE "borrowers" ADD COLUMN "line" TEXT;
UPDATE "borrowers" SET "status" = CASE "status" WHEN 'รอส่งคืน' THEN 'PENDING_REPAYMENT' WHEN 'พิจารณา' THEN 'UNDER_REVIEW' WHEN 'ปิดยอด' THEN 'CLOSED' ELSE "status" END;
UPDATE "borrowers" SET "payoutChannel" = CASE "payoutChannel" WHEN 'PP' THEN 'PROMPTPAY' WHEN 'K-Bank' THEN 'KBANK' ELSE "payoutChannel" END;
