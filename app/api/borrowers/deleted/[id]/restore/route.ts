import { authorizeApiRequest } from "@/lib/authorization";
import { prisma } from '@/lib/prisma';
import { isPrismaCode } from '@/lib/borrowers';
import { writeLoanLog } from '@/lib/loan-logs';
import { formatBorrowerCode } from '@/lib/borrower-code';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  const denied = await authorizeApiRequest("borrowers", "write");
  if (denied) return denied;
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'ไม่อนุญาตคำขอจากเว็บไซต์อื่น'},{status:403});
  const {id}=await context.params;
  try{
    await prisma.$transaction(async tx=>{
      const event=await tx.borrowersdelete.findUniqueOrThrow({where:{id}});
      if(event.restoredAt)return;
      const restoredAt=new Date();
      const changed=await tx.borrowers.updateMany({where:{id:event.borrowerId,deletedAt:event.deletedAt},data:{deletedAt:null}});
      if(!changed.count)throw new Error('รายการนี้ไม่ตรงกับการลบล่าสุด กรุณาโหลดข้อมูลใหม่');
      await tx.borrowersdelete.update({where:{id},data:{restoredAt}});
      await writeLoanLog(tx,{borrowerId:event.borrowerId,targetId:id,type:'BORROWER',action:'RESTORE',note:`กู้คืนผู้กู้ ${formatBorrowerCode(event.borrowersCode)}`,afterData:{archiveId:id,restoredAt}});
    });
    return Response.json({success:true});
  }catch(error){
    if(isPrismaCode(error,'P2025'))return Response.json({error:'ไม่พบประวัติการลบ'},{status:404});
    return Response.json({error:error instanceof Error?error.message:'กู้คืนไม่สำเร็จ'},{status:409});
  }
}
