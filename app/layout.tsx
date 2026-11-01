import type { Metadata } from 'next';
import { Anton, Source_Sans_3, Space_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import { ConnectivityGate } from '@/components/ConnectivityGate';
import { DeviceGate } from '@/components/DeviceGate';
import './globals.css';

const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-anton',
  display: 'swap',
});

const sourceSans3 = Source_Sans_3({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-source-sans-3',
  display: 'swap',
});

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
  display: 'swap',
});

// Dashboard-only typeface (scoped via .dashboard-app-root in globals.css) —
// the landing page keeps Source Sans 3 untouched.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-dashboard',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Royal Optical',
  description: 'Royal Optical — Eye Clinic & Optical Studio',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${anton.variable} ${sourceSans3.variable} ${spaceMono.variable} ${plusJakartaSans.variable}`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ConnectivityGate>
          <DeviceGate>{children}</DeviceGate>
        </ConnectivityGate>
      </body>
    </html>
  );
}
