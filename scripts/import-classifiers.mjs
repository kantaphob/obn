import 'dotenv/config';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('../prisma/data/classifiers.json', import.meta.url), 'utf8'));
const url = process.env.DATABASE_URL;
if (!url?.startsWith('file:')) throw new Error('Set a SQLite file DATABASE_URL before importing.');
if (new Set(data.items.map((row) => row.code)).size !== data.items.length || new Set(data.items.map((row) => row.nameTh)).size !== data.items.length) throw new Error('Duplicate classifier code or name');
const db = new Database(url.slice(5), { fileMustExist: true });
try {
  const insert = db.prepare('INSERT INTO "Classifier" (code,nameTh,nameEn,category,examples,sourceUrl,sourceVersion,sourceDate) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET nameTh=excluded.nameTh,nameEn=excluded.nameEn,category=excluded.category,examples=excluded.examples,sourceUrl=excluded.sourceUrl,sourceVersion=excluded.sourceVersion,sourceDate=excluded.sourceDate');
  db.transaction(() => {
    for (const row of data.items) insert.run(row.code,row.nameTh,row.nameEn,row.category,row.examples,data.source.url,data.source.version,data.source.retrievedAt);
  })();
  console.log(`Imported ${data.items.length} Thai classifiers without duplicate codes.`);
} finally { db.close(); }
