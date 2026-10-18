import { authorizeApiRequest } from "@/lib/authorization";
import { prisma } from '@/lib/prisma'
import { saveBorrowerFile } from '@/lib/borrower-file-storage'

const acceptedTypes: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

export async function POST(request: Request) {
  const denied = await authorizeApiRequest("borrowers", "write");
  if (denied) return denied;
  const formData = await request.formData().catch(() => null)
  const image = formData?.get('image')
  if (!(image instanceof File) || !acceptedTypes[image.type]) {
    return Response.json({ error: 'รองรับไฟล์ JPG, PNG หรือ WebP เท่านั้น' }, { status: 400 })
  }
  if (image.size < 1 || image.size > 5 * 1024 * 1024) {
    return Response.json({ error: 'รูปภาพต้องมีขนาดไม่เกิน 5 MB' }, { status: 400 })
  }

  const borrowerId = formData?.get('borrowerId')
  const borrower = typeof borrowerId === 'string'
    ? await prisma.borrowers.findUnique({ where: { id: borrowerId }, select: { borrowersCode: true } })
    : null
  const saved = await saveBorrowerFile({
    storageArea: 'borrower-images',
    borrowerCode: borrower?.borrowersCode || 'PENDING',
    contractNumber: 'PROFILE',
    extension: acceptedTypes[image.type].slice(1),
    apiRoute: '/api/borrowers/images',
    data: Buffer.from(await image.arrayBuffer()),
  })
  return Response.json({ url: saved.url }, { status: 201 })
}
