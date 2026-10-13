import { mutateCatalog, readCatalogItem } from '@/lib/catalog-mutations';

type Context = { params: Promise<{ code: string }> };

export async function GET(_request: Request, context: Context) {
  return readCatalogItem('classifiers', (await context.params).code);
}

export async function PATCH(request: Request, context: Context) {
  return mutateCatalog(request, 'classifiers', (await context.params).code);
}

export async function DELETE(request: Request, context: Context) {
  return mutateCatalog(request, 'classifiers', (await context.params).code);
}
