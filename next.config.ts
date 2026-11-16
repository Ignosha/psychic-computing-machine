import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  // The sanctions dataset is read from disk at runtime; ship it with the functions that use it.
  outputFileTracingIncludes: {
    "/api/v1/sanctions/**": ["./data/sanctions.json"],
    "/sanctions/**": ["./data/sanctions.json"],
    "/sanctions": ["./data/sanctions.json"],
  },
};
export default config;
