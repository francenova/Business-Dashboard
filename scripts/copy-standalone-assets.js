// Runs automatically after `npm run build` (as the "postbuild" npm lifecycle
// script). Next.js's `output: 'standalone'` produces a self-contained server
// at .next/standalone/server.js, but deliberately leaves out `public/` and
// `.next/static/` — those have to be copied in by hand so the standalone
// bundle can serve them itself. This is what Electron packages up.

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const standaloneDir = path.join(root, '.next', 'standalone');

if (!existsSync(standaloneDir)) {
  console.error(
    '[copy-standalone-assets] .next/standalone not found — did next.config.ts set output: "standalone"?'
  );
  process.exit(1);
}

const publicSrc = path.join(root, 'public');
if (existsSync(publicSrc)) {
  cpSync(publicSrc, path.join(standaloneDir, 'public'), { recursive: true });
}

const staticSrc = path.join(root, '.next', 'static');
const staticDest = path.join(standaloneDir, '.next', 'static');
mkdirSync(path.dirname(staticDest), { recursive: true });
cpSync(staticSrc, staticDest, { recursive: true });

console.log('[copy-standalone-assets] Copied static assets into .next/standalone.');
