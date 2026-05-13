import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Vercel and Docker/Node.js self-hosted deployments.
  // next build uses webpack by default (Turbopack is opt-in via --turbopack flag),
  // so webpack generates the middleware NFT files that standalone output needs.
  output: "standalone",
};

export default nextConfig;
