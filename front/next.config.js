/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'utf-8-validate': false,
      'bufferutil': false,
    };
    return config;
  },
};

module.exports = nextConfig;
