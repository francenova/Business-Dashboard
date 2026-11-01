'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { apiFetch, setDeviceTokenGetter } from '@/lib/apiFetch';

// Only present inside the packaged Electron app (see electron/preload.cjs) —
// a plain browser during `next dev` never has this, so the gate below is a
// no-op there and local development is unaffected.
declare global {
  interface Window {
    royalOpticalDesktop?: {
      isDesktopApp: boolean;
      getDeviceToken: () => Promise<string | null>;
      setDeviceToken: (token: string) => Promise<void>;
    };
  }
}

type Status = 'checking' | 'ready' | 'needs-enrollment';

// Gates the whole app behind "this installed copy already has a device
// token." The one-time enrollment step below is something the developer
// does once during setup/delivery — the end client never sees this screen
// on a properly provisioned machine, since the token is already stored via
// Electron's safeStorage from that point on. See the device-provisioning
// plan: app/api/device/enroll and middleware.ts's checkDeviceToken.
export function DeviceGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('checking');
  const [enrollmentToken, setEnrollmentToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const desktop = typeof window !== 'undefined' ? window.royalOpticalDesktop : undefined;
    if (!desktop) {
      // Not running inside the Electron shell (e.g. plain browser dev) —
      // nothing to gate.
      setStatus('ready');
      return;
    }

    desktop
      .getDeviceToken()
      .then((token) => {
        if (token) {
          setDeviceTokenGetter(() => desktop.getDeviceToken());
          setStatus('ready');
        } else {
          setStatus('needs-enrollment');
        }
      })
      .catch(() => setStatus('needs-enrollment'));
  }, []);

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    const desktop = window.royalOpticalDesktop;
    if (!desktop || !enrollmentToken.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const { deviceToken } = await apiFetch<{ deviceToken: string }>('/api/device/enroll', {
        method: 'POST',
        body: JSON.stringify({ enrollmentToken: enrollmentToken.trim() }),
      });
      await desktop.setDeviceToken(deviceToken);
      setDeviceTokenGetter(() => desktop.getDeviceToken());
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrollment failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'checking') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    );
  }

  if (status === 'needs-enrollment') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/95 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 mb-5">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold text-white mb-2">One-time device setup</h1>
          <p className="text-sm text-slate-400 mb-6">
            This installation hasn&apos;t been activated yet. Enter the setup code provided with this install.
          </p>
          <form onSubmit={handleEnroll} className="space-y-3">
            <input
              type="text"
              autoFocus
              value={enrollmentToken}
              onChange={(e) => setEnrollmentToken(e.target.value)}
              placeholder="Setup code"
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-500"
            />
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button
              type="submit"
              disabled={submitting || !enrollmentToken.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {submitting ? 'Activating…' : 'Activate'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
