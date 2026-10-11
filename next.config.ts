import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["pdf-parse"],
  ...(process.env.LUJIE_DESKTOP_BUILD === "1" ? {
    output: "standalone",
    experimental: { cpus: 2 },
    outputFileTracingExcludes: {
      "/*": ["./.env*", "./prisma/*.db*", "./data/campus/**/*", "./outputs/**/*", "./tmp/**/*"],
    },
  } as const : {}),
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
