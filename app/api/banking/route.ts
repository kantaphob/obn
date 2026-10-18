import { authorizeApiRequest } from "@/lib/authorization";
import { prisma } from '@/lib/prisma';
import { bankingError, mutateBank } from '@/lib/banking-api';
export async function GET() {
  const denied = await authorizeApiRequest("masterdata", "read");
  if (denied) return denied;
 try { return Response.json(await prisma.banking.findMany({ orderBy: { bankCode: 'asc' } })); }
 catch (error) { return bankingError(error); }
}
export async function POST(request: Request) {
  const denied = await authorizeApiRequest("masterdata", "write");
  if (denied) return denied; return mutateBank(request); }
