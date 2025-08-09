/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Exclude WASM packages from server-side bundling (Next.js 15+ solution)
  serverExternalPackages: [
    '@emurgo/cardano-serialization-lib-nodejs',
    '@emurgo/cardano-message-signing-nodejs'
  ],
  webpack: (config, { isServer }) => {
    // Enable WASM for both client and server to avoid module parsing errors
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Handle WASM files properly
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    if (!isServer) {
      // Client-side fallbacks
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    return config;
  },
};

module.exports = nextConfig;