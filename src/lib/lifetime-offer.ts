export const LIFETIME_OFFER = { amountCents: 29_900, currency: "usd", productId: "lifetime_all_access" } as const;

export function lifetimeCheckoutMetadataIsValid(metadata: unknown, userId: string): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const value = metadata as Record<string, unknown>;
  return value.user_id === userId && value.product_id === LIFETIME_OFFER.productId && value.purchase_type === "lifetime";
}
