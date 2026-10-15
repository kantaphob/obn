import { prisma } from '@/lib/prisma';
import { formatBorrowerCode } from '@/lib/borrower-code';
export async function GET(request:Request){
 const id=new URL(request.url).searchParams.get('id');
 if(id){const draft=await prisma.loanContractDraft.findUnique({where:{id}});if(!draft)return Response.json({error:'ไม่พบร่าง'},{status:404});return Response.json({...draft,data:JSON.parse(draft.dataJson)});}
 const drafts=await prisma.loanContractDraft.findMany({where:{finalizedContractId:null},orderBy:[{updatedAt:'desc'},{createdAt:'desc'},{id:'desc'}]});
 const borrowers=await prisma.borrowers.findMany({where:{id:{in:drafts.map(d=>d.borrowerId)}},select:{id:true,borrowersCode:true,firstName:true,lastName:true,nickname:true}});
 return Response.json(drafts.map(({dataJson,...draft})=>{const borrower=borrowers.find(b=>b.id===draft.borrowerId);return {...draft,status:'DRAFT',data:JSON.parse(dataJson),borrower:borrower?{...borrower,borrowersCode:formatBorrowerCode(borrower.borrowersCode)}:undefined};}),{headers:{'Cache-Control':'no-store'}});
}
export async function PUT(request:Request){
 const body=await request.json().catch(()=>null);
 if(!body || typeof body.id!=='string' || !/^[a-f0-9-]{36}$/.test(body.id) || typeof body.borrowerId!=='string' || !body.data || typeof body.data!=='object')return Response.json({error:'ข้อมูลร่างไม่ถูกต้อง'},{status:400});
 const existing=await prisma.loanContractDraft.findUnique({where:{id:body.id},select:{finalizedContractId:true}});if(existing?.finalizedContractId)return Response.json({error:'ร่างนี้บันทึกเป็นสัญญาแล้ว',contractId:existing.finalizedContractId},{status:409});
 const dataJson=JSON.stringify(body.data);if(Buffer.byteLength(dataJson)>4*1024*1024)return Response.json({error:'ข้อมูลร่างใหญ่เกินไป'},{status:400});
 if(!await prisma.borrowers.findUnique({where:{id:body.borrowerId},select:{id:true}}))return Response.json({error:'ไม่พบผู้กู้'},{status:404});
 const draft=await prisma.loanContractDraft.upsert({where:{id:body.id},create:{id:body.id,borrowerId:body.borrowerId,dataJson},update:{borrowerId:body.borrowerId,dataJson}});
 return Response.json({id:draft.id,status:'DRAFT',updatedAt:draft.updatedAt});
}

export async function DELETE(request:Request){
 const id=new URL(request.url).searchParams.get('id');
 if(!id || !/^[a-f0-9-]{36}$/.test(id))return Response.json({error:'รหัสร่างไม่ถูกต้อง'},{status:400});
 const deleted=await prisma.loanContractDraft.deleteMany({where:{id,finalizedContractId:null}});
 if(deleted.count===1)return Response.json({success:true});
 const existing=await prisma.loanContractDraft.findUnique({where:{id},select:{finalizedContractId:true}});
 if(!existing)return Response.json({error:'ไม่พบร่างนี้'},{status:404});
 return Response.json({error:'ร่างนี้บันทึกเป็นสัญญาแล้ว จึงลบจากรายการร่างไม่ได้'},{status:409});
}
