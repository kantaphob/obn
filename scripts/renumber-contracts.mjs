import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

const db=new Database(path.resolve((process.env.DATABASE_URL||'file:./prisma/dev.db').replace(/^file:/,'').split('?')[0]));
db.pragma('foreign_keys = ON');
const contracts=db.prepare('SELECT id,debtorId,contractNumber,previousContractNumber,startDate FROM Contract').all();
if(contracts.length!==17)throw new Error('Expected the 17 reviewed contracts; review mapping before applying to a different data set');
if(contracts.some(contract=>contract.previousContractNumber))throw new Error('Contracts already renumbered; refusing a second renumber');
contracts.sort((a,b)=>new Date(a.startDate).getTime()-new Date(b.startDate).getTime()||a.contractNumber.localeCompare(b.contractNumber));
const counters=new Map();
const mapping=contracts.map(contract=>{
 const year=Number(new Intl.DateTimeFormat('en',{timeZone:'Asia/Bangkok',year:'numeric'}).format(new Date(contract.startDate)));
 const number=(counters.get(year)||0)+1;counters.set(year,number);
 return {...contract,newNumber:`LN-${year}-${String(number).padStart(5,'0')}`};
});
if(!process.argv.includes('--apply')){console.log(JSON.stringify(mapping.map(({contractNumber,newNumber,startDate})=>({old:contractNumber,new:newNumber,date:startDate})),null,2));db.close();process.exit(0);}
mkdirSync('storage/backups',{recursive:true});
const stamp=Date.now();
await db.backup(`storage/backups/contract-renumber-${stamp}.db`);
writeFileSync(`storage/backups/contract-renumber-map-${stamp}.json`,JSON.stringify(mapping,null,2),{mode:0o600});
const now=new Date().toISOString();
const beforeMoney=db.prepare('SELECT id,principal,interestAmount,netDisbursed,startDate,dueDate,status FROM Contract ORDER BY id').all();
const beforePayments=db.prepare('SELECT * FROM Payment ORDER BY id').all();
const beforeRepayments=db.prepare('SELECT * FROM Repayment ORDER BY id').all();
const ledger=db.prepare('SELECT id,party FROM CompanyLedgerEntry').all();
let linkedEntries=0;
db.transaction(()=>{
 for(const row of mapping)db.prepare('UPDATE Contract SET contractNumber=? WHERE id=?').run(`__RENUMBER__${row.id}`,row.id);
 for(const row of mapping){
  db.prepare('UPDATE Contract SET contractNumber=?,previousContractNumber=?,renumberedAt=?,updatedAt=? WHERE id=?').run(row.newNumber,row.contractNumber,now,now,row.id);
  db.prepare('INSERT INTO loanlogs (id,userId,borrowerId,contractId,targetId,action,type,note,beforeData,afterData,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),'guest',row.debtorId,row.id,row.id,'UPDATE','CONTRACT','จัดเลขสัญญาใหม่ตามวันที่เริ่มสัญญา',JSON.stringify({contractNumber:row.contractNumber}),JSON.stringify({contractNumber:row.newNumber,previousContractNumber:row.contractNumber}),now);
 }
 for(const entry of ledger){
  const row=mapping.find(item=>entry.party===item.contractNumber||entry.party.startsWith(`${item.contractNumber} · `));
  if(row){db.prepare('UPDATE CompanyLedgerEntry SET party=?,updatedAt=? WHERE id=?').run(row.newNumber+entry.party.slice(row.contractNumber.length),now,entry.id);linkedEntries++;}
 }
 for(const [year,lastNumber] of counters)db.prepare('INSERT INTO ContractNumberSequence (year,lastNumber,updatedAt) VALUES (?,?,?) ON CONFLICT(year) DO UPDATE SET lastNumber=excluded.lastNumber,updatedAt=excluded.updatedAt').run(year,lastNumber,now);
 const afterMoney=db.prepare('SELECT id,principal,interestAmount,netDisbursed,startDate,dueDate,status FROM Contract ORDER BY id').all();
 if(JSON.stringify(beforeMoney)!==JSON.stringify(afterMoney))throw new Error('Contract balance or terms changed');
 if(JSON.stringify(beforePayments)!==JSON.stringify(db.prepare('SELECT * FROM Payment ORDER BY id').all()))throw new Error('Payment history changed');
 if(JSON.stringify(beforeRepayments)!==JSON.stringify(db.prepare('SELECT * FROM Repayment ORDER BY id').all()))throw new Error('Repayment history changed');
 if(db.pragma('foreign_key_check').length)throw new Error('Broken foreign keys');
})();
console.log(JSON.stringify({renumbered:mapping.length,linkedLedgerEntries:linkedEntries,nextNumber:`LN-2026-${String(counters.get(2026)+1).padStart(5,'0')}`,unchangedMoneyAndPayments:true}));
db.close();
