'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { FileText, Paperclip, RefreshCw, Search, UserRound, X, ChevronDown, CircleCheck, Clock3, CircleAlert, Circle } from 'lucide-react';
import '@/app/dashboard/loan/payment-history/payment-history.css';
import { useTrackedFetch } from '@/components/ui/ToastProvider';
import LoanReceipt from '@/components/loan/LoanReceipt';
import { formatBorrowerCode } from '@/lib/borrower-code';

type Receipt = {
  id: string;
  receiptNumber: string;
  reversedAt?: string | null;
  paidAt: string;
  timeRecorded: boolean;
  createdAt: string;
  amount: number;
  interestPaid: number;
  penaltyPaid: number;
  principalPaid: number;
  principalRemaining: number;
  interestRemaining: number;
  penaltyRemaining: number;
  totalRemaining: number;
  method: string;
  evidenceUrl: string | null;
  note: string | null;
};

type LegacyPayment = {
  id: string;
  title: string;
  amount: number;
  transactionDate: string;
  reference: string;
  note: string;
};

type Contract = {
  previousContractNumber?:string|null;
  requestNumber?:string|null;losNumber?:string|null;requestType?:string|null;
  id: string;
  contractNumber: string;
  status: string;
  dueDate?: string | null;
  principal?:number;interestRate?:number;interestAmount?:number;netDisbursed?:number;startDate?:string;signedAt?:string|null;documentData?:string|null;createdAt?:string;updatedAt?:string;
  balance?: { total: number };
  receiptBranch: { name: string; companyName: string; taxId: string; address: string; phone: string } | null;
  repayments: Receipt[];
  legacyPayments: LegacyPayment[];
  debtor: {
    borrowersCode: string;
    firstName: string;
    lastName: string | null;
    nickname: string | null;
    address: string | null;
    houseNumber: string | null;
    phone?:string|null;
  };
};

type Entry = {
  id: string;
  contractNumber: string;
  date: string;
  timeRecorded: boolean;
  title: string;
  amount: number;
  receipt: Receipt | null;
  reference: string;
};

