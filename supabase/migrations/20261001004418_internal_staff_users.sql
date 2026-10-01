create table public.staff_users (
 id uuid primary key references auth.users(id),
 username text not null unique check (username ~ '^[a-z0-9][a-z0-9._-]{2,39}$'),
 name text not null check (length(name) between 1 and 100),
 session_version integer not null default 1,
 password_reset_pending boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.staff_sessions (
 token_hash text primary key,
 user_id uuid not null references public.staff_users(id) on delete cascade,
 session_version integer not null,
 expires_at timestamptz not null
);
create index staff_sessions_user_id on public.staff_sessions(user_id);
create table public.staff_login_attempts (
 username text primary key,
 attempts integer not null default 0,
 window_start timestamptz not null default now()
);
alter table public.staff_users enable row level security;
alter table public.staff_sessions enable row level security;
alter table public.staff_login_attempts enable row level security;
revoke all on public.staff_users, public.staff_sessions, public.staff_login_attempts from anon, authenticated;
grant all on public.staff_users, public.staff_sessions, public.staff_login_attempts to service_role;
create function public.claim_staff_login(login_name text) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
 insert into public.staff_login_attempts(username,attempts,window_start)
 values(login_name,1,now())
 on conflict(username) do update set
 attempts=case when public.staff_login_attempts.window_start < now()-interval '15 minutes' then 1 else public.staff_login_attempts.attempts+1 end,
 window_start=case when public.staff_login_attempts.window_start < now()-interval '15 minutes' then now() else public.staff_login_attempts.window_start end
 returning attempts into n;
 return n <= 10;
end;
$$;
revoke all on function public.claim_staff_login(text) from public, anon, authenticated;
grant execute on function public.claim_staff_login(text) to service_role;
alter table public.reservations add column created_by_staff_name text;
