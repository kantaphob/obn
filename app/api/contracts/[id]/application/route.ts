import { authorizeApiRequest } from "@/lib/authorization";
import { prisma } from '@/lib/prisma';
import { loanApplicationFields, loanRequestTypes } from '@/lib/loan-application';
import { writeLoanLog } from '@/lib/loan-logs';
import { isPrismaCode } from '@/lib/borrowers';
export async function PATCH(request:Request,context:{params:Promise<{id:string}>}) {
  const denied = await authorizeApiRequest("contracts", "write");
  if (denied) return denied;
 const origin=request.headers.get('origin');
 if(origin && origin!==new URL(request.url).origin)return Response.json({error:'ไม่อนุญาตคำขอจากเว็บไซต์อื่น'},{status:403});
 const data=await request.json().catch(()=>null);
 if(!data || typeof data.requestType!=='string' || !Object.hasOwn(loanRequestTypes,data.requestType) || (data.losNumber!==null && typeof data.losNumber!=='string') || (typeof data.losNumber==='string' && data.losNumber.length>100))return Response.json({error:'กรุณาตรวจประเภทคำขอและเลข LOS (ไม่เกิน 100 ตัวอักษร)'},{status:400});
 const {id}=await context.params;
 try {
  const saved=await prisma.$transaction(async tx=>{
   const application=await tx.loanApplication.findUnique({where:{contractId:id}});
   if(!application)throw new Error('APPLICATION_NOT_FOUND');
   const next=await tx.loanApplication.update({where:{id:application.id},data:{requestType:data.requestType,losNumber:data.losNumber?.trim()||null}});
   await tx.contract.update({where:{id},data:{updatedAt:new Date()}});
   await writeLoanLog(tx,{borrowerId:application.borrowerId,contractId:id,targetId:application.id,type:'CONTRACT',action:'UPDATE',note:'แก้ไขประเภทคำขอและเลขอ้างอิง LOS',beforeData:{requestNumber:application.requestNumber,losNumber:application.losNumber,requestType:application.requestType},afterData:{requestNumber:next.requestNumber,losNumber:next.losNumber,requestType:next.requestType}});
   return next;
  });
  return Response.json(loanApplicationFields(saved));
 } catch(error) {
  if(isPrismaCode(error,'P2002'))return Response.json({error:'เลข LOS นี้ใช้กับคำขออื่นแล้ว'},{status:409});
  if(error instanceof Error && error.message==='APPLICATION_NOT_FOUND')return Response.json({error:'ไม่พบคำขอของสัญญานี้'},{status:404});
  return Response.json({error:'บันทึกข้อมูลคำขอไม่สำเร็จ'},{status:500});
 }
}
