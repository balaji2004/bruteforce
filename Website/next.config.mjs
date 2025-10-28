import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.js');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Webpack configuration to handle client-side libraries
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle these on server side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },

  eslint: {
    // Don't fail build on ESLint errors (they'll still show as warnings)
    ignoreDuringBuilds: false,
  },
};

export default withNextIntl(nextConfig);
