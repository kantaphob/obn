import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp)$/.test(filename)) return new Response(null, { status: 404 });
  try {
    const data = await readFile(path.join(process.cwd(), 'storage', 'company-logos', filename));
    const types: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    return new Response(data, { headers: { 'Content-Type': types[filename.split('.').pop()!], 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return new Response(null, { status: 404 }); }
}
