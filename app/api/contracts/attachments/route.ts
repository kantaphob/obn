import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
export async function POST(request: Request) {
    const body = await request.formData().catch(() => null), file = body?.get('file');
    const types: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
    if (!(file instanceof File) || !types[file.type] || file.size < 1 || file.size > 10 * 1024 * 1024)
        return Response.json({ error: 'รองรับ JPG, PNG, WebP หรือ PDF ไม่เกิน 10 MB' }, { status: 400 });
    const data = Buffer.from(await file.arrayBuffer());
    const valid = file.type === 'application/pdf' ? data.subarray(0, 5).toString() === '%PDF-' : file.type === 'image/jpeg' ? data[0] === 255 && data[1] === 216 : file.type === 'image/png' ? data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP';
    if (!valid)
        return Response.json({ error: 'ชนิดไฟล์ไม่ตรงกับเนื้อหา' }, { status: 400 });
    const filename = `${randomUUID()}.${types[file.type]}`;
    const dir = path.join(process.cwd(), 'storage', 'contract-attachments');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), data, { flag: 'wx' });
    return Response.json({ url: `/api/contracts/attachments/${filename}` }, { status: 201 });
}
