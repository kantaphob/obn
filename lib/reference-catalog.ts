import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import type { CatalogKind, CatalogResult } from '@/lib/reference-catalog-types';

function integer(value: string | null, fallback: number) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
    throw new Error('page และ pageSize ต้องเป็นจำนวนเต็มบวก');
  }
  return Number(value);
}

export async function getReferenceCatalog(request: Request, kind: CatalogKind) {
  const params = new URL(request.url).searchParams;
  let page: number;
  let pageSize: number;
  try {
    page = integer(params.get('page'), 1);
    pageSize = Math.min(integer(params.get('pageSize'), 25), 100);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
  const q = params.get('q')?.trim() ?? '';
  const category = params.get('category')?.trim() ?? '';
  const code = params.get('code')?.trim() ?? '';
  const unitCode = params.get('unitCode')?.trim() ?? '';
  if (q.length > 120 || category.length > 100 || code.length > 32 || unitCode.length > 32) {
    return Response.json({ error: 'คำค้นหาหรือตัวกรองยาวเกินกำหนด' }, { status: 400 });
  }
  const common = {
    ...(category ? { category } : {}),
    ...(code ? { code } : {}),
  };
  const search = [
    { code: { contains: q } }, { nameTh: { contains: q } },
    { nameEn: { contains: q } }, { category: { contains: q } },
  ];
  try {
    const result: CatalogResult = await prisma.$transaction(async (db) => {
      if (kind === 'classifiers') {
        const where: Prisma.ClassifierWhereInput = {
          ...common, ...(q ? { OR: [...search, { examples: { contains: q } }] } : {}),
        };
        const total = await db.classifier.count({ where });
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const currentPage = Math.min(page, totalPages);
        const items = await db.classifier.findMany({ where, orderBy: { code: 'asc' }, skip: (currentPage - 1) * pageSize, take: pageSize });
        const groups = await db.classifier.findMany({ distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } });
        const totalRecords = await db.classifier.count();
        return { items, categories: groups.map((row) => row.category), total, totalRecords, page: currentPage, pageSize, totalPages };
      }
      if (kind === 'units') {
        const where: Prisma.UnitWhereInput = {
          ...common, ...(q ? { OR: [...search, { symbol: { contains: q } }] } : {}),
        };
        const total = await db.unit.count({ where });
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const currentPage = Math.min(page, totalPages);
        const items = await db.unit.findMany({ where, orderBy: [{ category: 'asc' }, { code: 'asc' }], skip: (currentPage - 1) * pageSize, take: pageSize });
        const groups = await db.unit.findMany({ distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } });
        const totalRecords = await db.unit.count();
        return { items, categories: groups.map((row) => row.category), total, totalRecords, page: currentPage, pageSize, totalPages };
      }
      const where: Prisma.MaterialWhereInput = {
        ...common,
        ...(unitCode ? { recommendedUnitCode: unitCode } : {}),
        ...(q ? { OR: search } : {}),
      };
      const total = await db.material.count({ where });
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const currentPage = Math.min(page, totalPages);
      const items = await db.material.findMany({
        where, orderBy: [{ category: 'asc' }, { code: 'asc' }], skip: (currentPage - 1) * pageSize, take: pageSize,
        include: { recommendedUnit: { select: { code: true, nameTh: true, symbol: true } } },
      });
      const groups = await db.material.findMany({ distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } });
      const totalRecords = await db.material.count();
      return { items, categories: groups.map((row) => row.category), total, totalRecords, page: currentPage, pageSize, totalPages };
    });
    return Response.json(result);
  } catch (error) {
    console.error(`Unable to load ${kind}`, error);
    return Response.json({ error: 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
  }
}
