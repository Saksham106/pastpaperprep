import { NextResponse } from "next/server";
import { isLocalEconomicsPreviewEnabled, localPreviewSourceRoot, readContainedLocalPreviewAsset } from "@/lib/local-preview";

export const runtime = "nodejs";
const PRIVATE_RESPONSE_INIT = { headers: { "Cache-Control": "private, no-store, max-age=0" } } as const;

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(_request: Request, context: RouteContext) {
  if (!isLocalEconomicsPreviewEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const root = localPreviewSourceRoot();
  if (!root) return NextResponse.json({ error: "Local preview source is not mounted" }, { status: 503 });
  const routePath = (await context.params).path.join("/");
  try {
    const bytes = await readContainedLocalPreviewAsset(root, routePath);
    return new NextResponse(bytes as unknown as BodyInit, { status: 200, headers: { ...PRIVATE_RESPONSE_INIT.headers, "Content-Type": "image/webp" } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
