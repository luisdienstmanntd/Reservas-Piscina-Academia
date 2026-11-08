-- Verificador de segurança do Supabase: funções de trigger sem search_path fixo.
-- Idempotente: instalações novas já criam as funções com search_path vazio.
ALTER FUNCTION public.reservations_set_updated_at() SET search_path = '';
ALTER FUNCTION public.reservations_log_event() SET search_path = '';
