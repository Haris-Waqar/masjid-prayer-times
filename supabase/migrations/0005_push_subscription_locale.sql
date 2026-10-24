alter table public.push_subscriptions
  add column locale text not null default 'en';

alter table public.push_subscriptions
  add constraint push_subscriptions_locale_check
  check (locale in ('en', 'ur'));

drop function public.register_push_subscription(text, text, text, text);

create function public.register_push_subscription(
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
  v_attempts integer;
begin
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
end;
$$;

revoke all on function public.register_push_subscription(text, text, text, text, text) from public;
grant execute on function public.register_push_subscription(text, text, text, text, text) to service_role;
