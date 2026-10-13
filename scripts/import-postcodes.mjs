import 'dotenv/config';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';

const url = process.env.DATABASE_URL ?? 'file:./dev.db';
if (!url.startsWith('file:')) throw new Error('Postcode import requires a SQLite file DATABASE_URL');
const data = JSON.parse(readFileSync(new URL('../prisma/data/thailand-postcodes.json', import.meta.url), 'utf8'));
const db = new Database(url.slice(5), { fileMustExist: true });
db.pragma('foreign_keys = ON');
try {
  db.transaction(() => {
    for (const [table, rows] of Object.entries(data)) {
      const columns = Object.keys(rows[0]);
      const quote = (name) => `"${name}"`;
      const statement = db.prepare(`INSERT INTO ${quote(table)} (${columns.map(quote).join(',')}) VALUES (${columns.map(() => '?').join(',')}) ON CONFLICT (${quote(columns[0])}) DO UPDATE SET ${columns.slice(1).map((key) => `${quote(key)} = excluded.${quote(key)}`).join(',')}`);
      for (const row of rows) statement.run(...columns.map((key) => key === 'name_en' ? row[key] ?? '' : row[key]));
    }
    if (db.pragma('foreign_key_check').length) throw new Error('Invalid postcode relationships');
  })();
  console.log(`Imported ${data.province.length} provinces, ${data.district.length} districts, ${data.subdistrict.length} subdistricts.`);
} finally {
  db.close();
}
