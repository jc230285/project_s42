'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { hasScale42Access, getUserGroups } from '@/lib/auth-utils';
import { Loader2 } from 'lucide-react';

console.log('WithScale42Access: FILE LOADED - This should appear immediately');

interface WithScale42AccessProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

/**
 * Higher-order component that protects content for Scale42 users only
 */
export function WithScale42Access({ 
  children, 
  fallback = null, 
  redirectTo = '/unauthorized' 
}: WithScale42AccessProps) {
  console.log('!!!!! WithScale42Access: COMPONENT FUNCTION CALLED !!!!');
  console.log('WithScale42Access: Component mounted/rendered');
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [userGroups, setUserGroups] = useState<string[]>([]);
  
  console.log('WithScale42Access: Current status:', status, 'session exists:', !!session);
  
  // TEST: Direct access check without useEffect to see if function works
  if (session && status === 'authenticated') {
    console.log('WithScale42Access: DIRECT TEST - calling hasScale42Access');
    const directCheck = hasScale42Access(session);
    console.log('WithScale42Access: DIRECT TEST - result:', directCheck);
  }

  // Fetch user groups if missing from session
  useEffect(() => {
    console.log('WithScale42Access: useEffect for fetchUserGroups triggered');
    const fetchUserGroups = async () => {
      console.log('WithScale42Access: fetchUserGroups called, session exists:', !!session?.user?.email);
      if (session?.user?.email) {
        const currentGroups = getUserGroups(session);
        console.log('WithScale42Access: Current groups from session:', currentGroups);
        console.log('WithScale42Access: Full session object:', JSON.stringify(session, null, 2));
        
        if (currentGroups.length === 0) {
          console.log('WithScale42Access: No groups in session, fetching from backend...');
          try {
            const response = await fetch('/api/auth/user-groups', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: session.user.email })
            });
            
            if (response.ok) {
              const data = await response.json();
              console.log('WithScale42Access: Fetched groups from API:', data.groups);
              setUserGroups(data.groups || []);
            } else {
              console.error('WithScale42Access: Failed to fetch groups:', response.status);
              setUserGroups([]);
            }
          } catch (error) {
            console.error('WithScale42Access: Error fetching groups:', error);
            setUserGroups([]);
          }
        } else {
          setUserGroups(currentGroups);
        }
      }
    };

    if (status === 'authenticated' && session) {
      fetchUserGroups();
    }
  }, [session, status]);

  useEffect(() => {
    console.log('WithScale42Access: useEffect for access check triggered, status:', status);
    if (status === 'loading') {
      console.log('WithScale42Access: Status is loading, returning early');
      return;
    }

    if (status === 'unauthenticated') {
      console.log('WithScale42Access: User unauthenticated, redirecting to signin');
      router.push('/api/auth/signin');
      return;
    }

    if (status === 'authenticated') {
      // Wait for session to have user data before checking access
      if (!session?.user?.email) {
        console.log('WithScale42Access: Session authenticated but no user data yet, waiting...');
        return;
      }
      
      // Also check if groups are loaded (either in session or fetched)
      const sessionGroups = getUserGroups(session);
      if (sessionGroups.length === 0 && userGroups.length === 0) {
        console.log('WithScale42Access: No groups loaded yet, waiting...');
        return;
      }
      // Use the same hasScale42Access function that auth-utils uses
      console.log('WithScale42Access: User authenticated, checking access');
      console.log('WithScale42Access: Session for access check:', session);
      console.log('WithScale42Access: About to call hasScale42Access...');
      const hasAccess = hasScale42Access(session);
      console.log('WithScale42Access: hasScale42Access returned:', hasAccess);
      console.log('WithScale42Access: Type of hasAccess:', typeof hasAccess);
      
      // Also check fetched groups as fallback
      if (!hasAccess && userGroups.length > 0) {
        const fallbackAccess = userGroups.some(group => {
          const groupLower = group.toLowerCase();
          const isScale42 = groupLower === 'scale42' || 
                           groupLower === 'scale-42' || 
                           groupLower === 'scale_42';
          console.log('WithScale42Access: Checking fallback group:', group, 'isScale42:', isScale42);
          return isScale42;
        });
        console.log('WithScale42Access: Fallback access decision:', fallbackAccess);
        if (fallbackAccess) {
          setIsChecking(false);
          return;
        }
      }
      
      if (!hasAccess && redirectTo) {
        // Only redirect if we have actually checked the groups
        console.log('WithScale42Access: Access denied, redirecting to:', redirectTo);
        router.push(redirectTo);
        return;
      }
      
      if (hasAccess) {
        console.log('WithScale42Access: Access granted, stopping checking');
        setIsChecking(false);
      } else {
        console.log('WithScale42Access: No access granted yet, still checking...');
      }
    }
  }, [session, status, router, redirectTo, userGroups]);

  // Show loading while checking authentication and permissions
  if (status === 'loading' || isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Checking permissions...</span>
        </div>
      </div>
    );
  }

  // Show fallback if user doesn't have access and no redirect is specified
  if (!hasScale42Access(session)) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this content.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Hook to check if current user has Scale42 access
 */
export function useScale42Access() {
  const { data: session, status } = useSession();
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);

  useEffect(() => {
    const fetchGroups = async () => {
      if (session?.user?.email) {
        const sessionGroups = getUserGroups(session);
        if (sessionGroups.length === 0) {
          setIsLoadingGroups(true);
          try {
            const response = await fetch('/api/auth/user-groups', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: session.user.email })
            });
            
            if (response.ok) {
              const data = await response.json();
              setUserGroups(data.groups || []);
            }
          } catch (error) {
            console.error('Error fetching groups:', error);
          } finally {
            setIsLoadingGroups(false);
          }
        } else {
          setUserGroups(sessionGroups);
        }
      }
    };

    if (status === 'authenticated') {
      fetchGroups();
    }
  }, [session, status]);

  const sessionGroups = getUserGroups(session);
  const groupsToCheck = sessionGroups.length > 0 ? sessionGroups : userGroups;
  
  const hasAccess = groupsToCheck.some(group => {
    const groupLower = group.toLowerCase();
    return groupLower === 'scale42' || 
           groupLower === 'scale-42' || 
           groupLower === 'scale_42';
  });
  
  return {
    hasAccess,
    session,
    groups: groupsToCheck,
    isLoading: status === 'loading' || isLoadingGroups,
    isAuthenticated: status === 'authenticated'
  };
}