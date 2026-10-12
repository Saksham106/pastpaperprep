/** Match only the known PostgREST clock rejection, never generic JWT failures. */
export function isFutureIssuedJwtError(error: unknown): boolean {
  if (!error || typeof error !== "object" || Array.isArray(error)) return false;
  const failure = error as { code?: unknown; message?: unknown };
  return failure.code === "PGRST303" && failure.message === "JWT issued at future";
}
