import { NextResponse, type NextRequest } from 'next/server';
import { hashToken } from '@/lib/deviceAuth';
import { getRateLimiter, getEnrollRateLimiter } from '@/lib/rateLimit';

// This same middleware file ships in both places this codebase runs:
//  - Bundled into the Electron app (serves the UI only, locally). Its
//    /api/* routes are never called there anymore (the renderer now talks
//    to the real backend over HTTPS — see lib/apiFetch.ts), so none of the
//    logic below ever actually runs in that context; it's simply dead code
//    there, not a risk.
//  - Deployed to your own infrastructure (Vercel) as the real backend. This
//    is where the checks below actually matter: every /api/* request must
//    carry a valid, non-revoked device token (or, for the two enrollment/
//    admin exceptions, pass their own separate check) before it ever
//    reaches a route handler and touches Supabase.
//
// CORS headers are applied below purely so the Electron renderer's own
// fetch calls can read the response — they are NOT a security boundary.
// A browser enforces CORS against *other websites*; it does nothing to
// stop a direct request from curl, Postman, or any other non-browser
// client, which is why Access-Control-Allow-Origin: * here is fine — the
// device-token check is the real authorization boundary, and it applies
// identically regardless of how the request was made or its Origin header.
function withCors(response: NextResponse): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Device-Token, X-Admin-Secret');
  return response;
}

function clientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

async function checkDeviceToken(request: NextRequest): Promise<boolean> {
  const token = request.headers.get('x-device-token');
  if (!token) return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return false; // misconfigured deployment — fail closed

  const tokenHash = await hashToken(token);
  const res = await fetch(
    `${url}/rest/v1/device_credentials?token_hash=eq.${tokenHash}&revoked=eq.false&select=device_id`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!res.ok) return false;
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return false;

  // Best-effort, non-blocking — a failed "last seen" update must never
  // block or fail the actual request.
  fetch(`${url}/rest/v1/device_credentials?token_hash=eq.${tokenHash}`, {
    method: 'PATCH',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ last_seen_at: new Date().toISOString() }),
  }).catch(() => {});

  return true;
}

function checkAdminSecret(request: NextRequest): boolean {
  const provided = request.headers.get('x-admin-secret');
  const expected = process.env.ADMIN_SECRET;
  return Boolean(expected) && provided === expected;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth bypassed app-wide for the dashboard UI itself — unrelated to the
  // API device-auth below. See app/(app)/layout.tsx for why.
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (pathname.startsWith('/api/')) {
    // Preflight — browsers send this before the real cross-origin request;
    // answer it directly, it never needs to reach a route handler.
    if (request.method === 'OPTIONS') {
      return withCors(new NextResponse(null, { status: 204 }));
    }

    const isAdminRoute = pathname.startsWith('/api/admin/');
    const isEnrollRoute = pathname === '/api/device/enroll';

    const limiter = isEnrollRoute ? getEnrollRateLimiter() : getRateLimiter();
    if (limiter) {
      const key = isAdminRoute || isEnrollRoute ? clientIp(request) : request.headers.get('x-device-token') || clientIp(request);
      const { success } = await limiter.limit(key);
      if (!success) {
        return withCors(NextResponse.json({ error: 'Too many requests.' }, { status: 429 }));
      }
    }

    if (isAdminRoute) {
      if (!checkAdminSecret(request)) {
        return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
      }
      return withCors(NextResponse.next({ request }));
    }

    if (isEnrollRoute) {
      return withCors(NextResponse.next({ request }));
    }

    // Fail CLOSED by default — device-token enforcement is always ON
    // unless this exact flag is explicitly set, so simply forgetting to
    // configure something on a deployment can never silently open this up.
    // Only ever set this in a local .env.local (gitignored, never deployed
    // anywhere, never bundled into the Electron app) so day-to-day local
    // development doesn't require enrolling a device first.
    const localDevBypass = process.env.DISABLE_DEVICE_AUTH_FOR_LOCAL_DEV === 'true';
    if (!localDevBypass) {
      const authorized = await checkDeviceToken(request);
      if (!authorized) {
        return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
      }
    }

    return withCors(NextResponse.next({ request }));
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
