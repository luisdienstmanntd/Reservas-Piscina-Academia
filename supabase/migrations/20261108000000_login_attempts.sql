-- Rate limit do login da recepção: registra senhas erradas (hash do IP, sem IP em texto puro).

CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_key text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.login_attempts IS
  'Falhas de login da recepção. client_key = HMAC do IP. Linhas antigas são removidas pela aplicação.';

CREATE INDEX login_attempts_key_time_idx
  ON public.login_attempts (client_key, attempted_at DESC);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.login_attempts FROM anon, authenticated;
GRANT ALL ON public.login_attempts TO service_role;
