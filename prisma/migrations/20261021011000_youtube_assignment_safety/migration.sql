ALTER TABLE YoutubeBillingSeat ADD COLUMN assignmentKey TEXT NOT NULL DEFAULT '';
UPDATE YoutubeBillingSeat SET assignmentKey=lower(hex(randomblob(16)));
ALTER TABLE YoutubePayment ADD COLUMN assignmentKey TEXT;
UPDATE YoutubePayment SET assignmentKey=(SELECT assignmentKey FROM YoutubeBillingSeat WHERE id=YoutubePayment.seatId);
CREATE UNIQUE INDEX YoutubePayment_active_seat_due_unique ON YoutubePayment(seatId,dueDate) WHERE voidedAt IS NULL;
