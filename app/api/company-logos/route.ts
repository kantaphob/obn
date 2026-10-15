import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'ไม่อนุญาตคำขอจากเว็บไซต์อื่น' }, { status: 403 });
  try {
    const body = await request.formData().catch(() => null);
    const file = body?.get('file');
    const types: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    if (!(file instanceof File) || !types[file.type] || file.size < 1 || file.size > 5 * 1024 * 1024) {
      return Response.json({ error: 'รองรับ PNG, JPG หรือ WebP ขนาดไม่เกิน 5 MB' }, { status: 400 });
    }
    const data = Buffer.from(await file.arrayBuffer());
    const valid = file.type === 'image/jpeg' ? data[0] === 255 && data[1] === 216 && data[2] === 255
      : file.type === 'image/png' ? data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP';
    if (!valid) return Response.json({ error: 'ชนิดไฟล์ไม่ตรงกับเนื้อหา' }, { status: 400 });
    const filename = `${randomUUID()}.${types[file.type]}`;
    const dir = path.join(process.cwd(), 'storage', 'company-logos');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), data, { flag: 'wx' });
    return Response.json({ url: `/api/company-logos/${filename}` }, { status: 201 });
  } catch (error) {
    console.error('Company logo upload failed', error);
    return Response.json({ error: 'อัปโหลดโลโก้ไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
  }
}
