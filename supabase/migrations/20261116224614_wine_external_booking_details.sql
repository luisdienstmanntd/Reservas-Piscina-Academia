alter table public.experience_bookings
  drop constraint experience_booking_pizza_details,
  add constraint experience_booking_pizza_details check (
    experience = 'pizza'
    or (
      price_cents is null and not complimentary
      and ((experience = 'wine' and customer = 'external') or (numbers is null and phone is null))
    )
  );
