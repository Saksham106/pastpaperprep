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
  },
  async headers() {
    return [{
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
