import { readFile } from "node:fs/promises";
import path from "node:path";

type RouteContext = { params: Promise<{ filename: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { filename } = await params;
  if (!/^[0-9a-f-]{36}\.png$/i.test(filename)) {
    return Response.json({ error: "ไม่พบลายเซ็น" }, { status: 404 });
  }
  try {
    const image = await readFile(path.join(process.cwd(), "storage", "contract-signatures", filename));
    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "ไม่พบลายเซ็น" }, { status: 404 });
  }
}
