// Pure Web Crypto (crypto.subtle / crypto.getRandomValues) so these helpers
// work identically in Edge Middleware and in Node route handlers — no
// Node-only `crypto` module, which isn't available in the Edge runtime
// middleware.ts runs in.

export function generateToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Device/enrollment tokens are stored only as this hash — never the raw
// value — so a database leak alone can never produce a usable token.
export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
