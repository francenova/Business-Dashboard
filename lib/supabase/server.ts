import { createClient } from '@supabase/supabase-js';

// Server-only Supabase client, using the service_role key — this bypasses
// Row Level Security by design (that's what service_role means at the
// Postgres level), so this file must NEVER be imported into any 'use
// client' component or anything else that ships to the browser/Electron
// renderer bundle. Only import this from app/api/**/route.ts — Route
// Handlers run inside the local Next.js server process Electron already
// spawns, never in the client bundle, so SUPABASE_SERVICE_ROLE_KEY (a plain
// env var, not NEXT_PUBLIC_) never gets inlined into client-shipped JS.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase server credentials (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
