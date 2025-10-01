import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 FRONTEND PROXY: nocodb/query endpoint called');
    
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    // Parse the request body
    const body = await request.json();
    const { query } = body;
    
    console.log('🔍 FRONTEND PROXY: Query received:', query);

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Forward request to backend using internal Docker network URL
    const backendUrl = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    console.log('🎯 FRONTEND PROXY: Forwarding to backend at:', backendUrl);
    
    const response = await fetch(`${backendUrl}/nocodb/query`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    console.log('📡 FRONTEND PROXY: Backend response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', response.status, errorText);
      return NextResponse.json(
        { error: `Backend request failed: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ FRONTEND PROXY: Backend response received, returning data');
    return NextResponse.json(data);

  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}