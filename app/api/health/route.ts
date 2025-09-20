import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Basic health check - verify the app is responding
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'kids-multi-wiki-chat',
      version: '1.0.0'
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    );
  }
}