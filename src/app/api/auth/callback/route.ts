import { NextRequest, NextResponse } from 'next/server';

const STRAVA_OAUTH_BASE = "https://www.strava.com/oauth";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${error}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', request.url));
  }

  try {
    // Construct redirect URI - must match exactly what's in Strava app settings
    let redirectUri: string;
    if (process.env.NEXT_PUBLIC_APP_URL) {
      // Ensure protocol is included
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL.startsWith('http')
        ? process.env.NEXT_PUBLIC_APP_URL
        : `https://${process.env.NEXT_PUBLIC_APP_URL}`;
      redirectUri = `${baseUrl}/api/auth/callback`;
    } else {
      redirectUri = `${request.nextUrl.origin}/api/auth/callback`;
    }

    // Exchange code for token
    const response = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.STRAVA_CLIENT_ID!,
        client_secret: process.env.STRAVA_CLIENT_SECRET!,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token exchange failed:', errorText);
      return NextResponse.redirect(new URL('/?error=token_exchange_failed', request.url));
    }

    const tokenData = await response.json();

    // Redirect back to app with token data in URL hash (client-side only)
    const redirectUrl = new URL('/', request.url);
    redirectUrl.hash = `access_token=${tokenData.access_token}&refresh_token=${tokenData.refresh_token}&expires_at=${tokenData.expires_at}`;
    
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(new URL('/?error=server_error', request.url));
  }
}

