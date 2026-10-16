import { readFile } from 'node:fs/promises';
import { companyFilePath } from '@/lib/company-file-storage';

export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const legacyName = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp)$/i.test(filename);
  const organizedName = /^\d{5}-LOGO-\d{2}-\d{8}(?:-\d{2})?\.(jpg|png|webp)$/i.test(filename);
  if (!legacyName && !organizedName) return new Response(null, { status: 404 });
  try {
    const data = await readFile(companyFilePath('company-logos', request, filename));
    const types: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    return new Response(data, { headers: { 'Content-Type': types[filename.split('.').pop()!], 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return new Response(null, { status: 404 }); }
}
