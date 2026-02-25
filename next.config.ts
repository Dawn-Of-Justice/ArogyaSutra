import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = withPWA({
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  turbopack: {},
});

export default nextConfig;
