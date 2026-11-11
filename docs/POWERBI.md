# Power BI — conexão, modelo e primeiro relatório

Guia da Fase 3 do [`ROADMAP_CORRECOES.md`](../ROADMAP_CORRECOES.md). O Power BI lê **somente** o schema `analytics` (views sem dados pessoais), com uma role própria de leitura. Ele nunca usa a `service_role` nem lê as tabelas de `public`.

## 1. Antes de conectar (uma vez só, na ordem)

1. **Já aplicado em produção em 09/11/2026** (ordem do nome; em um projeto novo, aplique antes de publicar o código desta fase):
   1. `20261108140000_reservations_stay_id.sql`
   2. `20261108150000_analytics_layer.sql`
   3. `20261108160000_cleanup_orphan_stays_cron.sql` (precisa do `pg_cron`, já usado pelo job LGPD)
2. **Pendente:** definir a senha da role no **SQL Editor** do Supabase. A role nasce sem senha e não consegue entrar enquanto isso não for feito:

```sql
ALTER ROLE powerbi_reader WITH PASSWORD '<senha-forte-gerada-por-voce>';
```

   Guarde a senha em um gerenciador de senhas. Ela não deve entrar no repositório, no chat nem em arquivo `.env` versionado.
3. Publicar o código (ele passa a gravar `stay_id` nas reservas feitas pelo link do hóspede). Publicar o código **antes** da migration 1 faz a reserva do hóspede falhar, porque a coluna `stay_id` ainda não existe.

## 2. Conexão no Power BI Desktop

No painel do Supabase, em **Connect → Session pooler**, copie o host. A conexão direta usa IPv6 e costuma falhar em redes só IPv4; o pooler resolve.

| Campo | Valor |
|---|---|
| Servidor | host do Session pooler (algo como `aws-0-<região>.pooler.supabase.com`), porta `5432` |
| Banco de dados | `postgres` |
| Usuário | `powerbi_reader.<ref-do-projeto>` (o pooler exige o sufixo com o ref; o ref deste projeto é `fjwqnoojvtdiytedtfwt`) |
| Senha | a definida no passo 1.2 |
| Modo | **Importar** (não use DirectQuery) |

Passos: **Obter dados → Banco de dados PostgreSQL**, informe `servidor:5432` e o banco, escolha **Importar**, credenciais do tipo **Banco de dados**, deixe a criptografia ligada e selecione estas três views:

- `analytics.vw_reservas`: uma linha por reserva (ativa ou cancelada).
- `analytics.vw_estadias`: uma linha por link de estadia, com a contagem de reservas geradas.
- `analytics.vw_eventos`: trilha de auditoria (criada, editada, cancelada, anonimizada).

A role tem limite de 5 conexões e 30 s por consulta, o que sobra para este volume.

## 3. Modelo

**Calendário.** Crie no próprio Power BI (**Modelagem → Nova tabela**):

```dax
Calendario =
ADDCOLUMNS(
    CALENDAR(DATE(2026, 7, 1), DATE(2027, 12, 31)),
    "Ano", YEAR([Date]),
    "Mês", FORMAT([Date], "yyyy-MM"),
    "Dia da semana", WEEKDAY([Date], 2)
)
```

**Capacidade.** Tabela de apoio com os slots por dia (piscina: 13h–23h e 00h = 12; academia: 24). A recepção também pode registrar reserva manual na piscina nos horários de uso compartilhado (09h–12h), que NÃO entram nessa capacidade: para a taxa de ocupação da piscina, filtre `hora_slot` de 13h em diante (ou some esses 4 horários à capacidade) para não passar de 100%:

```dax
Capacidade =
DATATABLE(
    "Instalacao", STRING, "SlotsPorDia", INTEGER,
    { {"Piscina", 12}, {"Academia", 24} }
)
```

**Relacionamentos** (todos de muitos para um, direção única):

