import { readFile } from 'node:fs/promises';
import path from 'node:path';
export async function GET(_request: Request, { params }: {
    params: Promise<{
        filename: string;
    }>;
}) {
    const { filename } = await params;
    if (!/^[a-f0-9-]+\.(jpg|png|webp|pdf)$/.test(filename))
        return new Response(null, { status: 404 });
    try {
        const data = await readFile(path.join(process.cwd(), 'storage', 'contract-attachments', filename));
        const types: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' };
        return new Response(data, { headers: { 'Content-Type': types[filename.split('.').pop()!], 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
    }
    catch {
        return new Response(null, { status: 404 });
    }
}
