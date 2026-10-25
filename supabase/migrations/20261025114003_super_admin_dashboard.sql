alter table public.admin_members
  add column user_id uuid,
  add column role text not null default 'admin'
    check (role in ('admin', 'super_admin'));

update public.admin_members as member
set user_id = auth_user.id
from auth.users as auth_user
where lower(auth_user.email) = member.email;

do $$
begin
  if exists (select 1 from public.admin_members where user_id is null) then
    raise exception 'Every admin member must match an Auth user before this migration can continue';
  end if;
end;
$$;

alter table public.admin_members
  alter column user_id set not null,
  add constraint admin_members_user_id_key unique (user_id),
  add constraint admin_members_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

update public.admin_members
set role = 'super_admin'
where id = (
  select id
  from public.admin_members
  where active = true
  order by created_at, id
  limit 1
);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_members
    where user_id = (select auth.uid()) and active = true
  );
$$;

drop policy if exists "Members can see their own admin record" on public.admin_members;

create policy "Members can see their own admin record"
on public.admin_members for select to authenticated
using (user_id = (select auth.uid()));
