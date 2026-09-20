/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a self-contained .next/standalone build (minimal node_modules
  // trace) so the production Docker image stays small.
  output: "standalone",
};

module.exports = nextConfig;
