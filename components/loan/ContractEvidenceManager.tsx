'use client';

import LoanActionButton from "@/components/loan/LoanActionButton";
import { useRef, useState } from 'react';
import { LoaderCircle, Paperclip, Upload } from 'lucide-react';
import ConfirmDelete from '@/components/ui/ConfirmDelete';

type Evidence = { url: string; name?: string; reference?: string };
export default function ContractEvidenceManager({contractId,evidence,onChanged,onBusyChange}:{contractId:string;evidence:Evidence[];onChanged:()=>Promise<void>;onBusyChange:(busy:boolean)=>void}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [removing,setRemoving]=useState<Evidence|null>(null);
  async function update(file?:File) {
    if(busy || (!file && !removing))return;
    setBusy(true);onBusyChange(true);setError('');
    try {
      let response;
      if(file) {
        const data=new FormData();data.append('file',file);
        response=await fetch(`/api/contracts/${encodeURIComponent(contractId)}/delivery-evidence`,{method:'POST',body:data});
      } else {
        response=await fetch(`/api/contracts/${encodeURIComponent(contractId)}/delivery-evidence`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:removing?.url})});
      }
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'บันทึกหลักฐานไม่สำเร็จ');
      await onChanged();setRemoving(null);
    } catch(cause) {setError(cause instanceof Error?cause.message:'บันทึกหลักฐานไม่สำเร็จ');setRemoving(null);}
    finally {setBusy(false);onBusyChange(false);}
  }
  return <section style={{margin:'20px 0',padding:20,border:'1px solid var(--lx-line,#e9e3ef)',borderRadius:14,background:'var(--lx-surface,#fff)'}} aria-label="หลักฐานส่งมอบเงินของสัญญา">
    {removing && <ConfirmDelete name={removing.name||'หลักฐานส่งมอบเงิน'} busy={busy} onConfirm={()=>void update()} onCancel={()=>{if(!busy)setRemoving(null);}}/>}
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}><div><h2 style={{fontSize:16,fontWeight:600,margin:0}}>หลักฐานส่งมอบเงิน</h2><p style={{fontSize:12,margin:'6px 0 0',color:'var(--lx-muted)'}}>เพิ่มหลักฐานได้ทันที โดยไม่ต้องบันทึกแก้ไขเงื่อนไขสัญญา</p></div><button type="button" className="lx-btn" disabled={busy} onClick={()=>input.current?.click()}>{busy?<LoaderCircle size={16} className="animate-spin"/>:<Upload size={16}/>} {busy?'กำลังบันทึก…':'อัปโหลดหลักฐานเพิ่ม'}</button></div>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" aria-label="เลือกหลักฐานส่งมอบเงิน" hidden disabled={busy} onChange={event=>{void update(event.target.files?.[0]);event.target.value='';}}/>
    <p style={{fontSize:11,color:'var(--lx-muted)',marginTop:10}}>JPG / PNG / WebP / PDF ไม่เกิน 10 MB ต่อไฟล์</p>
    {evidence.length ? <ul style={{listStyle:'none',padding:0,margin:'14px 0 0',display:'grid',gap:10}}>{evidence.map(file=><li key={file.url} style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10,padding:'12px 0',borderTop:'1px solid var(--lx-line,#e9e3ef)'}}><div style={{minWidth:0,overflowWrap:'anywhere'}}><a href={file.url} target="_blank" rel="noreferrer" style={{display:'inline-flex',alignItems:'center',gap:6}}><Paperclip size={15}/>{file.name||'เปิดหลักฐาน'}</a>{file.reference && <small style={{display:'block',marginTop:4}}>อ้างอิง {file.reference}</small>}</div><LoanActionButton action="delete" disabled={busy} aria-label={`ลบไฟล์ ${file.name || "หลักฐาน"}`} onClick={()=>setRemoving(file)} /></li>)}</ul>:<p style={{fontSize:13,color:'var(--lx-muted)',marginTop:14}}>ยังไม่มีหลักฐานส่งมอบเงิน</p>}
    {error && <p role="alert" style={{color:'#b3261e',marginTop:12}}>{error}</p>}
  </section>;
}
