import 'server-only';
import { createSign } from 'node:crypto';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { LOAN_SHEET_HEADERS, loanSheetRow } from './loan-sheet-data';

type SyncResult={state:'NOT_CONFIGURED'|'SYNCED'|'ERROR';message:string;updatedAt:string;rowCount?:number};
const statusFile=path.join(process.cwd(),'storage','integrations','google-sheets-status.json');
let cachedToken:{value:string;expires:number}|undefined;
let queue:Promise<unknown>=Promise.resolve();
const config=()=>({id:process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim()||'',tab:process.env.GOOGLE_SHEETS_TAB_NAME?.trim()||'ชีต1',keyFile:process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_FILE?.trim()||''});
export async function googleSheetsStatus(){
  const {id,tab,keyFile}=config();
  const configured=Boolean(id&&keyFile);
  let result:SyncResult|undefined;
  try{result=JSON.parse(await readFile(statusFile,'utf8'));}catch{}
  return {configured,spreadsheetUrl:id?`https://docs.google.com/spreadsheets/d/${id}/edit`:null,tab,...(result||{state:'NOT_CONFIGURED',message:'รอตั้งค่าไฟล์ Service Account และแชร์ชีตให้บัญชีของระบบ',updatedAt:''}),...(!configured?{state:'NOT_CONFIGURED',message:'รอตั้งค่าไฟล์ Service Account และแชร์ชีตให้บัญชีของระบบ'}:{})};
}
async function token(){
  if(cachedToken&&cachedToken.expires>Date.now()+60000)return cachedToken.value;
  let credentials:{client_email?:string;private_key?:string};
  try{credentials=JSON.parse(await readFile(config().keyFile,'utf8'));}catch{throw new Error('อ่านไฟล์ Service Account ไม่สำเร็จ กรุณาตรวจการตั้งค่าเซิร์ฟเวอร์');}
  if(!credentials.client_email||!credentials.private_key)throw new Error('ไฟล์ Service Account ไม่ครบถ้วน');
  const now=Math.floor(Date.now()/1000);
  const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned=`${encode({alg:'RS256',typ:'JWT'})}.${encode({iss:credentials.client_email,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})}`;
  const sign=createSign('RSA-SHA256');sign.update(unsigned);
  const assertion=`${unsigned}.${sign.sign(credentials.private_key,'base64url')}`;
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(12000),cache:'no-store'});
  if(!response.ok)throw new Error('ยืนยันบัญชี Google ไม่สำเร็จ กรุณาตรวจ Service Account');
  const data=await response.json();
  if(typeof data.access_token!=='string')throw new Error('ไม่ได้รับสิทธิ์จาก Google');
  cachedToken={value:data.access_token,expires:Date.now()+Math.min(Number(data.expires_in)||3600,3600)*1000};
  return cachedToken.value;
}
async function sheetsRequest(endpoint:string,init:RequestInit={}){
  const response=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config().id)}${endpoint}`,{...init,headers:{Authorization:`Bearer ${await token()}`,'Content-Type':'application/json',...init.headers},signal:AbortSignal.timeout(15000),cache:'no-store'});
  if(!response.ok){if(response.status===401)cachedToken=undefined;throw new Error(response.status===403?'ไม่มีสิทธิ์เขียนชีต กรุณาเปิด Sheets API และแชร์ชีตให้ Service Account เป็นผู้แก้ไข':response.status===404?'ไม่พบไฟล์หรือแท็บ Google Sheet ที่ตั้งค่าไว้':`Google Sheets ตอบกลับ ${response.status} กรุณาลองซิงก์อีกครั้ง`);}
  return response.json();
}
async function persist(result:SyncResult){
  await mkdir(path.dirname(statusFile),{recursive:true});
  const temp=`${statusFile}.${process.pid}.tmp`;
  await writeFile(temp,JSON.stringify(result),{mode:0o600});await rename(temp,statusFile);
}
async function runSync():Promise<SyncResult>{
  const {id,keyFile,tab}=config();
  if(!id||!keyFile)return {state:'NOT_CONFIGURED',message:'รอตั้งค่าไฟล์ Service Account และแชร์ชีตให้บัญชีของระบบ',updatedAt:new Date().toISOString()};
  try{
    // Read fresh data inside the queue so earlier changes cannot overwrite a newer snapshot.
    const contracts=await prisma.contract.findMany({orderBy:{contractNumber:'asc'},select:{contractNumber:true,previousContractNumber:true,principal:true,interestRate:true,interestAmount:true,netDisbursed:true,interestMode:true,status:true,signedAt:true,application:{select:{requestNumber:true,losNumber:true,requestType:true,borrowerSnapshot:true}},startDate:true,dueDate:true,debtor:{select:{borrowersCode:true,prefixTH:true,firstName:true,lastName:true,nickname:true,phone:true}}}});
    const quoted=`'${tab.replace(/'/g,"''")}'`;
    const metadata=await sheetsRequest('?fields=sheets(properties)');
    const sheet=metadata.sheets?.find((item:{properties:{title:string}})=>item.properties.title===tab)?.properties;
    if(!sheet)throw new Error('ไม่พบแท็บที่ตั้งค่าไว้ กรุณาตรวจชื่อแท็บ');
    const existing=await sheetsRequest(`/values/${encodeURIComponent(`${quoted}!A1:Q${sheet.gridProperties.rowCount}`)}`);
    const values:(string|number)[][]=existing.values||[];
    const matchesCurrent=LOAN_SHEET_HEADERS.every((header,index)=>values[0]?.[index]===header);
    const matchesLegacy=[10,16].some(width=>LOAN_SHEET_HEADERS.slice(0,width).every((header,index)=>values[0]?.[index]===header)&&values.every(row=>row.slice(width,17).every(cell=>cell===''||cell===undefined||cell===null)));
    if(values.length&&!matchesCurrent&&!matchesLegacy)throw new Error('หัวตาราง A:Q ไม่ตรงกับรูปแบบซิงก์ หรือคอลัมน์ใหม่มีข้อมูลอื่น จึงหยุดเพื่อรักษาข้อมูลเดิม');
    const lastRow=Math.max(contracts.length+1,values.length);
    if(lastRow>sheet.gridProperties.rowCount)await sheetsRequest(':batchUpdate',{method:'POST',body:JSON.stringify({requests:[{appendDimension:{sheetId:sheet.sheetId,dimension:'ROWS',length:lastRow-sheet.gridProperties.rowCount}}]})});
    const rows=[LOAN_SHEET_HEADERS,...contracts.map(loanSheetRow)];
    // A:Q is managed by this integration. Columns after Q are left untouched.
    while(rows.length<lastRow)rows.push(Array(LOAN_SHEET_HEADERS.length).fill(''));
    await sheetsRequest('/values:batchUpdate',{method:'POST',body:JSON.stringify({valueInputOption:'RAW',data:[{range:`${quoted}!A1:Q${lastRow}`,values:rows}]})});
    const result:SyncResult={state:'SYNCED',message:`ซิงก์สำเร็จ ${contracts.length} สัญญา`,updatedAt:new Date().toISOString(),rowCount:contracts.length};
    await persist(result);return result;
  }catch(error){
    const message=error instanceof Error&&error.name!=='TimeoutError'?error.message:'เชื่อมต่อ Google Sheets ไม่สำเร็จ กรุณาลองอีกครั้ง';
    // Never log credentials, JWTs, access tokens or Google response payloads.
    const result:SyncResult={state:'ERROR',message,updatedAt:new Date().toISOString()};
    await persist(result).catch(()=>{});return result;
  }
}
export function syncLoanGoogleSheet():Promise<SyncResult>{
  const work=queue.catch(()=>{}).then(runSync);
  queue=work;return work;
}
