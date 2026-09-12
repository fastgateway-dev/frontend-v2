import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8081';

async function proxyRequest(req: NextRequest) {
  const url = new URL(req.url);
  const backendPath = `/api/v1${url.pathname.replace('/api/v1', '')}`;
  const target = `${BACKEND_URL}${backendPath}${url.search}`;

  const headers = new Headers(req.headers);
  // Remove Next.js/browser-specific headers that shouldn't be forwarded
  headers.delete('host');

  const init: RequestInit = {
    method: req.method,
    headers,
  };

  // Forward body for methods that have one
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req.body;
    // @ts-expect-error duplex is needed for streaming body
    init.duplex = 'half';
  }

  try {
    const backendRes = await fetch(target, init);

    const responseHeaders = new Headers(backendRes.headers);
    // Remove hop-by-hop headers
    responseHeaders.delete('transfer-encoding');

    return new NextResponse(backendRes.body, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: 'Backend unavailable' },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
