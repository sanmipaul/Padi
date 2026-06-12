import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  webpack: (cfg) => {
    cfg.resolve.fallback = { fs: false, net: false, tls: false };
    return cfg;
  },
};

export default config;
