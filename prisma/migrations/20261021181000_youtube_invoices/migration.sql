CREATE TABLE YoutubeInvoice (
 id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, sourceKey TEXT NOT NULL, groupId TEXT NOT NULL, groupName TEXT NOT NULL,
 seatId TEXT NOT NULL, assignmentKey TEXT NOT NULL, memberId TEXT, memberName TEXT NOT NULL, email TEXT, position INTEGER NOT NULL,
 amountSatang INTEGER NOT NULL, billingMonths INTEGER NOT NULL, dueDate TEXT NOT NULL, nextDueDate TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'ISSUED', receiptId TEXT, ledgerId TEXT, note TEXT, issuedOn TEXT NOT NULL,
 createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL
);
CREATE UNIQUE INDEX YoutubeInvoice_sourceKey_key ON YoutubeInvoice(sourceKey);
CREATE UNIQUE INDEX YoutubeInvoice_receiptId_key ON YoutubeInvoice(receiptId);
CREATE UNIQUE INDEX YoutubeInvoice_ledgerId_key ON YoutubeInvoice(ledgerId);
CREATE INDEX YoutubeInvoice_status_dueDate_idx ON YoutubeInvoice(status,dueDate);
CREATE INDEX YoutubeInvoice_groupId_idx ON YoutubeInvoice(groupId);
CREATE TRIGGER youtube_invoice_insert AFTER INSERT ON YoutubeInvoice BEGIN
 INSERT INTO YoutubeRecordHistory(id,entityType,entityId,action,afterJson,createdAt) VALUES(lower(hex(randomblob(16))),'INVOICE',CAST(NEW.id AS TEXT),'INSERT',json_object('groupId',NEW.groupId,'memberName',NEW.memberName,'amountSatang',NEW.amountSatang,'dueDate',NEW.dueDate,'status',NEW.status,'receiptId',NEW.receiptId,'ledgerId',NEW.ledgerId),CAST(ROUND((julianday('now')-2440587.5)*86400000) AS INTEGER));
END;
CREATE TRIGGER youtube_invoice_update AFTER UPDATE ON YoutubeInvoice BEGIN
 INSERT INTO YoutubeRecordHistory(id,entityType,entityId,action,beforeJson,afterJson,createdAt) VALUES(lower(hex(randomblob(16))),'INVOICE',CAST(NEW.id AS TEXT),'UPDATE',json_object('groupId',OLD.groupId,'memberName',OLD.memberName,'amountSatang',OLD.amountSatang,'dueDate',OLD.dueDate,'status',OLD.status,'receiptId',OLD.receiptId,'ledgerId',OLD.ledgerId),json_object('groupId',NEW.groupId,'memberName',NEW.memberName,'amountSatang',NEW.amountSatang,'dueDate',NEW.dueDate,'status',NEW.status,'receiptId',NEW.receiptId,'ledgerId',NEW.ledgerId),CAST(ROUND((julianday('now')-2440587.5)*86400000) AS INTEGER));
END;
