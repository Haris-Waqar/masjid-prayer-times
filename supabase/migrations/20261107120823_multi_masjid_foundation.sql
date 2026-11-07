-- Introduce mosque scoping without removing the legacy single-mosque settings
-- row. The compatibility functions at the end keep the deployed application
-- working while the Next.js routes migrate to the mosque-aware signatures.

create table public.mosques (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  location text not null check (char_length(btrim(location)) between 1 and 240),
  timezone text not null check (char_length(btrim(timezone)) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.mosques (slug, name, location, timezone, active, updated_at)
select
  'fazaia-town',
  name,
  location,
  timezone,
  true,
  updated_at
from public.mosque_settings
where id = 1;

do $$
begin
  if not exists (select 1 from public.mosques where slug = 'fazaia-town') then
    raise exception 'The existing mosque settings row is required before multi-mosque migration';
  end if;
end;
$$;

alter table public.prayer_times
  add column mosque_id uuid;

update public.prayer_times
set mosque_id = (select id from public.mosques where slug = 'fazaia-town');

alter table public.prayer_times
  alter column mosque_id set not null,
  add constraint prayer_times_mosque_id_fkey
    foreign key (mosque_id) references public.mosques(id) on delete restrict,
  drop constraint prayer_times_date_prayer_key,
  add constraint prayer_times_mosque_date_prayer_key
    unique (mosque_id, date, prayer);

create index prayer_times_mosque_date_idx
  on public.prayer_times (mosque_id, date desc);

alter table public.change_history
  add column mosque_id uuid;

update public.change_history
set mosque_id = (select id from public.mosques where slug = 'fazaia-town');

alter table public.change_history
  alter column mosque_id set not null,
  add constraint change_history_mosque_id_fkey
    foreign key (mosque_id) references public.mosques(id) on delete restrict;

create index change_history_mosque_changed_at_idx
  on public.change_history (mosque_id, changed_at desc);

alter table public.admin_members
  add column can_manage_mosjids boolean not null default false;

create table public.admin_mosque_access (
  admin_member_id uuid not null
    references public.admin_members(id) on delete cascade,
  mosque_id uuid not null
    references public.mosques(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (admin_member_id, mosque_id)
);

insert into public.admin_mosque_access (admin_member_id, mosque_id)
select member.id, mosque.id
from public.admin_members as member
cross join public.mosques as mosque
where mosque.slug = 'fazaia-town';

create index admin_mosque_access_mosque_idx
  on public.admin_mosque_access (mosque_id, admin_member_id);

create table public.push_subscription_mosques (
  endpoint text not null
    references public.push_subscriptions(endpoint) on delete cascade,
  mosque_id uuid not null
    references public.mosques(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (endpoint, mosque_id)
);

insert into public.push_subscription_mosques (endpoint, mosque_id)
select subscription.endpoint, mosque.id
from public.push_subscriptions as subscription
cross join public.mosques as mosque
where mosque.slug = 'fazaia-town';

create index push_subscription_mosques_mosque_idx
  on public.push_subscription_mosques (mosque_id, endpoint);

alter table public.mosques enable row level security;
alter table public.admin_mosque_access enable row level security;
alter table public.push_subscription_mosques enable row level security;

revoke all on table
  public.mosques,
  public.admin_mosque_access,
  public.push_subscription_mosques
from anon, authenticated;

grant select on public.mosques to anon, authenticated;
grant select on public.admin_mosque_access to authenticated;

create policy "Public can read active mosques"
on public.mosques for select to anon, authenticated
using (active = true);

create policy "Members can read their mosque assignments"
on public.admin_mosque_access for select to authenticated
using (
  exists (
    select 1
    from public.admin_members as member
    where member.id = admin_mosque_access.admin_member_id
      and member.user_id = (select auth.uid())
      and member.active = true
  )
);

create policy "No direct public access to push mosque subscriptions"
on public.push_subscription_mosques for all to anon, authenticated
using (false) with check (false);

create or replace function private.can_access_mosque(p_mosque_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_members as member
    where member.user_id = (select auth.uid())
      and member.active = true
      and (
        member.role = 'super_admin'
        or exists (
          select 1
          from public.admin_mosque_access as access
          where access.admin_member_id = member.id
            and access.mosque_id = p_mosque_id
        )
      )
  );
$$;

revoke all on function private.can_access_mosque(uuid) from public;
grant execute on function private.can_access_mosque(uuid) to authenticated;

drop policy if exists "Public can read prayer times" on public.prayer_times;

create policy "Public can read active mosque prayer times"
on public.prayer_times for select to anon, authenticated
using (
  exists (
    select 1
    from public.mosques
    where mosques.id = prayer_times.mosque_id
      and mosques.active = true
  )
);

drop policy if exists "Admins can read change history" on public.change_history;

create policy "Admins can read assigned mosque change history"
on public.change_history for select to authenticated
using ((select private.can_access_mosque(change_history.mosque_id)));

-- Mosque-aware schedule publishing. Route handlers still authenticate and
-- authorize the editor before invoking this service-role-only function.
create function public.publish_prayer_schedule(
  p_mosque_id uuid,
  p_date date,
  p_times jsonb,
  p_changed_by text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_prayer text;
  v_jamaat time;
  v_old_jamaat time;
  v_changes jsonb := '[]'::jsonb;
  v_allowed text[] := array['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha', 'Jumu''ah'];
begin
  if not exists (
    select 1 from public.mosques where id = p_mosque_id and active = true
  ) then
    raise exception 'mosque is unavailable';
  end if;

  if p_times is null
    or jsonb_typeof(p_times) <> 'array'
    or jsonb_array_length(p_times) <> 6 then
    raise exception 'all five daily jamaat times and Jumu''ah are required';
  end if;

  if (
    select count(distinct item ->> 'prayer') <> 6
    from jsonb_array_elements(p_times) as item
    where item ->> 'prayer' = any (v_allowed)
  ) then
    raise exception 'each prayer must appear exactly once';
  end if;

  for v_item in select value from jsonb_array_elements(p_times)
  loop
    v_prayer := v_item ->> 'prayer';
    v_jamaat := (v_item ->> 'jamaat')::time;

    select jamaat into v_old_jamaat
    from public.prayer_times
    where mosque_id = p_mosque_id
      and date <= p_date
      and prayer = v_prayer
    order by date desc
    limit 1;

    if found and v_old_jamaat is distinct from v_jamaat then
      insert into public.change_history (
        mosque_id, date, prayer, old_jamaat, new_jamaat, changed_by, changed_at
      ) values (
        p_mosque_id, p_date, v_prayer, v_old_jamaat, v_jamaat, p_changed_by, now()
      );
      v_changes := v_changes || jsonb_build_array(jsonb_build_object(
        'prayer', v_prayer,
        'oldJamaat', to_char(v_old_jamaat, 'HH24:MI'),
        'newJamaat', to_char(v_jamaat, 'HH24:MI')
      ));
    end if;

    insert into public.prayer_times (
      mosque_id, date, prayer, prayer_start, jamaat, updated_at, updated_by
    ) values (
      p_mosque_id, p_date, v_prayer, v_jamaat, v_jamaat, now(), p_changed_by
    )
    on conflict (mosque_id, date, prayer) do update
    set prayer_start = excluded.prayer_start,
        jamaat = excluded.jamaat,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
  end loop;

  update public.mosques
  set updated_at = now()
  where id = p_mosque_id;

  -- Keep the legacy settings timestamp current during the rolling deployment.
  if p_mosque_id = (select id from public.mosques where slug = 'fazaia-town') then
    update public.mosque_settings set updated_at = now() where id = 1;
  end if;

  return v_changes;
end;
$$;

revoke all on function public.publish_prayer_schedule(uuid, date, jsonb, text)
from public, anon, authenticated;
grant execute on function public.publish_prayer_schedule(uuid, date, jsonb, text)
to service_role;

-- Preserve the deployed three-argument RPC until all route handlers use the
-- mosque-aware signature.
create or replace function public.publish_prayer_schedule(
  p_date date,
  p_times jsonb,
  p_changed_by text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_mosque_id uuid;
begin
  select id into v_mosque_id
  from public.mosques
  where slug = 'fazaia-town';

  if v_mosque_id is null then
    raise exception 'default mosque is unavailable';
  end if;

  return public.publish_prayer_schedule(
    v_mosque_id,
    p_date,
    p_times,
    p_changed_by
  );
end;
$$;

revoke all on function public.publish_prayer_schedule(date, jsonb, text)
from public, anon, authenticated;
grant execute on function public.publish_prayer_schedule(date, jsonb, text)
to service_role;

-- Mosque-aware push registration keeps the browser's Web Push endpoint in one
-- table and records independent mosque subscriptions in the join table.
create function public.register_push_subscription(
  p_mosque_id uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_rate_key text,
  p_locale text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_attempts integer;
begin
  if not exists (
    select 1 from public.mosques where id = p_mosque_id and active = true
  ) then
    raise exception 'mosque is unavailable';
  end if;

  if p_locale not in ('en', 'ur') then
    raise exception 'invalid locale';
  end if;

  insert into public.push_rate_limits (rate_key, window_started_at, attempts)
  values (p_rate_key, now(), 1)
  on conflict (rate_key) do update
  set
    window_started_at = case
      when push_rate_limits.window_started_at < now() - interval '1 day' then now()
      else push_rate_limits.window_started_at
    end,
    attempts = case
      when push_rate_limits.window_started_at < now() - interval '1 day' then 1
      else push_rate_limits.attempts + 1
    end
  returning attempts into v_attempts;

  if v_attempts > 10 then
    raise exception 'rate limit exceeded';
  end if;

  insert into public.push_subscriptions (
    endpoint, p256dh, auth, locale, created_at, last_seen_at
  ) values (
    p_endpoint, p_p256dh, p_auth, p_locale, now(), now()
  )
  on conflict (endpoint) do update
  set p256dh = excluded.p256dh,
      auth = excluded.auth,
      locale = excluded.locale,
      last_seen_at = now();

  insert into public.push_subscription_mosques (endpoint, mosque_id)
  values (p_endpoint, p_mosque_id)
  on conflict (endpoint, mosque_id) do nothing;
end;
$$;

revoke all on function public.register_push_subscription(
  uuid, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.register_push_subscription(
  uuid, text, text, text, text, text
) to service_role;

-- Preserve the deployed five-argument RPC and associate new registrations with
-- Fazaia until the application sends an explicit mosque identifier.
create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_rate_key text,
  p_locale text default 'en'
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_mosque_id uuid;
begin
  select id into v_mosque_id
  from public.mosques
  where slug = 'fazaia-town';

  if v_mosque_id is null then
    raise exception 'default mosque is unavailable';
  end if;

  perform public.register_push_subscription(
    v_mosque_id,
    p_endpoint,
    p_p256dh,
    p_auth,
    p_rate_key,
    p_locale
  );
end;
$$;

revoke all on function public.register_push_subscription(
  text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.register_push_subscription(
  text, text, text, text, text
) to service_role;
