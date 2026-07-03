const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: frontendOrigin },
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, PATCH, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Idempotency-Key" },
          { key: "Vary", value: "Origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
