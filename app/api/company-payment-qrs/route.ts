import { authorizeApiRequest } from "@/lib/authorization";
import { saveCompanyFile } from '@/lib/company-file-storage';

export async function POST(request: Request) {
  const denied = await authorizeApiRequest("companies", "write");
  if (denied) return denied;
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'ไม่อนุญาตคำขอจากเว็บไซต์อื่น' }, { status: 403 });
  try {
    const body = await request.formData().catch(() => null);
    const file = body?.get('file');
    const entityCode = String(body?.get('entityCode') ?? '');
    const types: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    if (!(file instanceof File) || !types[file.type] || file.size < 1 || file.size > 5 * 1024 * 1024) {
      return Response.json({ error: 'รองรับ PNG, JPG หรือ WebP ขนาดไม่เกิน 5 MB' }, { status: 400 });
    }
    if (!/^\d{5}$/.test(entityCode)) return Response.json({ error: 'ไม่พบรหัสบริษัทหรือสาขาสำหรับจัดเก็บไฟล์' }, { status: 400 });
    const data = Buffer.from(await file.arrayBuffer());
    const valid = file.type === 'image/jpeg' ? data[0] === 255 && data[1] === 216 && data[2] === 255
      : file.type === 'image/png' ? data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP';
    if (!valid) return Response.json({ error: 'ชนิดไฟล์ไม่ตรงกับเนื้อหา' }, { status: 400 });
    const saved = await saveCompanyFile({ storageArea: 'company-payment-qrs', entityCode, label: 'PAYMENT', extension: types[file.type], apiRoute: '/api/company-payment-qrs', data });
    return Response.json({ url: saved.url }, { status: 201 });
  } catch (error) {
    console.error('Company logo upload failed', error);
    return Response.json({ error: 'อัปโหลดQR Codeไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
  }
}
