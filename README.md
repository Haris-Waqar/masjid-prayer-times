# Masjid Prayer Times

A mobile-first Next.js PWA for one mosque. Visitors can see jamaat times without
an account and opt in to Web Push alerts. Only authorized editors
can sign in and publish timetable changes.

## Stack

- Next.js App Router and TypeScript
- Supabase Postgres, Auth and row-level security
- Standards-based Web Push with VAPID keys
- Installable PWA with an offline copy of the last public timetable

## Local setup

1. Create a Supabase project.
2. In the Supabase SQL Editor, run every file in `supabase/migrations/` in
   filename order. Later migrations tighten database permissions and must not be
   skipped.
3. Invite each editor in Supabase Authentication, then add their lowercase email:

   ```sql
   insert into public.admin_members (email) values ('imam@example.org');
   ```

4. Copy `.env.example` to `.env.local` and add the Supabase URL, publishable key,
   server secret key and VAPID keys.
5. Add `http://localhost:3000/auth/callback` to Supabase Auth redirect URLs.
6. Run `npm install` and `npm run dev`.

Never expose `SUPABASE_SECRET_KEY` or `VAPID_PRIVATE_KEY` in browser code or
commit them to Git.

## Alerts

Generate one VAPID key pair and put the public key in
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` and the private key in `VAPID_PRIVATE_KEY`.
Subscribers are stored in Supabase. When an editor changes a jamaat time, the
server sends a push message containing the prayer, old time and new time. A 404
or 410 response removes that stale subscription.

Web Push requires HTTPS in production. On iPhone, users must install the PWA to
the Home Screen before enabling notifications.

## Verification

```sh
npm test
npm run type-check
npm run lint
npm run build
npm run test:e2e
```

Install the Playwright browser once with `npx playwright install chromium`.
The unit/integration suite covers API authorization, missing server credentials,
the publish payload and malformed API responses. Playwright checks the public
timetable, admin redirect and unauthorized API behavior in desktop and mobile
Chromium.

If publishing reports that server setup is incomplete, add the Supabase
`sb_secret_...` value to `SUPABASE_SECRET_KEY` in `.env.local`, then restart the
development server. Never paste that secret into chat or commit it to Git.

Before launch, test sign-in, authorization, timetable publishing, installation
and a real notification on both Android and iPhone.
