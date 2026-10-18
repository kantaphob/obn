import { authorizeApiRequest } from "@/lib/authorization";
import { prisma } from '@/lib/prisma';
import { bankingError, mutateBank } from '@/lib/banking-api';
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  const denied = await authorizeApiRequest("masterdata", "read");
  if (denied) return denied;
 try {
  const { id } = await context.params;
  const bank = await prisma.banking.findUnique({ where: { id } });
  return bank ? Response.json(bank) : Response.json({ error: 'ไม่พบธนาคารนี้' }, { status: 404 });
 } catch (error) { return bankingError(error); }
}
export async function PATCH(request: Request, context: Context) {
  const denied = await authorizeApiRequest("masterdata", "write");
  if (denied) return denied; return mutateBank(request, (await context.params).id); }
export async function DELETE(request: Request, context: Context) {
  const denied = await authorizeApiRequest("masterdata", "write");
  if (denied) return denied; return mutateBank(request, (await context.params).id); }
