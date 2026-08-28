import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kb/ui", "@kb/shared", "@kb/client"],
};

export default nextConfig;
