import { readFile } from 'node:fs/promises'
import path from 'node:path'

const contentTypes: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params
  const match = /^([0-9a-f-]{36})\.(jpg|png|webp)$/i.exec(filename)
  if (!match) return new Response('Not found', { status: 404 })

  try {
    const bytes = await readFile(path.join(process.cwd(), 'storage', 'borrower-images', filename))
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
