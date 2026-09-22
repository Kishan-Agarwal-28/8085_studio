import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '8085 Microprocessor Studio',
    short_name: '8085 Studio',
    description:
      'Cycle-Accurate Intel 8085 Microprocessor Simulator, Assembler, and Real-Time Architecture Visualizer.',
    start_url: '/simulator',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#09090b',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/favicon.ico',
        sizes: '32x32',
        type: 'image/x-icon',
      },
    ],
  };
}
