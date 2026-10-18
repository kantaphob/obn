'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArchiveRestore, Search, Trash2 } from 'lucide-react';
import '../../lending-ui.css';

type DeletedBorrower={id:string;borrowerId:string;borrowersCode:string;reason:string|null;deletedAt:string;restoredAt:string|null;snapshot:Record<string,unknown>};
const fullName=(row:DeletedBorrower)=>[row.snapshot.prefixTH,row.snapshot.firstName,row.snapshot.lastName].filter(Boolean).join(' ')||String(row.snapshot.nickname||'ไม่ระบุชื่อ');
const date=(value:string|null)=>value?new Date(value).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'short'}):'—';
export default function DeletedBorrowers(){
  const [rows,setRows]=useState<DeletedBorrower[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState('');
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('DELETED');
  const load=useCallback(async(signal?:AbortSignal)=>{
    const response=await fetch('/api/borrowers/deleted',{cache:'no-store',signal});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'โหลดประวัติการลบไม่สำเร็จ');
    return data as DeletedBorrower[];
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    void load(controller.signal).then(data=>{if(!controller.signal.aborted)setRows(data);}).catch(cause=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'โหลดข้อมูลไม่สำเร็จ');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[load]);
  async function restore(row:DeletedBorrower){
    if(busy)return;
    setBusy(row.id);setError('');setMessage('');
    try{
      const response=await fetch(`/api/borrowers/deleted/${row.id}/restore`,{method:'POST'});const data=await response.json();
      if(!response.ok)throw new Error(data.error||'กู้คืนไม่สำเร็จ');
      setRows(await load());setMessage(`กู้คืน ${row.borrowersCode} แล้ว กลับไปดูในรายชื่อผู้กู้ได้`);
    }catch(cause){setError(cause instanceof Error?cause.message:'กู้คืนไม่สำเร็จ');}finally{setBusy('');}
  }
  const visible=rows.filter(row=>(filter==='ALL'||(filter==='DELETED'?!row.restoredAt:Boolean(row.restoredAt)))&&[row.borrowersCode,fullName(row),row.snapshot.nickname,row.snapshot.phone,row.reason].some(value=>String(value||'').toLocaleLowerCase('th-TH').includes(query.trim().toLocaleLowerCase('th-TH'))));
  return <main className="lx-page"><div className="lx-wrap">
    <header className="lx-head"><div><span className="eyebrow">ประวัติผู้กู้</span><h1><Trash2 size={25} aria-hidden="true"/> ถังขยะผู้กู้</h1><p>เก็บข้อมูล ณ เวลาลบ พร้อมวันเวลา เหตุผล และประวัติการกู้คืน</p></div><Link className="lx-btn" href="/dashboard/loan/borrowers"><ArrowLeft size={16} aria-hidden="true"/> กลับรายชื่อผู้กู้</Link></header>
    <section className="lx-panel" style={{padding:18,marginBottom:18}}><strong>{rows.filter(row=>!row.restoredAt).length} รายการในถังขยะ</strong><p style={{margin:'8px 0',fontSize:14}}>ข้อมูล รูปภาพ รหัสผู้กู้ สัญญา และประวัติชำระเงินยังเก็บไว้ การกู้คืนจะใช้รหัสเดิม ประวัติการลบแต่ละครั้งยังคงอยู่หลังจากกู้คืน</p></section>
    {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    <section className="lx-panel"><div className="lx-filterbar" style={{padding:16,display:'flex',gap:12,flexWrap:'wrap'}}><label style={{display:'flex',alignItems:'center',gap:8,flex:1,minWidth:200}}><Search size={17} aria-hidden="true"/><input aria-label="ค้นหาประวัติผู้กู้ที่ลบ" value={query} onChange={event=>setQuery(event.target.value)} placeholder="ค้นหารหัส ชื่อ เบอร์โทร หรือเหตุผล" style={{width:'100%',padding:10,border:'1px solid #d8d8e3',borderRadius:8}}/></label><select aria-label="สถานะประวัติการลบ" value={filter} onChange={event=>setFilter(event.target.value)} style={{padding:10,border:'1px solid #d8d8e3',borderRadius:8}}><option value="DELETED">อยู่ในถังขยะ</option><option value="RESTORED">กู้คืนแล้ว</option><option value="ALL">ประวัติทั้งหมด</option></select></div>
    <div className="lx-table-wrap"><table className="lx-table"><thead><tr><th>ผู้กู้ / รหัส</th><th>ลบเมื่อ</th><th>เหตุผล</th><th>สถานะ / กู้คืนเมื่อ</th><th>จัดการ</th></tr></thead><tbody>
      {loading?<tr><td colSpan={5}>กำลังโหลดข้อมูล…</td></tr>:visible.length===0?<tr><td colSpan={5}>ไม่พบรายการ</td></tr>:visible.map(row=><tr key={row.id}><td><strong>{fullName(row)}</strong><div>{row.borrowersCode}{row.snapshot.nickname?` · ${row.snapshot.nickname}`:''}</div><details style={{marginTop:8}}><summary style={{cursor:'pointer'}}>ข้อมูลที่เก็บไว้ ณ เวลาลบ</summary><dl>{[['phone','โทรศัพท์'],['nationalId','เลขบัตรประชาชน'],['firstNameEN','ชื่อภาษาอังกฤษ'],['lastNameEN','นามสกุลภาษาอังกฤษ'],['address','ที่อยู่'],['workplace','ที่ทำงาน'],['note','หมายเหตุ']].map(([key,label])=><div key={key} style={{marginTop:8}}><dt>{label}</dt><dd style={{margin:0,whiteSpace:'pre-wrap'}}>{String(row.snapshot[key]||'—')}</dd></div>)}</dl></details></td><td>{date(row.deletedAt)}</td><td style={{whiteSpace:'pre-wrap',maxWidth:300}}>{row.reason||'ไม่ระบุเหตุผล'}</td><td>{row.restoredAt?<>กู้คืนแล้ว<div>{date(row.restoredAt)}</div></>:'อยู่ในถังขยะ'}</td><td>{!row.restoredAt&&<button type="button" className="lx-btn" disabled={Boolean(busy)} onClick={()=>void restore(row)}><ArchiveRestore size={16} aria-hidden="true"/>{busy===row.id?'กำลังกู้คืน…':'กู้คืนผู้กู้'}</button>}</td></tr>)}
    </tbody></table></div></section>
  </div></main>;
}
