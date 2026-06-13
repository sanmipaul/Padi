/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  webpack: (cfg) => {
    cfg.resolve.fallback = { fs: false, net: false, tls: false };
    return cfg;
  },
};

export default config;
