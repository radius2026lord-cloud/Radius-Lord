/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${(process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001').replace(/\/$/, '')}/api/:path*`, // يستخدم عنوان الباك إند لا منفذ واجهة Next.js
      },
    ];
  },
};
export default nextConfig;
