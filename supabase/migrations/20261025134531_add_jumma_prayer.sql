-- Allow Jumma as a Friday-only jamaat row alongside the five daily prayers.
alter table public.prayer_times
  drop constraint if exists prayer_times_prayer_check;

alter table public.prayer_times
  add constraint prayer_times_prayer_check
  check (prayer in ('Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha', 'Jumma'));

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
  v_item jsonb;
  v_prayer text;
  v_jamaat time;
  v_old_jamaat time;
  v_changes jsonb := '[]'::jsonb;
  v_is_friday boolean := extract(dow from p_date) = 5;
  v_expected_count integer := case when v_is_friday then 6 else 5 end;
  v_allowed text[] := case
    when v_is_friday then array['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha', 'Jumma']
    else array['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
  end;
begin
  if jsonb_typeof(p_times) <> 'array' or jsonb_array_length(p_times) <> v_expected_count then
    raise exception 'required jamaat times are missing';
  end if;

  if (
    select count(distinct item ->> 'prayer') <> v_expected_count
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
    where date <= p_date and prayer = v_prayer
    order by date desc
    limit 1;

    if found and v_old_jamaat is distinct from v_jamaat then
      insert into public.change_history (
        date, prayer, old_jamaat, new_jamaat, changed_by, changed_at
      ) values (
        p_date, v_prayer, v_old_jamaat, v_jamaat, p_changed_by, now()
      );
      v_changes := v_changes || jsonb_build_array(jsonb_build_object(
        'prayer', v_prayer,
        'oldJamaat', to_char(v_old_jamaat, 'HH24:MI'),
        'newJamaat', to_char(v_jamaat, 'HH24:MI')
      ));
    end if;

    insert into public.prayer_times (
      date, prayer, prayer_start, jamaat, updated_at, updated_by
    ) values (
      p_date, v_prayer, v_jamaat, v_jamaat, now(), p_changed_by
    )
    on conflict (date, prayer) do update
    set prayer_start = excluded.prayer_start,
        jamaat = excluded.jamaat,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
  end loop;

  update public.mosque_settings set updated_at = now() where id = 1;
  return v_changes;
end;
$$;

revoke execute on function public.publish_prayer_schedule(date, jsonb, text)
from public, anon, authenticated;

grant execute on function public.publish_prayer_schedule(date, jsonb, text)
to service_role;
