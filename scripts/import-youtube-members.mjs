import "dotenv/config";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith("file:")) throw new Error("Set a SQLite file DATABASE_URL before importing.");
const databasePath = path.resolve(databaseUrl.slice(5).split("?")[0]);
const members = [
  { name: "พิชญศักดิ์ภักดี ธนสิทธิโภคิน", emails: ["thanasitthipokin@gmail.com", "pol.chayanat@gmail.com", "pol.occib@gmail.com"] },
  { name: "sm1.ศุภวัฒน์", emails: ["Kanchonnakan.siri@gmail.com"] },
  { name: "SUMi", emails: ["sureerat.wongmoon@gmail.com"] },
  { name: "CP", emails: ["Kankanoksaiinta@gmail.com"] },
  { name: "ก้อง", emails: ["Ksomparsert@gmail.com"] },
  { name: "Ball♾️", emails: [] },
  { name: "Kankawee_JT ♓", emails: [] },
  { name: "TeeYai👽💻", emails: [] },
  { name: "N🌤Thitirat 788", emails: [] },
];

const db = new Database(databasePath, { fileMustExist: true });
db.pragma("foreign_keys = ON");
const now = new Date().toISOString();
const upsertMember = db.prepare(`
  INSERT INTO "YoutubeMember" ("id", "name", "createdAt", "updatedAt")
  VALUES (?, ?, ?, ?)
  ON CONFLICT ("name") DO UPDATE SET "updatedAt" = excluded."updatedAt"
`);
const findMember = db.prepare('SELECT "id" FROM "YoutubeMember" WHERE "name" = ?');
const upsertAccount = db.prepare(`
  INSERT INTO "YoutubeMemberAccount" ("id", "memberId", "email", "createdAt", "updatedAt")
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT ("email") DO UPDATE SET "memberId" = excluded."memberId", "updatedAt" = excluded."updatedAt"
`);
const findAccount = db.prepare('SELECT "id" FROM "YoutubeMemberAccount" WHERE "email" = ? COLLATE NOCASE');
const linkSeats = db.prepare('UPDATE "YoutubeBillingSeat" SET "accountId" = ? WHERE "email" = ? COLLATE NOCASE');

try {
  db.transaction(() => {
    for (const member of members) {
      upsertMember.run(randomUUID(), member.name, now, now);
      const memberId = findMember.get(member.name)?.id;
      if (!memberId) throw new Error(`Could not load member ${member.name}.`);
      for (const email of member.emails) {
        upsertAccount.run(randomUUID(), memberId, email, now, now);
        const accountId = findAccount.get(email)?.id;
        if (!accountId) throw new Error(`Could not load member account ${email}.`);
        linkSeats.run(accountId, email);
      }
    }
  })();
  const accountCount = members.reduce((total, member) => total + member.emails.length, 0);
  console.log(`Imported ${members.length} YouTube members and ${accountCount} member accounts. Re-running updates the same members and accounts without duplicates.`);
} finally {
  db.close();
}
