import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["pdf-parse"],
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
