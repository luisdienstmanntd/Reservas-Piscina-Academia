alter table public.experience_sessions
  drop constraint experience_sessions_experience_check,
  add constraint experience_sessions_experience_check
    check (experience in ('cinema', 'wine', 'pizza'));

create trigger check_pizza_session_day
  before insert on public.experience_sessions
  for each row when (new.experience = 'pizza')
  execute function public.check_experience_booking_day();
