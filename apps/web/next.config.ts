import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@arlo-doc/ui", "@arlo-doc/shared", "@arlo-doc/client"],
};

export default nextConfig;
