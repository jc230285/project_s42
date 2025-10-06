'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getUserGroups } from '@/lib/auth-utils';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface WithPageAccessProps {
  children: React.ReactNode;
  pagePath: string; // e.g., "/projects"
  fallback?: React.ReactNode;
  redirectTo?: string;
}

interface Page {
  id: number;
  name: string;
  path: string;
  allowed_groups: string[];
}

/**
 * Higher-order component that protects pages based on group permissions
 */
export function WithPageAccess({ 
  children, 
  pagePath,
  fallback = null, 
  redirectTo = '/unauthorized' 
}: WithPageAccessProps) {
  console.log('🔒 WithPageAccess: Component mounted for path:', pagePath);
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [userGroups, setUserGroups] = useState<string[]>([]);
  
  useEffect(() => {
    const checkAccess = async () => {
      console.log('🔒 WithPageAccess: Checking access for path:', pagePath);
      console.log('🔒 WithPageAccess: Session status:', status);
      console.log('🔒 WithPageAccess: Session data:', session);
      
      // If not authenticated, redirect to login
      if (status === 'unauthenticated') {
        console.log('🔒 WithPageAccess: User not authenticated, redirecting to login');
        router.push('/api/auth/signin');
        return;
      }
      
      // If still loading session, wait
      if (status === 'loading') {
        console.log('🔒 WithPageAccess: Session still loading...');
        return;
      }
      
      // If authenticated, check page permissions
      if (session?.user?.email) {
        const groups = getUserGroups(session);
        setUserGroups(groups);
        console.log('🔒 WithPageAccess: User groups:', groups);
        
        try {
          // Fetch user's accessible pages
          console.log('🔒 WithPageAccess: Fetching accessible pages for:', session.user.email);
          const response = await fetch(`/api/pages/user?email=${encodeURIComponent(session.user.email)}`);
          
          if (!response.ok) {
            console.error('🔒 WithPageAccess: Failed to fetch user pages, status:', response.status);
            setIsChecking(false);
            setHasAccess(false);
            return;
          }
          
          const pages: Page[] = await response.json();
          console.log('🔒 WithPageAccess: User accessible pages:', pages);
          console.log('🔒 WithPageAccess: Page paths:', pages.map(p => p.path));
          
          // Check if user has access to this page
          const page = pages.find(p => p.path === pagePath);
          console.log('🔒 WithPageAccess: Looking for path:', pagePath);
          console.log('🔒 WithPageAccess: Found matching page:', page);
          
          if (page) {
            console.log('🔒 WithPageAccess: ✅ User HAS access to page:', page.name);
            setHasAccess(true);
          } else {
            console.log('🔒 WithPageAccess: ❌ User does NOT have access to page:', pagePath);
            setHasAccess(false);
            
            // Show toast notification
            toast.error("Access denied. You don't have permission to view this page.", {
              duration: 3000,
            });
            
            // Redirect to unauthorized page after short delay
            if (redirectTo) {
              console.log('🔒 WithPageAccess: Redirecting to:', redirectTo);
              setTimeout(() => {
                router.push(redirectTo);
              }, 500);
            }
          }
        } catch (error) {
          console.error('🔒 WithPageAccess: Error checking page access:', error);
          setHasAccess(false);
        } finally {
          setIsChecking(false);
        }
      }
    };
    
    checkAccess();
  }, [session, status, pagePath, router, redirectTo]);
  
  // Show loading spinner while checking
  if (isChecking || status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }
  
  // Show fallback or children based on access
  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            You don't have permission to access this page.
          </p>
          <p className="text-sm text-muted-foreground">
            Your groups: {userGroups.join(', ') || 'None'}
          </p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}
