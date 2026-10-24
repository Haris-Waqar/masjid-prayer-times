revoke all on table
  public.mosque_settings,
  public.prayer_times,
  public.admin_members,
  public.push_subscriptions,
  public.push_rate_limits,
  public.change_history
from anon, authenticated;

revoke all on all sequences in schema public from anon, authenticated;

alter default privileges in schema public
revoke all on tables from anon, authenticated;

alter default privileges in schema public
revoke all on sequences from anon, authenticated;

grant select on public.mosque_settings, public.prayer_times
to anon, authenticated;

grant select on public.admin_members, public.change_history
to authenticated;

create policy "No direct public access to push subscriptions"
on public.push_subscriptions for all to anon, authenticated
using (false) with check (false);

create policy "No direct public access to push rate limits"
on public.push_rate_limits for all to anon, authenticated
using (false) with check (false);
