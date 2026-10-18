// Parse fields independently: card OCR often places labels and values on separate lines.
export function parseIdCardOcr(input: string): Record<string, string> {
  const text=input.normalize('NFKC').replace(/[๐-๙]/g,c=>String(c.charCodeAt(0)-0x0e50)).replace(/\r/g,'').replace(/[\u200b-\u200d\ufeff]/g,'');
  const lines=text.split('\n').map(line=>line.trim()).filter(Boolean);
  const result:Record<string,string>={};
  const id=text.match(/(?<!\d)(?:\d[ \t-]*){12}\d(?![ \t-]*\d)/)?.[0].replace(/\D/g,'');
  if(id)result.nationalId=id;
  const label=/^(?:ชื่อ|นามสกุล|วัน|วันที่|ที่อยู่|เกิด|เพศ|Name|Last|Surname|Date|Birth|Issue|Expiry|Thai|Identification)/i;
  for(let i=0;i<lines.length;i++){
    // Never combine a Thai name with a date/address label on the following line.
    const line=lines[i].replace(/^(?:ชื่อตัวและชื่อสกุล|ชื่อตัว|ชื่อ[ -]?สกุล|ชื่อ)\s*[:：]?\s*/,'');
    const named=line.match(/^(นาง\s*สาว|นาง|นาย)\s*(.*)$/);
    if(!named)continue;
    result.prefixTH=named[1].replace(/\s/g,'');
    const value=named[2].trim() || (!label.test(lines[i+1]||'')?lines[i+1]||'':'');
    const parts=value.match(/[ก-๙]+/g)||[];
    if(parts[0])result.firstName=parts[0];
    if(parts.length>1)result.lastName=parts.slice(1).join('');
    else {const next=lines[i+(named[2].trim()?1:2)]||'';if(/^[ก-๙]+$/.test(next)&&!label.test(next))result.lastName=next;}
    if(result.firstName)break;
  }
  if(!result.firstName){const named=text.match(/(?:ชื่อตัวและชื่อสกุล|ชื่อตัว|ชื่อ)\s*[:：]?\s*([ก-๙]+)(?:[ \t]+([ก-๙]+))?/);if(named&&!/^(?:ตัว|สกุล|นามสกุล)$/.test(named[1])){result.firstName=named[1];if(named[2])result.lastName=named[2];}}
  const separateSurname=text.match(/นามสกุล\s*[:：]?\s*([ก-๙]+)/);
  if(separateSurname)result.lastName=separateSurname[1];
  for(const [field,pattern] of [['firstNameEN',/^(?:Name|First\s*name|Given\s*name)\b[ \t]*[:.]?[ \t]*(.*)$/i],['lastNameEN',/^(?:Last\s*name|Surname|Family\s*name)\b[ \t]*[:.]?[ \t]*(.*)$/i]] as const){
    for(let i=0;i<lines.length;i++){
      const match=lines[i].match(pattern);if(!match)continue;
      let value=match[1].replace(/^(?:Mrs|Miss|Mr|Ms)\.?\s+/i,'').trim();
      if(!value)value=(lines[i+1]||'').replace(/^(?:Mrs|Miss|Mr|Ms)\.?\s+/i,'').trim();
      if(/^[A-Za-z][A-Za-z '-]*$/.test(value)&&!label.test(value)){result[field]=value;break;}
    }
  }
  if(result.prefixTH==='นาย')result.gender='ชาย';
  if(result.prefixTH==='นาง'||result.prefixTH==='นางสาว')result.gender='หญิง';
  const months=[['jan','มค','มกราคม'],['feb','กพ','กุมภาพันธ์'],['mar','มีค','มีนาคม'],['apr','เมย','เมษายน'],['may','พค','พฤษภาคม'],['jun','มิย','มิถุนายน'],['jul','กค','กรกฎาคม'],['aug','สค','สิงหาคม'],['sep','กย','กันยายน'],['oct','ตค','ตุลาคม'],['nov','พย','พฤศจิกายน'],['dec','ธค','ธันวาคม']];
  function date(value:string){
    const match=value.match(/\b(\d{1,2})[\s/.-]+([A-Za-zก-๙][A-Za-zก-๙. \t]*?|\d{1,2})[\s/.-]+(\d{4})\b/);
    if(!match)return '';
    const token=match[2].toLowerCase().replace(/[.\s]/g,'');
    const month=/^\d+$/.test(token)?Number(token):months.findIndex(names=>names.some(name=>token===name||token.slice(0,3)===name))+1;
    const year=Number(match[3])>2400?Number(match[3])-543:Number(match[3]),day=Number(match[1]);
    const parsed=new Date(Date.UTC(year,month-1,day));
    return year>=1900&&month>=1&&month<=12&&parsed.getUTCMonth()===month-1&&parsed.getUTCDate()===day?`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`:'';
  }
  const dateLabels=/เกิด|Birth|ออกบัตร|Issue|หมดอายุ|Expiry|Expiration/i;
  for(const [field,pattern] of [['birthDate',/เกิด|Birth/i],['issueDate',/ออกบัตร|Issue/i],['expiryDate',/หมดอายุ|Expiry|Expiration/i]] as const){
    for(let i=0;i<lines.length;i++){
      if(!pattern.test(lines[i]))continue;
      let value=date(lines[i]);
      // Values can precede English labels; prefer the same line, then nearby value-only lines.
      for(const offset of [1,-1,2,-2]){const nearby=lines[i+offset]||'';if(!value&&!dateLabels.test(nearby))value=date(nearby);}
      if(value){result[field]=value;break;}
    }
  }
  const index=lines.findIndex(line=>/ที่\s*อยู่/.test(line));
  if(index>=0){
    const addressLines:string[]=[];
    for(let i=index;i<Math.min(lines.length,index+6);i++){if(i>index&&dateLabels.test(lines[i]))break;if(!/^(?:Date|Name|Last|Thai|Identification)/i.test(lines[i]))addressLines.push(lines[i]);}
    const address=addressLines.join(' ').replace(/^.*?ที่\s*อยู่\s*[:：]?/,'').trim();
    if(address)result.address=address;
    const house=address.match(/^\s*(\d+[\d/]*)/);if(house)result.houseNumber=house[1];
    for(const [field,pattern] of [['alley',/(?:ซอย|ซ\.)\s*([^\s]+)/],['road',/(?:ถนน|ถ\.)\s*([^\s]+)/],['subdistrictName',/(?:ตำบล|แขวง|ต\.)\s*([ก-๙]+)/],['districtName',/(?:อำเภอ|เขต|อ\.)\s*([ก-๙]+)/],['provinceName',/(?:จังหวัด|จ\.)\s*([ก-๙]+)/]] as const){const value=address.match(pattern)?.[1];if(value)result[field]=value;}
  }
  return result;
}
