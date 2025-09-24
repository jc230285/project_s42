'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1f2937', // gray-800
            color: '#f9fafb', // gray-50
            border: '1px solid #374151', // gray-700
          },
          success: {
            iconTheme: {
              primary: '#10b981', // emerald-500
              secondary: '#f9fafb',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444', // red-500
              secondary: '#f9fafb',
            },
          },
        }}
      />
    </SessionProvider>
  );
}