import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NEXT_PUBLIC_DEMO_MODE is inlined at build time, so the e2e demo and live servers need
  // separate build outputs to run side by side (see playwright.config.ts).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  cacheComponents: true,
  experimental: {
    // Turbopack's file-system cache (on by default in Next 16) served stale CSS from the
    // `@tailwindcss/turbopack` loader: Vercel restores .next/cache between deployments and the
    // 003-ui-refresh deploy shipped new JS with the previous theme's stylesheet (same in `next dev`).
    // Always compile from source; the project is small enough that the cache isn't needed.
    turbopackFileSystemCacheForBuild: false,
    turbopackFileSystemCacheForDev: false,
    // The app renders on the client behind a preferences gate (src/app/providers.tsx): pages hold
    // per-user data loaded in the browser, so the server never renders them and implicit
    // instant-navigation validation can't apply. Validate only segments that opt in with
    // `export const instant = true`.
    instantInsights: { validationLevel: "manual-warning" },
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
