import { Session } from 'next-auth';

/**
 * Check if a user belongs to a specific group (case-insensitive)
 */
export function hasUserGroup(session: Session | null, groupName: string): boolean {
  if (!session?.user) return false;
  
  // Try both locations where groups might be stored
  const userGroups = (session.user as any).groups as string[] || (session as any).groups as string[] || [];
  return userGroups.some(group => group.toLowerCase() === groupName.toLowerCase());
}

/**
 * Check if a user belongs to the Scale42 group
 */
export function hasScale42Access(session: Session | null): boolean {
  if (!session?.user) {
    console.log('Auth: No session or user');
    return false;
  }
  
  const userGroups = getUserGroups(session);
  console.log('Auth: User groups:', userGroups);
  
  // If no groups are found, try to fetch them from backend directly
  if (userGroups.length === 0 && session.user.email) {
    console.log('Auth: No groups found in session, checking if we need to fetch them');
    // This will be handled by the useScale42Access hook instead
  }
  
  // Check for various Scale42 group names
  const hasAccess = userGroups.some(group => {
    const groupLower = group.toLowerCase();
    return groupLower === 'scale42' || 
           groupLower === 'scale-42' || 
           groupLower === 'scale_42';
  });
  
  console.log('Auth: Has Scale42 access:', hasAccess);
  return hasAccess;
}

/**
 * Get all user groups from session
 */
export function getUserGroups(session: Session | null): string[] {
  console.log('Auth: getUserGroups called with session:', !!session);
  
  if (!session?.user) {
    console.log('Auth: No session or user in getUserGroups');
    return [];
  }
  
  // Try both locations where groups might be stored
  const userGroups = (session.user as any).groups as string[] || [];
  const sessionGroups = (session as any).groups as string[] || [];
  
  const groups = userGroups.length > 0 ? userGroups : sessionGroups;
  
  console.log('Auth: Session user email:', session.user?.email);
  console.log('Auth: userGroups from session.user.groups:', userGroups);
  console.log('Auth: sessionGroups from session.groups:', sessionGroups);
  console.log('Auth: final groups selected:', groups);
  
  // Extra debugging - check session structure
  console.log('Auth: Full session.user object keys:', Object.keys(session.user || {}));
  if ((session as any).user) {
    console.log('Auth: session.user.groups specifically:', (session.user as any).groups);
  }
  
  return groups;
}

/**
 * Check if user has any of the specified groups
 */
export function hasAnyGroup(session: Session | null, groupNames: string[]): boolean {
  const userGroups = getUserGroups(session);
  return groupNames.some(group => userGroups.includes(group));
}

/**
 * Check if user has all of the specified groups
 */
export function hasAllGroups(session: Session | null, groupNames: string[]): boolean {
  const userGroups = getUserGroups(session);
  return groupNames.every(group => userGroups.includes(group));
}

/**
 * Get user's domain from email
 */
export function getUserDomain(session: Session | null): string | null {
  if (!session?.user?.email) return null;
  
  const emailParts = session.user.email.split('@');
  return emailParts.length > 1 ? emailParts[1] : null;
}