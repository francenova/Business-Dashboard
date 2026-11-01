// Client-side fetch wrapper for the /api/* routes — keeps the same
// "throws an Error with a readable .message" shape the app's hooks already
// built their try/catch + toast error handling around when they called
// Supabase directly, so migrating a hook to the local API was a small,
// mechanical change rather than a rewrite of its error handling.
//
// Target: NEXT_PUBLIC_API_BASE_URL, when set (the packaged Electron app's
// build), points every call at the real backend over HTTPS instead of a
// local relative path. Left unset (plain `next dev`), calls stay relative —
// local development keeps working exactly as before, no device/backend
// setup required for everyday coding.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

// Set once by DeviceGate once it's confirmed a device token exists — kept
// as an injected getter (not a fixed value) so a freshly-enrolled token is
// picked up immediately without needing a page reload.
let deviceTokenGetter: (() => Promise<string | null>) | null = null;

export function setDeviceTokenGetter(fn: (() => Promise<string | null>) | null): void {
  deviceTokenGetter = fn;
}

export async function apiFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const headers: Record<string, string> = isFormData
    ? { ...((init?.headers as Record<string, string>) || {}) }
    : { 'Content-Type': 'application/json', ...((init?.headers as Record<string, string>) || {}) };

  if (deviceTokenGetter) {
    const token = await deviceTokenGetter();
    if (token) headers['X-Device-Token'] = token;
  }

  const res = await fetch(`${API_BASE_URL}${url}`, { ...init, headers });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // Response wasn't JSON — keep the generic status-based message.
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
