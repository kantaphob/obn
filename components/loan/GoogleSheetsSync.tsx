'use client';
import { useEffect, useState } from 'react';

type Status={configured:boolean;state:string;message:string;updatedAt:string;spreadsheetUrl:string|null;tab:string};
export default function GoogleSheetsSync(){
  const [status,setStatus]=useState<Status|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();
    const refresh=()=>{void fetch('/api/integrations/google-sheets',{cache:'no-store',signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error('โหลดสถานะ Google Sheets ไม่สำเร็จ');return response.json();}).then(data=>setStatus(data)).catch(cause=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'โหลดสถานะไม่สำเร็จ');});};
    refresh();window.addEventListener('focus',refresh);
    return()=>{controller.abort();window.removeEventListener('focus',refresh);};
  },[]);
  async function sync(){
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/integrations/google-sheets',{method:'POST'});const data=await response.json();
      setStatus(current=>current?{...current,...data}:current);
      if(!response.ok)setError(data.message||'ซิงก์ไม่สำเร็จ');
    }catch{setError('เชื่อมต่อระบบไม่สำเร็จ กรุณาลองอีกครั้ง');}finally{setBusy(false);}
  }
  return <section className="lx-panel" aria-label="Google Sheets" style={{padding:'14px 18px',marginBottom:18}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
      <div><strong>Google Sheets</strong><p role="status" style={{margin:'4px 0',fontSize:13}}>{busy?'กำลังซิงก์…':status?.message||error||'กำลังโหลดสถานะ…'}{status?.updatedAt&&status.configured&&<span> · {new Date(status.updatedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</span>}</p></div>
      <div style={{display:'flex',gap:8}}>{status?.spreadsheetUrl&&<a className="lx-btn sm" href={status.spreadsheetUrl} target="_blank" rel="noreferrer">เปิดชีต</a>}<button type="button" className="lx-btn sm" disabled={!status?.configured||busy} onClick={()=>void sync()}>ซิงก์ตอนนี้</button></div>
    </div>
    {error&&<p role="alert">{error}</p>}
    {status&&!status.configured&&<details><summary style={{cursor:'pointer',fontSize:13}}>วิธีเปิดซิงก์อัตโนมัติ</summary><ol style={{fontSize:13,lineHeight:1.9}}><li>เปิด <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">Google Cloud</a> สร้างหรือเลือกโปรเจกต์ แล้วเปิดใช้งาน Google Sheets API</li><li>ไปที่ IAM &amp; Admin → Service Accounts → Create service account ตั้งชื่อ เช่น loan-sheet-sync</li><li>เปิดบัญชีที่สร้าง → Keys → Add key → Create new key → JSON เก็บไฟล์ไว้ในเครื่อง</li><li>แชร์ชีตให้อีเมลของบัญชีนี้ โดยเลือก “ผู้แก้ไข” แล้วแจ้งพาธไฟล์ JSON เพื่อให้ตั้งค่าเซิร์ฟเวอร์</li></ol><p style={{fontSize:13}}>เมื่อตั้งค่าแล้ว ระบบจะส่งข้อมูลหลังบันทึกหรือแก้ไขสัญญา หากส่งไม่สำเร็จให้กด “ซิงก์ตอนนี้”</p></details>}
  </section>;
}
