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
  serverExternalPackages: ["sharp"],
  images: {
    // Sharp is installed in amplify.yml for Linux x64 — enable optimization.
    // Next.js will resize/compress on first request; Amplify CloudFront caches the result.
    unoptimized: false,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.amazonaws.com",
        pathname: "/**",
      },
    ],
  },
  turbopack: {},

  // Allow cross-origin requests from local network devices (e.g. phone/tablet on same Wi-Fi).
  // Add any additional local IPs here as needed.
  allowedDevOrigins: ["192.168.0.130"],

  // Non-secret env vars that Amplify's SSR Lambda needs at runtime.
  // DO NOT put AWS credentials here — they would be baked as plain text into
  // the server bundle. Set APP_AWS_ACCESS_KEY_ID / APP_AWS_SECRET_ACCESS_KEY
  // only in the Amplify Console (Environment variables) so they stay server-only.
  env: {
    APP_AWS_REGION: process.env.APP_AWS_REGION ?? "",
    // Credentials baked server-side so the SSR Lambda can call AWS APIs.
    // No NEXT_PUBLIC_ prefix = never sent to the browser bundle.
    APP_AWS_ACCESS_KEY_ID: process.env.APP_AWS_ACCESS_KEY_ID ?? "",
    APP_AWS_SECRET_ACCESS_KEY: process.env.APP_AWS_SECRET_ACCESS_KEY ?? "",
    KMS_KEY_ID: process.env.KMS_KEY_ID ?? "",
    ADMIN_SECRET: process.env.ADMIN_SECRET ?? "",
    BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID ?? "",
    KIMI_BEDROCK_MODEL: process.env.KIMI_BEDROCK_MODEL ?? "",
    SNS_TOPIC_ARN: process.env.SNS_TOPIC_ARN ?? "",
    DYNAMODB_AUDIT_TABLE: process.env.DYNAMODB_AUDIT_TABLE ?? "",
    DYNAMODB_ACCESS_TABLE: process.env.DYNAMODB_ACCESS_TABLE ?? "",
    DYNAMODB_SESSION_TABLE: process.env.DYNAMODB_SESSION_TABLE ?? "",
    DYNAMODB_HEALTH_RECORDS_TABLE: process.env.DYNAMODB_HEALTH_RECORDS_TABLE ?? "",
    DYNAMODB_CHECKUPS_TABLE: process.env.DYNAMODB_CHECKUPS_TABLE ?? "",
    DYNAMODB_APPOINTMENTS_TABLE: process.env.DYNAMODB_APPOINTMENTS_TABLE ?? "",
  },

  async headers() {
    return [
      // Static JS/CSS/fonts — immutable, cache 1 year at CDN edge
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Public assets (manifest, 3D model JSON, icons)
      {
        source: "/models/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=3600" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
      // API routes — never cache at CDN; browsers may cache GET briefly
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          // Prevent clickjacking and MIME sniffing
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
});

export default nextConfig;
