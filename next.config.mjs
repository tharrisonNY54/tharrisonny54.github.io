/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for GitHub Pages (no server runtime).
  output: "export",
  // Directory-style URLs so Pages resolves routes to <route>/index.html.
  trailingSlash: true,
  // No image optimization server on Pages.
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
