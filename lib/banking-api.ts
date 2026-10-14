import { prisma } from '@/lib/prisma';
class InputError extends Error {}
export function bankingError(error: unknown) {
 if (error instanceof InputError) return Response.json({ error: error.message }, { status: 400 });
 const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
 if (code === 'P2002') return Response.json({ error: 'รหัสธนาคารนี้มีอยู่แล้ว' }, { status: 409 });
 if (code === 'P2025') return Response.json({ error: 'ไม่พบธนาคารนี้' }, { status: 404 });
 if (code === 'P2003') return Response.json({ error: 'มีผู้กู้ใช้ธนาคารนี้เป็นช่องรับเงิน จึงลบไม่ได้' }, { status: 409 });
 console.error('Banking request failed', error);
 return Response.json({ error: 'ไม่สามารถดำเนินการได้ กรุณาลองใหม่' }, { status: 500 });
}
export async function mutateBank(request: Request, id?: string) {
 const origin = request.headers.get('origin');
 if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'ไม่อนุญาตคำขอจากเว็บไซต์อื่น' }, { status: 403 });
 try {
  if (request.method === 'DELETE' && id) {
   await prisma.banking.delete({ where: { id } });
   return new Response(null, { status: 204 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { throw new InputError('JSON ไม่ถูกต้อง'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InputError('ข้อมูลไม่ถูกต้อง');
  const input = body as Record<string, unknown>;
  const value = (key: string, max: number) => {
   const v = input[key];
   if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw new InputError(`กรุณาระบุ ${key} ไม่เกิน ${max} ตัวอักษร`);
   return v.trim();
  };
  const bankCode = value('bankCode', 3);
  if (!/^\d{3}$/.test(bankCode)) throw new InputError('รหัสธนาคารต้องเป็นตัวเลข 3 หลัก เช่น 002');
  const bankNameEN = value('bankNameEN', 200);
  const data = { bankCode, bankShort: value('bankShort', 30).toUpperCase(), bankNameTH: value('bankNameTH', 200), bankNameEN, bankFull: bankNameEN };
  const bank = id ? await prisma.banking.update({ where: { id }, data }) : await prisma.banking.create({ data });
  return Response.json(bank, { status: id ? 200 : 201 });
 } catch (error) { return bankingError(error); }
}
