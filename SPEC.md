# Product specification

## Purpose

Prevent community members from missing jamaat when a mosque changes a prayer
time. The public experience supports multiple mosques, remains immediate and
never requires a visitor account.

## Public experience

- Give every active mosque a stable, shareable public page.
- Show a first-visit landing page that guides a visitor to their mosque: one
  search field that lists every active mosque A–Z when tapped and filters by
  name or location as they type, a preview of the chosen mosque's posted
  jamaat times, then an explicit choice to save it as the default or just
  view its timetable. Never show unposted or estimated times in the preview.
- Keep a simple mosque switcher on the timetable page.
- Let a visitor explicitly choose a default mosque and store only its stable
  identifier in a first-party browser cookie.
- Opening a shared mosque page must not silently replace an existing default.
- If a saved default is missing or inactive, clear it and show the selector.
- Unknown or inactive mosque URLs must show a not-found or unavailable state;
  they must never render the legacy default mosque settings or timetable.
- Show the mosque name, location, mosque-local date, prayer-start times and
  jamaat times.
- Highlight the next jamaat and show a countdown.
- Allow visitors to install the PWA and independently subscribe to changed-time
  alerts for one or more mosques.
- Changing the default mosque must not change alert subscriptions.
- Keep the most recently loaded timetable for each visited mosque available
  during a poor connection without showing one mosque's cached timetable for
  another.
- Show when the timetable was last updated.

## Administration

- Use Supabase password sign-in and database-backed `admin` and `super_admin` roles.
- Reject every unauthorized write on the server.
- Assign regular administrators to one or more mosques and limit their timetable
  access to those assignments. The sole super administrator may access every
  mosque.
- Let an authorized editor choose an effective date and update all five daily
  prayer rows plus Jumu'ah (default 13:45), shown after Isha with a Friday marker.
- Require an explicit confirmation before publishing.
- Notify only subscribers to the affected mosque and only when at least one
  jamaat time changed.
- Record the mosque, prayer, old time, new time, editor and timestamp.
- Allow both administrator roles to edit jamaat times.
- Allow only the sole super administrator to view operational statistics and create
  or permanently delete regular administrators.
- Allow the super administrator to create, edit, archive and restore mosques.
- Give the super administrator an inherent `can_manage_mosjids` capability and
  let them grant or revoke that single capability for a regular administrator.
- Treat mosque removal as reversible archiving: an archived mosque is removed
  from public selection and cannot receive new timetable publications or alert
  registrations, while its schedules and audit history remain intact.
- Let the super administrator revoke and later reactivate a regular administrator
  without deleting their Auth account or timetable history.
- Create new administrators with a one-time generated temporary password and
  force them to replace it before timetable or management access is granted.
- Never allow the interface or API to create another super administrator.
- Report subscribed-device totals, English/Urdu split, registrations and refreshes
  in the last 30 days, active administrators, recent timetable changes, and the
  latest timetable change without exposing subscription secrets.

## Data rules

- Store dates as `YYYY-MM-DD` in the mosque timezone.
- Store wall-clock times as 24-hour `HH:mm` strings.
- Scope prayer schedules, change history, administrator assignments, push-alert
  registrations, server caches and offline cache entries by mosque.
- Keep mosque slugs unique and stable so shared links and saved defaults remain
  reliable.
- Never derive a jamaat time from a calculated prayer-start time.
- A mosque's date-specific schedule is authoritative for that mosque and date.
- A device may subscribe to multiple mosques; enabling or disabling alerts on one
  mosque must not modify its subscriptions to another.
- Stale push endpoints are deleted after a 404 or 410 response.

## Launch acceptance

- Anonymous mosque selection and timetable reading work on the public web app.
- A saved default opens on later visits in the same browser, and clearing browser
  data safely returns the visitor to the selector.
- Unauthorized users cannot open the editor or call the update endpoint.
- Regular administrators cannot read or update an unassigned mosque by changing
  a URL, query parameter or request body.
- Administrators without `can_manage_mosjids` cannot create, edit, archive or
  restore a mosque through either the interface or API.
- Regular administrators cannot open or call super-administrator management features.
- Temporary-password users cannot use administrator features until setup is complete.
- A mosque-scoped published change survives across browsers and devices.
- Duplicate submissions do not duplicate the mosque/date/prayer row.
- Notifications identify the affected mosque, prayer, old time, new time and
  effective date, and reach only that mosque's subscribers.
- Previously visited mosque timetables remain correctly identified offline.
- The PWA passes a manual Android and iPhone installation test.

## Deferred scope

- Nearby-mosque location discovery and maps.
- Favourite mosques beyond the single browser-local default.
- Cross-device preference synchronization or public visitor accounts.
- Permanent mosque deletion and fine-grained create/edit/archive permissions.
