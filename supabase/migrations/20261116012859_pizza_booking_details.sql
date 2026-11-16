alter table public.experience_bookings
  add column price_cents integer check (price_cents between 0 and 999999999),
  add column numbers text check (numbers ~ '^[0-9]{1,30}$'),
  add column phone text check (phone ~ '^[+][1-9][0-9]{1,14}$'),
  add column complimentary boolean not null default false,
  add constraint experience_booking_pizza_details check (
    experience = 'pizza'
    or (price_cents is null and numbers is null and phone is null and not complimentary)
  );

update public.experience_bookings
set price_cents = 18900
where experience = 'pizza';
