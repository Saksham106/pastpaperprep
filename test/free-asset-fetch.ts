/** Test double for GET /api/assets/free (see src/app/api/assets/free/route.ts). */
export function isFreeAssetRequest(input: RequestInfo | URL): boolean {
  return String(input).startsWith("/api/assets/free?");
}

export function freeAssetResponse(
  input: RequestInfo | URL,
  urlFor: (questionId: string, kind: string) => string = (questionId, kind) => `https://assets.example/${questionId}-${kind}.webp`,
): Response {
  const params = new URL(String(input), "https://pastpaperprep.com").searchParams;
  const questionId = params.get("id") ?? "";
  const kind = params.get("kind") ?? "";
  return new Response(JSON.stringify({ expiresIn: 3600, maxAge: 900, asset: { questionId, kind, urls: [urlFor(questionId, kind)] } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export function freeAssetIds(calls: ReadonlyArray<readonly unknown[]>): string[] {
  return calls.map(([input]) => String(input)).filter((url) => url.startsWith("/api/assets/free?"))
    .map((url) => new URL(url, "https://pastpaperprep.com").searchParams.get("id") ?? "");
}
