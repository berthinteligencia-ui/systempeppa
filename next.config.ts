import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "unpdf"],
  optimizePackageImports: ["lucide-react", "recharts"],
};

export default nextConfig;
