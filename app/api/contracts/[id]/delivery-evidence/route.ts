import { authorizeApiRequest } from "@/lib/authorization";
import { prisma } from '@/lib/prisma';
import { POST as upload } from '../../attachments/route';
import { unlink } from 'node:fs/promises';
import { storedUploadPath } from '@/lib/borrower-file-storage';
import { writeLoanLog } from '@/lib/loan-logs';

export async function DELETE(request:Request, context:{params:Promise<{id:string}>}) {
  const denied = await authorizeApiRequest("contracts", "write");
  if (denied) return denied;
 const origin=request.headers.get('origin');
 if(origin && origin!==new URL(request.url).origin)return Response.json({error:'ไม่อนุญาตคำขอจากเว็บไซต์อื่น'},{status:403});
 const body=await request.json().catch(()=>null);
 if(typeof body?.url!=='string' || !body.url.startsWith('/api/contracts/attachments/'))return Response.json({error:'ข้อมูลหลักฐานไม่ถูกต้อง'},{status:400});
 const {id}=await context.params;
 try {
  await prisma.$transaction(async tx=>{
   const locked=await tx.contract.updateMany({where:{id},data:{updatedAt:new Date()}});
   if(!locked.count)throw new Error('CONTRACT_NOT_FOUND');
   const contract=await tx.contract.findUniqueOrThrow({where:{id},select:{documentData:true,debtorId:true,contractNumber:true}});
   const data=JSON.parse(contract.documentData||'{}');
   const attachments:{url:string;name?:string}[]=Array.isArray(data.attachments)?data.attachments:[];
   const records:{url:string;name?:string}[]=Array.isArray(data.deliveryEvidenceRecords)?data.deliveryEvidenceRecords:[];
   const evidence=records.find(file=>file.url===body.url) || attachments.find(file=>file.url===body.url && /^(หลักฐานส่งมอบเงิน|หลักฐานโอนเงินเดิม)/.test(file.name||''));
   if(!evidence)throw new Error('EVIDENCE_NOT_FOUND');
   data.attachments=attachments.filter(file=>file.url!==body.url);
   data.deliveryEvidenceRecords=records.filter(file=>file.url!==body.url);
   await tx.contract.update({where:{id},data:{documentData:JSON.stringify(data)}});
   await writeLoanLog(tx,{borrowerId:contract.debtorId,contractId:id,targetId:id,type:'CONTRACT',action:'UPDATE',note:`ลบหลักฐานส่งมอบเงินที่แนบผิด สัญญา ${contract.contractNumber}`,beforeData:{deliveryEvidenceCount:records.length,removedEvidence:evidence},afterData:{deliveryEvidenceCount:data.deliveryEvidenceRecords.length}});
  });
  return Response.json({deletedUrl:body.url});
 } catch(error) {
  if(error instanceof Error && ['CONTRACT_NOT_FOUND','EVIDENCE_NOT_FOUND'].includes(error.message))return Response.json({error:error.message==='CONTRACT_NOT_FOUND'?'ไม่พบสัญญา':'ไม่พบหลักฐานส่งมอบเงินในสัญญานี้'},{status:404});
  return Response.json({error:'ลบหลักฐานไม่สำเร็จ กรุณาลองใหม่'},{status:500});
 }
}

export async function POST(request:Request, context:{params:Promise<{id:string}>}){
  const denied = await authorizeApiRequest("contracts", "write");
  if (denied) return denied;
 const {id}=await context.params;
 const existing=await prisma.contract.findUnique({where:{id},select:{id:true,contractNumber:true,debtorId:true}});
 if(!existing)return Response.json({error:'ไม่พบสัญญา'},{status:404});
 const form=await request.formData().catch(()=>null);
 if(!form)return Response.json({error:'ข้อมูลที่ส่งมาไม่ถูกต้อง'},{status:400});
 form.set('contractId',id);form.set('borrowerId',existing.debtorId);form.set('contractNumber',existing.contractNumber);
 const result=await upload(new Request(request.url,{method:'POST',headers:{origin:request.headers.get('origin')||''},body:form}));
 if(!result.ok)return result;
 const {url}=await result.json();
 const attachment={url,name:`หลักฐานส่งมอบเงิน ${new Date().toISOString()}`};
 try{
  await prisma.$transaction(async tx=>{
   // Acquire the SQLite write lock before reading metadata to preserve concurrent uploads.
   await tx.contract.update({where:{id},data:{updatedAt:new Date()}});
   const contract=await tx.contract.findUniqueOrThrow({where:{id},select:{debtorId:true,contractNumber:true,documentData:true,status:true}});
   if(contract.status==='AWAITING_DOCUMENT')throw new Error('ต้องบันทึกวันที่ลงนามในเอกสารก่อนบันทึกหลักฐานส่งมอบเงิน');
   const data=contract.documentData?JSON.parse(contract.documentData):{};
   const previousCount=Array.isArray(data.deliveryEvidenceRecords)?data.deliveryEvidenceRecords.length:0;
   data.attachments=[...(Array.isArray(data.attachments)?data.attachments:[]),attachment];
   data.deliveryEvidenceRecords=[...(Array.isArray(data.deliveryEvidenceRecords)?data.deliveryEvidenceRecords:[]),{...attachment,uploadedAt:new Date().toISOString()}];
   const nextStatus=contract.status==='READY'?'ACTIVE':contract.status;
   await tx.contract.update({where:{id},data:{documentData:JSON.stringify(data),...(contract.status==='READY'?{status:nextStatus}:{})}});
   await writeLoanLog(tx, {
    borrowerId:contract.debtorId,contractId:id,targetId:id,type:'CONTRACT',action:'UPDATE',
    note:`เพิ่มหลักฐานส่งมอบเงินสัญญา ${contract.contractNumber}`,
    beforeData:{deliveryEvidenceCount:previousCount,status:contract.status},
    afterData:{deliveryEvidenceCount:previousCount+1,status:nextStatus},
   });
  });
  return Response.json({attachment},{status:201});
 }catch(error){
  await unlink(storedUploadPath('contract-attachments',url)).catch(()=>{});
  if(error instanceof Error && error.message==='ต้องบันทึกวันที่ลงนามในเอกสารก่อนบันทึกหลักฐานส่งมอบเงิน')return Response.json({error:error.message},{status:409});
  return Response.json({error:'บันทึกหลักฐานไม่สำเร็จ กรุณาลองใหม่'},{status:500});
 }
}
