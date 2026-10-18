'use client';
import {useState} from 'react';
export default function LoanApplicationEditor({contractId,requestNumber,requestType,losNumber,onChanged}:{contractId:string;requestNumber?:string|null;requestType?:string|null;losNumber?:string|null;onChanged:()=>Promise<void>}) {
 const [type,setType]=useState(requestType||'LOAN');
 const [los,setLos]=useState(losNumber||'');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 async function save() {
  if(busy)return;
  setBusy(true);setMessage('');
  try {
   const response=await fetch(`/api/contracts/${encodeURIComponent(contractId)}/application`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestType:type,losNumber:los.trim()||null})});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||'บันทึกข้อมูลไม่สำเร็จ');
   await onChanged();setMessage('บันทึกข้อมูลคำขอแล้ว');
  }catch(error){setMessage(error instanceof Error?error.message:'บันทึกไม่สำเร็จ');}finally{setBusy(false);}
 }
 return <section className="contract-review-card"><h2 style={{fontSize:16}}>ข้อมูลใบคำขอ</h2><p>เลขที่ใบคำขอ: <strong>{requestNumber||'—'}</strong></p><div className="lx-grid c2"><label className="lx-field"><span>รายการคำขอ</span><select value={type} disabled={busy} onChange={event=>setType(event.target.value)}><option value="LOAN">กู้ยืมเงิน</option><option value="TOP_UP">กู้เพิ่ม</option><option value="RENEWAL">ต่อสัญญา</option></select></label><label className="lx-field"><span>เลขที่ใบคำขอ LOS (ถ้ามี)</span><input value={los} maxLength={100} disabled={busy} onChange={event=>setLos(event.target.value)}/></label></div><div style={{marginTop:14,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}><button type="button" className="lx-btn" disabled={busy} onClick={()=>void save()}>{busy?'กำลังบันทึก…':'บันทึกข้อมูลคำขอ'}</button><small>บันทึกแยกจากการแก้ไขเงื่อนไขเงินกู้</small></div>{message&&<p role="status">{message}</p>}</section>;
}
