'use client';

import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AlertTriangle, Home } from 'lucide-react';

export default function UnauthorizedPage() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-card border border-border rounded-lg p-8 text-center shadow-lg">
          <div className="flex justify-center mb-6">
            <div className="bg-yellow-100 dark:bg-yellow-900 p-3 rounded-full">
              <AlertTriangle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-foreground mb-4">
            Access Denied
          </h1>
          
          <p className="text-muted-foreground mb-6">
            You don't have permission to access this page. Only users with Scale42 group access can view this content.
          </p>
          
          {session?.user?.email && (
            <div className="bg-muted p-3 rounded-md mb-6">
              <p className="text-sm text-muted-foreground">
                Signed in as: <span className="font-medium">{session.user.email}</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Your account domain: <span className="font-medium">
                  {session.user.email.split('@')[1]}
                </span>
              </p>
            </div>
          )}
          
          <div className="space-y-3">
            <Link href="/dashboard">
              <Button className="w-full">
                <Home className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Button>
            </Link>
            
            <p className="text-xs text-muted-foreground">
              If you believe you should have access, please contact your administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}