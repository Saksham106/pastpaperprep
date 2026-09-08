export function formatPublicLabel(value: string): string {
  const spaced = value.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (!spaced) return spaced;
  return spaced.charAt(0).toLocaleUpperCase() + spaced.slice(1);
}
