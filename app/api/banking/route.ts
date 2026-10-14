import { prisma } from '@/lib/prisma';
import { bankingError, mutateBank } from '@/lib/banking-api';
export async function GET() {
 try { return Response.json(await prisma.banking.findMany({ orderBy: { bankCode: 'asc' } })); }
 catch (error) { return bankingError(error); }
}
export async function POST(request: Request) { return mutateBank(request); }
