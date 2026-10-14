import { prisma } from '@/lib/prisma';
import { bankingError, mutateBank } from '@/lib/banking-api';
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
 try {
  const { id } = await context.params;
  const bank = await prisma.banking.findUnique({ where: { id } });
  return bank ? Response.json(bank) : Response.json({ error: 'ไม่พบธนาคารนี้' }, { status: 404 });
 } catch (error) { return bankingError(error); }
}
export async function PATCH(request: Request, context: Context) { return mutateBank(request, (await context.params).id); }
export async function DELETE(request: Request, context: Context) { return mutateBank(request, (await context.params).id); }
