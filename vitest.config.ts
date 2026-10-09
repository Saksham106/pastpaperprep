import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Server actions import server-only modules; Next swaps them for RPC stubs in the browser,
      // but Vitest loads the real file, so neutralize the guard here.
      "server-only": path.resolve(__dirname, "./test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Many suites load multi-megabyte question banks; the 5s default flakes on CI runners.
    testTimeout: 30_000,
    exclude: [...configDefaults.exclude, "**/.worktrees/**", "**/supabase/tests/*.pglite.test.mjs"],
  },
});
