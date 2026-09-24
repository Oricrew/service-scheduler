import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const REFRIGO_ORIGIN =
  process.env.REFRIGO_ORIGIN || "https://refrigo-service-scheduler.vercel.app";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/refrigo",
        destination: `${REFRIGO_ORIGIN}/refrigo`,
      },
      {
        source: "/refrigo/:path*",
        destination: `${REFRIGO_ORIGIN}/refrigo/:path*`,
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
