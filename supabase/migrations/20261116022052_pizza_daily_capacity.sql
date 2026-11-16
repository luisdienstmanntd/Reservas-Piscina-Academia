create table public.pizza_daily_capacity (
  day date primary key,
  capacity integer not null check (capacity between 1 and 999)
);

alter table public.pizza_daily_capacity enable row level security;
revoke all on public.pizza_daily_capacity from public, anon, authenticated;
grant select, insert, update on public.pizza_daily_capacity to service_role;

alter table public.experience_bookings
  drop constraint experience_bookings_check,
  add constraint experience_bookings_line_check check (
    line between 1 and case experience when 'cinema' then 5 when 'pizza' then 999 else 8 end
  );
