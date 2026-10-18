import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const db = new Database(path.resolve((process.env.DATABASE_URL || 'file:./prisma/dev.db').replace(/^file:/, '').split('?')[0]));
const completedMarker = path.resolve('storage/backups/contract-files-completed.json');
if (fs.existsSync(completedMarker)) throw new Error('File migration already completed; refusing to rename twice');
const contracts = db.prepare('SELECT * FROM Contract WHERE previousContractNumber IS NOT NULL').all();
const compact = value => value.replace(/[^A-Za-z0-9ก-๛]/g, '');
const plans = [];
const roots = ['contract-attachments', 'contract-signatures', 'repayment-evidence'];
function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : entry.isFile() ? [file] : [];
  });
}
for (const area of roots) {
  for (const file of walk(path.resolve('storage', area))) {
    const name = path.basename(file);
    const matches = contracts.filter(c => name.includes(`-${compact(c.previousContractNumber)}-`));
    if (matches.length !== 1) continue;
    const contract = matches[0];
    const next = path.join(path.dirname(file), name.replace(`-${compact(contract.previousContractNumber)}-`, `-${compact(contract.contractNumber)}-`));
    if (next !== file) plans.push({ file, next, area, contractId: contract.id, local: true });
  }
}
const driveRoot = '/Users/ohmz/Library/CloudStorage/GoogleDrive-pol.occib@gmail.com/ไดรฟ์ของฉัน/OBN Co., Ltd./L-OBN Co., Ltd./2026';
for (const file of walk(driveRoot)) {
  const contract = contracts.find(c => path.parse(file).name === c.previousContractNumber);
  if (contract) plans.push({ file, next: path.join(path.dirname(file), contract.contractNumber + path.extname(file)), contractId: contract.id, local: false });
}
for (const plan of plans) if (fs.existsSync(plan.next)) throw new Error(`Destination already exists: ${plan.next}`);
if (new Set(plans.map(p => p.next)).size !== plans.length) throw new Error('Duplicate destinations');
if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ local: plans.filter(p => p.local).length, drive: plans.filter(p => !p.local).length, files: plans.map(p => ({ from: path.basename(p.file), to: path.basename(p.next) })) }, null, 2));
  db.close(); process.exit(0);
}
const backup = path.resolve('storage/backups', `contract-files-${Date.now()}`);
fs.mkdirSync(path.join(backup, 'files'), { recursive: true });
await db.backup(path.join(backup, 'database.db'));
fs.writeFileSync(path.join(backup, 'mapping.json'), JSON.stringify(plans, null, 2), { mode: 0o600 });
plans.forEach((p, i) => fs.copyFileSync(p.file, path.join(backup, 'files', String(i) + path.extname(p.file))));
function replaceUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('/api/')) return value;
  const parsed = new URL(value, 'http://local.invalid');
  const filename = decodeURIComponent(parsed.pathname.split('/').pop());
  const prefix = parsed.pathname.slice(0, parsed.pathname.lastIndexOf('/'));
  const areas = { '/api/contracts/attachments': 'contract-attachments', '/api/contracts/signatures': 'contract-signatures', '/api/repayments/evidence': 'repayment-evidence' };
  const plan = plans.find(p => p.local && p.area === areas[prefix] && path.basename(p.file) === filename && path.basename(path.dirname(p.file)) === parsed.searchParams.get('folder'));
  return plan ? `${prefix}/${encodeURIComponent(path.basename(plan.next))}${parsed.search}` : value;
}
function rewrite(value, contract) {
  if (typeof value === 'string') return replaceUrl(value);
  if (Array.isArray(value)) return value.map(v => rewrite(v, contract));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, key === 'name' && typeof v === 'string' ? v.replaceAll(contract.previousContractNumber, contract.contractNumber) : rewrite(v, contract)]));
  return value;
}
const renamed = [];
try {
  for (const plan of plans) {
    fs.renameSync(plan.file, plan.next);
    renamed.push(plan);
    // Historical saved links remain usable, while current records use the new name.
    if (plan.local) fs.symlinkSync(path.basename(plan.next), plan.file);
  }
  db.transaction(() => {
    for (const contract of contracts) {
      const documentData = contract.documentData ? JSON.stringify(rewrite(JSON.parse(contract.documentData), contract)) : contract.documentData;
      db.prepare('UPDATE Contract SET documentData=?,signatureUrl=?,documentUrl=? WHERE id=?').run(documentData, replaceUrl(contract.signatureUrl), replaceUrl(contract.documentUrl), contract.id);
    }
    for (const repayment of db.prepare('SELECT id,evidenceUrl FROM Repayment WHERE evidenceUrl IS NOT NULL').all()) {
      db.prepare('UPDATE Repayment SET evidenceUrl=? WHERE id=?').run(replaceUrl(repayment.evidenceUrl), repayment.id);
    }
  })();
} catch (error) {
  for (const plan of renamed.reverse()) {
    if (plan.local && fs.existsSync(plan.file) && fs.lstatSync(plan.file).isSymbolicLink()) fs.unlinkSync(plan.file);
    fs.renameSync(plan.next, plan.file);
  }
  throw error;
}
fs.writeFileSync(completedMarker, JSON.stringify({ backup, completedAt: new Date().toISOString() }), { mode: 0o600 });
console.log(JSON.stringify({ localRenamed: plans.filter(p => p.local).length, driveRenamed: plans.filter(p => !p.local).length, backup }));
db.close();
