import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dockerfile copy .next/standalone — bắt buộc bật output standalone
  output: "standalone",

  // Ẩn dev indicator badge (nút tròn N) để không che khuất bottom navigation trên mobile
  devIndicators: false,

  typescript: {
    ignoreBuildErrors: true,
  },

  // Cho phép kết nối WebSocket HMR và truy cập từ mọi máy trong mạng nội bộ (LAN / Wi-Fi)
  allowedDevOrigins: [
    "localhost",
    "localhost:3000",
    "127.0.0.1",
    "127.0.0.1:3000",
    "192.168.21.48",
    "192.168.21.48:3000",
    "192.168.*",
    "10.*",
    "172.16.*",
    "*.local",
    "*.lan",
  ],
};

export default nextConfig;
