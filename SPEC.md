# Product specification

## Purpose

Prevent community members from missing jamaat when a mosque changes a prayer
time. The public experience must be immediate and require no account.

## Public experience

- Show the mosque name, location, date, prayer-start times and jamaat times.
- Highlight the next jamaat and show a countdown.
- Allow visitors to install the PWA and subscribe to changed-time alerts.
- Keep the most recently loaded timetable available during a poor connection.
- Show when the timetable was last updated.

## Administration

- Use Supabase passwordless sign-in and the `admin_members` allowlist.
- Reject every unauthorized write on the server.
- Let an editor choose an effective date and update all five prayer rows.
- Require an explicit confirmation before publishing.
- Notify subscribers only when at least one jamaat time changed.
- Record the prayer, old time, new time, editor and timestamp.

## Data rules

- Store dates as `YYYY-MM-DD` in the mosque timezone.
- Store wall-clock times as 24-hour `HH:mm` strings.
- Never derive a jamaat time from a calculated prayer-start time.
- A date-specific schedule is authoritative for that date.
- Stale push endpoints are deleted after a 404 or 410 response.

## Launch acceptance

- Anonymous timetable reading works on the public web app.
- Unauthorized users cannot open the editor or call the update endpoint.
- A published change survives across browsers and devices.
- Duplicate submissions do not duplicate the date/prayer row.
- Notifications identify the prayer, old time, new time and effective date.
- The PWA passes a manual Android and iPhone installation test.
