export function normalizeNationalId(value: string) {
  return value.normalize('NFKC').replace(/[๐-๙]/g, digit => String(digit.charCodeAt(0) - 0x0e50));
}

export function nationalIdDigits(value: string) {
  return normalizeNationalId(value).replace(/[^0-9]/g, '');
}
