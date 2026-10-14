import 'dotenv/config';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const url = process.env.DATABASE_URL;
if (!url?.startsWith('file:')) throw new Error('A SQLite DATABASE_URL is required');
const rows = JSON.parse(readFileSync(new URL('../prisma/data/banks.json', import.meta.url), 'utf8'));
if (rows.some((row) => !/^\d{3}$/.test(row.bankCode)) || new Set(rows.map((row) => row.bankCode)).size !== rows.length) throw new Error('Invalid or duplicate bank code');
const db = new Database(url.slice(5), { fileMustExist: true });
try {
 const insert = db.prepare('INSERT INTO Banking (id,bankCode,bankShort,bankFull,bankNameTH,bankNameEN) VALUES (?,?,?,?,?,?) ON CONFLICT(bankCode) DO NOTHING');
 const count = db.transaction(() => rows.reduce((n,r) => n + insert.run(randomUUID(),r.bankCode,r.bankShort,r.bankNameEN,r.bankNameTH,r.bankNameEN).changes,0))();
 console.log(`Added ${count} banks; existing entries retained.`);
} finally { db.close(); }
