import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const imageUrl = searchParams.get('url');
  const photoId = searchParams.get('photoId');
  const index = searchParams.get('idx');

  if (!imageUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  // Log which photo we're proxying (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Proxy] Fetching image: photoId=${photoId}, idx=${index}, url=${imageUrl.substring(0, 60)}...`);
  }

  try {
    // Fetch the image from Strava's CDN
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!response.ok) {
      console.error(`[Proxy] Failed to fetch image: ${response.status} for photoId=${photoId}`);
      return new NextResponse('Failed to fetch image', { status: response.status });
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Proxy] Successfully proxied image: photoId=${photoId}, size=${imageBuffer.byteLength} bytes`);
    }

    // Return the image with CORS headers (making it same-origin)
    // Disable caching completely to prevent image duplication issues
    // Also include photoId in headers for debugging
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
        'X-Photo-ID': photoId || 'unknown', // For debugging
      },
    });
  } catch (error) {
    console.error(`[Proxy] Error proxying image (photoId=${photoId}):`, error);
    return new NextResponse('Error proxying image', { status: 500 });
  }
}

