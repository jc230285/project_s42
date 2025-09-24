import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { email } = await request.json();
    
    // Verify the email matches the session
    if (email !== session.user.email) {
      return NextResponse.json({ error: 'Email mismatch' }, { status: 403 });
    }

    // Fetch user groups from backend
    const backendUrl = process.env.NODE_ENV === 'production' 
      ? 'https://s42api.edbmotte.com' 
      : 'http://backend:8000';
      
    const response = await fetch(`${backendUrl}/user-info/${encodeURIComponent(email)}`, {
      headers: { 'Authorization': 'Bearer internal-auth-check' }
    });
    
    if (response.ok) {
      const userData = await response.json();
      const groups = userData.group_name ? [userData.group_name] : [];
      
      return NextResponse.json({ 
        groups,
        userData 
      });
    } else {
      console.error('API: Failed to fetch user data from backend:', response.status);
      return NextResponse.json({ groups: [] });
    }
    
  } catch (error) {
    console.error('API: Error fetching user groups:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}