| De (muitos) | Para (um) |
|---|---|
| `vw_reservas[data_reserva]` | `Calendario[Date]` |
| `vw_reservas[estadia_id]` | `vw_estadias[id]` |
| `vw_eventos[reserva_id]` | `vw_reservas[id]` |
| `vw_reservas[instalacao]` | `Capacidade[Instalacao]` (use uma coluna de dimensão ou filtre pela instalação na página) |

## 4. Medidas (DAX)

```dax
Total de Reservas = COUNTROWS(vw_reservas)

Reservas Ativas =
CALCULATE(COUNTROWS(vw_reservas), vw_reservas[cancelada] = FALSE())

Reservas Canceladas =
CALCULATE(COUNTROWS(vw_reservas), vw_reservas[cancelada] = TRUE())

Taxa de Cancelamento = DIVIDE([Reservas Canceladas], [Total de Reservas])

Antecedência Média (dias) =
CALCULATE(AVERAGE(vw_reservas[antecedencia_dias]), vw_reservas[cancelada] = FALSE())

Conversão do Link =
DIVIDE(
    CALCULATE(COUNTROWS(vw_estadias), vw_estadias[teve_reserva] = TRUE()),
    COUNTROWS(vw_estadias)
)

Confirmações Enviadas =
CALCULATE(COUNTROWS(vw_reservas), vw_reservas[confirmacao_enviada] = TRUE())

Slots Disponíveis =
SUMX(VALUES(Capacidade[Instalacao]), CALCULATE(MAX(Capacidade[SlotsPorDia])))
    * DISTINCTCOUNT(Calendario[Date])

Taxa de Ocupação = DIVIDE([Reservas Ativas], [Slots Disponíveis])
```

Atenção a `Taxa de Ocupação`: ela só faz sentido com um **período fechado** e já ocorrido selecionado no filtro de data. Dias futuros entram na capacidade e puxam a taxa para baixo. Revise estas medidas ao montar o modelo; elas não foram executadas no Power BI.

## 5. Primeiro relatório (item 3.4 do roadmap)

1. **Visão geral:** cartões com Reservas Ativas, Taxa de Cancelamento e Antecedência Média; linha de reservas por dia.
2. **Ocupação:** matriz de `dia_semana_iso` (linhas) por `hora_slot` (colunas) com Reservas Ativas, com segmentação por Instalação e por mês.
3. **Origem e cancelamentos:** barras de `origem` (Hóspede × Recepção) e de cancelamentos por dia da semana.
4. **Link e mensagens:** Conversão do Link por semana e funil de Confirmações Enviadas.

## 6. Atualização agendada

Publique o relatório e, no Power BI Service, configure a **atualização agendada** (por exemplo, uma vez ao dia). A fonte é um endpoint público na nuvem, então não precisa de gateway.

## 7. Cuidados

- **Fuso horário:** `created_at`, `cancelled_at` e `ocorrido_em` estão em UTC. Para análises por dia use `data_criacao_local` (calculada no fuso do hotel) e `data_reserva`/`horario_inicio`, que já são locais.
- **Histórico começa do zero:** o banco foi zerado em 08/11/2026. Antes dessa data não há dados, e os cancelamentos só passaram a ser preservados a partir da Fase 2.
- **Dados pessoais:** as views não têm nome, WhatsApp, observações nem o token da estadia. `apartamento` é só o número do quarto. Se o relatório for compartilhado fora do hotel, considere remover essa coluna.
- **Troca de senha:** repita o `ALTER ROLE ... WITH PASSWORD` e atualize a credencial no Power BI.
- **Acesso:** para revogar o acesso do Power BI de imediato, `ALTER ROLE powerbi_reader NOLOGIN;`.

## 8. Verificação (como administrador, no SQL Editor)

```sql
-- Deve funcionar:
SET ROLE powerbi_reader;
SELECT count(*) FROM analytics.vw_reservas;

-- Cada um destes deve dar "permission denied":
SELECT count(*) FROM public.reservations;
SELECT count(*) FROM public.active_stays;
RESET ROLE;
```
