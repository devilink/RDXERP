import type { NextConfig } from "next";

// Cache Components is intentionally OFF: an ERP is fully per-user, per-school,
// request-time data, so every authenticated route renders dynamically.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
