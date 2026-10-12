// Match the installed auth-js validator before using URL input as a verifier-slot key.
export function validOAuthFlowId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(value);
}

// signInWithOAuth builds this URL locally; do not start a second flow to change redirectTo.
// Only OAuth is augmented: email/recovery redirect allowlists remain untouched.
export function googleAuthorizationUrl(url: string, callbackUrl: URL, flowId: unknown) {
  if (flowId == null) return url; // Compatibility with older SDKs / non-PKCE clients.
  if (!validOAuthFlowId(flowId)) throw new Error("Invalid OAuth flow");
  const callback = new URL(callbackUrl);
  callback.searchParams.set("provider", "google");
  callback.searchParams.set("sb_flow_id", flowId);
  const authorization = new URL(url);
  authorization.searchParams.set("redirect_to", callback.toString());
  return authorization.toString();
}
