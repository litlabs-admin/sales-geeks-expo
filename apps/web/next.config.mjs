import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), "../../.env.local") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cosmetic lint rules (unused vars, unescaped apostrophes) must not block a
  // production deploy. TypeScript type-checking still runs and still fails the
  // build on real type errors.
  eslint: { ignoreDuringBuilds: true }
};

export default nextConfig;
