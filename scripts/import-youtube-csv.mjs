import 'dotenv/config';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const csvPath = process.argv[2];
if (!csvPath) throw new Error('Usage: node scripts/import-youtube-csv.mjs <csv-file>');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith('file:')) throw new Error('Set a SQLite file DATABASE_URL before importing.');
const databasePath = path.resolve(databaseUrl.slice(5).split('?')[0]);
const csv = readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  if (field || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }
  return rows;
}

function readGroups(rows) {
  const groups = [];
  let current = null;
  for (const row of rows) {
    const first = (row[0] ?? '').trim();
    if (first.toLocaleLowerCase('en') === 'youtube') {
      if (current) groups.push(current);
      current = { rows: [], name: null };
    } else if (first === 'ลำดับ') {
      continue;
    } else if (current && /^\d+$/.test(first)) {
      current.rows.push(row);
    } else if (current && !current.name) {
      current.name = row.map((cell) => cell.trim()).find(Boolean) ?? null;
    }
  }
  if (current) groups.push(current);
  if (!groups.length) throw new Error('No YouTube data blocks were found in the CSV.');
  return groups;
}

function parseMonths(value) {
  const match = value.match(/(\d+)\s*เดือน/);
  return match ? Number(match[1]) : null;
}

function parseSatang(value) {
  const normalized = value.replace(/[฿,\s]/g, '');
  if (!normalized) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`Invalid price value: ${value}`);
  return Math.round(amount * 100);
}

function parseDueDay(rows) {
  const days = [...new Set(rows.map((row) => (row[7] ?? '').trim()).filter(Boolean))];
  if (days.length !== 1 || !/^\d+$/.test(days[0])) return null;
  const day = Number(days[0]);
  return day >= 1 && day <= 31 ? day : null;
}

const parsedGroups = readGroups(parseCsv(csv)).map((group, groupIndex) => {
  const groupNumber = groupIndex + 1;
  const sourceRows = new Map(group.rows.map((row) => [Number(row[0]), row]));
  if ([...sourceRows.keys()].some((position) => position < 1 || position > 6)) {
    throw new Error(`Group ${groupNumber} has a slot number outside 1–6.`);
  }
  if (sourceRows.size !== group.rows.length) throw new Error(`Group ${groupNumber} has duplicate slot numbers.`);
  const dueDay = parseDueDay(group.rows);
  const seats = Array.from({ length: 6 }, (_, index) => {
    const position = index + 1;
    const row = sourceRows.get(position) ?? [];
    const cell = (column) => (row[column] ?? '').trim() || null;
    return {
      position,
      sourceRowKey: `youtube-csv-group-${groupNumber}-slot-${position}`,
      displayName: cell(1),
      email: cell(2),
      contactMethod: cell(3),
      billingMonths: parseMonths(cell(4) ?? ''),
      sourceStatus: cell(5),
      priceSatang: parseSatang(cell(6) ?? ''),
    };
  });
  const isComplete = dueDay !== null && seats.every((seat) => seat.billingMonths !== null && seat.priceSatang !== null && seat.sourceStatus === 'ใช้งาน');
  return {
    importKey: `youtube-csv-group-${groupNumber}`,
    name: group.name ?? `กลุ่ม YouTube ${groupNumber} (ยังไม่ระบุชื่อ)`,
    dueDay,
    status: isComplete ? 'ACTIVE' : 'DRAFT',
    seats,
  };
});

const db = new Database(databasePath, { fileMustExist: true });
db.pragma('foreign_keys = ON');
const now = new Date().toISOString();
const upsertGroup = db.prepare(`
  INSERT INTO "YoutubeBillingGroup" ("id", "importKey", "name", "dueDay", "status", "createdAt", "updatedAt")
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT ("importKey") DO UPDATE SET
    "name" = excluded."name", "dueDay" = excluded."dueDay", "status" = excluded."status", "updatedAt" = excluded."updatedAt"
`);
const getGroupId = db.prepare('SELECT "id" FROM "YoutubeBillingGroup" WHERE "importKey" = ?');
const upsertSeat = db.prepare(`
  INSERT INTO "YoutubeBillingSeat" (
    "id", "groupId", "position", "sourceRowKey", "displayName", "email", "contactMethod",
    "billingMonths", "sourceStatus", "priceSatang", "paymentStatus", "createdAt", "updatedAt"
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNRECORDED', ?, ?)
  ON CONFLICT ("sourceRowKey") DO UPDATE SET
    "groupId" = excluded."groupId", "position" = excluded."position", "displayName" = excluded."displayName",
    "email" = excluded."email", "contactMethod" = excluded."contactMethod", "billingMonths" = excluded."billingMonths",
    "sourceStatus" = excluded."sourceStatus", "priceSatang" = excluded."priceSatang", "updatedAt" = excluded."updatedAt"
`);

try {
  db.transaction(() => {
    for (const group of parsedGroups) {
      upsertGroup.run(randomUUID(), group.importKey, group.name, group.dueDay, group.status, now, now);
      const groupId = getGroupId.get(group.importKey)?.id;
      if (!groupId) throw new Error(`Could not load imported group ${group.importKey}.`);
      for (const seat of group.seats) {
        upsertSeat.run(
          randomUUID(), groupId, seat.position, seat.sourceRowKey, seat.displayName, seat.email,
          seat.contactMethod, seat.billingMonths, seat.sourceStatus, seat.priceSatang, now, now,
        );
      }
    }
  })();
  if (db.pragma('foreign_key_check').length) throw new Error('Foreign-key validation failed after import.');
  const importedSeats = db.prepare(`
    SELECT COUNT(*) AS count FROM "YoutubeBillingSeat" WHERE "sourceRowKey" LIKE 'youtube-csv-group-%'
  `).get().count;
  const namedSeats = db.prepare(`
    SELECT COUNT(*) AS count FROM "YoutubeBillingSeat" WHERE "sourceRowKey" LIKE 'youtube-csv-group-%' AND ("displayName" IS NOT NULL OR "email" IS NOT NULL)
  `).get().count;
  console.log(`Imported ${parsedGroups.length} groups and ${importedSeats} slots (${namedSeats} with a name or email). Re-importing this file updates these source slots without duplicating them.`);
} finally {
  db.close();
}
