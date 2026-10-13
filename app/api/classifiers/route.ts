import { getReferenceCatalog } from '@/lib/reference-catalog';

export async function GET(request: Request) {
  return getReferenceCatalog(request, 'classifiers');
}

import { mutateCatalog } from '@/lib/catalog-mutations';

export async function POST(request: Request) {
  return mutateCatalog(request, 'classifiers');
}
