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
    unoptimized: true,
  },
  turbopack: {},
  // Bake these build-time env vars into the server-side bundle so
  // Amplify's SSR Lambda can see them at runtime.
  env: {
    APP_AWS_ACCESS_KEY_ID: process.env.APP_AWS_ACCESS_KEY_ID ?? "",
    APP_AWS_SECRET_ACCESS_KEY: process.env.APP_AWS_SECRET_ACCESS_KEY ?? "",
    APP_AWS_REGION: process.env.APP_AWS_REGION ?? "",
    BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID ?? "",
    SNS_TOPIC_ARN: process.env.SNS_TOPIC_ARN ?? "",
    KMS_KEY_ID: process.env.KMS_KEY_ID ?? "",
    DYNAMODB_AUDIT_TABLE: process.env.DYNAMODB_AUDIT_TABLE ?? "",
    DYNAMODB_ACCESS_TABLE: process.env.DYNAMODB_ACCESS_TABLE ?? "",
    DYNAMODB_SESSION_TABLE: process.env.DYNAMODB_SESSION_TABLE ?? "",
    ADMIN_SECRET: process.env.ADMIN_SECRET ?? "",
  },
});

export default nextConfig;
