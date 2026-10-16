import { existsSync } from 'node:fs';
import { link, mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const storageRoot = path.join(process.cwd(), 'storage');

export function safeFilePart(value: string, fallback: string) {
  const cleaned = value.normalize('NFC').trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/\.+$/g, '')
    .slice(0, 100);
  return cleaned && cleaned !== '.' && cleaned !== '..' ? cleaned : fallback;
}

function bangkokTimestamp(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', year: '2-digit', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.day}${parts.hour}${parts.minute}${parts.second}`;
}

export async function saveBorrowerFile({
  storageArea,
  borrowerCode,
  contractNumber,
  extension,
  apiRoute,
  data,
}: {
  storageArea: string;
  borrowerCode: string;
  contractNumber: string;
  extension: string;
  apiRoute: string;
  data: Buffer;
}) {
  const code = safeFilePart(borrowerCode, 'PENDING').replace(/[^A-Za-z0-9ก-๛]/g, '') || 'PENDING';
  const contract = safeFilePart(contractNumber, 'PROFILE').replace(/[^A-Za-z0-9ก-๛]/g, '') || 'PROFILE';
  const stem = `${code}-${contract}-${bangkokTimestamp()}`;
  const folder = code;
  const directory = path.join(storageRoot, storageArea, folder);
  await mkdir(directory, { recursive: true });

  let filename = `${stem}.${extension}`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (attempt) filename = `${stem}-${String(attempt).padStart(2, '0')}.${extension}`;
    try {
      await writeFile(path.join(directory, filename), data, { flag: 'wx' });
      const query = new URLSearchParams({ folder });
      return { filename, folder, path: path.join(directory, filename), url: `${apiRoute}/${encodeURIComponent(filename)}?${query}` };
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) throw error;
    }
  }
  throw new Error('ไม่สามารถตั้งชื่อไฟล์ที่ไม่ซ้ำได้');
}

export function storedUploadPath(category: string, url: string) {
  const parsed = new URL(url, 'http://local.invalid');
  const filename = decodeURIComponent(parsed.pathname.split('/').pop() || '');
  if (!filename || filename !== path.basename(filename)) throw new Error('Invalid upload filename');
  const folder = parsed.searchParams.get('folder');
  if (folder) {
    if (folder !== safeFilePart(folder, '')) throw new Error('Invalid upload folder');
    const categorizedPath = path.join(storageRoot, category, folder, filename);
    // Keep URLs already saved while files used a borrower-name folder at storage root.
    return existsSync(categorizedPath) ? categorizedPath : path.join(storageRoot, folder, filename);
  }
  return path.join(storageRoot, category, filename);
}

export async function finalizePendingBorrowerProfileUrl(url: string | null | undefined, borrowerCode: string) {
  if (!url) return url ?? null;
  const parsed = new URL(url, 'http://local.invalid');
  if (!parsed.pathname.startsWith('/api/borrowers/images/')) return url;
  const filename = decodeURIComponent(parsed.pathname.split('/').pop() || '');
  const match = /^PENDING-PROFILE-(\d{2}-\d{8})(?:-(\d+))?\.(jpg|png|webp)$/i.exec(filename);
  const oldFolder = parsed.searchParams.get('folder');
  if (!match || !oldFolder) return url;

  const code = safeFilePart(borrowerCode, 'PENDING').replace(/[^A-Za-z0-9ก-๛]/g, '') || 'PENDING';
  const folder = code;
  const directory = path.join(storageRoot, 'borrower-images', folder);
  await mkdir(directory, { recursive: true });
  const stem = `${code}-PROFILE-${match[1]}`;
  let nextFilename = `${stem}.${match[3].toLowerCase()}`;
  let attempt = 0;
  while (true) {
    try {
      const sourcePath = storedUploadPath('borrower-images', url);
      await link(sourcePath, path.join(directory, nextFilename));
      await unlink(sourcePath);
      break;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
        attempt += 1;
        nextFilename = `${stem}-${String(attempt).padStart(2, '0')}.${match[3].toLowerCase()}`;
        continue;
      }
      throw error;
    }
  }
  const query = new URLSearchParams({ folder });
  return `/api/borrowers/images/${encodeURIComponent(nextFilename)}?${query}`;
}

export function isUploadUrl(url: string, apiRoute: string, extensions: string[]) {
  try {
    const parsed = new URL(url, 'http://local.invalid');
    const filename = decodeURIComponent(parsed.pathname.slice(apiRoute.length + 1));
    const folder = parsed.searchParams.get('folder');
    return parsed.pathname.startsWith(`${apiRoute}/`)
      && filename === path.basename(filename)
      && new RegExp(`^[A-Za-z0-9ก-๛._-]+\\.(${extensions.join('|')})$`, 'i').test(filename)
      && (!folder || folder === safeFilePart(folder, ''));
  } catch {
    return false;
  }
}
