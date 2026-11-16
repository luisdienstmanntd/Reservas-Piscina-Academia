create table public.wine_daily_capacity (
  day date primary key,
  capacity integer not null check (capacity between 1 and 999)
);

alter table public.wine_daily_capacity enable row level security;
revoke all on public.wine_daily_capacity from public, anon, authenticated;
grant select, insert, update on public.wine_daily_capacity to service_role;

create function public.check_wine_capacity_day()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.experience_sessions where experience = 'wine' and day = new.day
  ) then
    raise exception 'Wine date moved' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger check_wine_capacity_day before insert or update of day
  on public.wine_daily_capacity for each row execute function public.check_wine_capacity_day();

create or replace function public.move_experience(kind text, source_day date, target_day date)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if kind not in ('cinema','wine','pizza') or source_day = target_day then
    return false;
  end if;
  lock table public.experience_sessions, public.experience_bookings, public.pizza_daily_capacity,
    public.wine_daily_capacity in share row exclusive mode;
  if exists (select 1 from public.experience_sessions where experience = kind and day = target_day)
    or exists (select 1 from public.experience_bookings where experience = kind and day = target_day)
    or (kind = 'pizza' and exists (select 1 from public.pizza_daily_capacity where day = target_day))
    or (kind = 'wine' and exists (select 1 from public.wine_daily_capacity where day = target_day)) then
    return false;
  end if;
  update public.experience_sessions set day = target_day where experience = kind and day = source_day;
  if kind <> 'pizza' and not found then return false; end if;
  if kind = 'pizza' then
    if exists (select 1 from public.moved_pizza_days where day = source_day) then return false; end if;
    delete from public.moved_pizza_days where day = target_day;
    insert into public.moved_pizza_days values (source_day);
  end if;
  update public.experience_bookings set day = target_day, revision = gen_random_uuid()
    where experience = kind and day = source_day;
  if kind = 'pizza' then
    update public.pizza_daily_capacity set day = target_day where day = source_day;
  elsif kind = 'wine' then
    update public.wine_daily_capacity set day = target_day where day = source_day;
  end if;
  return true;
end;
$$;
revoke all on function public.move_experience(text,date,date) from public, anon, authenticated;
grant execute on function public.move_experience(text,date,date) to service_role;
