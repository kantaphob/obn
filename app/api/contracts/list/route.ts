import { prisma } from '@/lib/prisma';
import { ContractStatus, ContractType, SignatureMode } from '@/generated/prisma/enums';
export async function GET(){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const todayStart=new Date(`${today}T00:00:00.000Z`);
 const todayEnd=new Date(`${today}T23:59:59.999+07:00`);
 // Reconcile contracts finalized by earlier versions that were incorrectly left in DRAFT.
 await prisma.contract.updateMany({where:{status:ContractStatus.DRAFT,OR:[{contractType:ContractType.NONE},{signatureMode:SignatureMode.DIGITAL},{signedAt:{not:null}}]},data:{status:ContractStatus.READY}});
 await prisma.contract.updateMany({where:{status:ContractStatus.DRAFT,contractType:{not:ContractType.NONE},signatureMode:SignatureMode.PRINT,signedAt:null},data:{status:ContractStatus.AWAITING_DOCUMENT}});
 await prisma.contract.updateMany({where:{status:ContractStatus.RESERVED,startDate:{lte:todayEnd}},data:{status:ContractStatus.READY}});
 await prisma.contract.updateMany({where:{status:ContractStatus.ACTIVE,dueDate:{lt:todayStart}},data:{status:ContractStatus.OVERDUE}});
 const contracts=await prisma.contract.findMany({include:{debtor:{select:{borrowersCode:true,firstName:true,lastName:true,nickname:true}}},orderBy:{updatedAt:'desc'}});
 return Response.json(contracts,{headers:{'Cache-Control':'no-store'}});
}
