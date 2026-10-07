type BuildEnvironment = Record<string, string | undefined>;

export function getPostHogBuildConfig(env: BuildEnvironment = process.env, platform: string = process.platform) {
  return {
    personalApiKey: env.POSTHOG_API_KEY || "",
    projectId: env.POSTHOG_PROJECT_ID || "623524",
    host: env.POSTHOG_HOST || env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.posthog.com",
    sourcemaps: {
      // Upload only on Vercel's Linux builders. Never invoke the blocked native
      // uploader on a developer's Mac or bypass Gatekeeper to make a build pass.
      enabled: Boolean(platform === "linux" && env.VERCEL === "1" &&
        (env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview") &&
        env.POSTHOG_API_KEY && env.POSTHOG_PROJECT_ID === "623524"),
      releaseName: "pastpaperprep",
      releaseVersion: env.NEXT_PUBLIC_BUILD_REVISION || env.VERCEL_GIT_COMMIT_SHA || "local",
      deleteAfterUpload: true,
    },
  };
}
