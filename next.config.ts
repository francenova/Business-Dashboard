import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Produces .next/standalone — a self-contained server bundle (no full
  // node_modules needed at runtime) that the Electron main process spawns.
  output: 'standalone',
  // Sanity's Studio (mounted at /studio) needs its own routing behavior;
  // this will be extended in the Sanity integration pass.
  images: {
    remotePatterns: [
      // Sanity's image CDN will be added here once the Sanity project exists.
      // Supabase Storage — allow any Supabase project subdomain
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

export default nextConfig;
