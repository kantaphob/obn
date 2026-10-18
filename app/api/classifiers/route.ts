import { authorizeApiRequest } from "@/lib/authorization";
import { getReferenceCatalog } from '@/lib/reference-catalog';

export async function GET(request: Request) {
  const denied = await authorizeApiRequest("masterdata", "read");
  if (denied) return denied;
  return getReferenceCatalog(request, 'classifiers');
}

import { mutateCatalog } from '@/lib/catalog-mutations';

export async function POST(request: Request) {
  const denied = await authorizeApiRequest("masterdata", "write");
  if (denied) return denied;
  return mutateCatalog(request, 'classifiers');
}
