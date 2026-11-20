import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build to plain static files in `out/` — no server needed.
  //
  // Note: `cacheComponents` (and `partialPrefetching`, which depends on it)
  // can't be combined with a static export — `next build` fails with
  // "PPR cannot be enabled in export mode" — so they are off.
  output: "export",
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
