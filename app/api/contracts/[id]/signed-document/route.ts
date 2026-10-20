import { authorizeLoanContract } from "@/lib/loan-access";
import { authorizeApiRequest } from "@/lib/authorization";
import { prisma } from '@/lib/prisma';
import { POST as upload } from '../../attachments/route';
import { unlink } from 'node:fs/promises';
import { storedUploadPath } from '@/lib/borrower-file-storage';
import { writeLoanLog } from '@/lib/loan-logs';

export async function POST(request:Request, context:{params:Promise<{id:string}>}){
  const denied = await authorizeApiRequest("contracts", "write");
  if (denied) return denied;
 const {id}=await context.params;
 const companyDenied = await authorizeLoanContract(id); if (companyDenied) return companyDenied;
 const existing=await prisma.contract.findUnique({where:{id},select:{status:true,signatureMode:true,contractNumber:true,debtorId:true}});
 if(!existing)return Response.json({error:'ไม่พบสัญญา'},{status:404});
 if(!['AWAITING_DOCUMENT','RESERVED'].includes(existing.status)||existing.signatureMode!=='PRINT')return Response.json({error:'สัญญานี้ไม่อยู่ระหว่างรอเอกสารลงนาม'},{status:409});
 const form=await request.formData().catch(()=>null);
 if(!form)return Response.json({error:'ข้อมูลที่ส่งมาไม่ถูกต้อง'},{status:400});
 form.set('contractId',id);form.set('borrowerId',existing.debtorId);form.set('contractNumber',existing.contractNumber);
 const result=await upload(new Request(request.url,{method:'POST',headers:{origin:request.headers.get('origin')||''},body:form}));
 if(!result.ok)return result;
 const {url}=await result.json();
 const attachment={url,name:`สำเนาสัญญาที่ลงนามแล้ว ${new Date().toISOString()}`};
 try{
  await prisma.$transaction(async tx=>{
   await tx.contract.update({where:{id},data:{updatedAt:new Date()}});
   const contract=await tx.contract.findUniqueOrThrow({where:{id},select:{debtorId:true,contractNumber:true,documentData:true,status:true,signatureMode:true,startDate:true}});
   if(!['AWAITING_DOCUMENT','RESERVED'].includes(contract.status)||contract.signatureMode!=='PRINT')throw new Error('สัญญานี้ไม่อยู่ระหว่างรอเอกสารลงนาม');
   const data=contract.documentData?JSON.parse(contract.documentData):{};
   const hadSignedDocument=Boolean(data.signedDocument);
   data.signedDocument={...attachment,uploadedAt:new Date().toISOString()};
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   const todayEnd=new Date(`${today}T23:59:59.999+07:00`);
   const nextStatus=contract.startDate>todayEnd?'RESERVED':'READY';
   await tx.contract.update({where:{id},data:{documentData:JSON.stringify(data),status:nextStatus,signedAt:new Date()}});
   await writeLoanLog(tx, {
    borrowerId:contract.debtorId,contractId:id,targetId:id,type:'CONTRACT',action:'UPDATE',
    note:`บันทึกเอกสารลงนามสัญญา ${contract.contractNumber}`,
    beforeData:{signedDocument:hadSignedDocument,status:contract.status},
    afterData:{signedDocument:true,status:nextStatus},
   });
  });
  return Response.json({attachment},{status:201});
 }catch(error){
  await unlink(storedUploadPath('contract-attachments',url)).catch(()=>{});
  if(error instanceof Error&&error.message==='สัญญานี้ไม่อยู่ระหว่างรอเอกสารลงนาม')return Response.json({error:error.message},{status:409});
  return Response.json({error:'บันทึกสำเนาสัญญาไม่สำเร็จ กรุณาลองใหม่'},{status:500});
 }
}
