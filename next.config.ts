import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NEXT_PUBLIC_DEMO_MODE is inlined at build time, so the e2e demo and live servers need
  // separate build outputs to run side by side (see playwright.config.ts).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  cacheComponents: true,
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
