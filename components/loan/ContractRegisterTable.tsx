'use client';

import { Fragment, useState, type ReactNode } from 'react';
import { ChevronDown, FileText } from 'lucide-react';
import './contract-register.css';

type Person = {borrowersCode:string;firstName:string;lastName?:string|null;nickname?:string|null;phone?:string|null};
export type RegisterContract = {
  id:string;status:string;contractNumber?:string;previousContractNumber?:string|null;principal?:number;interestRate?:number;interestAmount?:number;
  netDisbursed?:number;repayType?:string;interestMode?:string;installmentMonths?:number|null;
  startDate?:string;dueDate?:string|null;signedAt?:string|null;createdAt?:string;updatedAt?:string;
  lateFeePerDay?:number;lateFeeWaived?:boolean;documentData?:string|null;note?:string|null;
  cancelledAt?:string|null;cancellationReason?:string|null;
  disbursement?:{id:string;amount:number;paidAt:string;method:string;reference:string|null}|null;
  requestNumber?:string|null;losNumber?:string|null;requestType?:string|null;
  witness1?:string|null;witness2?:string|null;guarantor?:string|null;signatureMode?:string;
  debtor?:Person;borrower?:Person;applicant?:Person|null;
  repayments?:{amount:number;receiptNumber?:string}[];
  balance?:{total:number};
  data?:{contract?:{principal?:string;startDate?:string;requestNumber?:string;losNumber?:string};documents?:Record<string,unknown>};
};
const labels:Record<string,string>={DRAFT:'ร่าง',RESERVED:'จองสัญญา',AWAITING_DOCUMENT:'รอเอกสารลงนาม',READY:'พร้อมจ่ายเงิน',ACTIVE:'รอชำระคืน',OVERDUE:'เกินกำหนด',CLOSED:'ปิดสัญญา',CANCELLED:'ยกเลิกสัญญา'};
const money=(value?:number)=>typeof value==='number'?new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'}).format(value/100):'—';
const date=(value?:string|null)=>value && Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium'}).format(new Date(value)):'—';
const text=(value:unknown)=>typeof value==='string' && value.trim()?value:'—';
function documentOf(row:RegisterContract):Record<string,unknown> {try{return row.documentData?JSON.parse(row.documentData):row.data?.documents||{};}catch{return {};}}

