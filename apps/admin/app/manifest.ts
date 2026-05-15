import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VouchrEx Admin',
    short_name: 'VouchrEx Admin',
    description: 'Mobile-friendly admin console for VouchrEx operations.',
    start_url: '/payouts',
    scope: '/',
    display: 'standalone',
    background_color: '#0D0B1E',
    theme_color: '#0D0B1E',
    orientation: 'portrait',
    categories: ['business', 'finance', 'productivity'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
