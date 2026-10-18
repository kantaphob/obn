import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const storageRoot = path.join(process.cwd(), 'storage');

function timestamp(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', year: '2-digit', day: '2-digit', hour: '2-digit',
    minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.day}${parts.hour}${parts.minute}${parts.second}`;
}

export async function saveCompanyFile({
  storageArea,
  entityCode,
  label,
  extension,
  apiRoute,
  data,
}: {
  storageArea: 'company-logos' | 'company-owner-documents' | 'company-payment-qrs';
  entityCode: string;
  label: 'LOGO' | 'OWNER' | 'PAYMENT';
  extension: string;
  apiRoute: string;
  data: Buffer;
}) {
  if (!/^\d{5}$/.test(entityCode)) throw new Error('รหัสบริษัทหรือสาขาไม่ถูกต้อง');
  const directory = path.join(storageRoot, storageArea, entityCode);
  await mkdir(directory, { recursive: true });
  const stem = `${entityCode}-${label}-${timestamp()}`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const filename = `${stem}${attempt ? `-${String(attempt).padStart(2, '0')}` : ''}.${extension}`;
    try {
      await writeFile(path.join(directory, filename), data, { flag: 'wx' });
      const query = new URLSearchParams({ folder: entityCode });
      return { filename, url: `${apiRoute}/${encodeURIComponent(filename)}?${query}` };
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) throw error;
    }
  }
  throw new Error('ไม่สามารถตั้งชื่อไฟล์ที่ไม่ซ้ำได้');
}

export function companyFilePath(storageArea: 'company-logos' | 'company-owner-documents' | 'company-payment-qrs', request: Request, filename: string) {
  if (!filename || filename !== path.basename(filename)) throw new Error('Invalid upload filename');
  const folder = new URL(request.url).searchParams.get('folder');
  if (folder) {
    if (!/^\d{5}$/.test(folder)) throw new Error('Invalid upload folder');
    const match = /^(\d{5})-(?:LOGO|OWNER)-/.exec(filename);
    if (match && match[1] !== folder) throw new Error('Invalid upload folder');
    const categorizedPath = path.join(storageRoot, storageArea, folder, filename);
    if (existsSync(categorizedPath)) return categorizedPath;
  }
  return path.join(storageRoot, storageArea, filename);
}

export function isCompanyOwnerDocumentUrl(value: string) {
  try {
    const parsed = new URL(value, 'http://local.invalid');
    if (parsed.pathname.startsWith('/api/company-owner-documents/')) {
      const filename = decodeURIComponent(parsed.pathname.split('/').pop() || '');
      const validName = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(pdf|jpg|png|webp)$/i.test(filename)
        || /^\d{5}-OWNER-\d{2}-\d{8}(?:-\d{2})?\.(pdf|jpg|png|webp)$/i.test(filename);
      const folder = parsed.searchParams.get('folder');
      const code = /^(\d{5})-OWNER-/.exec(filename)?.[1];
      return validName && (!folder || /^\d{5}$/.test(folder)) && (!code || !folder || code === folder);
    }
    return false;
  } catch {
    return false;
  }
}
