CREATE TRIGGER youtube_payable_insert AFTER INSERT ON YoutubePayable BEGIN
 INSERT INTO YoutubeRecordHistory(id,entityType,entityId,action,afterJson,createdAt) VALUES(lower(hex(randomblob(16))),'PAYABLE',NEW.id,'INSERT',json_object('groupId',NEW.groupId,'amountSatang',NEW.amountSatang,'dueDate',NEW.dueDate,'status',NEW.status,'paidEntryId',NEW.paidEntryId),CAST(ROUND((julianday('now')-2440587.5)*86400000) AS INTEGER));
END;
CREATE TRIGGER youtube_payable_update AFTER UPDATE ON YoutubePayable BEGIN
 INSERT INTO YoutubeRecordHistory(id,entityType,entityId,action,beforeJson,afterJson,createdAt) VALUES(lower(hex(randomblob(16))),'PAYABLE',NEW.id,'UPDATE',json_object('groupId',OLD.groupId,'amountSatang',OLD.amountSatang,'dueDate',OLD.dueDate,'status',OLD.status,'paidEntryId',OLD.paidEntryId),json_object('groupId',NEW.groupId,'amountSatang',NEW.amountSatang,'dueDate',NEW.dueDate,'status',NEW.status,'paidEntryId',NEW.paidEntryId),CAST(ROUND((julianday('now')-2440587.5)*86400000) AS INTEGER));
END;
