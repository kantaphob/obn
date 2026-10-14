export type ContractDocumentSettings = {
 collateral:string; branchCode:string; witness1Id:string; witness1Phone:string; witness1Address:string; witness2Id:string; witness2Phone:string; witness2Address:string;
 kind:'NEW_LOAN'|'AMENDMENT'; place:string; companyCode:string; lenderName:string; lenderId:string; lenderAddress:string; lenderPhone:string;
 annualRate:string; originalDate:string; originalNumber:string; principalPaid:string; lawfulInterest:string; deliveryEvidence:string;
 guarantorId:string; guarantorAddress:string; guarantorPhone:string; guarantorAge:string; guaranteeLimit:string;
 loanText:string; guaranteeText:string; attachments:{url:string;name:string}[];
 lenderSignature:string; witness1Signature:string; witness2Signature:string; guarantorSignature:string;
};
export const emptyDocumentSettings:ContractDocumentSettings={collateral:'',branchCode:'',witness1Id:'',witness1Phone:'',witness1Address:'',witness2Id:'',witness2Phone:'',witness2Address:'',kind:'NEW_LOAN',place:'',companyCode:'',lenderName:'',lenderId:'',lenderAddress:'',lenderPhone:'',annualRate:'',originalDate:'',originalNumber:'',principalPaid:'',lawfulInterest:'',deliveryEvidence:'',guarantorId:'',guarantorAddress:'',guarantorPhone:'',guarantorAge:'',guaranteeLimit:'',loanText:'',guaranteeText:'',attachments:[],lenderSignature:'',witness1Signature:'',witness2Signature:'',guarantorSignature:''};
const blank=(s:string|null|undefined)=>s?.trim()||'………………………………';
export function thaiMoneyWords(cents:number){
 const digits=['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];const units=['','สิบ','ร้อย','พัน','หมื่น','แสน'];
 function read(n:number):string{if(n>=1000000)return read(Math.floor(n/1000000))+'ล้าน'+(n%1000000?read(n%1000000):'');const s=String(n);return [...s].map((c,i)=>{const d=Number(c),pos=s.length-i-1;if(!d)return '';if(pos===1)return (d===1?'':d===2?'ยี่':digits[d])+'สิบ';if(pos===0 && d===1 && s.length>1)return 'เอ็ด';return digits[d]+units[pos];}).join('');}
 const baht=Math.floor(cents/100),satang=cents%100;return (baht?read(baht):'ศูนย์')+'บาท'+(satang?read(satang)+'สตางค์':'ถ้วน');
}
export type DocumentLoan={number:string;borrowerName:string;borrowerId:string;borrowerAddress:string;borrowerPhone:string;principal:number|null;rate:number;monthly:boolean;months:string;startDate:string;dueDate:string;paymentOption:string};
function legalDate(value:string){
 if(!/^\d{4}-\d{2}-\d{2}/.test(value))return blank(value);
 const date=new Date(`${value.slice(0,10)}T12:00:00+07:00`);
 if(!Number.isFinite(date.getTime()))return blank(value);
 const parts=new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",day:"numeric",month:"long",year:"numeric"}).formatToParts(date);
 const part=(kind:string)=>parts.find(p=>p.type===kind)?.value||"";
 return `${part("day")} เดือน ${part("month")} พ.ศ. ${part("year")}`;
}
export function makeLoanDocument(doc:ContractDocumentSettings,loan:DocumentLoan){
 const amount=loan.principal===null?'…………':new Intl.NumberFormat('th-TH').format(loan.principal/100);const words=loan.principal===null?'……………………':thaiMoneyWords(loan.principal);
 const parties=`ทำที่ ${blank(doc.place)}\nวันที่ ${legalDate(loan.startDate)}\n\nฝ่ายที่หนึ่ง ผู้ให้กู้ (เจ้าหนี้)\nชื่อ-นามสกุล ${blank(doc.lenderName)}\nเลขประจำตัวประชาชน ${blank(doc.lenderId)}\nที่อยู่ ${blank(doc.lenderAddress)}\nโทรศัพท์ ${blank(doc.lenderPhone)}\nต่อไปนี้เรียกว่า “ผู้ให้กู้”\n\nฝ่ายที่สอง ผู้กู้ (ลูกหนี้)\nชื่อ-นามสกุล ${blank(loan.borrowerName)}\nเลขประจำตัวประชาชน ${blank(loan.borrowerId)}\nที่อยู่ ${blank(loan.borrowerAddress)}\nโทรศัพท์ ${blank(loan.borrowerPhone)}\nต่อไปนี้เรียกว่า “ผู้กู้”\n\nคู่สัญญาตกลงดังต่อไปนี้\n`;
 if (doc.kind === 'NEW_LOAN') {
    const interest = loan.monthly
      ? `ร้อยละ ${loan.rate} ต่อเดือน แก่ท่านทุกเดือนไป จนกว่าข้าพเจ้าจะนำเงินต้นส่งให้แก่ท่านจนครบตามจำนวนที่ได้กู้ไป`
      : `ร้อยละ ${loan.rate} ตามสัญญา แก่ท่านเมื่อครบกำหนด จนกว่าข้าพเจ้าจะนำเงินต้นส่งให้แก่ท่านจนครบตามจำนวนที่ได้กู้ไป`;
    const newAmount = loan.principal === null ? '…………' : new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(loan.principal / 100);
    return `หนังสือสัญญาเงินกู้
ลำดับที่ ${blank(loan.number)}
ทำที่ ${blank(doc.place)}
วันที่ ${legalDate(loan.startDate)}

ข้าพเจ้า ${blank(loan.borrowerName)} เลขประจำตัวประชาชน ${blank(loan.borrowerId)}
อยู่ที่ ${blank(loan.borrowerAddress)} โทรศัพท์ ${blank(loan.borrowerPhone)}
ได้ทำหนังสือสัญญากู้เงินให้ไว้แก่ ${blank(doc.lenderName)} (เลขประจำตัวประชาชน ${blank(doc.lenderId)} ที่อยู่ ${blank(doc.lenderAddress)}) มีข้อสัญญาดังแจ้งต่อไปนี้

ข้อ 1. ข้าพเจ้า ${blank(loan.borrowerName)} ได้กู้เงินของ ${blank(doc.lenderName)} เป็นจำนวนเงิน ${newAmount} บาท (${words})
ข้าพเจ้าได้รับเงินไปครบถ้วนเสร็จแล้วตั้งแต่วันทำสัญญานี้

ข้อ 2. เพื่อเป็นหลักฐานในเงินซึ่งข้าพเจ้ากู้ไปนี้ ข้าพเจ้าได้นำ ${blank(doc.collateral)} ให้ท่านถือไว้เป็นประกันด้วย และข้าพเจ้าขอรับรองว่า ทรัพย์สินซึ่งข้าพเจ้านำมานี้ เป็นของข้าพเจ้าโดยแท้จริง และไม่มีภาระผูกพันใด ๆ ในหนี้สินรายอื่นนอกเหนือทรัพย์สินนี้เลย

ข้อ 3. ในจำนวนเงินซึ่งข้าพเจ้าได้กู้ไปนี้ ข้าพเจ้าจะนำมาใช้ให้ท่านเสร็จภายใน ${legalDate(loan.dueDate)} นับตั้งแต่วันทำสัญญานี้เป็นต้นไป${loan.monthly ? ` โดยผ่อนชำระ ${blank(loan.months)} งวด ตามตารางแนบท้าย` : loan.paymentOption === 'UPFRONT' ? ' โดยหักดอกเบี้ยก่อนจ่ายเงิน และชำระเงินต้นตามกำหนด' : ''}

ข้อ 4. ข้าพเจ้ายอมให้ดอกเบี้ย ${interest}

ข้อ 5. ข้าพเจ้าล้มตายเสียก็ดี หรือหลบหายไปเสียก็ดี ข้าพเจ้ายอมให้ท่านมีอำนาจเอาทรัพย์สมบัติของข้าพเจ้า ขายทอดตลาดเอาเงินต้นและดอกเบี้ยของท่านจนครบ

ข้อ 6. แม้ว่าข้าพเจ้าประพฤติผิดสัญญานี้แต่ข้อหนึ่งข้อใดก็ดี ยอมให้ท่านฟ้องร้องเรียกเงินต้นและดอกเบี้ยแก่ข้าพเจ้าตามกฎหมาย

ข้อ 7. ค่าธรรมเนียม ค่าพาหนะและค่าเสียหายต่าง ๆ ซึ่งท่านต้องเสียไปในการทวงถามฟ้องร้องข้าพเจ้านั้น ข้าพเจ้ายอมใช้ให้ท่านตามที่ได้เสียหายไปจนครบถ้วน

ทั้งนี้ ผู้เขียนสัญญาได้อ่านข้อสัญญาให้ข้าพเจ้าผู้กู้ฟังเข้าใจโดยละเอียดตลอดทุกข้อแล้ว ข้าพเจ้าได้ลงลายมือชื่อให้ไว้ต่อหน้าพยานพร้อมกัน ณ ที่นี้

ข้าพเจ้าพยาน ขอรับรองว่าข้าพเจ้าเข้าใจข้อความในหนังสือสัญญานี้ตลอดแล้ว และได้เห็นคู่สัญญาส่งมอบเงินกู้ ตกลงปากคำ ทำหนังสือสัญญานี้ และลงลายมือชื่อต่อหน้าข้าพเจ้า

ข้อมูลพยานคนที่ 1
เลขบัตร ${blank(doc.witness1Id)} โทรศัพท์ ${blank(doc.witness1Phone)}
ที่อยู่ ${blank(doc.witness1Address)}

ข้อมูลพยานคนที่ 2
เลขบัตร ${blank(doc.witness2Id)} โทรศัพท์ ${blank(doc.witness2Phone)}
ที่อยู่ ${blank(doc.witness2Address)}`;
  }
 return `เอกสารแนบท้ายสัญญากู้ยืมเงิน\nอ้างอิงสัญญาเลขที่ ${blank(doc.originalNumber)}\n${parties}
ข้อ 1 อ้างอิงสัญญากู้ยืมเงินเดิม
ตามที่ผู้กู้ได้ทำสัญญากู้ยืมเงินเมื่อวันที่ ${legalDate(doc.originalDate)} เป็นเงินต้น ${amount} บาท (${words}) ผู้กู้ยืนยันว่าได้กู้ยืมและได้รับเงินตามสัญญาเดิมจริง โดยมีหลักฐานการส่งมอบเงิน ${blank(doc.deliveryEvidence)} คู่สัญญาประสงค์แก้ไขเพิ่มเติมโดยมิได้ส่งมอบเงินกู้ใหม่ตามบันทึกฉบับนี้

ข้อ 2 การยืนยันยอดหนี้คงเหลือ
เงินต้นตามสัญญาเดิม ${amount} บาท
เงินต้นที่ผู้กู้ชำระแล้ว ${blank(doc.principalPaid)} บาท
เงินต้นคงเหลือ …………… บาท
ดอกเบี้ยที่ชอบด้วยกฎหมายและยังค้างชำระ ${blank(doc.lawfulInterest)} บาท
รวมยอดหนี้ค้างชำระ ณ วันที่ตรวจสอบ …………… บาท
คู่สัญญาตรวจสอบยอดร่วมกัน ณ วันที่ …………… ไม่รวมดอกเบี้ยหรือค่าใช้จ่ายที่เรียกเก็บโดยฝ่าฝืนกฎหมาย

ข้อ 3 การแก้ไขข้อตกลงเรื่องดอกเบี้ย
ตั้งแต่วันที่บันทึกนี้มีผล คู่สัญญาตกลงคิดดอกเบี้ยจากเงินต้นคงเหลือจริงในอัตราร้อยละ ${blank(doc.annualRate)} ต่อปี ซึ่งไม่เกินอัตราที่กฎหมายอนุญาต คำนวณตามวันค้างชำระจริง ฐาน 365 วันต่อปี ไม่คิดดอกเบี้ยทบต้น ดอกเบี้ยก่อนบันทึกให้มีผลเฉพาะส่วนที่ชอบด้วยกฎหมาย บันทึกนี้ไม่ทำให้ดอกเบี้ยที่ไม่ชอบด้วยกฎหมายกลับมีผลบังคับได้

ข้อ 4 กำหนดชำระหนี้
[ ] ชำระเงินต้นและดอกเบี้ยที่ชอบด้วยกฎหมายทั้งหมดภายใน ${legalDate(loan.dueDate)}
[ ] ผ่อนตามตารางแนบท้าย จำนวน ${blank(loan.months)} งวด เริ่มวันที่ ${legalDate(loan.startDate)}
ช่องทางรับชำระ [ ] เงินสด [ ] โอนเงิน ระบุบัญชี ……………

ข้อ 5 การผิดนัดชำระหนี้
ผู้ให้กู้มีสิทธิเรียกเงินต้นที่ถึงกำหนดและดอกเบี้ยผิดนัดตามอัตราที่กฎหมายอนุญาต กรณีเป็นงวดให้คิดจากเงินต้นของงวดที่ผิดนัดตามกฎหมาย ผู้ให้กู้มีสิทธิทวงถามและดำเนินคดี แต่ไม่มีสิทธิยึดหรือขายทรัพย์เองโดยไม่มีอำนาจตามกฎหมาย

ข้อ 6 หลักประกันตามสัญญาเดิม
[ ] ไม่มีการส่งมอบหรือจัดทำหลักประกันไว้จริง
[ ] มีทรัพย์สินที่อ้างเป็นหลักประกัน ……………
ผลและการบังคับหลักประกันเป็นไปตามกฎหมาย บันทึกนี้ไม่ตั้งหลักประกันใหม่โดยอัตโนมัติ หากมีผู้ค้ำหรือบุคคลภายนอกให้หลักประกัน ต้องดำเนินการเรื่องการเปลี่ยนแปลงที่กระทบสิทธิให้ถูกต้องตามกฎหมาย

ข้อ 7 ผลของบันทึก
เป็นการแก้ไขเพิ่มเติมและยืนยันหนี้เดิม ไม่มีเจตนาให้หนี้เดิมระงับหรือแปลงเป็นหนี้ใหม่ และไม่มีการกู้ยืมเพิ่ม ข้อตกลงเดิมที่ไม่ขัดกับบันทึกนี้และกฎหมายยังมีผล

ข้อ 8 หลักฐานการชำระหนี้
เมื่อรับชำระ ผู้ให้กู้ออกหลักฐานจำนวนเงิน วันที่ และยอดคงเหลือ เมื่อชำระครบให้ออกหนังสือรับรองและคืนหรือยกเลิกหลักฐานการกู้ยืมตามกฎหมาย

ข้อ 9 การรับทราบและลงนาม
คู่สัญญาอ่านและเข้าใจข้อความ ยืนยันข้อมูลกู้ยืม การส่งมอบเงิน และยอดหนี้ตามจริง จัดทำสองฉบับข้อความตรงกัน เก็บฝ่ายละฉบับพร้อมสำเนาสัญญาเดิม`;
}
export function makeGuaranteeDocument(doc:ContractDocumentSettings,loan:DocumentLoan,guarantor:string){
 const amount=loan.principal===null?'…………':new Intl.NumberFormat('th-TH',{minimumFractionDigits:2}).format(loan.principal/100);
 const words=loan.principal===null?'……………………':thaiMoneyWords(loan.principal);
 return `สัญญาค้ำประกันการกู้ยืมเงิน

ทำที่ ${blank(doc.place)}
วันที่ ${legalDate(loan.startDate)}

สัญญาฉบับนี้ทำขึ้นระหว่าง
${blank(guarantor)} อายุ ${blank(doc.guarantorAge)} ปี เลขประจำตัวประชาชน ${blank(doc.guarantorId)}
อยู่ที่ ${blank(doc.guarantorAddress)} โทรศัพท์ ${blank(doc.guarantorPhone)}
ซึ่งต่อไปในสัญญานี้เรียกว่า “ผู้ค้ำประกัน” ฝ่ายหนึ่ง กับ

${blank(doc.lenderName)} เลขประจำตัวประชาชน ${blank(doc.lenderId)}
อยู่ที่ ${blank(doc.lenderAddress)}
ซึ่งต่อไปในสัญญานี้เรียกว่า “ผู้ให้กู้” อีกฝ่ายหนึ่ง

คู่สัญญาทั้งสองฝ่ายได้ตกลงกันมีข้อความดังต่อไปนี้

ข้อ 1. ตามที่ ${blank(loan.borrowerName)} ซึ่งต่อไปนี้เรียกว่า “ผู้กู้” ได้กู้เงินจากผู้ให้กู้เป็นเงิน ${amount} บาท (${words}) ตามสัญญากู้ยืมเงินฉบับลงวันที่ ${legalDate(doc.originalDate || loan.startDate)} นั้น หากผู้กู้ผิดสัญญาหรือกระทำการใด ๆ เป็นเหตุให้ผู้ให้กู้ไม่ได้รับชำระหนี้ดังกล่าว ผู้ค้ำประกันยอมร่วมกับผู้กู้อย่างลูกหนี้ร่วม ชำระหนี้ให้แก่ผู้ให้กู้ตามจำนวนเงินดังกล่าว พร้อมทั้งดอกเบี้ยนับแต่วันผิดนัด รวมทั้งค่าใช้จ่ายในการติดตามทวงถาม การดำเนินคดี การบังคับคดี ค่าเสียหายต่าง ๆ อันเกิดขึ้นแก่ผู้ให้กู้ ตลอดจนอุปกรณ์ทุกชนิด ผู้ค้ำประกันยินยอมชดใช้ให้ผู้ให้กู้จนครบถ้วน

ข้อ 2. ถ้าผู้กู้ผิดนัดไม่ชำระหนี้ดังกล่าวแล้วไม่ว่าด้วยเหตุใด ๆ หรือล้มละลาย หรือตาย หรือกลายเป็นบุคคลไร้ความสามารถ หรือสาบสูญ หรือไปเสีย หรือหาตัวไม่พบ หรือมีกรณีอื่นใดอันกระทำให้ผู้ให้กู้ไม่ได้รับชำระหนี้ดังกล่าวในสัญญาก็ดี ผู้ค้ำประกันยอมเข้ารับผิดร่วมกับผู้กู้ในอันที่จะต้องชำระหนี้ดังกล่าว

ข้อ 3. ถ้าผู้ให้กู้ผ่อนเวลาให้แก่ผู้กู้ชำระหนี้ โดยจะได้แจ้งหรือมิได้แจ้งให้ทราบก็ตาม ผู้ค้ำประกันเป็นอันยอมตกลงด้วยกับการให้ผ่อนเวลานั้นทุกครั้งไป และการผ่อนเวลาเช่นนั้นเป็นเหตุปลดเปลื้องความรับผิดชอบของผู้ค้ำประกันเป็นอันขาด

ข้อ 4. ในกรณีที่ผู้กู้ผิดสัญญา ผู้ค้ำประกันยอมสละสิทธิที่จะต่อสู้ให้ผู้ให้กู้ไปเรียกร้องจากทรัพย์สินของผู้กู้ก่อนเรียกร้องให้ผู้ค้ำประกันรับผิด ทั้งนี้ไม่เป็นการตัดสิทธิผู้ให้กู้ที่จะดำเนินการเรียกร้องหรือฟ้องร้องผู้กู้หรือกองมรดก หรือผู้รับช่วงสิทธิหรือหนี้ก่อน ตามแต่ผู้ให้กู้จะเห็นสมควร

ข้อ 5. การค้ำประกันนี้ย่อมผูกพันผู้ค้ำประกันอย่างสมบูรณ์ แม้ผู้กู้เป็นบุคคลไร้ความสามารถหรือเข้าทำสัญญาที่กล่าวแล้วด้วยความสำคัญผิด โดยผู้ค้ำประกันจะได้รู้ถึงเหตุไร้ความสามารถหรือสำคัญผิดนั้นหรือไม่ก็ตาม ผู้ค้ำประกันไม่พ้นจากความรับผิดเพราะเหตุที่ผู้ให้กู้กระทำการใด ๆ ไป

ข้อ 6. ในกรณีที่ผู้กู้ถึงแก่ความตายและผู้ให้กู้มิได้ฟ้องร้องบังคับเอาแก่ทายาท หรือผู้สืบสิทธิ หรือผู้รับช่วงสิทธิหรือหน้าที่ของผู้กู้จนล่วงพ้นระยะเวลา 1 ปีนับแต่วันความตายแล้วก็ตาม ผู้ค้ำประกันก็จะไม่ยกเหตุที่คดีขาดอายุความมรดกนั้นขึ้นต่อสู้ และยังคงยินยอมรับผิดชดใช้หนี้จำนวนที่ลูกหนี้ยังคงค้างชำระอยู่กับผู้ให้กู้นั้นจนเต็มจำนวนทุกประการ

ข้อ 7. ผู้ค้ำประกันตกลงยินยอมว่า ถ้ามีข้อพิพาทอันเกิดจากการผิดสัญญาดังกล่าวข้างต้นอันทำให้ผู้ให้กู้ไม่ได้รับชำระหนี้ ให้ผู้ให้กู้ดำเนินคดีฟ้องร้องได้

ข้อ 8. การบอกกล่าว ทวงถาม หรือการส่งเอกสารใด ๆ ถ้าได้ส่งไปทางไปรษณีย์ตามที่อยู่ข้างต้นแล้ว ให้ถือว่าได้ส่งให้แก่ผู้ค้ำประกันโดยชอบ ทั้งนี้โดยไม่ต้องคำนึงถึงว่าจะมีผู้รับไว้ได้หรือไม่ได้เพราะเหตุใด ๆ

ข้อ 9. ผู้ค้ำประกันขอสละสิทธิที่จะยกเลิกหรือเพิกถอนการค้ำประกันตามความในสัญญาค้ำประกันฉบับนี้ทั้งสิ้น ทั้งนี้จนกว่าผู้ให้กู้จะได้รับชำระหนี้โดยสิ้นเชิง

คู่สัญญาทั้งสองฝ่ายได้อ่านและเข้าใจข้อความในสัญญานี้ตลอดแล้ว จึงลงลายมือชื่อต่อหน้าพยาน ณ วัน เดือน ปี ที่ระบุข้างต้น

ลงชื่อ ……………………………… ผู้ค้ำประกัน (${blank(guarantor)})
ลงชื่อ ……………………………… คู่สมรสผู้ให้ความยินยอม (………………………………)
ลงชื่อ ……………………………… ผู้ให้กู้ (${blank(doc.lenderName)})
ลงชื่อ ……………………………… พยาน
ลงชื่อ ……………………………… พยาน`;
}
