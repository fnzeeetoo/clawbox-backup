/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone', // create .next/standalone with server.js
  // Enable API routes to handle CORS from local engine
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
  // Environmental variable handling
  env: {
    BACKUP_API_URL: process.env.BACKUP_API_URL || 'http://localhost:18790',
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};

export default nextConfig;