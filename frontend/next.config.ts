import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Matching can run candidates, research and review sequentially, each with
  // a backend timeout. Keep the proxy alive long enough to receive that result.
  experimental: { proxyTimeout: 360_000 },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*', // Proxy to Backend
      },
    ]
  },
};

export default nextConfig;
