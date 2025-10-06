import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

export async function GET(request: NextRequest) {
  try {
    // Get email from query params
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }
    
    // Fetch pages from backend (use server-side URL for container-to-container communication)
    const backendUrl = process.env.BACKEND_BASE_URL || process.env.NEXT_PUBLIC_BACKEND_BASE_URL || 'http://localhost:8000';
    const response = await fetch(
      `${backendUrl}/pages/user-mysql/${encodeURIComponent(email)}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      console.error('Failed to fetch user pages from backend:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch user pages' },
        { status: response.status }
      );
    }
    
    const pages = await response.json();
    return NextResponse.json(pages);
    
  } catch (error) {
    console.error('Error in /api/pages/user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
