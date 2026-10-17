/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${(process.env.BACKEND_API_URL || `http://localhost:${process.env.PORT || 4001}`).replace(/\/$/, '')}/api/:path*`, // يوجّه للباك إند على المنفذ المضبوط
      },
    ];
  },
};
export default nextConfig;
