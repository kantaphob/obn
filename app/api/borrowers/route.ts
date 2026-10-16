import { prisma } from '@/lib/prisma'
import { isPrismaCode, parseBorrowerInput, validateBorrowerPayout } from '@/lib/borrowers'
import { formatBorrowerCode } from '@/lib/borrower-code'
import { writeLoanLog } from '@/lib/loan-logs'
import { finalizePendingBorrowerProfileUrl } from '@/lib/borrower-file-storage'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim()
  const takeParam = Number(searchParams.get('take'))
  const take = Number.isInteger(takeParam) && takeParam > 0 ? Math.min(takeParam, 50) : undefined
  const nationalIdQuery = query?.replace(/\D/g, '')

  const borrowers = await prisma.borrowers.findMany({
    where: query
      ? {
          OR: [
            { borrowersCode: { contains: query.toLowerCase() } },
            { borrowersCode: { contains: query.toUpperCase() } },
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { nickname: { contains: query } },
            ...(nationalIdQuery ? [{ nationalId: { contains: nationalIdQuery } }] : []),
            { phone: { contains: query } },
          ],
        }
      : undefined,
    orderBy: { updatedAt: 'desc' },
    ...(take ? { take } : {}),
    include: {
      subdistrict: {
        select: { id: true, nameTh: true, postcode: true, district: { select: { id: true, nameTh: true, province: { select: { id: true, nameTh: true } } } } },
      },
    },
  })

  return Response.json(borrowers.map(borrower => ({ ...borrower, borrowersCode: formatBorrowerCode(borrower.borrowersCode) })), { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'ข้อมูลที่ส่งมาไม่ถูกต้อง' }, { status: 400 })
  }

  const parsed = parseBorrowerInput(body)
  if ('error' in parsed) return Response.json({ error: parsed.error }, { status: 400 })

  const payoutError = await validateBorrowerPayout(parsed.data.payoutChannel, parsed.data.payoutBankCode)
  if (payoutError) return Response.json({ error: payoutError }, { status: 400 })

  try {
    const borrower = await prisma.$transaction(async tx => {
      const sequence = await tx.borrowerCodeSequence.update({ where: { id: 1 }, data: { value: { increment: 1 } } })
      if (sequence.value > 999999) throw new Error('BORROWER_CODE_EXHAUSTED')
      const borrower = await tx.borrowers.create({ data: { ...parsed.data, borrowersCode: `BO${String(sequence.value).padStart(6, '0')}`, phone: parsed.data.phone ?? '', firstName: parsed.data.firstName ?? '' } })
      await writeLoanLog(tx, {
        borrowerId: borrower.id,
        targetId: borrower.id,
        type: 'BORROWER',
        action: 'CREATE',
        note: `เพิ่มผู้กู้ ${formatBorrowerCode(borrower.borrowersCode)}`,
        afterData: borrower,
      })
      return borrower
    })
    const photoUrl = await finalizePendingBorrowerProfileUrl(borrower.photoUrl, borrower.borrowersCode)
    const idCardImageUrl = borrower.idCardImageUrl === borrower.photoUrl
      ? photoUrl
      : await finalizePendingBorrowerProfileUrl(borrower.idCardImageUrl, borrower.borrowersCode)
    const finalized = photoUrl !== borrower.photoUrl || idCardImageUrl !== borrower.idCardImageUrl
      ? await prisma.borrowers.update({ where: { id: borrower.id }, data: { photoUrl, idCardImageUrl } })
      : borrower
    return Response.json(finalized, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'BORROWER_CODE_EXHAUSTED') return Response.json({ error: 'รหัสผู้กู้ครบ 999999 รายแล้ว' }, { status: 409 })
    if (isPrismaCode(error, 'P2002')) {
      return Response.json({ error: 'เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว' }, { status: 409 })
    }
    if (isPrismaCode(error, 'P2003')) return Response.json({ error: 'ธนาคารที่เลือกไม่มีอยู่ในระบบ' }, { status: 400 })
    throw error
  }
}
