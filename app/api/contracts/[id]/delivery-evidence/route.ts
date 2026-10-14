import { prisma } from '@/lib/prisma';
import { POST as upload } from '../../attachments/route';
import { unlink } from 'node:fs/promises';
import path from 'node:path';

export async function POST(request:Request, context:{params:Promise<{id:string}>}){
 const {id}=await context.params;
 if(!await prisma.contract.findUnique({where:{id},select:{id:true}}))return Response.json({error:'ไม่พบสัญญา'},{status:404});
 const result=await upload(request);
 if(!result.ok)return result;
 const {url}=await result.json();
 const attachment={url,name:`หลักฐานส่งมอบเงิน ${new Date().toISOString()}`};
 try{
  await prisma.$transaction(async tx=>{
   // Acquire the SQLite write lock before reading metadata to preserve concurrent uploads.
   await tx.contract.update({where:{id},data:{updatedAt:new Date()}});
   const contract=await tx.contract.findUniqueOrThrow({where:{id},select:{documentData:true,status:true}});
   if(contract.status==='AWAITING_DOCUMENT')throw new Error('ต้องบันทึกวันที่ลงนามในเอกสารก่อนบันทึกหลักฐานส่งมอบเงิน');
   const data=contract.documentData?JSON.parse(contract.documentData):{};
   data.attachments=[...(Array.isArray(data.attachments)?data.attachments:[]),attachment];
   data.deliveryEvidenceRecords=[...(Array.isArray(data.deliveryEvidenceRecords)?data.deliveryEvidenceRecords:[]),{...attachment,uploadedAt:new Date().toISOString()}];
   await tx.contract.update({where:{id},data:{documentData:JSON.stringify(data),...(contract.status==='READY'?{status:'ACTIVE'}:{})}});
  });
  return Response.json({attachment},{status:201});
 }catch(error){
  await unlink(path.join(process.cwd(),'storage','contract-attachments',url.split('/').pop())).catch(()=>{});
  if(error instanceof Error && error.message==='ต้องบันทึกวันที่ลงนามในเอกสารก่อนบันทึกหลักฐานส่งมอบเงิน')return Response.json({error:error.message},{status:409});
  return Response.json({error:'บันทึกหลักฐานไม่สำเร็จ กรุณาลองใหม่'},{status:500});
 }
}
