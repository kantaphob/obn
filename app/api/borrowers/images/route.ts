import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const acceptedTypes: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null)
  const image = formData?.get('image')
  if (!(image instanceof File) || !acceptedTypes[image.type]) {
    return Response.json({ error: 'รองรับไฟล์ JPG, PNG หรือ WebP เท่านั้น' }, { status: 400 })
  }
  if (image.size < 1 || image.size > 5 * 1024 * 1024) {
    return Response.json({ error: 'รูปภาพต้องมีขนาดไม่เกิน 5 MB' }, { status: 400 })
  }

  const filename = `${randomUUID()}${acceptedTypes[image.type]}`
  const directory = path.join(process.cwd(), 'storage', 'borrower-images')
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, filename), Buffer.from(await image.arrayBuffer()), { flag: 'wx' })
  return Response.json({ url: `/api/borrowers/images/${filename}` }, { status: 201 })
}
