ALTER TABLE "YoutubePayment" ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE "YoutubePayment" ADD COLUMN "reference" TEXT;
ALTER TABLE "YoutubePayment" ADD COLUMN "note" TEXT;
