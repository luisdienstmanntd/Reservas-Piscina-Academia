-- Fase 3.2 e 3.3 — Camada analítica para o Power BI (sem dados pessoais) e role somente-leitura.
--
-- O Power BI NUNCA lê as tabelas de public: só as views do schema analytics, sem nome,
-- WhatsApp, observações nem token de estadia.
--
-- A role powerbi_reader é criada SEM senha (não consegue entrar). Defina a senha pelo SQL Editor,
-- fora do repositório:  ALTER ROLE powerbi_reader WITH PASSWORD '<senha-forte>';

CREATE SCHEMA IF NOT EXISTS analytics;

-- ---------------------------------------------------------------------------
-- Reservas (uma linha por reserva, ativas e canceladas)
-- ---------------------------------------------------------------------------
CREATE VIEW analytics.vw_reservas AS
SELECT
  r.id,
  r.stay_id                                         AS estadia_id,
  r.facility,
  CASE r.facility WHEN 'pool' THEN 'Piscina' ELSE 'Academia' END AS instalacao,
  r.reservation_date                                AS data_reserva,
  r.slot_start                                      AS horario_inicio,
  EXTRACT(HOUR FROM r.slot_start)::int              AS hora_slot,
  EXTRACT(ISODOW FROM r.reservation_date)::int      AS dia_semana_iso,
  r.apartment_number                                AS apartamento,
  LEFT(r.apartment_number, 1)                       AS andar,
  CASE r.created_by WHEN 'guest' THEN 'Hóspede' ELSE 'Recepção' END AS origem,
  r.status,
  (r.status = 'cancelled')                          AS cancelada,
  r.created_at,
  r.cancelled_at,
  (r.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS data_criacao_local,
  r.reservation_date
    - (r.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS antecedencia_dias,
  r.confirmation_sent                               AS confirmacao_enviada,
  r.warning_sent                                    AS aviso_enviado,
  r.anonymized                                      AS anonimizada
FROM public.reservations r;

COMMENT ON VIEW analytics.vw_reservas IS
  'Uma linha por reserva (ativa ou cancelada). Sem nome, WhatsApp ou observações.';

-- ---------------------------------------------------------------------------
-- Estadias (links de hóspede gerados pela recepção). Sem o token (é uma credencial).
-- ---------------------------------------------------------------------------
CREATE VIEW analytics.vw_estadias AS
SELECT
  s.id,
  s.apartment_number                                AS apartamento,
  LEFT(s.apartment_number, 1)                       AS andar,
  s.created_at,
  (s.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS data_criacao_local,
  s.checkout_date                                   AS data_checkout,
  s.checkout_date
    - (s.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dias_ate_checkout,
  COALESCE(c.total, 0)                              AS qtd_reservas,
  COALESCE(c.ativas, 0)                             AS qtd_reservas_ativas,
  COALESCE(c.total, 0) > 0                          AS teve_reserva
FROM public.active_stays s
LEFT JOIN (
  SELECT stay_id,
         COUNT(*)                                   AS total,
         COUNT(*) FILTER (WHERE status = 'active')  AS ativas
  FROM public.reservations
  WHERE stay_id IS NOT NULL
  GROUP BY stay_id
) c ON c.stay_id = s.id;

COMMENT ON VIEW analytics.vw_estadias IS
  'Uma linha por link de estadia, com contagem de reservas geradas (conversão do link).';

-- ---------------------------------------------------------------------------
-- Eventos de auditoria (criada, editada, cancelada, anonimizada)
-- ---------------------------------------------------------------------------
CREATE VIEW analytics.vw_eventos AS
SELECT
  e.id,
  e.reservation_id                                  AS reserva_id,
  e.event_type                                      AS tipo_evento,
  e.actor                                           AS ator,
  e.changed_fields                                  AS campos_alterados,
  e.occurred_at                                     AS ocorrido_em
FROM public.reservation_events e;

COMMENT ON VIEW analytics.vw_eventos IS
  'Trilha de auditoria das reservas. Só nomes de campos alterados, nunca valores.';

-- ---------------------------------------------------------------------------
-- Role de leitura exclusiva do Power BI
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'powerbi_reader') THEN
    CREATE ROLE powerbi_reader LOGIN NOINHERIT NOBYPASSRLS NOCREATEDB NOCREATEROLE CONNECTION LIMIT 5;
  END IF;
END $$;

ALTER ROLE powerbi_reader SET statement_timeout = '30s';

-- O schema analytics não é exposto pela API do Supabase e fica fechado para todos, exceto a role.
REVOKE ALL ON SCHEMA analytics FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA analytics FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA analytics TO powerbi_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO powerbi_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics GRANT SELECT ON TABLES TO powerbi_reader;

-- A role não tem acesso a nada em public (as tabelas já têm RLS sem políticas).
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM powerbi_reader;
