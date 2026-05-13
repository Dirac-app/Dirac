import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: output: "standalone" is incompatible with Next.js 16 Turbopack builds
  // (middleware NFT file tracing is not yet supported). Re-enable when deploying
  // with a webpack build or when Turbopack adds full NFT support.
};

export default nextConfig;
