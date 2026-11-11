import { render } from "@testing-library/react";
import { NextRequest } from "next/server";
import { vi } from "vitest";
import PricingPage from "./page";

/**
 * Test harness for the CDN-served /pricing page. The caller mocks `next/navigation`
 * (useSearchParams → `pricingTestUrl.search`) and the Supabase server modules; account
 * requests from the page are routed to the real /api/pricing/account handler.
 */
/** `prerender: true` makes the mocked useSearchParams bail out, as it does while Next prerenders. */
export const pricingTestUrl = { search: "", prerender: false };
export const SESSION_COOKIE = "sb-project-auth-token=base64-eyJ9";

export function setSignedIn(signedIn: boolean) {
  document.cookie = signedIn ? `${SESSION_COOKIE}; path=/` : "sb-project-auth-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
}

/** Sends the page's account request through the real route handler, with the browser's cookie. */
export function routeAccountRequestsToHandler() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url !== "/api/pricing/account") throw new Error(`Unexpected fetch ${url}`);
    const { GET } = await import("@/app/api/pricing/account/route");
    try {
      return await GET(new NextRequest(`https://pastpaperprep.com${url}`, { headers: { cookie: document.cookie } }));
    } catch {
      return new Response(null, { status: 500 });
    }
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function renderPricingPage(search = "") {
  pricingTestUrl.search = search;
  pricingTestUrl.prerender = false;
  return render(PricingPage());
}
