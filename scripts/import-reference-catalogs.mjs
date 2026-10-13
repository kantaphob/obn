import 'dotenv/config';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';

const catalog = JSON.parse(readFileSync(new URL('../prisma/data/reference-catalogs.json', import.meta.url), 'utf8'));
const url = process.env.DATABASE_URL;
if (!url?.startsWith('file:')) throw new Error('Set a SQLite file DATABASE_URL before importing.');
const unitCodes = new Set(catalog.units.map((unit) => unit.code));
if (unitCodes.size !== catalog.units.length) throw new Error('Duplicate unit code');
if (new Set(catalog.materials.map((material) => material.code)).size !== catalog.materials.length) throw new Error('Duplicate material code');
for (const material of catalog.materials) {
  if (!/^\d{8}$/.test(material.code)) throw new Error(`Invalid CPV code: ${material.code}`);
  if (material.recommendedUnitCode && !unitCodes.has(material.recommendedUnitCode)) throw new Error(`Unknown unit for ${material.code}`);
}
const db = new Database(url.slice(5), { fileMustExist: true });
db.pragma('foreign_keys = ON');
try {
  db.transaction(() => {
    // Fixed table/column lists; all imported values are bound parameters.
    for (const [table, key, columns] of [
      ['Unit', 'units', ['code', 'nameTh', 'nameEn', 'symbol', 'category', 'standard']],
      ['Material', 'materials', ['code', 'nameTh', 'nameEn', 'category', 'recommendedUnitCode']],
    ]) {
      const source = catalog.sources[key];
      const fields = [...columns, 'sourceUrl', 'sourceVersion', 'sourceDate'];
      const quote = (value) => `"${value}"`;
      const statement = db.prepare(`INSERT INTO ${quote(table)} (${fields.map(quote).join(',')}) VALUES (${fields.map(() => '?').join(',')}) ON CONFLICT ("code") DO UPDATE SET ${fields.slice(1).map((field) => `${quote(field)} = excluded.${quote(field)}`).join(',')}`);
      for (const row of catalog[key]) {
        statement.run(...columns.map((field) => row[field]), source.url, source.version, source.retrievedAt);
      }
    }
    if (db.pragma('foreign_key_check').length) throw new Error('Foreign-key validation failed');
  })();
  console.log(`Imported ${catalog.units.length} units and ${catalog.materials.length} materials. Existing codes updated without duplicates.`);
} finally {
  db.close();
}
