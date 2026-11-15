create table public.experience_sessions (
  experience text not null check (experience in ('cinema', 'wine')),
  day date not null,
  title text not null check (length(trim(title)) between 1 and 200),
  start_time time not null,
  primary key (experience, day)
);

create table public.experience_bookings (
  experience text not null check (experience in ('cinema', 'wine', 'pizza')),
  day date not null,
  line integer not null check (line between 1 and case when experience = 'cinema' then 5 else 8 end),
  revision uuid not null default gen_random_uuid(),
  customer text not null check (customer in ('guest', 'external')),
  apartment text,
  name text not null check (length(trim(name)) between 1 and 200),
  pax integer check (pax > 0),
  adults integer check (adults >= 0),
  children integer check (children >= 0),
  notes text check (length(notes) <= 2000),
  primary key (experience, day, line),
  check (
    (customer = 'guest' and apartment is not null and length(trim(apartment)) > 0)
    or (customer = 'external' and apartment is null and experience <> 'cinema')
  ),
  check (
    (experience = 'cinema' and pax is null and adults is null and children is null and notes is null)
    or (experience = 'wine' and pax is not null and adults is null and children is null)
    or (experience = 'pizza' and pax is null and adults is not null and children is not null and adults + children > 0)
  )
);

alter table public.experience_sessions enable row level security;
alter table public.experience_bookings enable row level security;

revoke all on public.experience_sessions, public.experience_bookings from public, anon, authenticated;
grant select, insert on public.experience_sessions to service_role;
grant select, insert, update, delete on public.experience_bookings to service_role;
