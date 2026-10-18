import { authorizeApiRequest } from "@/lib/authorization";
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import type { PostcodeResult } from '@/lib/postcode-types';

function positiveInteger(value: string | null, fallback?: number) {
  if (value === null || value === '') return fallback;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
    throw new Error('invalid parameter');
  }
  return Number(value);
}

export async function GET(request: Request) {
  const denied = await authorizeApiRequest("masterdata", "read");
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  let page: number, pageSize: number, provinceId: number | undefined, districtId: number | undefined;
  try {
    page = positiveInteger(params.get('page'), 1)!;
    pageSize = Math.min(positiveInteger(params.get('pageSize'), 25)!, 100);
    provinceId = positiveInteger(params.get('provinceId'));
    districtId = positiveInteger(params.get('districtId'));
  } catch {
    return Response.json({ error: 'page, pageSize, provinceId และ districtId ต้องเป็นจำนวนเต็มบวก' }, { status: 400 });
  }
  const q = params.get('q')?.trim() ?? '';
  const postcode = params.get('postcode')?.trim();
  if (q.length > 120 || (postcode && !/^\d{5}$/.test(postcode))) {
    return Response.json({ error: 'คำค้นต้องไม่เกิน 120 ตัวอักษร และ postcode ต้องเป็นตัวเลข 5 หลัก' }, { status: 400 });
  }
  const where: Prisma.SubdistrictWhereInput = {
    ...(districtId ? { districtId } : {}),
    ...(provinceId ? { district: { provinceId } } : {}),
    ...(postcode ? { postcode } : {}),
    ...(q ? { OR: [
      { postcode: { contains: q } }, { nameTh: { contains: q } }, { nameEn: { contains: q } },
      { district: { nameTh: { contains: q } } }, { district: { nameEn: { contains: q } } },
      { district: { province: { nameTh: { contains: q } } } },
      { district: { province: { nameEn: { contains: q } } } },
    ] } : {}),
  };
  try {
    const result = await prisma.$transaction(async (db) => {
      const total = await db.subdistrict.count({ where });
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const currentPage = Math.min(page, totalPages);
      const items = await db.subdistrict.findMany({
        where, orderBy: { id: 'asc' }, skip: (currentPage - 1) * pageSize, take: pageSize,
        select: {
          id: true, nameTh: true, nameEn: true, postcode: true, latitude: true, longitude: true,
          district: { select: { id: true, nameTh: true, nameEn: true, province: { select: { id: true, nameTh: true, nameEn: true } } } },
        },
      });
      const provinces = await db.province.findMany({ orderBy: { nameTh: 'asc' } });
      const districts = provinceId ? await db.district.findMany({ where: { provinceId }, orderBy: { nameTh: 'asc' }, select: { id: true, nameTh: true, nameEn: true } }) : [];
      return { items, provinces, districts, total, page: currentPage, pageSize, totalPages } satisfies PostcodeResult;
    });
    return Response.json(result);
  } catch (error) {
    console.error('Unable to load postcodes', error);
    return Response.json({ error: 'ไม่สามารถโหลดข้อมูลรหัสไปรษณีย์ได้ กรุณาลองใหม่' }, { status: 500 });
  }
}
