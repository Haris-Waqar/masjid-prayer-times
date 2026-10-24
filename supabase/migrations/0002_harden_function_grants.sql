revoke execute on function public.register_push_subscription(text, text, text, text)
from public, anon, authenticated;

revoke execute on function public.publish_prayer_schedule(date, jsonb, text)
from public, anon, authenticated;

grant execute on function public.register_push_subscription(text, text, text, text)
to service_role;

grant execute on function public.publish_prayer_schedule(date, jsonb, text)
to service_role;

drop policy if exists "Members can see their own admin record"
on public.admin_members;

create policy "Members can see their own admin record"
on public.admin_members for select to authenticated
using (email = lower(coalesce((select auth.jwt()) ->> 'email', '')));
