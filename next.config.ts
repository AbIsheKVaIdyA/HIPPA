import type { NextConfig } from "next";

/**
 * firebase-admin (and Firestore) rely on dynamic requires (e.g. @opentelemetry/api).
 * Bundling them with Turbopack in dev can throw "Cannot find module '@opentelemetry/api'"
 * and surface as POST /api/auth/sign-in 500. Keep them external.
 */
const nextConfig: NextConfig = {
  serverExternalPackages: [
    "firebase-admin",
    "@google-cloud/firestore",
    "@grpc/grpc-js",
    "google-gax",
    "@opentelemetry/api",
  ],
};

export default nextConfig;
