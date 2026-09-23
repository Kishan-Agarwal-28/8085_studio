import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/toast';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://8085-studio.netlify.app';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
    { media: '(prefers-color-scheme: light)', color: '#09090b' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: '8085 Microprocessor Studio — Cycle-Accurate Assembler & Real-Time Visualizer',
    template: '%s | 8085 Studio',
  },
  description:
    'Free, cycle-accurate Intel 8085 assembler, virtual machine, and real-time CPU visualizer in the browser. Features step-by-step data bus animations, two-pass assembler, 64KB memory inspector, hardware interrupt simulation (TRAP, RST 7.5, RST 6.5, RST 5.5, INTR), SIM/RIM decoders, and full undocumented ghost opcode support.',
  applicationName: '8085 Microprocessor Studio',
  authors: [{ name: '8085 Studio' }],
  generator: 'Next.js',
  keywords: [
    '8085 microprocessor',
    '8085 simulator',
    'intel 8085',
    '8085 assembler',
    '8085 compiler',
    '8085 architecture visualizer',
    'microprocessor studio',
    'online 8085 compiler',
    'assembly language IDE',
    'cycle-accurate 8085 simulation',
    'undocumented 8085 opcodes',
    'ghost opcodes',
    'sim rim instructions',
    'hardware interrupts trap rst',
    'two pointer algorithm visualizer',
    '64kb memory inspector',
    'computer architecture simulator',
    'microprocessor lab online',
    'excalidraw presenter mode',
  ],
  referrer: 'origin-when-cross-origin',
  creator: '8085 Studio',
  publisher: '8085 Studio',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: '8085 Microprocessor Studio — Cycle-Accurate Assembler & Real-Time Visualizer',
    description:
      'Compile, step-through, and visually debug Intel 8085 microcode in real time with animated data bus, register banks, memory inspector, and hardware interrupt emulation.',
    url: siteUrl,
    siteName: '8085 Microprocessor Studio',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: '8085 Microprocessor Studio — Architecture Visualizer & Assembler',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '8085 Microprocessor Studio — Cycle-Accurate Assembler & Visualizer',
    description:
      'Interactive Intel 8085 assembler, compiler, and step-by-step CPU visualizer with animated data flow and hardware interrupts.',
    images: ['/og-image.svg'],
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
  },
  manifest: '/manifest.webmanifest',
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  category: 'technology',
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      '@id': `${siteUrl}/#webapp`,
      name: '8085 Microprocessor Studio',
      url: siteUrl,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'All modern web browsers',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      description:
        'Browser-based cycle-accurate Intel 8085 microprocessor studio with two-pass assembler, real-time animated data bus, register matrix, flag registers, 64KB memory inspector, and hardware interrupt simulation.',
      featureList: [
        'Cycle-accurate 8085 CPU & ALU emulation',
        'Two-pass intelligent assembler with friendly shorthand syntax',
        'Animated CPU internal data bus particle flow',
        'Interactive 64KB linear hex memory & stack inspector',
        'Physical interrupt pin simulation (TRAP, RST 7.5, RST 6.5, RST 5.5, INTR)',
        'Live SIM and RIM instruction decoders',
        '16-bit incrementer/decrementer address latch visualizer',
        'Emulation of all 10 undocumented ghost opcodes (DSUB, ARHL, RDEL, etc.)',
        'Presenter mode with transparent Excalidraw whiteboard canvas and glowing laser pointer',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: '8085 Microprocessor Studio',
      description:
        'Cycle-accurate Intel 8085 Assembler, Virtual Machine, and Real-Time Architecture Visualizer.',
      inLanguage: 'en-US',
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Toaster>{children}</Toaster>
      </body>
    </html>
  );
}
