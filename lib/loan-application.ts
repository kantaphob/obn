import { formatBorrowerCode } from '@/lib/borrower-code';
import type { Prisma } from '@/generated/prisma/client';

export const loanRequestTypes = { LOAN: 'กู้ยืมเงิน', TOP_UP: 'กู้เพิ่ม', RENEWAL: 'ต่อสัญญา' } as const;
export function loanApplicationFields(application: {requestNumber:string;losNumber:string|null;requestType:string;requestedAt:Date;borrowerSnapshot:string;source:string}|null|undefined) {
  if(!application)return {requestNumber:null,losNumber:null,requestType:null,applicant:null};
  let snapshot;
  try {snapshot=JSON.parse(application.borrowerSnapshot);}catch {snapshot=null;}
  return {requestNumber:application.requestNumber,losNumber:application.losNumber,requestType:application.requestType,requestedAt:application.requestedAt,requestSource:application.source,
    applicant:snapshot?{borrowersCode:formatBorrowerCode(snapshot.borrowersCode||''),firstName:snapshot.firstName,lastName:snapshot.lastName,phone:snapshot.phone}:null};
}
export async function createLoanApplication(tx:Prisma.TransactionClient,input:{borrowerId:string;requestedAmount:number;requestType:string;losNumber:string|null}) {
  const borrower=await tx.borrowers.findUniqueOrThrow({where:{id:input.borrowerId,deletedAt:null},include:{subdistrict:{include:{district:{include:{province:true}}}}}});
  const year=Number(new Intl.DateTimeFormat('en',{timeZone:'Asia/Bangkok',year:'numeric'}).format(new Date()));
  const sequence=await tx.loanApplicationNumberSequence.upsert({where:{year},create:{year,lastNumber:1},update:{lastNumber:{increment:1}}});
  const snapshot={borrowerId:borrower.id,borrowersCode:borrower.borrowersCode,prefixTH:borrower.prefixTH,firstName:borrower.firstName,lastName:borrower.lastName,phone:borrower.phone,nationalId:borrower.nationalId,address:borrower.address,houseNumber:borrower.houseNumber,buildingName:borrower.buildingName,alley:borrower.alley,road:borrower.road,subdistrictId:borrower.subdistrictId,subdistrict:borrower.subdistrict?.nameTh,district:borrower.subdistrict?.district.nameTh,province:borrower.subdistrict?.district.province.nameTh,capturedAt:new Date().toISOString()};
  return tx.loanApplication.create({data:{...input,requestNumber:`REQ-${year}-${String(sequence.lastNumber).padStart(5,'0')}`,borrowerSnapshot:JSON.stringify(snapshot)}});
}