const TZ = 'Asia/Bangkok';
const baht = (value: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(value / 100);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dateLabel = (value: string) => new Intl.DateTimeFormat('th-TH', { timeZone: TZ, dateStyle: 'medium' }).format(new Date(value));
const timeLabel = (value: string) => new Intl.DateTimeFormat('th-TH', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
const monthKey = (value: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' }).format(new Date(value));
const monthTitle = (value: string) => new Intl.DateTimeFormat('th-TH', { timeZone: TZ, month: 'long', year: 'numeric' }).format(new Date(value));
const borrowerName = (contract: Contract) =>
  [contract.debtor.firstName, contract.debtor.lastName].filter(Boolean).join(' ') || contract.debtor.nickname || 'ไม่ระบุชื่อ';

function currentContractStatus(contract?:Contract) {
  if(contract?.status==='CLOSED')return {label:'ปิดสัญญา',Icon:CircleCheck,color:'#288453',background:'#eaf6ee'};
  if(contract?.status==='OVERDUE' || (contract?.status==='ACTIVE' && contract.dueDate && new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(contract.dueDate))<today() && (contract.balance?.total??1)>0))return {label:'เกินกำหนด',Icon:CircleAlert,color:'#b74455',background:'#fceef0'};
  if(contract?.status==='ACTIVE')return {label:'รอชำระคืน',Icon:Clock3,color:'#3477ac',background:'#edf4fc'};
  if(contract?.status==='RESERVED')return {label:'จองสัญญา',Icon:Clock3,color:'#936a16',background:'#fff6df'};
  if(contract?.status==='READY')return {label:'พร้อมจ่ายเงิน',Icon:Circle,color:'#367ca3',background:'#eaf4fb'};
  if(contract?.status==='AWAITING_DOCUMENT')return {label:'รอเอกสารลงนาม',Icon:Clock3,color:'#7c5b9d',background:'#f3edf9'};
  return {label:contract?.status==='DRAFT'?'ร่าง':'ไม่ระบุสถานะ',Icon:Circle,color:'#727985',background:'#f0f2f5'};
}

export default function PaymentHistory({ onReceivePayment, revision = 0 }: {
  onReceivePayment?: (borrowerCode: string, contractId?: string) => void;
  revision?: number;
}) {
  const trackedFetch = useTrackedFetch();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [borrowerDialog, setBorrowerDialog] = useState(false);
  const [contractFilter, setContractFilter] = useState('');
  const [openId, setOpenId] = useState('');
  const [preview, setPreview] = useState<{ receipt: Receipt; contract: Contract } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await trackedFetch(`/api/repayments?date=${today()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'โหลดประวัติไม่สำเร็จ');
      setContracts(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดประวัติไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [trackedFetch]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, revision]);

  useEffect(() => {
    if (!preview && !borrowerDialog) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (preview) setPreview(null);
      else setBorrowerDialog(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview, borrowerDialog]);

  const borrowers = useMemo(() => {
    const byCode = new Map<string, { sample: Contract; count: number }>();
    for (const contract of contracts) {
      const code = contract.debtor.borrowersCode;
      const found = byCode.get(code);
      if (found) found.count += 1;
      else byCode.set(code, { sample: contract, count: 1 });
    }
    return [...byCode.values()];
  }, [contracts]);

  const needle = query.trim().toLocaleLowerCase('th-TH');
  const filteredBorrowers = borrowers.filter(({ sample }) =>
    `${sample.debtor.borrowersCode} ${sample.debtor.firstName} ${sample.debtor.lastName || ''} ${sample.debtor.nickname || ''}`
      .toLocaleLowerCase('th-TH')
      .includes(needle) || contracts.some(contract=>contract.debtor.borrowersCode===sample.debtor.borrowersCode && `${contract.contractNumber} ${contract.previousContractNumber||''} ${contract.requestNumber||''} ${contract.losNumber||''} ${contract.debtor.phone||''}`.toLocaleLowerCase('th-TH').includes(needle)),
  );

  const activeCode = selectedCode;
  const selected = filteredBorrowers.find(({ sample }) => sample.debtor.borrowersCode === activeCode)?.sample;
  const borrowerContracts = contracts.filter(contract => contract.debtor.borrowersCode === activeCode);


  const entries = (() => {
    const list: Entry[] = borrowerContracts
      .filter((contract) => !contractFilter || contract.contractNumber === contractFilter)
      .flatMap((contract): Entry[] => [
        ...contract.repayments.filter(receipt => !receipt.reversedAt).map((receipt) => ({
          id: receipt.id,
          contractNumber: contract.contractNumber,
          date: receipt.paidAt,
          timeRecorded: receipt.timeRecorded,
          title: receipt.receiptNumber,
          amount: receipt.amount,
          receipt,
          reference: receipt.note?.match(/เลขสลิปเดิม:\s*(\S+)/)?.[1] || receipt.receiptNumber,
        })),
        ...(contract.legacyPayments || []).map((entry) => ({
          id: entry.id,
          contractNumber: contract.contractNumber,
          date: entry.transactionDate,
          timeRecorded: false,
          title: entry.title,
          amount: entry.amount,
          receipt: null,
          reference: entry.reference || '',
        })),
      ]);
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || a.id.localeCompare(b.id));
  })();

  const groups = (() => {
    const map = new Map<string, { label: string; total: number; items: Entry[] }>();
    for (const entry of entries) {
      const key = monthKey(entry.date);
      const group = map.get(key) ?? { label: monthTitle(entry.date), total: 0, items: [] };
      group.total += entry.amount;
      group.items.push(entry);
      map.set(key, group);
    }
    return [...map.entries()];
  })();

  const totalPaid = entries.reduce((sum, entry) => sum + entry.amount, 0);

  const pickBorrower = (code: string) => {
    setSelectedCode(code);
    setContractFilter('');
    setOpenId('');
    setPreview(null);
    setBorrowerDialog(false);
  };

  return (
    <section className="ph-page" aria-label="ประวัติการชำระ">
      <header className="ph-header">
        <div>
          <h1>รับชำระและประวัติ</h1>
          <p>ค้นหาผู้กู้ ดูประวัติรับชำระ และบันทึกรับเงินได้ในหน้าเดียว</p>
        </div>
        <div className="ph-actions">
          {onReceivePayment ? <button type="button" disabled={loading || !selected} className="ph-btn ph-btn-primary" onClick={() => onReceivePayment(selected!.debtor.borrowersCode, borrowerContracts.find(contract => contract.contractNumber === contractFilter)?.id)}>รับชำระ</button> : <Link href="/dashboard/loan/payments" className="ph-btn ph-btn-primary">รับชำระ</Link>}
          <button type="button" className="ph-btn" disabled={loading} onClick={() => void load()}>
            <RefreshCw size={16} className={loading ? 'ph-spin' : ''} /> โหลดใหม่
          </button>
        </div>
      </header>

      {error && <p className="ph-error" role="alert">{error}</p>}

      <div className="ph-layout">
        {/* ซ้าย: รายชื่อผู้กู้ */}
        <aside className="ph-borrowers" aria-label="รายชื่อผู้กู้">
          <label className="ph-search">
            <Search size={17} aria-hidden />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedCode('');
                setBorrowerDialog(false);
                setContractFilter('');
                setOpenId('');
                setPreview(null);
              }}
              placeholder="ค้นหาชื่อหรือรหัสผู้กู้"
              aria-label="ค้นหาผู้กู้"
            />
          </label>
          <p className="ph-count">{loading ? 'กำลังโหลด…' : `${filteredBorrowers.length.toLocaleString('th-TH')} จาก ${borrowers.length.toLocaleString('th-TH')} ผู้กู้`}</p>
          <ul>
            {filteredBorrowers.map(({ sample, count }) => {
              const active = sample.debtor.borrowersCode === activeCode;
              return (
                <li key={sample.debtor.borrowersCode}>
                  <button type="button" className={active ? 'is-active' : ''} aria-pressed={active} onClick={() => pickBorrower(sample.debtor.borrowersCode)}>
                    <span className="ph-avatar" aria-hidden>{(sample.debtor.firstName || '?').slice(0, 1)}</span>
                    <span className="ph-borrower-text">
                      <strong>{borrowerName(sample)}</strong>
                      <small>{formatBorrowerCode(sample.debtor.borrowersCode)} · {count} สัญญา</small>
                    </span>
                  </button>
                </li>
              );
            })}
            {!loading && filteredBorrowers.length === 0 && <li className="ph-none">ไม่พบผู้กู้ที่ตรงกับ “{query}”</li>}
          </ul>
        </aside>

        {selected ? (
          <section className="ph-borrower-overview" aria-label="ภาพรวมผู้กู้ที่เลือก" style={{minWidth:0,alignSelf:'start',padding:24,border:'1px solid var(--ph-line, #e6dcf1)',borderRadius:20,background:'var(--ph-surface, #fff)'}}>
            <header style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16,flexWrap:'wrap'}}>
              <div style={{display:'flex',alignItems:'center',gap:12,minWidth:0}}>
                <span className="ph-avatar" aria-hidden style={{display:'grid',placeItems:'center',width:46,height:46,flex:'none',borderRadius:'50%',background:'var(--ph-green-soft, #e6f2ea)',color:'var(--ph-green, #3b7a57)',fontWeight:700}}>{(selected.debtor.firstName || '?').slice(0, 1)}</span>
                <div style={{minWidth:0}}><h2 style={{margin:0,fontSize:'1.35rem',lineHeight:1.35}}>{borrowerName(selected)}</h2><p style={{margin:'3px 0 0',color:'var(--ph-muted, #85759a)'}}>รหัส {formatBorrowerCode(selected.debtor.borrowersCode)}</p></div>
              </div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <button type="button" className="ph-btn ph-btn-sm" onClick={() => {setContractFilter('');setBorrowerDialog(true);}}><FileText size={15}/> ดูสัญญาและประวัติ</button>
                {onReceivePayment && <button type="button" className="ph-btn ph-btn-sm ph-btn-primary" onClick={() => onReceivePayment(selected.debtor.borrowersCode)}>รับชำระ</button>}
              </div>
            </header>

            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',gap:12,marginTop:22}}>
              <div style={{padding:16,border:'1px solid var(--ph-line, #e6dcf1)',borderRadius:14}}><span style={{display:'block',color:'var(--ph-muted, #85759a)',fontSize:'.88rem'}}>รับชำระรวม</span><strong style={{display:'block',marginTop:5,color:'var(--ph-green, #3b7a57)',fontSize:'1.3rem'}}>{baht(totalPaid)}</strong></div>
              <div style={{padding:16,border:'1px solid var(--ph-line, #e6dcf1)',borderRadius:14}}><span style={{display:'block',color:'var(--ph-muted, #85759a)',fontSize:'.88rem'}}>รายการรับชำระ</span><strong style={{display:'block',marginTop:5,fontSize:'1.3rem'}}>{entries.length.toLocaleString('th-TH')} รายการ</strong></div>
              <div style={{padding:16,border:'1px solid var(--ph-line, #e6dcf1)',borderRadius:14}}><span style={{display:'block',color:'var(--ph-muted, #85759a)',fontSize:'.88rem'}}>จำนวนสัญญา</span><strong style={{display:'block',marginTop:5,fontSize:'1.3rem'}}>{borrowerContracts.length.toLocaleString('th-TH')} สัญญา</strong></div>
            </div>

            <section aria-label="สัญญาของผู้กู้" style={{marginTop:24}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:10}}>
                <h3 style={{margin:0,fontSize:'1.05rem'}}>สัญญาของผู้กู้</h3>
                <button type="button" className="ph-btn ph-btn-sm" onClick={() => {setContractFilter('');setBorrowerDialog(true);}}>ดูรายละเอียดทั้งหมด</button>
              </div>
              <ul style={{display:'grid',gap:8,margin:0,padding:0,listStyle:'none'}}>
                {borrowerContracts.map((contract) => {
                  const status = currentContractStatus(contract);
                  const StatusIcon = status.Icon;
                  return (
                    <li key={contract.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:14,flexWrap:'wrap',padding:'13px 15px',border:'1px solid var(--ph-line, #e6dcf1)',borderRadius:13,background:'var(--ws-surface, #fff)'}}>
                      <div style={{display:'grid',gap:5,minWidth:0}}>
                        <strong style={{overflowWrap:'anywhere'}}>สัญญา {contract.contractNumber}</strong>
                        <span style={{display:'flex',alignItems:'center',gap:6,color:status.color,fontSize:'.88rem'}}><StatusIcon size={15}/>{status.label}<span style={{color:'var(--ph-muted, #85759a)'}}>· คงเหลือ {baht(contract.balance?.total ?? 0)}</span></span>
                      </div>
                      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                        <button type="button" className="ph-btn ph-btn-sm" onClick={() => {setContractFilter(contract.contractNumber);setOpenId('');setBorrowerDialog(true);}}>ดูประวัติ</button>
                        {onReceivePayment && ['ACTIVE','OVERDUE'].includes(contract.status) && <button type="button" className="ph-btn ph-btn-sm ph-btn-primary" onClick={() => onReceivePayment(contract.debtor.borrowersCode,contract.id)}>รับชำระ</button>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <div style={{marginTop:24}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:10}}><h3 style={{margin:0,fontSize:'1.05rem'}}>รายการรับชำระล่าสุด</h3>{entries.length > 3 && <button type="button" className="ph-btn ph-btn-sm" onClick={() => {setContractFilter('');setBorrowerDialog(true);}}>ดูทั้งหมด</button>}</div>
              {entries.length === 0 ? <p className="ph-none-detail" style={{margin:0,padding:'24px 12px',border:'1px dashed var(--ph-line, #e6dcf1)',borderRadius:14}}>ยังไม่มีประวัติรับชำระของผู้กู้รายนี้</p> : (
                <ul style={{display:'grid',gap:8,margin:0,padding:0,listStyle:'none'}}>
                  {entries.slice(0, 3).map((entry) => (
                    <li key={`${entry.contractNumber}-${entry.id}`}>
                      <button type="button" onClick={() => {setContractFilter(entry.contractNumber);setOpenId('');setBorrowerDialog(true);}} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,width:'100%',padding:'13px 15px',border:'1px solid var(--ph-line, #e6dcf1)',borderRadius:13,background:'var(--ws-surface, #fff)',textAlign:'left'}}>
                        <span style={{display:'grid',gap:3,minWidth:0}}><strong style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>สัญญา {entry.contractNumber}</strong><small style={{color:'var(--ph-muted, #85759a)'}}>{dateLabel(entry.date)} · {entry.title}</small></span>
                        <strong style={{flex:'none',fontVariantNumeric:'tabular-nums'}}>{baht(entry.amount)}</strong>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ) : (
          <div className="ph-empty ph-pick-hint">
            <UserRound size={34} aria-hidden />
            <h2>ค้นหาแล้วเลือกผู้กู้</h2>
            <p>ช่องนี้จะแสดงยอดรับชำระ สัญญา และรายการล่าสุดของผู้กู้</p>
          </div>
        )}
      </div>

      {borrowerDialog && selected && (
        <div className="ph-modal ph-borrower-modal" role="dialog" aria-modal="true" aria-label={`ข้อมูลผู้กู้ ${borrowerName(selected)}`} onClick={() => setBorrowerDialog(false)}>
          <article className="ph-borrower-dialog" style={{position:'relative',display:'flex',flexDirection:'column',width:'min(1080px, 100%)',maxHeight:'min(90vh, 980px)',overflow:'hidden',border:'1px solid var(--ph-line, #e6dcf1)',borderRadius:22,background:'var(--ph-bg, #f8f3fd)',boxShadow:'0 24px 80px rgba(35,24,50,.2)'}} onClick={(event) => event.stopPropagation()}>
            <header className="ph-dialog-header" style={{position:'relative',display:'flex',alignItems:'center',justifyContent:'space-between',gap:20,padding:'22px 28px',borderBottom:'1px solid var(--ph-line, #e6dcf1)',background:'var(--ph-surface, #fff)'}}>
              <div><span style={{color:'var(--ph-muted, #85759a)',fontSize:'.88rem'}}>ข้อมูลผู้กู้</span><h2 style={{margin:'3px 0',fontSize:'1.5rem',lineHeight:1.35}}>{borrowerName(selected)}</h2><p style={{margin:0,color:'var(--ph-muted, #85759a)'}}>รหัส {formatBorrowerCode(selected.debtor.borrowersCode)}</p></div>
              <button type="button" className="ph-close ph-dialog-close" style={{position:'static',flex:'none',width:42,height:42}} aria-label="ปิดรายละเอียดผู้กู้" onClick={() => setBorrowerDialog(false)}><X size={20} /></button>
            </header>
        <section className="ph-detail" style={{display:'grid',gap:20,minHeight:0,overflowY:'auto',padding:'24px 28px 30px'}}>
          {!selected && (
            <div className="ph-empty">
              <UserRound size={34} aria-hidden />
              <h2>เลือกผู้กู้เพื่อดูประวัติ</h2>
              <p>เลือกชื่อจากรายการทางซ้าย แล้วรายการรับชำระทุกสัญญาจะแสดงที่นี่</p>
            </div>
          )}

          {selected && (
            <>
              <div className="ph-summary" style={{padding:'18px 22px'}}>
                <dl>
                  <div><dt>รับชำระรวม</dt><dd>{baht(totalPaid)}</dd></div>
                  <div><dt>จำนวนรายการ</dt><dd>{entries.length.toLocaleString('th-TH')}</dd></div>
                  <div><dt>ชำระล่าสุด</dt><dd>{entries[0] ? dateLabel(entries[0].date) : '—'}</dd></div>
                </dl>
              </div>

              <section className="ph-contracts" style={{minWidth:0,padding:18,border:'1px solid var(--ph-line, #e6dcf1)',borderRadius:18,background:'var(--ph-surface, #fff)'}} aria-label="รายการสัญญาของผู้กู้">
                <div className="ph-contracts-heading" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,marginBottom:14}}>
                  <div><h3 style={{margin:0,fontSize:'1.05rem'}}>สัญญาของผู้กู้</h3><p style={{margin:'3px 0 0',color:'var(--ph-muted, #85759a)',fontSize:'.9rem'}}>เลือกดูประวัติ หรือบันทึกรับชำระตามสัญญา</p></div>
                  {contractFilter && <button type="button" className="ph-btn ph-btn-sm" onClick={() => setContractFilter('')}>ดูทุกสัญญา</button>}
                </div>
                <div className="ph-contract-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',gap:12}}>
                  {borrowerContracts.map((contract) => {
                    const status = currentContractStatus(contract);
                    const StatusIcon = status.Icon;
                    const filtered = contractFilter === contract.contractNumber;
                    return (
                      <article key={contract.id} className={`ph-contract-card${filtered ? ' is-filtered' : ''}`} style={{minWidth:0,padding:16,border:'1px solid var(--ph-line, #e6dcf1)',borderRadius:14,background:'var(--ws-surface, #fff)'}}>
                        <div className="ph-contract-card-top" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
                          <div style={{display:'grid',gap:3,minWidth:0}}><span style={{color:'var(--ph-muted, #85759a)',fontSize:'.82rem'}}>เลขที่สัญญา</span><strong style={{overflowWrap:'anywhere',fontSize:'1.05rem'}}>{contract.contractNumber}</strong></div>
                          <span className="ph-contract-status" style={{display:'inline-flex',flex:'none',alignItems:'center',gap:5,padding:'5px 9px',borderRadius:99,fontSize:'.8rem',fontWeight:600,color:status.color,background:status.background}}><StatusIcon size={14}/>{status.label}</span>
                        </div>
                        <div className="ph-contract-card-meta" style={{display:'flex',justifyContent:'flex-start',gap:12,margin:'14px 0',paddingTop:12,borderTop:'1px solid var(--ph-line, #e6dcf1)'}}>
                          <div style={{display:'grid',flex:1,gap:3,minWidth:0}}><span style={{color:'var(--ph-muted, #85759a)',fontSize:'.82rem'}}>ยอดคงเหลือ</span><strong style={{fontSize:'.94rem',fontVariantNumeric:'tabular-nums'}}>{baht(contract.balance?.total ?? 0)}</strong></div>
                          <div style={{display:'grid',flex:1,gap:3,minWidth:0}}><span style={{color:'var(--ph-muted, #85759a)',fontSize:'.82rem'}}>วันครบกำหนด</span><strong style={{fontSize:'.94rem'}}>{contract.dueDate ? dateLabel(contract.dueDate) : '—'}</strong></div>
                        </div>
                        <div className="ph-contract-actions" style={{display:'flex',justifyContent:'flex-start',flexWrap:'wrap',gap:8}}>
                          <button type="button" className={`ph-btn ph-btn-sm${filtered ? ' is-current' : ''}`} onClick={() => {setContractFilter(filtered ? '' : contract.contractNumber);setOpenId('');}}>{filtered ? 'กำลังดูประวัติ' : 'ดูประวัติ'}</button>
                          {onReceivePayment && ['ACTIVE','OVERDUE'].includes(contract.status) && <button type="button" className="ph-btn ph-btn-sm ph-btn-primary" onClick={() => onReceivePayment(contract.debtor.borrowersCode,contract.id)}>รับชำระ</button>}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              {entries.length === 0 && <p className="ph-none-detail">ยังไม่มีรายการรับชำระ{contractFilter ? `ในสัญญา ${contractFilter}` : 'ของผู้กู้รายนี้'}</p>}

              {groups.map(([key, group]) => (
                <div className="ph-month" key={key}>
                  <div className="ph-month-head">
                    <h3>{group.label}</h3>
                    <span>{baht(group.total)}</span>
                  </div>
                  <ul className="ph-ledger">
                    {group.items.map((entry) => {
                      const rowKey = `${entry.contractNumber}-${entry.id}`;
                      const open = openId === rowKey;
                      const receipt = entry.receipt;
                      const contractStatus = currentContractStatus(borrowerContracts.find(contract=>contract.contractNumber===entry.contractNumber));
                      const StatusIcon = contractStatus.Icon;
                      const parts = receipt
                        ? [
                            { key: 'interest', label: 'ดอกเบี้ย', value: receipt.interestPaid },
                            { key: 'penalty', label: 'ยอดเพิ่มหลังครบกำหนด', value: receipt.penaltyPaid },
                            { key: 'principal', label: 'เงินต้น', value: receipt.principalPaid },
                          ]
                        : [];
                      const sum = parts.reduce((s, p) => s + p.value, 0);
                      return (
                        <li key={rowKey} className={`ph-status-card${open ? ' is-open' : ''}`} style={{'--ph-card-accent':contractStatus.color,'--ph-card-tint':contractStatus.background} as CSSProperties}>
                          <button
                            type="button"
                            className="ph-row"
                            aria-expanded={receipt ? open : undefined}
                            disabled={!receipt}
                            onClick={() => setOpenId(open ? '' : rowKey)}
                          >
                            <span className="ph-status-avatar" aria-hidden="true"><StatusIcon size={30} strokeWidth={1.8}/></span>
                            <span className="ph-main">
                              <span className="ph-card-title"><strong>เลขที่สัญญา {entry.contractNumber}</strong><span className="ph-card-status" aria-label={`สถานะปัจจุบัน: ${contractStatus.label}`}><StatusIcon size={15} aria-hidden="true"/>{contractStatus.label}</span></span>
                              <small style={{overflowWrap:'anywhere'}}>เลขอ้างอิง / เลขสลิป: {entry.reference || 'ยังไม่มีเลขอ้างอิง'}</small>
                              <small className="ph-card-date">{dateLabel(entry.date)} · {entry.timeRecorded ? timeLabel(entry.date) : 'ไม่ระบุเวลา'}</small>
                              {!receipt && <small>{entry.title}</small>}
                              {receipt && sum > 0 && (
                                <span className="ph-bar" aria-hidden>
                                  {parts.map((p) => p.value > 0 && <i key={p.key} className={`ph-seg-${p.key}`} style={{ flexGrow: p.value }} />)}
                                </span>
                              )}
                            </span>
                            <span className="ph-amount">{baht(entry.amount)}</span>
                            {receipt ? <ChevronDown size={18} className="ph-chevron" aria-hidden /> : <span className="ph-chevron-space" />}
                          </button>

                          {receipt && open && (
                            <div className="ph-expand">
                              <ul className="ph-legend">
                                {parts.map((p) => (
                                  <li key={p.key}><i className={`ph-seg-${p.key}`} /><span>ตัด{p.label}</span><b>{baht(p.value)}</b></li>
                                ))}
                              </ul>
                              <p className="ph-remaining">ยอดคงเหลือทั้งหมดหลังชำระ <b>{baht(receipt.totalRemaining)}</b></p>
                              <div className="ph-row-actions">
                                <button type="button" className="ph-btn ph-btn-sm" onClick={() => setPreview({ receipt, contract: borrowerContracts.find((c) => c.contractNumber === entry.contractNumber)! })}>
                                  <FileText size={15} /> ดูใบรับชำระ
                                </button>
                                {receipt.evidenceUrl && (
                                  <a className="ph-btn ph-btn-sm" href={receipt.evidenceUrl} target="_blank" rel="noreferrer"><Paperclip size={15} /> ไฟล์แนบ</a>
                                )}
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </>
          )}
        </section>
          </article>
        </div>
      )}

      {preview && (
        <div className="ph-modal ph-receipt-modal" role="dialog" aria-modal="true" aria-label="ใบรับชำระเงิน" onClick={() => setPreview(null)}>
          <article className="ph-receipt" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="ph-close" aria-label="ปิด" onClick={() => setPreview(null)}><X size={18} /></button>
            <LoanReceipt
              receipt={preview.receipt}
              contractNumber={preview.contract.contractNumber}
              borrowerCode={preview.contract.debtor.borrowersCode}
              borrowerName={borrowerName(preview.contract)}
              borrowerAddress={preview.contract.debtor.address}
              borrowerHouseNumber={preview.contract.debtor.houseNumber}
              branch={preview.contract.receiptBranch}
              onClose={() => setPreview(null)}
            />
          </article>
        </div>
      )}
    </section>
  );
}
