-- Tokens de estadia para acesso ao fluxo /hospede/* (gerados na recepção).

CREATE TABLE public.active_stays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  apartment_number text NOT NULL,
  checkout_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.active_stays IS
  'Ligação mágica check-in: token único por estadia até checkout (fuso hotel em app).';

CREATE INDEX active_stays_token_idx ON public.active_stays (token);

ALTER TABLE public.active_stays ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.active_stays FROM anon, authenticated;
GRANT ALL ON public.active_stays TO service_role;
