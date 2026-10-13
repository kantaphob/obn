import { prisma } from '@/lib/prisma';
import type { CatalogKind } from '@/lib/reference-catalog-types';

class InputError extends Error {}

function failure(error: unknown) {
  if (error instanceof InputError) return Response.json({ error: error.message }, { status: 400 });
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  if (code === 'P2002') return Response.json({ error: 'รหัสหรือชื่อลักษณนามนี้มีอยู่แล้ว กรุณาใช้ค่าอื่น' }, { status: 409 });
  if (code === 'P2025') return Response.json({ error: 'ไม่พบรายการนี้ อาจถูกลบไปแล้ว' }, { status: 404 });
  if (code === 'P2003') return Response.json({ error: 'หน่วยนี้ถูกใช้อ้างอิงในรายการวัสดุ กรุณาเปลี่ยนหน่วยของวัสดุก่อนลบ หรือตรวจสอบรหัสหน่วยที่เลือก' }, { status: 409 });
  console.error('Catalog mutation failed', error);
  return Response.json({ error: 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่' }, { status: 500 });
}

function text(body: Record<string, unknown>, key: string, max: number, required: boolean, creating: boolean) {
  if (!(key in body)) {
    if (creating && required) throw new InputError(`กรุณาระบุ ${key}`);
    return undefined;
  }
  if (typeof body[key] !== 'string') throw new InputError(`${key} ต้องเป็นข้อความ`);
  const value = body[key].trim();
  if (value.length > max || (required && !value)) throw new InputError(`${key} ต้อง${required ? 'ไม่ว่างและ' : ''}ยาวไม่เกิน ${max} ตัวอักษร`);
  return value;
}

function fields(body: Record<string, unknown>, kind: CatalogKind, creating: boolean) {
  const common = {
    nameTh: text(body, 'nameTh', 120, true, creating),
    nameEn: text(body, 'nameEn', 160, false, creating) ?? (creating ? '' : undefined),
    category: text(body, 'category', 100, true, creating),
  };
  const symbol = kind === 'units' ? text(body, 'symbol', 40, true, creating) : undefined;
  const standard = kind === 'units' ? text(body, 'standard', 80, false, creating) : undefined;
  const examples = kind === 'classifiers' ? text(body, 'examples', 1000, true, creating) : undefined;
  let recommendedUnitCode: string | null | undefined;
  if (kind === 'materials' && ('recommendedUnitCode' in body || creating)) {
    recommendedUnitCode = body.recommendedUnitCode === null ? null : text(body, 'recommendedUnitCode', 32, false, false) || null;
  }
  return { ...common, symbol, standard: standard ?? (creating && kind === 'units' ? 'กำหนดเอง' : undefined), examples, recommendedUnitCode };
}

function date() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export async function readCatalogItem(kind: CatalogKind, code: string) {
  try {
    const item = kind === 'units' ? await prisma.unit.findUnique({ where: { code } }) : kind === 'classifiers' ? await prisma.classifier.findUnique({ where: { code } }) : await prisma.material.findUnique({ where: { code }, include: { recommendedUnit: true } });
    return item ? Response.json(item) : Response.json({ error: 'ไม่พบรายการนี้' }, { status: 404 });
  } catch (error) { return failure(error); }
}

export async function mutateCatalog(request: Request, kind: CatalogKind, code?: string) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'ไม่อนุญาตคำขอจากเว็บไซต์อื่น' }, { status: 403 });
  try {
    if (request.method === 'DELETE') {
      if (!code) throw new InputError('กรุณาระบุรหัสรายการ');
      if (kind === 'units') await prisma.unit.delete({ where: { code } });
      else if (kind === 'classifiers') await prisma.classifier.delete({ where: { code } });
      else await prisma.material.delete({ where: { code } });
      return new Response(null, { status: 204 });
    }
    let body: unknown;
    try { body = await request.json(); } catch { throw new InputError('ข้อมูล JSON ไม่ถูกต้อง'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InputError('ข้อมูลที่ส่งมาไม่ถูกต้อง');
    const input = body as Record<string, unknown>;
    const creating = request.method === 'POST';
    const inputCode = text(input, 'code', 32, creating, creating);
    if (creating && !/^[A-Z0-9][A-Z0-9_-]{0,31}$/.test(inputCode!)) throw new InputError('รหัสใช้ตัวอักษรอังกฤษพิมพ์ใหญ่ ตัวเลข ขีดกลาง และขีดล่างเท่านั้น');
    if (!creating && inputCode !== undefined && inputCode !== code) throw new InputError('ไม่สามารถเปลี่ยนรหัสรายการได้');
    const data = fields(input, kind, creating);
    if (!creating && !Object.values(data).some((value) => value !== undefined)) throw new InputError('ไม่มีข้อมูลสำหรับแก้ไข');
    const metadata = { sourceVersion: creating ? 'เพิ่มในระบบ' : 'แก้ไขในระบบ', sourceDate: date() };
    let item;
    if (creating) {
      const common = { code: inputCode!, nameTh: data.nameTh!, nameEn: data.nameEn!, category: data.category!, sourceUrl: '', ...metadata };
      if (kind === 'units') item = await prisma.unit.create({ data: { ...common, symbol: data.symbol!, standard: data.standard! } });
      else if (kind === 'classifiers') item = await prisma.classifier.create({ data: { ...common, examples: data.examples! } });
      else item = await prisma.material.create({ data: { ...common, recommendedUnitCode: data.recommendedUnitCode }, include: { recommendedUnit: true } });
    } else {
      const common = { nameTh: data.nameTh, nameEn: data.nameEn, category: data.category, ...metadata };
      if (kind === 'units') item = await prisma.unit.update({ where: { code }, data: { ...common, symbol: data.symbol, standard: data.standard } });
      else if (kind === 'classifiers') item = await prisma.classifier.update({ where: { code }, data: { ...common, examples: data.examples } });
      else item = await prisma.material.update({ where: { code }, data: { ...common, recommendedUnitCode: data.recommendedUnitCode }, include: { recommendedUnit: true } });
    }
    return Response.json(item, { status: creating ? 201 : 200 });
  } catch (error) { return failure(error); }
}
