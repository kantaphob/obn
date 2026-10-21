DROP INDEX YoutubePayment_active_seat_due_unique;
CREATE UNIQUE INDEX YoutubePayment_active_assignment_due_unique ON YoutubePayment(assignmentKey,dueDate) WHERE voidedAt IS NULL;
CREATE TABLE YoutubeGroupCharge (id TEXT NOT NULL PRIMARY KEY, groupId TEXT NOT NULL, groupName TEXT NOT NULL, billingMonth TEXT NOT NULL, dueDate TEXT NOT NULL, coveredThrough TEXT NOT NULL, amountSatang INTEGER NOT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX YoutubeGroupCharge_groupId_billingMonth_key ON YoutubeGroupCharge(groupId,billingMonth);
