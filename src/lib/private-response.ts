export const PRIVATE_NO_STORE = "private, no-store, max-age=0";

/** Marks every response from a user-private route as uncacheable, errors and denials included. */
export function withPrivateNoStore<Args extends unknown[], R extends Response>(handler: (...args: Args) => Promise<R>) {
  return async (...args: Args): Promise<R> => {
    const response = await handler(...args);
    response.headers.set("Cache-Control", PRIVATE_NO_STORE);
    return response;
  };
}

/** True for a non-null, non-array JSON object. */
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
