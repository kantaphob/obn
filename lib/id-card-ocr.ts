// Extract only recognizable card fields; the original OCR text remains available for review.
export function parseIdCardOcr(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const digits = text.match(/(?:\d[ -]*){13}/)?.[0].replace(/\D/g, '');
  if (digits?.length === 13) result.nationalId = digits;
  const thai = text.match(/(?:ชื่อ(?:ตัวและชื่อสกุล)?\s*)?(นางสาว|นาง|นาย)\s*([ก-๙]+)\s+([ก-๙]+)/);
  if (thai) { result.prefixTH = thai[1]; result.firstName = thai[2]; result.lastName = thai[3]; }
  const name = text.match(/(?:^|\n)\s*(?:Name|First\s*name)\s*[:.]?\s*(?:(?:Mr|Mrs|Miss)\.?\s+)?([A-Za-z][A-Za-z -]*)/i);
  const surname = text.match(/(?:Last\s*name|Surname)\s*[:.]?\s*([A-Za-z][A-Za-z -]*)/i);
  if (name) result.firstNameEN = name[1].trim();
  if (surname) result.lastNameEN = surname[1].trim();
  const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const thaiMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  function date(value: string) {
    const match = value.match(/(\d{1,2})\s*[/. -]\s*([A-Za-zก-๙.]+|\d{1,2})\s*[/. -]\s*(\d{4})/);
    if (!match) return '';
    let year = Number(match[3]);
    if (year > 2400) year -= 543;
    const monthText = match[2].toLowerCase();
    const month = /^\d+$/.test(monthText) ? Number(monthText) : Math.max(monthNames.indexOf(monthText.slice(0,3)), thaiMonths.indexOf(monthText)) + 1;
    const day = Number(match[1]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return '';
    const parsed = new Date(Date.UTC(year, month-1, day));
    return parsed.getUTCMonth() === month-1 && parsed.getUTCDate() === day ? `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}` : '';
  }
  for (const [field, pattern] of [['birthDate', /เกิด|Birth/i], ['issueDate', /ออกบัตร|Issue/i], ['expiryDate', /หมดอายุ|Expiry|Expiration/i]] as const) {
    const index = lines.findIndex(line => pattern.test(line));
    if (index >= 0) {
      const parsed = date(lines[index]) || date(lines[index+1] || '');
      if (parsed) result[field] = parsed;
    }
  }
  const addressIndex = lines.findIndex(line => /ที่อยู่/.test(line));
  if (addressIndex >= 0) {
    const address = lines.slice(addressIndex, addressIndex + 3).filter(line => !/ออกบัตร|หมดอายุ|Issue|Expiry/.test(line)).join(' ').replace(/^.*?ที่อยู่\s*[:：]?/, '').trim();
    if (address) result.address = address;
    const house = address.match(/^\s*(\d+[\d/]*)/);
    if (house) result.houseNumber = house[1];
    for (const [field, pattern] of [['alley', /(?:ซอย|ซ\.)\s*([^\s]+)/], ['road', /(?:ถนน|ถ\.)\s*([^\s]+)/]] as const) {
      const value = address.match(pattern)?.[1];
      if (value) result[field] = value;
    }
  }
  return result;
}
