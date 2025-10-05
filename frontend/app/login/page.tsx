'use client';

import { signIn, signOut } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    // If not loading and not authenticated, trigger Google sign-in
    if (status === 'unauthenticated') {
      signIn('google', { callbackUrl: '/' });
    }
  }, [status, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-6">
        <div className="mb-8">
          <img
            src="https://static.wixstatic.com/media/02157e_2734ffe4f4d44b319f9cc6c5f92628bf~mv2.png/v1/fill/w_506,h_128,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/Scale42%20Logo%200_1%20-%20White%20-%202kpx.png"
            alt="Scale42 Logo"
            className="h-16 w-auto mx-auto bg-muted px-4 py-2 rounded"
          />
        </div>
        
        {status === 'authenticated' ? (
          <>
            <h1 className="text-2xl font-bold text-foreground mb-4">You're already logged in</h1>
            <p className="text-muted-foreground mb-2">Logged in as: <strong>{session?.user?.email}</strong></p>
            <div className="space-y-3 mt-6">
              <button
                onClick={() => router.push('/')}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-md text-sm font-medium transition-colors"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground px-6 py-3 rounded-md text-sm font-medium transition-colors"
              >
                Sign out and login with different account
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Redirecting to Google Sign-In...</h1>
            <p className="text-muted-foreground">Please wait while we redirect you to sign in with Google</p>
            
            <button
              onClick={() => signIn('google', { callbackUrl: '/' })}
              className="mt-6 bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Click here if not redirected
            </button>
          </>
        )}
      </div>
    </div>
  );
}
