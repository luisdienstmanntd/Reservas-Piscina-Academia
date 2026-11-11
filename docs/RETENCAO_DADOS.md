# Retenção de dados — histórico de reservas

> **Status: APLICADO em produção em 11/11/2026**, com autorização do responsável. Decisão de negócio do
> responsável (11/11/2026), **sujeita à validação de LGPD**. Este documento não afirma que a política esteja em conformidade
> com a legislação; isso cabe ao responsável pela LGPD.

## Objetivo

Manter o histórico operacional completo. Nenhum registro de reserva é excluído automaticamente; o
**único dado apagado** é o **WhatsApp, 365 dias depois do check-out**.

## O que é preservado e o que é apagado

| Dado | Regra |
|------|-------|
| Reservas (inclusive canceladas e alteradas), instalação, data, horário, origem | preservadas |
| Apartamento, nome do hóspede, observações | preservados (sem prazo) |
| Cancelamentos e eventos de auditoria (`reservation_events`) | preservados |
| **WhatsApp (`guest_whatsapp`)** | apagado (`NULL`) 365 dias depois do check-out |

- **Marco do prazo:** `COALESCE(guest_checkout_date, reservation_date)`.
- **Contagem:** dia 365 após o marco ainda mantém o WhatsApp; a partir do dia 366 ele é apagado na
  rodada diária seguinte (`marco < hoje − 365`). Dias corridos (ano bissexto incluído).
- Cancelar (botão excluir da planilha) é `UPDATE status='cancelled'`, nunca `DELETE`. Não existe
  exclusão física de reservas no código, nas migrations nem nos jobs.

## Comportamento anterior × novo

| | Antes (migration `20261110100000`) | Depois (migration `20261111180853`) |
|---|---|---|
| Quando | dia seguinte ao check-out | 365 dias após o check-out |
| O que apaga | nome, WhatsApp **e observações** (`anonymized = true`) | **só o WhatsApp** |
| Rotina | `UPDATE` direto no job `lgpd_anonymize_reservations` | job chama `public.anonymize_old_whatsapp()` |
| Auditoria | evento `anonymized` | evento `updated` do ator `system`, campo `guest_whatsapp` |

**Já perdido, irrecuperável:** reservas que o job antigo já anonimizou (12 de 32 na produção em
11/11/2026) continuam sem nome e observações. A migration **não** as toca nem tenta recuperá-las.
A partir da aplicação, **o job deixou de apagar nome e observações**; só o WhatsApp vencido é apagado.

## O que a migration faz

`supabase/migrations/20261111180853_retention_whatsapp_365.sql` (aditiva, não apaga nada ao aplicar):

1. Nova coluna `reservations.whatsapp_anonymized_at` (quando o WhatsApp foi apagado).
2. Atualiza `reservations_log_event()` para atribuir a remoção ao `system` (e não à recepção).
3. Cria `public.anonymize_old_whatsapp(p_today date)`; só `service_role` executa. `p_today` serve para
   testar o prazo com datas exatas.
4. Reagenda o job `lgpd_anonymize_reservations` (03:00 UTC) para `SELECT public.anonymize_old_whatsapp();`.

A regra é espelhada e testada em `src/lib/retention.ts` (`whatsappExpired`).

## Como foi aplicada (e como aplicar de novo em outro ambiente)

1. Aprovação do responsável pela LGPD (ver pontos abaixo).
2. Aplicar a migration na produção (ex.: `apply_migration` do Supabase ou `supabase db push`).
3. Conferir: `select jobname, command from cron.job where jobname='lgpd_anonymize_reservations';`
   deve mostrar `SELECT public.anonymize_old_whatsapp();`.

**Aplicação na produção (11/11/2026):** estado antes, 32 reservas, 71 eventos, 12 já anonimizadas e hash
das colunas das reservas `885c9aa8…`; depois da migration, os mesmos números e o mesmo hash (nenhum dado
mudou). Job ativo com `SELECT public.anonymize_old_whatsapp();` às 03:00 UTC; só `service_role` executa
a função. O Supabase registrou a migration com a versão `20261111180853` (o arquivo do repositório foi
renomeado para a mesma versão, para um futuro `db push` não tentar aplicá-la de novo).

## Reversão

Migrations são para frente; a reversão é um script manual. **Ela não devolve dados apagados.**

```sql
-- Volta ao job anterior (apaga nome, WhatsApp e observações no dia seguinte ao check-out).
DO $$ DECLARE jid bigint; BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'lgpd_anonymize_reservations' LIMIT 1;
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;
SELECT cron.schedule('lgpd_anonymize_reservations', '0 3 * * *', $$
  UPDATE public.reservations
  SET guest_name = NULL, guest_whatsapp = NULL, notes = NULL, anonymized = true
  WHERE anonymized = false AND COALESCE(guest_checkout_date, reservation_date) < CURRENT_DATE;
$$);
-- Opcional (só depois de reverter o job): DROP FUNCTION public.anonymize_old_whatsapp(date);
-- A coluna whatsapp_anonymized_at pode ficar (inofensiva).
```

## Pontos que exigem aprovação do responsável pela LGPD

1. Finalidade e base legal para guardar **nome, apartamento e observações sem prazo**.
2. **Observações** são texto livre e podem conter dado pessoal sensível (saúde, alergias, religião);
   avaliar orientação à recepção ou prazo próprio.
3. Se o **WhatsApp apagado em 365 dias** atende a finalidade e ao prazo exigidos.
4. Informação ao hóspede sobre o tratamento (aviso de privacidade) e atendimento a pedidos de
   exclusão antes do prazo.

## Riscos conhecidos

- Plano Free do Supabase **sem backup**: qualquer erro de dado em produção não tem retorno.
- Dados pessoais acumulados sem prazo aumentam o impacto de um vazamento.
- O WhatsApp apagado não é recuperável; o job é diário e vale para o banco inteiro.

## Testes

- Unitários: `src/lib/retention.test.ts` (prazo exato 365/366, marco, ano bissexto).
- Integração (`npm run test:integration`, só banco local): `tests/integration/retention.test.ts`
  (dia 365 mantém, dia 366 apaga, check-out como marco, nome/apto/observações/status inalterados,
  nenhuma linha some, idempotência, linhas já anonimizadas intactas, evento do sistema na auditoria,
  só `service_role` executa).
- Migration sem perda de dados: aplicada sobre um banco de teste populado (reservas ativas, canceladas,
  anonimizadas e eventos): mesmas contagens antes e depois, 0 linhas com qualquer coluna diferente.
