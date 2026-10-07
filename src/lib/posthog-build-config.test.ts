import { describe, expect, it } from "vitest";
import { getPostHogBuildConfig } from "@/lib/posthog-build-config";

const uploadEnv = { POSTHOG_API_KEY: "upload-fixture", POSTHOG_PROJECT_ID: "623524", VERCEL: "1", VERCEL_ENV: "production" };

describe("PostHog build sourcemap privacy guard", () => {
  it("never launches source-map upload on macOS, even with production credentials", () => {
    expect(getPostHogBuildConfig(uploadEnv, "darwin").sourcemaps.enabled).toBe(false);
  });
  it("requires the private key, exact project, and a Vercel Linux deployment build", () => {
    expect(getPostHogBuildConfig({}, "linux").sourcemaps.enabled).toBe(false);
    expect(getPostHogBuildConfig({ ...uploadEnv, POSTHOG_API_KEY: undefined }, "linux").sourcemaps.enabled).toBe(false);
    expect(getPostHogBuildConfig({ ...uploadEnv, POSTHOG_PROJECT_ID: "other" }, "linux").sourcemaps.enabled).toBe(false);
    expect(getPostHogBuildConfig({ ...uploadEnv, VERCEL: undefined }, "linux").sourcemaps.enabled).toBe(false);
    expect(getPostHogBuildConfig(uploadEnv, "linux").sourcemaps.enabled).toBe(true);
    expect(getPostHogBuildConfig({ ...uploadEnv, VERCEL_ENV: "preview" }, "linux").sourcemaps.enabled).toBe(true);
  });
  it("deletes uploaded maps and associates the build with its public revision", () => {
    const config = getPostHogBuildConfig({ ...uploadEnv, VERCEL_GIT_COMMIT_SHA: "abc123" }, "linux");
    expect(config.personalApiKey).toBe("upload-fixture");
    expect(config.sourcemaps).toMatchObject({ enabled: true, releaseVersion: "abc123", releaseName: "pastpaperprep", deleteAfterUpload: true });
    expect(JSON.stringify(config.sourcemaps)).not.toContain("upload-fixture");
  });
});
