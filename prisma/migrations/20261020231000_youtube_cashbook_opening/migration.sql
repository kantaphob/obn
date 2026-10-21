INSERT INTO "YoutubeLedgerEntry" ("id", "sourceKey", "source", "type", "groupId", "groupName", "title", "party", "amountSatang", "transactionOn", "paymentMethod", "note")
SELECT 'yt-opening-' || "id", 'group-opening:' || "id", 'OPENING', 'INCOME', "id", "name", 'ยอดรับยกมาก่อนใช้ระบบ', 'ยอดยกมา', "openingReceivedSatang", COALESCE("startedOn", date("createdAt", '+7 hours')), 'OTHER', 'ยอดรับเดิมที่กรอกในกลุ่ม ไม่ใช่รายการรับเงินใหม่'
FROM "YoutubeBillingGroup" WHERE "openingReceivedSatang" > 0;
