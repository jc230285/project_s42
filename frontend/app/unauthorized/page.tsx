'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getUserGroups } from '@/lib/auth-utils';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

export default function UnauthorizedPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const userGroups = session ? getUserGroups(session) : [];

  useEffect(() => {
    // Show toast on page load
    toast.error('Access denied to the requested page', {
      duration: 3000,
    });

    // Automatically redirect to dashboard after 3 seconds
    const timer = setTimeout(() => {
      toast('Redirecting to dashboard...', {
        icon: '↩️',
        duration: 2000,
      });
      
      setTimeout(() => {
        router.push('/?from=unauthorized');
      }, 500);
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center max-w-md px-6">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-destructive/10 p-6">
            <ShieldAlert className="h-16 w-16 text-destructive" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold mb-3 text-foreground">
          Access Denied
        </h1>
        
        <p className="text-muted-foreground mb-6">
          You don't have permission to access this page.
        </p>
        
        {userGroups.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-muted-foreground mb-2">Your groups:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {userGroups.map((group) => (
                <span
                  key={group}
                  className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                >
                  {group}
                </span>
              ))}
            </div>
          </div>
        )}
        
        <p className="text-sm text-muted-foreground mb-6">
          You will be redirected to the dashboard in a moment...
        </p>
        
        <div className="flex gap-3 justify-center">
          <Button
            onClick={() => router.push('/?from=unauthorized')}
            variant="default"
          >
            Go to Dashboard
          </Button>
          
          <Button
            onClick={() => router.back()}
            variant="outline"
          >
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}
