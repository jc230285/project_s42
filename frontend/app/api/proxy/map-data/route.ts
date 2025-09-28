import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userInfo = {
      email: session.user.email,
      name: session.user.name,
      groups: ['Scale42'] // Assuming all users have Scale42 access for now
    };

  const encodedUser = Buffer.from(JSON.stringify(userInfo)).toString('base64');
    
  // Prefer in-docker URL, then public URL, then default
  const backendUrl = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://backend:8000';
    const response = await fetch(`${backendUrl}/projects/map-data`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${encodedUser}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend map data error:', response.status, errorText);
      return NextResponse.json(
        { error: `Backend error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Map data proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}