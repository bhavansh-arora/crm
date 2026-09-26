/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a self-contained .next/standalone build (minimal node_modules
  // trace) so the production Docker image stays small.
  output: "standalone",
  async headers() {
    return [
      {
        // Cross-origin isolation lets the in-browser narration voice (see
        // public/voice/voice-worker.js) use multi-threaded WebAssembly.
        // "credentialless" keeps ordinary cross-origin loads working.
        source: "/audit",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
      {
        // A worker started from an isolated page must itself be served with
        // a compatible embedder policy, or the browser refuses to run it.
        source: "/voice/:path*",
        headers: [{ key: "Cross-Origin-Embedder-Policy", value: "credentialless" }],
      },
    ];
  },
};

module.exports = nextConfig;
