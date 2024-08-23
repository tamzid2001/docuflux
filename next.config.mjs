/** @type {import('next').NextConfig} */
const nextConfig = {    
    webpack5: true,
    webpack: (config) => {
      config.resolve.fallback = { fs: false, path: false, child_process: false };
  
      return config;
    },
};

export default nextConfig;
