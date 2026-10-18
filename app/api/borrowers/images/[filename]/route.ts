import { authorizeApiRequest } from "@/lib/authorization";
import { readFile } from 'node:fs/promises'
import { storedUploadPath } from '@/lib/borrower-file-storage'

const contentTypes: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const denied = await authorizeApiRequest("borrowers", "read");
  if (denied) return denied;
  const { filename } = await params
  const match = /^([A-Za-z0-9ก-๛._-]+)\.(jpg|png|webp)$/i.exec(filename)
  if (!match) return new Response('Not found', { status: 404 })

  try {
    const bytes = await readFile(storedUploadPath('borrower-images', _request.url))
    return new Response(bytes, {
      headers: {
        'Content-Type': contentTypes[match[2].toLowerCase()],
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
