import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

function clientZone() {
  const path = process.env.CLIENT_PATH?.trim();
  const origin = process.env.CLIENT_ORIGIN?.trim().replace(/\/$/, "");

  if (!path || !origin || !/^[a-z0-9-]+$/i.test(path)) {
    return null;
  }

  return { path, origin };
}

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    const zone = clientZone();

    if (!zone) {
      return [];
    }

    return [
      {
        source: `/:locale(es|en|pt)/${zone.path}`,
        destination: `/${zone.path}`,
        permanent: false,
      },
    ];
  },
  async rewrites() {
    const zone = clientZone();

    if (!zone) {
      return [];
    }

    return {
      beforeFiles: [
        {
          source: `/${zone.path}`,
          destination: `${zone.origin}/${zone.path}`,
        },
        {
          source: `/${zone.path}/:path*`,
          destination: `${zone.origin}/${zone.path}/:path*`,
        },
      ],
    };
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
