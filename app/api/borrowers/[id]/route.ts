import { prisma } from '@/lib/prisma'
import { isPrismaCode, parseBorrowerInput, validateBorrowerPayout } from '@/lib/borrowers'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params
  const borrower = await prisma.borrowers.findUnique({
    where: { id },
    include: { subdistrict: { select: { id: true, nameTh: true, postcode: true, district: { select: { id: true, nameTh: true, province: { select: { id: true, nameTh: true } } } } } } },
  })
  if (!borrower) return Response.json({ error: 'ไม่พบข้อมูลผู้กู้' }, { status: 404 })
  return Response.json(borrower, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(request: Request, { params }: RouteContext) {
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
    where: { id },
    select: { payoutChannel: true, payoutBankCode: true },
  })
  if (!current) return Response.json({ error: 'ไม่พบข้อมูลผู้กู้' }, { status: 404 })
  const payoutError = await validateBorrowerPayout(
    parsed.data.payoutChannel === undefined ? current.payoutChannel : parsed.data.payoutChannel,
    parsed.data.payoutBankCode === undefined ? current.payoutBankCode : parsed.data.payoutBankCode,
  )
  if (payoutError) return Response.json({ error: payoutError }, { status: 400 })

  try {
    const borrower = await prisma.borrowers.update({ where: { id }, data: parsed.data })
    return Response.json(borrower)
  } catch (error) {
    if (isPrismaCode(error, 'P2025')) return Response.json({ error: 'ไม่พบข้อมูลผู้กู้' }, { status: 404 })
    if (isPrismaCode(error, 'P2002')) {
      return Response.json({ error: 'เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว' }, { status: 409 })
    }
    if (isPrismaCode(error, 'P2003')) return Response.json({ error: 'ธนาคารที่เลือกไม่มีอยู่ในระบบ' }, { status: 400 })
    throw error
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params
  try {
    await prisma.borrowers.delete({ where: { id } })
    return Response.json({ success: true })
  } catch (error) {
    if (isPrismaCode(error, 'P2025')) return Response.json({ error: 'ไม่พบข้อมูลผู้กู้' }, { status: 404 })
    if (isPrismaCode(error, 'P2003')) {
      return Response.json({ error: 'ผู้กู้รายนี้มีสัญญาที่อ้างอิงอยู่ จึงลบไม่ได้' }, { status: 409 })
    }
    throw error
  }
}
