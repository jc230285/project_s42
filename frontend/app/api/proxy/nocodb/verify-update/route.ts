import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tableId = searchParams.get('table_id')
    const rowId = searchParams.get('row_id')
    const fieldId = searchParams.get('field_id')

    if (!tableId || !rowId || !fieldId) {
      return NextResponse.json(
        { error: 'Missing required parameters: table_id, row_id, field_id' },
        { status: 400 }
      )
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
    const response = await fetch(`${backendUrl}/nocodb/verify-update?table_id=${tableId}&row_id=${rowId}&field_id=${fieldId}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `Backend error: ${response.status} - ${errorText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('Proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to proxy request to backend' },
      { status: 500 }
    )
  }
}