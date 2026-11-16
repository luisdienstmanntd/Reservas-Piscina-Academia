create function public.delete_experience(kind text, session_day date)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if kind is null or kind not in ('cinema', 'wine', 'pizza') or session_day is null then
    return false;
  end if;

  lock table public.experience_sessions, public.experience_bookings,
    public.pizza_daily_capacity, public.wine_daily_capacity in share row exclusive mode;

  delete from public.experience_sessions where experience = kind and day = session_day;
  if not found then return false; end if;

  delete from public.experience_bookings where experience = kind and day = session_day;
  if kind = 'pizza' then
    delete from public.pizza_daily_capacity where day = session_day;
  elsif kind = 'wine' then
    delete from public.wine_daily_capacity where day = session_day;
  end if;

  return true;
end;
$$;

revoke all on function public.delete_experience(text, date) from public, anon, authenticated;
grant execute on function public.delete_experience(text, date) to service_role;
