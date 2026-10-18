import { authorizeApiRequest } from "@/lib/authorization";
import { mutateCatalog, readCatalogItem } from '@/lib/catalog-mutations';

type Context = { params: Promise<{ code: string }> };

export async function GET(_request: Request, context: Context) {
  const denied = await authorizeApiRequest("masterdata", "read");
  if (denied) return denied;
  return readCatalogItem('units', (await context.params).code);
}

export async function PATCH(request: Request, context: Context) {
  const denied = await authorizeApiRequest("masterdata", "write");
  if (denied) return denied;
  return mutateCatalog(request, 'units', (await context.params).code);
}

export async function DELETE(request: Request, context: Context) {
  const denied = await authorizeApiRequest("masterdata", "write");
  if (denied) return denied;
  return mutateCatalog(request, 'units', (await context.params).code);
}
