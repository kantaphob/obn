import { authorizeApiRequest } from "@/lib/authorization";
import { prisma } from '@/lib/prisma';
import { formatBorrowerCode } from '@/lib/borrower-code';
export async function GET(){
  const denied = await authorizeApiRequest("borrowers", "read");
  if (denied) return denied;
  const events=await prisma.borrowersdelete.findMany({orderBy:{deletedAt:'desc'}});
  return Response.json(events.map(event=>({...event,borrowersCode:formatBorrowerCode(event.borrowersCode),snapshot:JSON.parse(event.snapshot)})),{headers:{'Cache-Control':'no-store'}});
}
