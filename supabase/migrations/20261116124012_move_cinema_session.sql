create table public.moved_pizza_days (day date primary key);
alter table public.moved_pizza_days enable row level security;
revoke all on public.moved_pizza_days from public, anon, authenticated;
grant select on public.moved_pizza_days to service_role;

create function public.check_experience_booking_day()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'pizza_daily_capacity' then
    if exists (select 1 from public.moved_pizza_days where day = new.day) then
      raise exception 'Pizza date moved' using errcode = '23514';
    end if;
  elsif new.experience = 'pizza' then
    if exists (select 1 from public.moved_pizza_days where day = new.day) then
      raise exception 'Pizza date moved' using errcode = '23514';
    end if;
  elsif not exists (
    select 1 from public.experience_sessions where experience = new.experience and day = new.day
  ) then
    raise exception 'Experience date moved' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger check_booking_day before insert or update of day
  on public.experience_bookings for each row execute function public.check_experience_booking_day();
create trigger check_capacity_day before insert or update of day
  on public.pizza_daily_capacity for each row execute function public.check_experience_booking_day();

create function public.move_experience(kind text, source_day date, target_day date)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if kind not in ('cinema','wine','pizza') or source_day = target_day then
    return false;
  end if;
  lock table public.experience_sessions, public.experience_bookings, public.pizza_daily_capacity
    in share row exclusive mode;
  if exists (select 1 from public.experience_sessions where experience = kind and day = target_day)
    or exists (select 1 from public.experience_bookings where experience = kind and day = target_day)
    or (kind = 'pizza' and exists (select 1 from public.pizza_daily_capacity where day = target_day)) then
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
  end if;
  return true;
end;
$$;
revoke all on function public.move_experience(text,date,date) from public, anon, authenticated;
grant execute on function public.move_experience(text,date,date) to service_role;
