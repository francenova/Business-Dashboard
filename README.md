# Royal Optical — Dashboard (extracted copy)

This is a read-only extract of the `/dashboard` part of `royal-optical-platform`,
copied on 2026-08-12. Nothing in the original GitHub repo was changed.

## What's in here
- `app/dashboard/**` — all dashboard routes (login, patients, visit, prescription, etc.)
- `components/dashboard/**` — every component used by those routes
- `context/AppContext.tsx` — shared dashboard state
- `hooks/**` — all dashboard data hooks (patients, visits, prescriptions, stats, settings)
- `lib/supabase/**` — Supabase client/server setup + data mappers
- `lib/types.ts`, `lib/excelExport.ts` — dashboard types + Excel export helper
- `lib/initialData.ts` — copied for safety, but not currently imported anywhere in the dashboard code
- `middleware.ts` — protects `/dashboard/*` routes, redirects to `/dashboard/login` if not signed in
- `app/layout.tsx`, `app/globals.css` — root layout + Tailwind styles (dashboard UI depends on these classes)
- `package.json` — trimmed down to only the packages the dashboard code actually imports (Sanity/CMS packages removed since the dashboard doesn't use them)
- `.env.example` — only the Supabase variables the dashboard needs

## What was NOT copied (stays in the website project)
- `app/page.tsx`, `app/studio/**`, `components/landing/**`
- `lib/siteSettings.ts`, `lib/sanity/**`, `sanity/**`, `sanity.config.ts`

## One thing to fix before running this
`components/dashboard/pages/PatientProfilePage.tsx` imports from `framer-motion`,
but the rest of the dashboard imports from `motion/react` (and only `motion` is
in package.json — `framer-motion` isn't installed anywhere). This looks like a
leftover from Antigravity. Change that one import to `motion/react` to match
the rest of the app, or add `framer-motion` as a dependency — either works.

## To run standalone
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in your Supabase project's URL + keys (same values as the main project, since it's the same Supabase project/data)
3. `npm run dev`
