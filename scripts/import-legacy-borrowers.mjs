import 'dotenv/config'
import Database from 'better-sqlite3'
import { readFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const source = process.argv[2]
if (!source) throw new Error('Usage: node scripts/import-legacy-borrowers.mjs <local-json-file>')
const rows = JSON.parse(readFileSync(source, 'utf8'))
if (!Array.isArray(rows) || rows.some(row => !/^CM\d{3}$/.test(row.id)) || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Invalid or duplicate borrower ID')
const url = process.env.DATABASE_URL
if (!url?.startsWith('file:')) throw new Error('SQLite DATABASE_URL required')
const db = new Database(url.slice(5), { fileMustExist: true })
const columns = ['id','nickname','firstName','lastName','phone','nationalId','workplace','status','bankAccountNumber','payoutChannel','payoutBankCode','registeredAt','hasFacebook','hasInstagram','hasLine','riskRating','approvedLimit','usedLimit','availableLimit','referrer']
try {
  mkdirSync('storage/backups', {recursive:true})
  await db.backup(path.join('storage/backups', `borrowers-before-import-${Date.now()}.db`))
  const insert = db.prepare(`INSERT INTO borrowers (${columns.join(',')},borrowersCode,createdAt,updatedAt) VALUES (${columns.map(()=>'?').join(',')},?,?,?) ON CONFLICT(id) DO NOTHING`)
  const count = db.transaction(() => rows.reduce((count,row) => {
    if (db.prepare('SELECT id FROM borrowers WHERE id = ?').get(row.id)) return count
    const sequence = db.prepare('UPDATE BorrowerCodeSequence SET value = value + 1 WHERE id = 1 RETURNING value').get()
    if (!sequence || sequence.value > 999999) throw new Error('Borrower code limit reached')
    const borrowersCode = `bo${String(sequence.value).padStart(6, '0')}`
    const data = columns.map(key => {
      const value = row[key] ?? null
      if (key === 'payoutBankCode') return ['K-Bank','KBANK'].includes(row.payoutChannel) ? '004' : row.payoutChannel === 'SCB' ? '014' : value
      if (key === 'status') {
        const mapped = { 'รอส่งคืน': 'PENDING_REPAYMENT', 'พิจารณา': 'UNDER_REVIEW', 'ปิดยอด': 'CLOSED' }[value] ?? value
        if (mapped !== null && !['PENDING_REPAYMENT', 'UNDER_REVIEW', 'CLOSED'].includes(mapped)) throw new Error('Invalid status')
        return mapped
      }
      if (key === 'payoutChannel') {
        const mapped = { PP: 'PROMPTPAY', 'K-Bank': 'BANK_TRANSFER', KBANK: 'BANK_TRANSFER', SCB: 'BANK_TRANSFER' }[value] ?? value
        if (mapped !== null && !['PROMPTPAY', 'BANK_TRANSFER'].includes(mapped)) throw new Error('Invalid payoutChannel')
        return mapped
      }
      if (key === 'riskRating' && value !== null && !['SS','S','A','B','C','D'].includes(value)) throw new Error('Invalid riskRating')
      if (key === 'firstName' || key === 'phone') return value ?? ''
      if (['hasFacebook','hasInstagram','hasLine'].includes(key)) {
        if (value !== null && typeof value !== 'boolean') throw new Error(`Invalid ${key}`)
        return value === null ? null : Number(value)
      }
      if (['approvedLimit','usedLimit','availableLimit'].includes(key)) {
        if (value === null) return null
        if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value*100))) throw new Error(`Invalid ${key}`)
        return Math.round(value*100)
      }
      if (key === 'registeredAt') {
        if (value === null) return null
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Use ISO date for registeredAt')
        const timestamp = Date.parse(`${value}T00:00:00+07:00`)
        if (!Number.isFinite(timestamp)) throw new Error('Invalid registration date')
        return timestamp
      }
      return value
    })
    const now = Date.now()
    return count + insert.run(...data,borrowersCode,now,now).changes
  },0))()
  console.log(`Imported ${count}; retained ${rows.length-count} existing records. IDs: ${rows.map(row=>row.id).join(', ')}`)
} finally { db.close() }
