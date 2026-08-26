export const CURRENT_ENTITLEMENT_FILTERS = {
  startsAt: "now",
  expiresAt: "expires_at.is.null,expires_at.gt.now",
} as const;
