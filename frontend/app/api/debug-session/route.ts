import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    return NextResponse.json({
      session: session,
      hasUser: !!session?.user,
      userEmail: session?.user?.email,
      userGroups: (session?.user as any)?.groups,
      fullUser: session?.user
    });
  } catch (error) {
    console.error('Debug session error:', error);
    return NextResponse.json({ error: 'Failed to get session' }, { status: 500 });
  }
}