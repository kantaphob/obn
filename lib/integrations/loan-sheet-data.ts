export const LOAN_SHEET_HEADERS = ['เลขที่สัญญา','ID','ชื่อผู้กู้','ยอดเงินกู้ (บาท)','ร้อยละ%','ยอดดอกเบี้ย','วันที่กู้ยืม','วันครบกำหนด','รูปแบบจ่ายเงิน','ยอดจ่ายสุทธิ (บาท)','รายการคำขอ','สถานะ','เลขที่ใบคำขอ','เลขที่ใบคำขอ LOS','เบอร์โทร','วันทำสัญญา','เลขที่สัญญาเดิม'];

type SheetContract = {
  previousContractNumber?:string|null;
  contractNumber:string; principal:number; interestRate:number; interestAmount:number; netDisbursed:number;
  status?:string;signedAt?:Date|string|number|null;
  application?:{requestNumber:string;losNumber:string|null;requestType:string;borrowerSnapshot:string}|null;
  interestMode:string; startDate:Date|string|number; dueDate:Date|string|number|null;
  debtor:{borrowersCode:string;prefixTH:string|null;firstName:string;lastName:string|null;nickname:string|null;phone?:string|null};
};
function sheetDate(value:SheetContract['dueDate']){
  if(value===null)return '';
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return '';
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get=(kind:string)=>parts.find(part=>part.type===kind)?.value||'';
  return `${get('day')}/${get('month')}/${get('year')}`;
}
export function loanSheetRow(contract:SheetContract):(string|number)[]{
  let snapshot;
  try {snapshot=contract.application?.borrowerSnapshot?JSON.parse(contract.application.borrowerSnapshot):null;}catch {snapshot=null;}
  const person=snapshot||contract.debtor;
  const statusLabels:Record<string,string>={DRAFT:'ร่าง',RESERVED:'จองสัญญา',AWAITING_DOCUMENT:'รอเอกสารลงนาม',READY:'พร้อมจ่ายเงิน',ACTIVE:'รอชำระคืน',OVERDUE:'เกินกำหนด',CLOSED:'ปิดสัญญา'};
  const requestLabels:Record<string,string>={LOAN:'กู้ยืมเงิน',TOP_UP:'กู้เพิ่ม',RENEWAL:'ต่อสัญญา'};
  return [contract.contractNumber,String(person.borrowersCode||contract.debtor.borrowersCode).toUpperCase(),[person.prefixTH,person.firstName,person.lastName].filter(Boolean).join(' ')||contract.debtor.nickname||'',contract.principal/100,contract.interestRate,contract.interestAmount/100,sheetDate(contract.startDate),sheetDate(contract.dueDate),contract.interestMode==='UPFRONT'?'หักดอกเบี้ยก่อน':'ไม่หักดอกเบี้ยก่อน',contract.netDisbursed/100,requestLabels[contract.application?.requestType||'LOAN']||contract.application?.requestType||'',statusLabels[contract.status||'']||contract.status||'',contract.application?.requestNumber||'',contract.application?.losNumber||'',person.phone||'',sheetDate(contract.signedAt||contract.startDate),contract.previousContractNumber||''];
}
