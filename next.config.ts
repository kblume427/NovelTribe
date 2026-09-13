import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "novel-tribe.vercel.app",
          },
        ],
        destination: "https://novel-tribe.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "www.novel-tribe.com",
          },
        ],
        destination: "https://novel-tribe.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
