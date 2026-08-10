/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Permite servir la API de Pandas bajo el mismo origen en desarrollo,
  // evitando problemas de CORS y de cookies entre puertos.
  async rewrites() {
    const backend = process.env.BACKEND_URL || 'http://127.0.0.1:8000';
    return [{ source: '/api/:path*', destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
