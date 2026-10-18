import { authorizeApiRequest } from "@/lib/authorization";
import { googleSheetsStatus, syncLoanGoogleSheet } from '@/lib/integrations/google-sheets';
export async function GET(){
  const denied = await authorizeApiRequest("integrations", "read");
  if (denied) return denied;return Response.json(await googleSheetsStatus(),{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){
  const denied = await authorizeApiRequest("integrations", "write");
  if (denied) return denied;
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'ไม่อนุญาตคำขอจากเว็บไซต์อื่น'},{status:403});
  const result=await syncLoanGoogleSheet();
  return Response.json(result,{status:result.state==='SYNCED'?200:result.state==='NOT_CONFIGURED'?503:502,headers:{'Cache-Control':'no-store'}});
}
