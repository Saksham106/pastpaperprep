import type { NextConfig } from "next";
import { withPostHogConfig } from "@posthog/nextjs-config";
import { getPostHogBuildConfig } from "@/lib/posthog-build-config";
import { bankUrlAliases } from "@/lib/bank-url-aliases";

// Set by scripts/agent-server.mjs (`npm run dev:agent` / `preview:agent`): load pages on
// first request instead of at start (0.65 -> 0.43 GB for `next start`). Builds and the
// owner's `npm run dev` are unaffected.
const agentServer = process.env.PASTPAPERPREP_AGENT_SERVER === "1";

/** `/page/` → `/page` (308, query kept), like Next's default, except the PostHog relay under /pp-relay. */
const TRAILING_SLASH_REDIRECT = { source: "/:path((?!pp-relay(?:/|$)).+)/", destination: "/:path", permanent: true };

const nextConfig: NextConfig = {
  // PostHog's endpoints end in a slash (/pp-relay/e/). Next's built-in slash redirect runs before
  // vercel.json routes, so every analytics request would take an extra 308 round trip. Turn the
  // built-in redirect off and redirect trailing slashes ourselves for everything except the
  // analytics relay (first entry in redirects() below), so page URLs behave exactly as before.
  skipTrailingSlashRedirect: true,
  experimental: {
    // Vercel exposes two build cores. Using both keeps static-generation workers
    // below the per-worker heap ceiling as the question corpus grows.
    cpus: 2,
    ...(agentServer ? { preloadEntriesOnStart: false } : {}),
  },
  outputFileTracingIncludes: {
    "/api/exam-style/worksheets/[course]/[slug]": ["./private/exam-style/**/*.pdf"],
    "/api/assets/sign": ["./generated/asset-manifest/**"],
    "/api/assets/free": ["./generated/asset-manifest/**"],
    "/api/study-state": ["./generated/asset-manifest/**"],
    "/api/questions/search": ["./generated/question-search/**"],
    // Question-image shapes for the first page of cards (src/lib/question-image-shapes.ts).
    "/banks/**": ["./src/data/image-shapes/*.json"],
    "/api/private-bank-index/[bank]": ["./src/data/image-shapes/*.json"],
    "/api/helper": ["./public/search/*.json", "./public/bank-index/*.json"],
    "/past-papers": ["./src/data/paper-archives/*.json", "./src/data/paper-archive-readback.json"],
    "/past-papers/**": ["./src/data/paper-archives/*.json", "./src/data/paper-archive-readback.json"],
  },
  outputFileTracingExcludes: {
    "/past-papers": ["./private/paper-archives/source-bindings.json", "./private/paper-archives/checkpoints/**", "./private/paper-archives/receipt.json", "./private/paper-preview/**", "./private/chemistry-paper-archive/**"],
    "/past-papers/**": ["./private/paper-archives/source-bindings.json", "./private/paper-archives/checkpoints/**", "./private/paper-archives/receipt.json", "./private/paper-preview/**", "./private/chemistry-paper-archive/**"],
  },
  async redirects() {
    return [
      TRAILING_SLASH_REDIRECT,
      // There is no bank index page; the home page lists every bank.
      { source: "/banks", destination: "/#question-banks", permanent: false },
      ...bankUrlAliases().map(({ alias, bank }) => ({ source: `/banks/${alias}/:path*`, destination: `/banks/${bank}/:path*`, permanent: true })),
    ];
  },
  async headers() {
    return [{
      // Low-risk defaults only; CSP and frame restrictions need a staged rollout
      // (PostHog, Stripe, and the pdf.js worker all load cross-origin resources).
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }, {
      source: "/bank-index/:slug.v1-:hash.json",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ],
    }];
  },
  turbopack: {
    root: process.cwd(),
  },
  // Release IDs are public build metadata; credentials remain server-only.
  env: {
    NEXT_PUBLIC_BUILD_REVISION: process.env.NEXT_PUBLIC_BUILD_REVISION || process.env.VERCEL_GIT_COMMIT_SHA || "local",
    // Only whether a key exists; the AI helper's button stays hidden on deployments without one.
    NEXT_PUBLIC_HELPER_ENABLED: process.env.ANTHROPIC_API_KEY ? "1" : "",
  },
  images: {
    // One quality for everything. The landing artwork at 75 looks the same as 90 at display
    // size and is 30-45% smaller (it was asking for 85, which Next coerced up to 90).
    qualities: [75],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "saksham106.github.io",
      },
    ],
  },
};

export default withPostHogConfig(nextConfig, getPostHogBuildConfig());
