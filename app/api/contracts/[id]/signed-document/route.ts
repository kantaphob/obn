import { prisma } from '@/lib/prisma';
import { POST as upload } from '../../attachments/route';
import { unlink } from 'node:fs/promises';
import path from 'node:path';

export async function POST(request:Request, context:{params:Promise<{id:string}>}){
 const {id}=await context.params;
 const existing=await prisma.contract.findUnique({where:{id},select:{status:true,signatureMode:true}});
 if(!existing)return Response.json({error:'ไม่พบสัญญา'},{status:404});
 if(existing.status!=='AWAITING_DOCUMENT'||existing.signatureMode!=='PRINT')return Response.json({error:'สัญญานี้ไม่อยู่ระหว่างรอเอกสารลงนาม'},{status:409});
 const result=await upload(request);
 if(!result.ok)return result;
 const {url}=await result.json();
 const attachment={url,name:`สำเนาสัญญาที่ลงนามแล้ว ${new Date().toISOString()}`};
 try{
  await prisma.$transaction(async tx=>{
   await tx.contract.update({where:{id},data:{updatedAt:new Date()}});
   const contract=await tx.contract.findUniqueOrThrow({where:{id},select:{documentData:true,status:true,signatureMode:true}});
   if(contract.status!=='AWAITING_DOCUMENT'||contract.signatureMode!=='PRINT')throw new Error('สัญญานี้ไม่อยู่ระหว่างรอเอกสารลงนาม');
   const data=contract.documentData?JSON.parse(contract.documentData):{};
   data.signedDocument={...attachment,uploadedAt:new Date().toISOString()};
   await tx.contract.update({where:{id},data:{documentData:JSON.stringify(data),status:'READY'}});
  });
  return Response.json({attachment},{status:201});
 }catch(error){
  await unlink(path.join(process.cwd(),'storage','contract-attachments',url.split('/').pop())).catch(()=>{});
  if(error instanceof Error&&error.message==='สัญญานี้ไม่อยู่ระหว่างรอเอกสารลงนาม')return Response.json({error:error.message},{status:409});
  return Response.json({error:'บันทึกสำเนาสัญญาไม่สำเร็จ กรุณาลองใหม่'},{status:500});
 }
}
