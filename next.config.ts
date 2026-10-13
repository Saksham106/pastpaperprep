import type { NextConfig } from "next";
import { withPostHogConfig } from "@posthog/nextjs-config";
import { getPostHogBuildConfig } from "@/lib/posthog-build-config";

const nextConfig: NextConfig = {
  experimental: {
    // Vercel exposes two build cores. Using both keeps static-generation workers
    // below the per-worker heap ceiling as the question corpus grows.
    cpus: 2,
  },
  outputFileTracingIncludes: {
    "/api/exam-style/worksheets/[course]/[slug]": ["./private/exam-style/**/*.pdf"],
    "/api/assets/sign": ["./generated/asset-manifest/**"],
    "/api/assets/free": ["./generated/asset-manifest/**"],
    "/api/study-state": ["./generated/asset-manifest/**"],
    "/past-papers": ["./src/data/paper-archives/*.json", "./src/data/paper-archive-readback.json"],
    "/past-papers/**": ["./src/data/paper-archives/*.json", "./src/data/paper-archive-readback.json"],
  },
  outputFileTracingExcludes: {
    "/past-papers": ["./private/paper-archives/source-bindings.json", "./private/paper-archives/checkpoints/**", "./private/paper-archives/receipt.json", "./private/paper-preview/**", "./private/chemistry-paper-archive/**"],
    "/past-papers/**": ["./private/paper-archives/source-bindings.json", "./private/paper-archives/checkpoints/**", "./private/paper-archives/receipt.json", "./private/paper-preview/**", "./private/chemistry-paper-archive/**"],
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
  },
  images: {
    // Artwork ships as pre-compressed WebP, so the optimizer must pass quality 90 through
    // instead of clamping to the default 75 and re-encoding the hero on every request.
    qualities: [75, 90],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "saksham106.github.io",
      },
    ],
  },
};

export default withPostHogConfig(nextConfig, getPostHogBuildConfig());
