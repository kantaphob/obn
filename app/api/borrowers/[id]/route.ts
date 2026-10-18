import { authorizeApiRequest } from "@/lib/authorization";
import { after } from 'next/server';
import { syncLoanGoogleSheet } from '@/lib/integrations/google-sheets';
import { prisma } from '@/lib/prisma'
import { isPrismaCode, parseBorrowerInput, validateBorrowerPayout } from '@/lib/borrowers'
import { formatBorrowerCode } from '@/lib/borrower-code'
import { writeLoanLog } from '@/lib/loan-logs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  const denied = await authorizeApiRequest("borrowers", "read");
  if (denied) return denied;
  const { id } = await params
  const borrower = await prisma.borrowers.findUnique({
    where: { id, deletedAt: null },
    include: { subdistrict: { select: { id: true, nameTh: true, postcode: true, district: { select: { id: true, nameTh: true, province: { select: { id: true, nameTh: true } } } } } } },
  })
  if (!borrower) return Response.json({ error: 'ไม่พบข้อมูลผู้กู้' }, { status: 404 })
  return Response.json({ ...borrower, borrowersCode: formatBorrowerCode(borrower.borrowersCode) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(request: Request, { params }: RouteContext) {
  const denied = await authorizeApiRequest("borrowers", "write");
  if (denied) return denied;
  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'ข้อมูลที่ส่งมาไม่ถูกต้อง' }, { status: 400 })
  }

  const parsed = parseBorrowerInput(body, true)
  if ('error' in parsed) return Response.json({ error: parsed.error }, { status: 400 })
  if (Object.keys(parsed.data).length === 0) {
    return Response.json({ error: 'ไม่มีข้อมูลสำหรับแก้ไข' }, { status: 400 })
  }

  const current = await prisma.borrowers.findUnique({
    where: { id, deletedAt: null },
  })
  if (!current) return Response.json({ error: 'ไม่พบข้อมูลผู้กู้' }, { status: 404 })
  const payoutError = await validateBorrowerPayout(
    parsed.data.payoutChannel === undefined ? current.payoutChannel : parsed.data.payoutChannel,
    parsed.data.payoutBankCode === undefined ? current.payoutBankCode : parsed.data.payoutBankCode,
  )
  if (payoutError) return Response.json({ error: payoutError }, { status: 400 })

  try {
    const borrower = await prisma.$transaction(async tx => {
      const before = await tx.borrowers.findUnique({ where: { id, deletedAt: null } })
      if (!before) throw Object.assign(new Error('ไม่พบข้อมูลผู้กู้'), { code: 'P2025' })
      const updated = await tx.borrowers.update({ where: { id, deletedAt: null }, data: parsed.data })
      await writeLoanLog(tx, {
        borrowerId: id,
        targetId: id,
        type: 'BORROWER',
        action: 'UPDATE',
        note: `แก้ไขข้อมูลผู้กู้ ${formatBorrowerCode(updated.borrowersCode)}`,
        beforeData: before,
        afterData: updated,
      })
      return updated
    })
    after(async()=>{await syncLoanGoogleSheet();});
    return Response.json({ ...borrower, borrowersCode: formatBorrowerCode(borrower.borrowersCode) })
  } catch (error) {
    if (isPrismaCode(error, 'P2025')) return Response.json({ error: 'ไม่พบข้อมูลผู้กู้' }, { status: 404 })
    if (isPrismaCode(error, 'P2002')) {
      return Response.json({ error: 'เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว' }, { status: 409 })
    }
    if (isPrismaCode(error, 'P2003')) return Response.json({ error: 'ธนาคารที่เลือกไม่มีอยู่ในระบบ' }, { status: 400 })
    throw error
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const denied = await authorizeApiRequest("borrowers", "write");
  if (denied) return denied;
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({error:'ข้อมูลการลบไม่ถูกต้อง'},{status:400})
  if(body.reason !== undefined && (typeof body.reason !== 'string' || body.reason.length > 1000)) return Response.json({error:'เหตุผลการลบต้องไม่เกิน 1,000 ตัวอักษร'},{status:400})
  const reason = typeof body.reason === 'string' ? body.reason.trim() : null
  try {
    await prisma.$transaction(async tx => {
      const before = await tx.borrowers.findUnique({ where: { id }, include:{subdistrict:{include:{district:{include:{province:true}}}}} })
      if (!before) throw Object.assign(new Error('ไม่พบข้อมูลผู้กู้'), { code: 'P2025' })
      if (before.deletedAt) return
      const deletedAt = new Date()
      const changed = await tx.borrowers.updateMany({where:{id,deletedAt:null},data:{deletedAt}})
      if(!changed.count)return
      const archived = await tx.borrowersdelete.create({data:{borrowerId:id,borrowersCode:before.borrowersCode,snapshot:JSON.stringify(before),reason:reason||null,deletedAt}})
      await writeLoanLog(tx, {
        borrowerId: id, targetId: archived.id, type: 'BORROWER', action: 'DELETE',
        note: `ย้ายผู้กู้ ${formatBorrowerCode(before.borrowersCode)} ไปถังขยะ${reason ? `: ${reason}` : ''}`,
        beforeData: before, afterData:{deletedAt,archiveId:archived.id},
      })
    })
    return Response.json({ success: true })
  } catch (error) {
    if (isPrismaCode(error, 'P2025')) return Response.json({ error: 'ไม่พบข้อมูลผู้กู้' }, { status: 404 })
    throw error
  }
}
