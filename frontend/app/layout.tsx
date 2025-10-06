import './globals.css';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Script from 'next/script';
import Providers from '@/components/Providers';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'Project S42',
  description: 'Scale42 Project Management Platform',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.svg', sizes: '32x32', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.svg',
    apple: '/apple-touch-icon.svg',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=marker,geometry&v=weekly&loading=async`}
          strategy="afterInteractive"
          async={true}
        />
      </head>
      <body>
        <Providers>
          {children}
          <Toaster
            position="bottom-left"
            toastOptions={{
              duration: 5000,
              style: {
                background: '#363636',
                color: '#fff',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
