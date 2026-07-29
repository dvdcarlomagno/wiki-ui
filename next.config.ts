import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root,
  },
  // Attachment uploads (PDF/binary) are buffered by the Next proxy; default 10MB
  // truncates multipart bodies and breaks FormData parsing.
  experimental: {
    proxyClientMaxBodySize: "25mb",
  },
};

export default nextConfig;
