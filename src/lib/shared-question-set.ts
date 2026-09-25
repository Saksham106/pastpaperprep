// Public membership only. This URL never contains private worksheet metadata or asset URLs.
export const MAX_SHARED_SET_LENGTH = 8000;
const ID = /^[A-Za-z0-9_-]{1,100}$/;

export function parseSharedSet(value: string): string[] {
  if (!value || value.length > MAX_SHARED_SET_LENGTH) throw new Error("Invalid shared question link");
  const ids = value.split(",");
  if (ids.length > 500 || ids.some((id) => !ID.test(id)) || new Set(ids).size !== ids.length) {
    throw new Error("Invalid shared question link");
  }
  return ids;
}

export function encodeSharedSet(ids: readonly string[]): string {
  return parseSharedSet(ids.join(",")).join(",");
}
