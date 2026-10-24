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
begin
  if jsonb_typeof(p_times) <> 'array' or jsonb_array_length(p_times) <> 5 then
    raise exception 'all five jamaat times are required';
  end if;

  if (
    select count(distinct item ->> 'prayer') <> 5
    from jsonb_array_elements(p_times) as item
    where item ->> 'prayer' in ('Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha')
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
