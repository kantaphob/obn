CREATE TABLE YoutubeMembershipPeriod (assignmentKey TEXT NOT NULL PRIMARY KEY, groupId TEXT NOT NULL, seatId TEXT NOT NULL, memberId TEXT, memberName TEXT, email TEXT, startedOn TEXT, endedOn TEXT, knownSince DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX YoutubeMembershipPeriod_groupId_seatId_idx ON YoutubeMembershipPeriod(groupId,seatId);
CREATE TABLE YoutubeSeatPricePeriod (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, assignmentKey TEXT NOT NULL, seatId TEXT NOT NULL, effectiveOn TEXT, priceSatang INTEGER, billingMonths INTEGER, baseline BOOLEAN NOT NULL DEFAULT false, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX YoutubeSeatPricePeriod_assignmentKey_id_idx ON YoutubeSeatPricePeriod(assignmentKey,id);
INSERT INTO YoutubeMembershipPeriod(assignmentKey,groupId,seatId,memberId,memberName,email,knownSince) SELECT assignmentKey,groupId,id,memberId,displayName,email,CAST(ROUND((julianday('now')-2440587.5)*86400000) AS INTEGER) FROM YoutubeBillingSeat WHERE memberId IS NOT NULL OR displayName IS NOT NULL OR email IS NOT NULL;
INSERT INTO YoutubeSeatPricePeriod(assignmentKey,seatId,effectiveOn,priceSatang,billingMonths,baseline,createdAt) SELECT assignmentKey,id,NULL,priceSatang,billingMonths,1,CAST(ROUND((julianday('now')-2440587.5)*86400000) AS INTEGER) FROM YoutubeBillingSeat WHERE memberId IS NOT NULL OR displayName IS NOT NULL OR email IS NOT NULL;
CREATE TRIGGER youtube_membership_insert AFTER INSERT ON YoutubeBillingSeat WHEN NEW.memberId IS NOT NULL BEGIN
 INSERT INTO YoutubeMembershipPeriod(assignmentKey,groupId,seatId,memberId,memberName,email,startedOn,knownSince) VALUES(NEW.assignmentKey,NEW.groupId,NEW.id,NEW.memberId,NEW.displayName,NEW.email,date('now','+7 hours'),CAST(ROUND((julianday('now')-2440587.5)*86400000) AS INTEGER));
 INSERT INTO YoutubeSeatPricePeriod(assignmentKey,seatId,effectiveOn,priceSatang,billingMonths,createdAt) VALUES(NEW.assignmentKey,NEW.id,coalesce(NEW.nextDueDate,date('now','+7 hours')),NEW.priceSatang,NEW.billingMonths,CAST(ROUND((julianday('now')-2440587.5)*86400000) AS INTEGER));
END;
CREATE TRIGGER youtube_membership_change AFTER UPDATE ON YoutubeBillingSeat WHEN OLD.assignmentKey <> NEW.assignmentKey BEGIN
 UPDATE YoutubeMembershipPeriod SET endedOn=date('now','+7 hours') WHERE assignmentKey=OLD.assignmentKey AND endedOn IS NULL;
 INSERT INTO YoutubeMembershipPeriod(assignmentKey,groupId,seatId,memberId,memberName,email,startedOn,knownSince) SELECT NEW.assignmentKey,NEW.groupId,NEW.id,NEW.memberId,NEW.displayName,NEW.email,date('now','+7 hours'),CAST(ROUND((julianday('now')-2440587.5)*86400000) AS INTEGER) WHERE NEW.memberId IS NOT NULL;
 INSERT INTO YoutubeSeatPricePeriod(assignmentKey,seatId,effectiveOn,priceSatang,billingMonths,createdAt) SELECT NEW.assignmentKey,NEW.id,coalesce(NEW.nextDueDate,date('now','+7 hours')),NEW.priceSatang,NEW.billingMonths,CAST(ROUND((julianday('now')-2440587.5)*86400000) AS INTEGER) WHERE NEW.memberId IS NOT NULL;
END;
CREATE TRIGGER youtube_price_change AFTER UPDATE ON YoutubeBillingSeat WHEN OLD.assignmentKey = NEW.assignmentKey AND (OLD.priceSatang IS NOT NEW.priceSatang OR OLD.billingMonths IS NOT NEW.billingMonths) AND NEW.memberId IS NOT NULL BEGIN
 INSERT INTO YoutubeSeatPricePeriod(assignmentKey,seatId,effectiveOn,priceSatang,billingMonths,createdAt) VALUES(NEW.assignmentKey,NEW.id,coalesce(NEW.nextDueDate,date('now','+7 hours')),NEW.priceSatang,NEW.billingMonths,CAST(ROUND((julianday('now')-2440587.5)*86400000) AS INTEGER));
END;