export default function ContractRegisterTable<T extends RegisterContract>({rows,draft=false,renderActions,emptyLabel='ไม่พบรายการสัญญา'}:{rows:T[];draft?:boolean;renderActions?:(row:T)=>ReactNode;emptyLabel?:string}) {
 const [expanded,setExpanded]=useState<string|null>(null);
 const toggle=(id:string)=>setExpanded(current=>current===id?null:id);
 return <div className="contract-register-scroll"><table className="contract-register-table"><thead><tr>{['รายการคำขอ','สถานะ','เลขที่ใบคำขอ','เลขที่ใบคำขอ LOS','เลขที่สัญญา','เลขผู้กู้','ชื่อ','เบอร์','ยอดเงิน','วันทำสัญญา','จัดการ'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map(row=>{
  const person=row.applicant||row.borrower||row.debtor;
  const doc=documentOf(row);
  const request=text(row.requestNumber||doc.requestNumber||row.data?.contract?.requestNumber);
  const los=text(row.losNumber||doc.losNumber||row.data?.contract?.losNumber);
  const amount=draft?(row.data?.contract?.principal?Math.round(Number(row.data.contract.principal)*100):undefined):row.principal;
  const open=expanded===row.id;
  const attachments=Array.isArray(doc.attachments)?doc.attachments as {url:string;name?:string}[]:[];
  const evidence=Array.isArray(doc.deliveryEvidenceRecords)?doc.deliveryEvidenceRecords as {url:string;name?:string;reference?:string}[]:[];
  const name=[person?.firstName,person?.lastName].filter(Boolean).join(' ')||person?.nickname||'—';
  return <Fragment key={row.id}><tr className={open?'is-expanded':undefined}>
   <td><button type="button" className="contract-register-open" onClick={()=>toggle(row.id)} aria-expanded={open} aria-controls={`contract-register-${row.id}`}><FileText size={15} aria-hidden="true"/>{({LOAN:'กู้ยืมเงิน',TOP_UP:'กู้เพิ่ม',RENEWAL:'ต่อสัญญา'} as Record<string,string>)[String(row.requestType||doc.requestType)]||'คำขอกู้ยืม'}</button></td>
   <td><span className={`contract-register-status is-${row.status.toLowerCase()}`}>{labels[row.status]||row.status}</span></td>
   <td>{request}</td><td>{los}</td>
   <td><button type="button" className="contract-register-number" onClick={()=>toggle(row.id)} aria-expanded={open}>{row.contractNumber||'ยังไม่ออกเลขสัญญา'}</button>{row.previousContractNumber && <small style={{display:'block',marginTop:5,color:'#998aa5'}}>เลขเดิม {row.previousContractNumber}</small>}</td>
   <td>{person?.borrowersCode||'—'}</td><td>{name}</td><td>{person?.phone||'—'}</td><td className="contract-register-money">{money(amount)}</td><td>{date(row.signedAt||row.startDate||row.data?.contract?.startDate)}</td>
   <td><div className="contract-register-actions"><button type="button" className="lx-btn sm" onClick={()=>toggle(row.id)} aria-expanded={open} aria-controls={`contract-register-${row.id}`}>รายละเอียด<ChevronDown size={13} style={{transform:open?'rotate(180deg)':undefined}} aria-hidden="true"/></button>{renderActions?.(row)}</div></td>
  </tr>{open && <tr className="contract-register-detail-row"><td colSpan={11}><section id={`contract-register-${row.id}`} aria-label={`รายละเอียดสัญญา ${row.contractNumber||'ร่าง'}`}>
   <div className="contract-register-detail-title"><strong>รายละเอียด {row.contractNumber||'ร่างสัญญา'}</strong><span>แก้ไขล่าสุด {date(row.updatedAt)}</span></div>
   <div className="contract-register-detail-grid">{[
    ['ผู้กู้',name],['เบอร์โทร',person?.phone||'—'],['ประเภทผู้ให้กู้',doc.lenderType==='PERSON'?'เจ้าของบริษัท':'บริษัท'],['ผู้ให้กู้',text(doc.lenderName)],['สาขา',text(doc.branchCode)],['สถานที่ทำสัญญา',text(doc.place)],
    ['เงินต้น',money(amount)],['อัตราดอกเบี้ย',typeof row.interestRate==='number'?`${row.interestRate}%${row.repayType==='INSTALLMENT'?' ต่อเดือน':' ตามสัญญา'}`:'—'],['ดอกเบี้ยรวม',money(row.interestAmount)],['ยอดจ่ายสุทธิ',money(row.netDisbursed)],
    ['รูปแบบชำระ',row.repayType==='INSTALLMENT'?`ผ่อนชำระ ${row.installmentMonths||'—'} เดือน`:row.repayType==='INTEREST_ONLY'?'ชำระดอกเบี้ยเป็นรอบ':'ชำระตามสัญญา'],['วิธีคิดดอกเบี้ย',row.interestMode==='UPFRONT'?'หักดอกเบี้ยก่อน':'ไม่หักดอกเบี้ยก่อน'],['วันเริ่มสัญญา',date(row.startDate)],['วันครบกำหนด',date(row.dueDate)],
    ['ค่าปรับต่อวัน',row.lateFeeWaived?'ยกเว้นค่าปรับ':money(row.lateFeePerDay)],['รายการจ่ายผู้กู้',row.disbursement?`${money(row.disbursement.amount)} · ${date(row.disbursement.paidAt)} · ${row.disbursement.method==='BANK_TRANSFER'?'โอนเงิน':'เงินสด'}${row.disbursement.reference?` · อ้างอิง ${row.disbursement.reference}`:''}`:'ยังไม่มีรายการจ่าย'],['ยอดรับชำระ',row.repayments?money(row.repayments.reduce((sum,item)=>sum+item.amount,0)):'—'],['หนี้คงเหลือ',money(row.balance?.total)],['วันยกเลิก',date(row.cancelledAt)],['เหตุผลยกเลิก',row.cancellationReason||'—'],['หมายเหตุ',row.note||'—'],
   ].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
   <div className="contract-register-detail-grid" style={{marginTop:18}}>{[
    ...(doc.packageType && doc.packageType!=='NONE' ? [['วิธีลงนาม',row.signatureMode==='DIGITAL'?'ลายเซ็นดิจิทัล':row.signatureMode==='PRINT'?'พิมพ์เพื่อลงนาม':'—'],['จำนวนพยาน',`${doc.witnessCount??2} คน`],...(row.witness1?[['พยานคนที่ 1',row.witness1]]:[]),...(row.witness2?[['พยานคนที่ 2',row.witness2]]:[])]:[]),
    ...(row.guarantor?[['ผู้ค้ำประกัน',row.guarantor],['เบอร์ผู้ค้ำ',text(doc.guarantorPhone)]]:[]),
    ...(doc.collateralDetails?[['ทรัพย์สินหลักประกัน',text(doc.collateralDetails)],['ผู้ให้หลักประกัน',text(doc.collateralProviderName)]]:[]),
   ].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
   {attachments.length>0 && <div className="contract-register-files"><strong>เอกสารและหลักฐาน</strong>{attachments.filter(file=>typeof file.url==='string' && file.url.startsWith('/api/contracts/attachments/')).map(file=><div key={file.url}><a href={file.url} target="_blank" rel="noreferrer">{file.name||'เปิดไฟล์แนบ'}</a>{evidence.find(item=>item.url===file.url)?.reference && <small>อ้างอิง {evidence.find(item=>item.url===file.url)?.reference}</small>}</div>)}</div>}
  </section></td></tr>}</Fragment>;
 })}</tbody></table>{!rows.length && <p className="contract-register-empty">{emptyLabel}</p>}</div>;
}
