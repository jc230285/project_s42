import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { tableId: string } }
) {
  try {
    console.log('🚀 FRONTEND PROXY: table data endpoint called');
    console.log('📋 Table ID:', params.tableId);

    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    // Forward request to backend using internal Docker network URL
    const backendUrl = process.env.BACKEND_BASE_URL || 'http://localhost:8150';
    console.log('🎯 FRONTEND PROXY: Forwarding to backend at:', backendUrl);

    const response = await fetch(`${backendUrl}/nocodb/table/${params.tableId}/records`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
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
    console.error('❌ FRONTEND PROXY: Error in table data endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}