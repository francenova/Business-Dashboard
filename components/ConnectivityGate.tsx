'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

const CHECK_INTERVAL_MS = 15000;
const PROBE_TIMEOUT_MS = 5000;

// Supabase's REST root responds (even 401/404) as long as the host is reachable —
// that's enough to prove we have a real path to the internet, not just to the router.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

async function probeSupabase(): Promise<boolean> {
  if (!SUPABASE_URL) return true; // nothing to probe against — don't block on misconfiguration
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    return true; // any response at all means the network path is up
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function ConnectivityGate({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [checking, setChecking] = useState(false);
  const mounted = useRef(true);

  const runCheck = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (mounted.current) setIsOnline(false);
      return;
    }
    setChecking(true);
    const reachable = await probeSupabase();
    if (mounted.current) {
      setIsOnline(reachable);
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    runCheck();

    const handleOnline = () => runCheck();
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(runCheck, CHECK_INTERVAL_MS);

    return () => {
      mounted.current = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [runCheck]);

  if (isOnline) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 mb-5">
          <WifiOff className="w-7 h-7" />
        </div>
        <h1 className="text-lg font-bold text-white mb-2">No internet connection</h1>
        <p className="text-sm text-slate-400 mb-6">
          Royal Opticals Dashboard needs an internet connection to reach the clinic
          database. Check your network and try again.
        </p>
        <button
          onClick={runCheck}
          disabled={checking}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Checking…' : 'Try again'}
        </button>
      </div>
    </div>
  );
}
