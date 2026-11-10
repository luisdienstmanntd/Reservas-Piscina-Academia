# Product Log — Reservas Piscina e Academia

Este arquivo é a memória histórica do produto. Ele registra pedidos, decisões, erros, causas, soluções e impactos para que pessoas e IAs entendam o contexto do projeto, evitem regressões e não repitam tentativas que já falharam.

## Regra de uso

Antes de alterar o produto:

1. Leia este arquivo e procure registros relacionados à área que será modificada.
2. Verifique se o novo pedido contradiz uma decisão, restrição ou solução anterior.
3. Se houver conflito, não descarte silenciosamente o histórico: apresente o conflito ao responsável e registre a decisão tomada.
4. Depois do trabalho, crie ou atualize uma entrada com o pedido, sua motivação, o problema, a causa identificada, o que foi feito, os testes e os riscos conhecidos.
5. Registre também tentativas que falharam. Saber o que não funcionou evita repetição de erros.
6. Nunca inclua senhas, tokens, chaves, dados pessoais de hóspedes ou outros segredos neste arquivo.

O código e os testes representam o comportamento atual do sistema. Este log explica por que ele chegou a esse estado. Caso o log e o código divirjam, confirme o comportamento atual, registre a divergência e corrija a documentação ou o sistema conforme a decisão do responsável.

## Status das entradas

- `Pedido`: ainda não analisado ou executado.
- `Em andamento`: trabalho iniciado, mas não concluído.
- `Concluído`: alteração implementada e verificada.
- `Decisão`: escolha de produto ou arquitetura que deve orientar trabalhos futuros.
- `Revertido`: alteração desfeita; o motivo deve ser registrado.
- `Bloqueado`: depende de informação, acesso ou decisão externa.

## Modelo de entrada

Copie o bloco abaixo para o início da seção **Histórico**, mantendo as entradas mais recentes primeiro.

```md
### AAAA-MM-DD — Título curto

- **Status:** Pedido | Em andamento | Concluído | Decisão | Revertido | Bloqueado
- **Área:** Ex.: reservas, autenticação, recepção, banco de dados, infraestrutura
- **Pedido:** O que foi solicitado, sem perder requisitos importantes.
- **Por que foi pedido:** Necessidade do usuário, do negócio ou da manutenção.
- **Problema observado:** Sintoma, erro ou limitação que motivou o trabalho.
- **Causa:** Causa raiz confirmada; use "não identificada" se ainda não houver evidência.
- **Decisão:** Comportamento ou abordagem escolhida e por quê.
- **O que foi feito:** Arquivos, regras, migrações ou fluxos alterados.
- **Resultado:** O que passou a funcionar ou deixou de ocorrer.
- **Validação:** Testes e verificações executados, com seus resultados.
- **Impactos e riscos:** Efeitos colaterais, compatibilidade, segurança e pontos de atenção.
- **Não fazer / evitar regressão:** Abordagens proibidas ou condições que não podem ser quebradas.
- **Pendências:** Trabalho restante; use "nenhuma" quando concluído.
- **Referências:** Issue, PR, commit, documentação ou arquivos relacionados.
```

## Histórico

### 2026-11-10 — Aviso de novas reservas para a recepção

- **Status:** Em andamento (PR em rascunho; validado em navegador com banco real; falta a rodada final de QA)
- **Área:** Recepção
- **Pedido:** A recepção precisa SEMPRE saber quando entram novas reservas.
- **Problema observado:** A grade atualizava a cada 30 s, em silêncio e só para o dia e a instalação que estavam na tela. Uma reserva de outro dia ou da outra instalação não aparecia, e nada avisava (sem som, contador ou destaque). Se a internet caísse, ninguém saberia que a tela estava parada.
- **Decisão:** Verificação a cada 10 s, para qualquer dia e instalação (nova ação `listNewReservations`, só para a recepção, sem nome nem WhatsApp). Só reserva feita pelo hóspede gera aviso. Aviso = faixa verde "N novas reservas" com "Ver na grade" e "Marcar como vistas", toast, som de 3 tons (desligável; lembrado no navegador), contador no título da aba e indicador "Novas reservas verificadas às HH:MM:SS". Se a verificação falhar 2 vezes seguidas, aparece o alerta vermelho "Sem conexão com o sistema: novas reservas podem não ser avisadas". O marcador da última verificação fica no navegador (até 24 h), então quem abre a tela depois de um tempo vê o que entrou nesse intervalo. A busca tem sobreposição de 10 s e a tela descarta repetidas pelo id.
- **O que foi feito:** `src/lib/new-reservations.ts`, `listNewReservations` em `src/app/actions/reservations.ts`, `src/app/recepcao/new-reservation-alerts.tsx` e ligação em `reception-dashboard.tsx`; testes unitários.
- **Validação:** 131 testes unitários, ESLint, tsc. Em navegador real, contra PostgreSQL real, 17 verificações passam: aviso em 9,9 s para outra instalação e outro dia, texto correto, sem dados pessoais, título da aba, som, toast, reserva da própria recepção não avisa, "Ver na grade" troca instalação/dia, som desligado não toca mas avisa, alerta de queda de conexão, recuperação sem perder a reserva criada durante a queda, sessão expirada volta ao login, sem erros de console.
- **Impactos e riscos:** Uma consulta leve a cada 10 s por aba da recepção aberta. Abas em segundo plano têm os temporizadores reduzidos pelo navegador (a verificação pode cair para cerca de 1 minuto depois de alguns minutos escondida); o aviso aparece ao voltar para a aba. O navegador só libera o som depois de um clique na página (a tela avisa quando o som está bloqueado). Se a recepção fechar o navegador, não há aviso (não é um aplicativo instalado nem notificação do sistema).
- **Não fazer / evitar regressão:** Não colocar dados pessoais no aviso; não avisar a recepção das reservas que ela mesma cria; manter o alerta de "sem conexão".
- **Pendências:** Rodada final de QA com a versão publicada; opcional: notificação do sistema operacional e aviso por WhatsApp/e-mail para quando ninguém estiver com a tela aberta.
- **Referências:** `src/app/recepcao/new-reservation-alerts.tsx`, `src/lib/new-reservations.ts`.

### 2026-11-10 — Atualização do Next.js por falhas de segurança

- **Status:** Concluído (PR em rascunho; revalidado no teste integrado da versão final)
- **Área:** Dependências e segurança
- **Pedido:** Corrigir os achados da revisão de segurança antes da entrega.
- **Problema observado:** `npm audit --omit=dev` marcava o Next.js 15.5.14 como **crítico** (falhas na otimização de imagens, desvio do middleware, negação de serviço em Server Actions, SSRF), além de 6 avisos altos em dependências indiretas.
- **Decisão:** Atualizar para o Next.js 15.5.29 (última da série 15.5, sem mudança de versão maior) e rodar `npm audit fix` sem `--force`. O crítico deixa de existir.
- **O que foi feito:** `next` e `eslint-config-next` para 15.5.29; `package-lock.json` com as atualizações indiretas compatíveis (nanoid, sharp, source-map-js, ws...).
- **Resultado:** `npm audit` cai de 7 avisos (1 crítico, 6 altos) para 3 (1 moderado, 2 altos), todos aceitos e sem correção sem quebrar compatibilidade: (1) PostCSS aninhado dentro do Next: afeta o processamento de CSS na compilação, não roda em produção; só some com o Next 16. (2) Zod 3: consumo de memória ao validar coleções enormes; o limite de tamanho de requisição do Next contém o caso, e as entradas deste sistema são pequenas; só some com o Zod 4 (versão maior).
- **Validação:** 122 testes unitários, ESLint, tsc e `next build` aprovados na versão nova.
- **Impactos e riscos:** Atualização de correção (patch/minor) dentro da mesma série; risco baixo, mas o comportamento do build deve ser conferido na publicação.
- **Pendências:** Planejar a migração para Next 16 e Zod 4 quando houver tempo para testá-las com calma.
- **Referências:** `package.json`, `package-lock.json`.

### 2026-11-09 — Horários indisponíveis sempre em cinza, em todas as telas

- **Status:** Concluído (publicação pendente)
- **Área:** Reservas, recepção e tela do hóspede
- **Pedido:** Horários já ocupados devem aparecer em cinza (indisponíveis) e ninguém (hóspede ou recepção) deve se confundir; revisar todo o projeto quanto ao comportamento dos bloqueios, sem regressões.
- **Problema observado:** No seletor de horário da "Nova reserva" da recepção, um horário reservado por outra pessoa (apto 211, 15h–16h) aparecia como livre e ainda vinha pré-selecionado, enquanto a grade mostrava as duas reservas. Na tela do hóspede, os rótulos "Ocup." e "Apto." tinham 8 px, a lista nunca se atualizava, e horários que já passaram apareciam disponíveis (e o servidor aceitava a reserva).
- **Causa:** (1) O seletor guardava uma foto da ocupação, tirada só ao abrir a tela ou ao trocar data/instalação; a grade atualizava a cada 30 s, o seletor não. (2) A tela do hóspede carregava a lista uma vez. (3) Não existia regra de "horário já terminou".
- **Decisão:** Regra única em `src/lib/slot-availability.ts`, usada por todas as telas e pelo servidor: um horário fica indisponível se está **ocupado**, se **já terminou hoje** (o horário em andamento continua permitido) ou se o **apartamento já atingiu o limite do dia** (nessa ordem de prioridade). Indisponível = cinza, com o motivo escrito (Ocupado / Já passou / Limite do dia), texto riscado na tela do hóspede e legenda "cinza = indisponível". O bloco 00h–01h da piscina fica FORA da regra de "já passou" porque a semântica dele ainda não foi definida (ver Pendências). A hora usada é a do servidor (`serverNowMs`), não a do aparelho.
- **O que foi feito:** Recepção: seletor de horário atualiza sozinho (a cada 20 s, ao voltar para a aba e após criar ou cancelar), junta a ocupação da grade, não troca o horário que a pessoa escolheu e só mostra aviso em vermelho; apartamentos que já têm reserva no dia ficam em cinza na "Nova reserva"; a grade separa "Livre" de "Já passou"; a atualização da grade pausa com a aba oculta. Hóspede: lista de horários atualiza em segundo plano (aba visível, sem piscar "Carregando…"), descarta resposta antiga, rótulos completos, `aria-label` e `title`. Servidor: `validateStayAndSlot` recusa horário que já terminou (hóspede e balcão); `getReservationDaySummary` devolve `serverNowMs` e, **para o hóspede, só `ownApartmentBooked` (nunca a lista de apartamentos)**; a recepção continua recebendo a lista.
- **Resultado:** Reproduzido o caso do print: após outra pessoa reservar, o seletor passa a mostrar o horário em cinza ao voltar para a aba (ou em até 20 s). Verificado no navegador com a aplicação real (servidor Supabase simulado), na recepção (PC) e no hóspede (celular 390 px): sem rolagem lateral e com os rótulos corretos nos cenários de apartamento livre e de limite do dia.
- **Validação:** 122 testes unitários, ESLint, `tsc` e `next build` aprovados, incluindo limites exatos (fim do horário, academia 00h–01h às 00:30 e 01h, dia futuro, balcão) e a privacidade do resumo. Um subagente revisou em modo somente leitura e apontou uma regressão que foi corrigida antes da entrega: a marcação de apartamento em cinza tinha ido para o seletor errado ("Gerar link"), o que impediria gerar novo link para quem já reservou. Também corrigidos: spinner que podia travar, horário pré-selecionado após criar reserva, e "hoje" congelado se a aba passasse da meia-noite. Testes E2E e celular real NÃO executados.
- **Impactos e riscos:** (a) **A recepção deixa de poder registrar reserva de balcão em horário que já terminou hoje** (ex.: lançar às 09h o uso das 07h); o horário em andamento continua permitido. Se isso for necessário, exige um caminho à parte. (b) Operador de recepção que também tenha cookie de hóspede no mesmo navegador não terá o aviso de limite na tela do hóspede (o servidor continua recusando). (c) A cor "disponível" (#8da4b7) é um azul acinzentado de contraste baixo; a legenda, o texto riscado e o motivo escrito compensam, mas vale revisar a paleta.
- **Não fazer / evitar regressão:** Não criar outra regra de bloqueio fora de `slot-availability.ts`; não devolver ao hóspede a lista de apartamentos; não marcar apartamentos em cinza no "Gerar link de acesso" (a recepção precisa gerar link para quem já reservou); não confiar no relógio do aparelho para decidir o que passou.
- **Pendências:** Definir a semântica do bloco 00h–01h da piscina (hoje o código o trata como a meia-noite de abertura do próprio dia, e o aviso de 10 minutos usa essa hora; se for a meia-noite do dia seguinte, regra e aviso mudam juntos); decidir se a recepção precisa de lançamento retroativo; opcional: mostrar "Já passou" também em dias anteriores na grade e restringir a consulta do hóspede às datas da estadia.
- **Referências:** `src/lib/slot-availability.ts`, `src/lib/reservation-slot-validation.ts`, `src/lib/reservation-grid.ts`, `src/app/actions/reservations.ts`, `src/app/recepcao/reception-dashboard.tsx`, `src/components/guest-booking.tsx`.

### 2026-11-09 — Grade da recepção responsiva, sem rolagem lateral

- **Status:** Concluído (publicação pendente)
- **Área:** Recepção (interface)
- **Pedido:** A planilha de reservas quebrava em telas menores. Ela não deve ter rolagem lateral nem rolagens internas; analisar um formato que distribua e mostre o conteúdo também em telas pequenas.
- **Problema observado:** A grade era uma `<table>` com largura mínima de 1180 px dentro de um contêiner com `overflow-x-auto`: em telas menores gerava rolagem lateral e a coluna de ações (lixeira) ficava escondida. Cada horário livre ocupava uma linha inteira com 7 traços, e havia cabeçalho duplicado ("WhatsApp" e "whatsapp").
- **Causa:** Layout desenhado só para telas largas, com largura mínima fixa nas colunas e nos campos.
- **Decisão:** Dois formatos conforme a largura. Telas largas (a partir de 1280 px): linha única com colunas de largura definida (horário, apto + origem, hóspede, observações, WhatsApp, mensagens, cancelar), alinhadas entre as linhas. Telas menores: cada reserva vira um cartão, com horário e lixeira na primeira linha, apto e origem na segunda, nome e WhatsApp lado a lado e observações na largura toda. Horários livres consecutivos são agrupados em uma linha só ("14h00 – 16h00 · Livre · 2 horários"; academia vazia = "Dia todo"). Nenhum contêiner com rolagem interna: o que passa da tela rola com a própria página.
- **O que foi feito:** `src/app/recepcao/reception-dashboard.tsx` (nova lista de reservas e linha de reserva; campos sem largura mínima/máxima), `src/components/reception-wa-actions.tsx` (botões em duas colunas no cartão, alinhados à direita na grade), `src/lib/reservation-grid.ts` (agrupamento de horários livres) e teste.
- **Resultado:** Sem rolagem lateral em 360, 414, 768, 1024, 1280, 1366 e 1920 px, na piscina e na academia. A grade da piscina com 4 reservas caiu de 1180 px de largura mínima para 452 px de altura em tela larga; a academia com 6 reservas ocupa 590 px.
- **Validação:** 98 testes unitários, ESLint, `tsc` e `next build` aprovados. Medição automatizada no navegador (Playwright) nas 7 larguras, com a aplicação real e um servidor falso no lugar do Supabase: nenhuma rolagem lateral da página, nenhum elemento vazando do cartão, nenhuma área com rolagem interna; prints conferidos a olho. Não testado em celular de verdade.
- **Impactos e riscos:** A rolagem vertical da página não some por completo: um dia com muitas reservas (ex.: piscina cheia, 12 reservas) continua mais alto que uma tela de celular. Horários livres agora aparecem agrupados, não um por um; reservar continua pelo formulário de balcão. O formato em cartão vale abaixo de 1280 px, inclusive tablet deitado (1024 px).
- **Não fazer / evitar regressão:** Não voltar a usar largura mínima fixa (`min-w-[...]`) ou `overflow-x-auto` na grade; não usar largura `auto` na coluna das mensagens (desalinha as linhas); todo campo novo da linha precisa de `min-w-0` e largura 100%.
- **Pendências:** Conferir no celular real depois da publicação.
- **Referências:** `src/app/recepcao/reception-dashboard.tsx`, `src/lib/reservation-grid.ts`.

### 2026-11-08 — Fase 3 do roadmap: camada de dados para o Power BI (preparada, não aplicada)

- **Status:** Em andamento (migrations aplicadas em produção em 09/11/2026; faltam a senha da role, o merge do código e o relatório)
- **Área:** Banco de dados, análise de dados e documentação
- **Pedido:** Excluir todas as reservas existentes no banco e preparar a Fase 3.
- **Por que foi pedido:** Começar o histórico analítico do zero, sem dados de teste, e deixar o banco pronto para o Power BI.
- **Decisão:** (a) Exclusão feita em produção a pedido explícito: 4 reservas (2 reais de julho, já anonimizadas, e 2 de teste de 08/11) e, por cascata, os 4 eventos de auditoria. Antes, uma cópia só das colunas sem dados pessoais foi guardada fora do repositório. Estadias (links), `login_attempts` e demais tabelas não foram tocadas. (b) 3.1: coluna `reservations.stay_id` (FK com `ON DELETE SET NULL`) gravada pelas reservas do link do hóspede; balcão fica `NULL`; job diário apaga estadias vencidas há mais de 30 dias SEM reservas. (c) 3.2: schema `analytics` com `vw_reservas`, `vw_estadias` (sem token) e `vw_eventos`, todas sem nome, WhatsApp ou observações. (d) 3.3: role `powerbi_reader` criada SEM senha (a senha é definida por quem administra, fora do repositório), com limite de 5 conexões e 30 s por consulta, só `SELECT` no schema `analytics` e nenhum acesso a `public`.
- **O que foi feito:** migrations `20261108140000_reservations_stay_id.sql`, `20261108150000_analytics_layer.sql`, `20261108160000_cleanup_orphan_stays_cron.sql`; `src/app/actions/stays.ts` (devolve o id da estadia) e `createGuestReservation` (grava `stay_id`); testes novos; `docs/POWERBI.md` (conexão, modelo, medidas DAX e roteiro do relatório); `setup_supabase_cloud.sql`.
- **Validação:** 97 testes unitários, ESLint, `tsc` aprovados. Cadeia completa de migrations aplicada em um PostgreSQL 16 local com dados de exemplo: a role lê as 3 views e recebe `permission denied` em todas as tabelas de `public`; `anon` e `authenticated` não entram no schema; nenhuma coluna das views tem dado pessoal ou token; a limpeza só apaga estadia vencida sem reserva; apagar estadia não apaga a reserva. `pg_cron` simulado. As medidas DAX e a conexão real com o Power BI NÃO foram executadas.
- **Impactos e riscos:** A exclusão das reservas é permanente (o plano gratuito do Supabase não tem backup automático). Ordem de publicação obrigatória: aplicar a migration `20261108140000` ANTES do código, senão a reserva do hóspede falha por falta da coluna `stay_id`. As views usam as permissões do dono (necessário para a role não ler `public`); o schema `analytics` não é exposto pela API do Supabase. `apartamento` nas views é só o número do quarto. Reservas anteriores ao campo `stay_id` não terão vínculo (hoje não há nenhuma).
- **Não fazer / evitar regressão:** Não dar `GRANT` em tabelas de `public` para `powerbi_reader`; não incluir nome, WhatsApp, observações ou `token` nas views; não conectar o Power BI com `service_role`; não gravar a senha da role no repositório.
- **Aplicado em produção:** 09/11/2026, projeto Supabase `valle-dincanto-piscina`, na ordem `20261108140000`, `20261108150000` e `20261108160000`, a pedido do responsável. Conferido no banco real: coluna `stay_id` criada, 3 views em `analytics` sem nenhuma coluna de dado pessoal, job `cleanup_orphan_stays` agendado, role `powerbi_reader` criada SEM senha (não consegue entrar). Teste em transação desfeita: a role lê as 3 views (3 reservas, 5 estadias, 3 eventos) e recebe `permission denied` em `reservations`, `active_stays`, `login_attempts` e `reservation_events`; `anon` também é barrado. O verificador de segurança do Supabase não apontou nada novo. O histórico (`schema_migrations`) foi alinhado aos nomes dos arquivos: 15 registros no banco e 15 arquivos no repositório. As 3 reservas existentes não foram tocadas (as migrations só adicionam). O código antigo continua compatível: a coluna nova aceita `NULL`.
- **Pendências:** Definir a senha da role (`ALTER ROLE powerbi_reader WITH PASSWORD '...'`, por quem administra o banco); mergear o PR #6 (o código passa a gravar `stay_id`; só serve depois das migrations, que já estão aplicadas); montar o relatório no Power BI; decidir se `notes` entra na anonimização; item 5.6 (tabela `apartments`) segue na Fase 5.
- **Referências:** `docs/POWERBI.md`, `REVISAO_TECNICA.md` §3, `ROADMAP_CORRECOES.md`.

### 2026-11-08 — Fase 2 do roadmap: preservar histórico e dados honestos

- **Status:** Concluído (migrations aplicadas em produção; deploy do código pendente)
- **Área:** Reservas, banco de dados, LGPD e auditoria
- **Pedido:** Executar a Fase 2 do `ROADMAP_CORRECOES.md` (itens 2.1 a 2.5).
- **Por que foi pedido:** Dado apagado não volta: cada cancelamento destruía a linha (F2), reservas de balcão gravavam checkout falso (F3), não havia `updated_at` nem trilha (F6) e a LGPD gravava `''` (F13). Isso inviabiliza taxa de cancelamento e demanda real no Power BI.
- **Decisão:** (2.1) Colunas `status` (`active`/`cancelled`), `cancelled_at`, `cancelled_by` com CHECK de consistência; as duas UNIQUE viraram índices únicos parciais `WHERE status = 'active'`, mantendo os nomes antigos (assim `uniqueViolationKind()` segue válido). (2.2) `deleteReservation` virou `cancelReservation` (UPDATE só em reservas ativas); `getReservationDaySummary`, `assertSlotAndApartmentFree` e `getReservationsForDate` filtram `status = 'active'`. (2.3) Balcão grava `guest_checkout_date = NULL`; `validateStayAndSlot` aceita `null` e pula só a checagem de check-out. (2.4) `updated_at` via trigger e tabela `reservation_events` (`created`, `updated`, `cancelled`, `anonymized`) alimentada por trigger, com histórico retroativo de `created`; os eventos guardam só o NOME dos campos alterados, nunca nome/WhatsApp/observações. (2.5) Coluna `anonymized`; o job grava `NULL` em nome e WhatsApp; linhas já anonimizadas foram convertidas.
- **O que foi feito:** migrations `20261108100000_reservations_soft_delete.sql`, `20261108110000_lgpd_anonymize_null.sql` e `20261108120000_reservations_audit.sql` (e `setup_supabase_cloud.sql`); `src/app/actions/reservations.ts`, `src/lib/reservation-slot-validation.ts`, `src/lib/reservations.ts`, `src/app/recepcao/reception-dashboard.tsx`.
- **Validação:** 80 testes unitários, ESLint, `tsc` aprovados. Migrations aplicadas em um PostgreSQL 16 local sobre dados legados (incluindo linhas já anonimizadas): conflito de slot e de apartamento entre ativas, liberação após cancelar, CHECK de consistência, eventos corretos e job LGPD com `NULL`. Esse teste achou e corrigiu um bug no trigger (concatenação de array) antes da entrega. `pg_cron` foi simulado; o teste de integração novo (TESTE 3) foi escrito mas NÃO executado (exige Supabase local).
- **Impactos e riscos:** A ordem importa: o código novo consulta `status`; publicá-lo antes das migrations quebra a recepção. Sem rollback automático: reverter exige apagar colunas e recriar as UNIQUE. A coluna `notes` (observações livres) pode conter dados pessoais e continua fora da anonimização. Eventos `updated` assumem `actor = 'reception'` (única origem de edições hoje). Cancelamentos antigos já foram perdidos e não podem ser reconstruídos.
- **Não fazer / evitar regressão:** Não voltar a apagar reservas; não esquecer `status = 'active'` em qualquer nova consulta de ocupação; não gravar PII em `reservation_events`; não renomear os índices únicos sem atualizar `uniqueViolationKind()`.
- **Ordem de publicação:** 1) aplicar as 3 migrations no Supabase, na ordem do nome; 2) publicar o código.
- **Aplicado em produção:** 08/11/2026, projeto Supabase `valle-dincanto-piscina`, na ordem `login_attempts` (Fase 1), `reservations_soft_delete`, `lgpd_anonymize_null`, `reservations_audit` e `fix_function_search_path` (funções com `search_path` vazio, por aviso do verificador de segurança). Conferido no banco real: 2 reservas ativas, 2 anonimizadas com `NULL`, 2 eventos históricos, índices parciais, triggers e job LGPD novo; teste ponta a ponta revertido por rollback sem deixar dados. O histórico (`supabase_migrations.schema_migrations`) foi alinhado aos arquivos do repositório: as 5 versões aplicadas pelo painel foram renomeadas para as versões dos arquivos e as 7 migrations antigas, feitas à mão, foram registradas como aplicadas (equivale a `supabase migration repair --status applied`). Com isso há 12 registros no banco e 12 arquivos no repositório depois do merge dos PRs #4 e #5, e `supabase db push` não deve tentar reaplicar nada. Correção de `search_path` virou o arquivo `20261108130000_fix_function_search_path.sql`.
- **Pendências:** Publicar o código (PRs #4 e #5) com `SESSION_SECRET` na Vercel; Fase 3 (camada Power BI); decidir se `notes` entra na anonimização.
- **Referências:** `REVISAO_TECNICA.md` (F2, F3, F6, F13), `ROADMAP_CORRECOES.md`.

### 2026-11-08 — Fase 1 do roadmap: segurança da recepção

- **Status:** Concluído (PR #4 mergeado em 08/11/2026; migration `login_attempts` aplicada; `SESSION_SECRET` cadastrada na Vercel; falta confirmar o login no site no ar)
- **Área:** Autenticação, banco de dados e middleware
- **Pedido:** Executar a Fase 1 do `ROADMAP_CORRECOES.md` (itens 1.1, 1.2 e 1.3).
- **Por que foi pedido:** A revisão técnica (F1, F4, F10, F11) mostrou que qualquer pessoa obtinha acesso à recepção.
- **Problema observado:** O cookie `reception_auth=1` não tinha assinatura nem validade no servidor; o login não limitava tentativas; o middleware podia ficar preso na consulta ao Supabase.
- **Causa:** A autorização era `cookie === "1"`; sem rate limit; `fetch` sem timeout.
- **Decisão:** (1.1) Cookie `<expiraEmMs>.<HMAC-SHA256>` validado com `timingSafeEqual` e expiração conferida no servidor (12h). Exige `SESSION_SECRET` com 32+ caracteres; sem ele, o login é recusado. (1.2) Tabela `login_attempts` com hash HMAC do IP (sem IP em texto puro); 5 falhas em 15 minutos bloqueiam, inclusive com a senha certa; senha correta zera as falhas; registros com mais de 1 dia são apagados. Se o banco não responder, o login falha fechado. (1.3) `AbortSignal.timeout(5000)` no middleware; estouro = token não validado. Senha comparada em tempo constante.
- **O que foi feito:** `src/lib/reception-session.ts`, `src/lib/login-rate-limit.ts`, `src/lib/reception-auth.ts`, `loginReception`/`logoutReception` em `src/app/actions/reservations.ts`, `src/middleware.ts`, migration `20261108000000_login_attempts.sql` (e `setup_supabase_cloud.sql`), `.env.template`.
- **Resultado:** `reception_auth=1` passa a ser rejeitado; a 6ª tentativa errada em 15 min é bloqueada com mensagem clara.
- **Validação:** 88 testes unitários (15 novos: assinatura, adulteração, expiração, segredo fraco, rate limit e ação de login), ESLint, `tsc` e `next build` aprovados. Migration e login real não testados contra um Supabase.
- **Impactos e riscos:** Ao publicar, todas as sessões atuais da recepção caem e será preciso entrar de novo. O limite é por IP: atrás de NAT compartilhado (rede do hotel), 5 erros bloqueiam todos os dispositivos da rede por 15 min; trocar de IP contorna o limite por origem. Não há limite global.
- **Não fazer / evitar regressão:** Não voltar a aceitar valor fixo no cookie; não gravar IP em texto puro; não usar `SESSION_SECRET` curto; não desativar a falha fechada do rate limit.
- **Ordem de publicação:** 1) cadastrar `SESSION_SECRET` na Vercel (`openssl rand -hex 32`); 2) aplicar a migration no Supabase; 3) publicar o código. Publicar o código antes da migration trava o login.
- **Pendências:** Itens acima; Fase 2 (soft delete).
- **Referências:** `REVISAO_TECNICA.md` §1.1–1.4, `ROADMAP_CORRECOES.md`.

### 2026-11-08 — README alinhado ao estado real do projeto

- **Status:** Concluído
- **Área:** Documentação
- **Pedido:** Ler o projeto e atualizá-lo no GitHub.
- **Problema observado:** O README prometia itens inexistentes: autenticação Firebase, 6+ tabelas, quatro views de analytics (`v_daily_occupancy` etc.), notificações WhatsApp automáticas, "40+ testes" e CI/CD como pendência. Também apontava para `ia.navegacao.md` (o arquivo real é `ia.navegation.md`) e não citava a falha de segurança do cookie da recepção.
- **Causa:** Texto escrito antes da implementação e não revisado depois.
- **Decisão:** Documentar apenas o que existe no código e remeter o restante ao `ROADMAP_CORRECOES.md`. Nenhuma mudança de código. Antes do merge, o README foi atualizado de novo para refletir as Fases 1 e 2 já mergeadas (segurança da recepção, 4 tabelas, 95 testes, cancelamento sem apagar).
- **O que foi feito:** Reescritas as seções de funcionalidades, stack, dados & análise, segurança, documentação e próximos passos do `README.md`.
- **Validação:** 73 testes unitários, ESLint e `tsc --noEmit` aprovados antes da edição; testes de integração e E2E não executados (dependem de Supabase/navegador).
- **Impactos e riscos:** Nenhum em runtime. O README agora declara como pendentes as falhas F1–F3 da revisão técnica; continuam sem correção.
- **Pendências:** Executar a Fase 1 do `ROADMAP_CORRECOES.md` (cookie assinado e rate limit no login).
- **Referências:** `README.md`, `REVISAO_TECNICA.md`, `ROADMAP_CORRECOES.md`.

### 2026-09-30 — Texto dos horários da piscina

- **Status:** Concluído (publicação pendente)
- **Pedido:** Substituir a orientação por “09h–13h Uso compartilhado” e “13h–01h Exclusivo — Toque para reservar.”, em duas linhas e com alinhamento justificado.
- **Decisão e execução:** Removida a expressão “(sem reserva)”, incluída quebra de linha preservada por whitespace-pre-line e text-justify apenas para a piscina. Horários e regras de reserva permanecem iguais.
- **Validação:** ESLint do componente e TypeScript aprovados.
- **Pendências:** Integrar o PR #1 e publicar na Vercel.
- **Referência:** src/components/guest-booking.tsx.

### 2026-09-30 — Telefones válidos e tela exclusiva para hóspedes

- **Status:** Concluído (implementação local; publicação pendente)
- **Área:** Reservas, WhatsApp e navegação do hóspede
- **Pedido:** Recusar telefones fora do formato correto; aceitar brasileiros com DDD e internacionais com código do país; retirar o link “Área da recepção” da tela compartilhada com hóspedes. Revisar com subagente.
- **Por que foi pedido:** Evitar contatos inválidos e mostrar ao hóspede apenas opções de agendamento.
- **Problema observado:** Cadastro e edição aceitavam quaisquer 10–13 dígitos após remover caracteres, inclusive letras e DDDs inválidos. A home exibia o acesso à recepção.
- **Causa:** Validação por comprimento duplicada em cliente/servidor e link administrativo na home pública.
- **Decisão:** Validar com libphonenumber-js/max e regra compartilhada: brasileiro com DDD; internacional com + e código de país. Armazenar novos telefones em E.164, preservando interpretação de registros antigos compatíveis. Manter telefone opcional na recepção e obrigatório para hóspedes.
- **O que foi feito:** Validação na identificação do hóspede, criação na recepção, edição na grade e Server Actions. Exemplos nos campos, formatação de exibição e links WhatsApp com país correto. Removido link da recepção da home.
- **Resultado:** Entradas inválidas são recusadas antes da gravação; hóspedes não veem o atalho à recepção.
- **Validação:** 70 testes unitários aprovados, incluindo validação servidor sem gravação real; lint, TypeScript e build aprovados. Subagente revisou as duas mudanças sem achados impeditivos.
- **Impactos e riscos:** Validação de plano/formato não comprova existência do número ou conta WhatsApp. Telefones internacionais antigos de 10/11 dígitos sem + são ambíguos e devem ser corrigidos manualmente. Nenhum dado existente foi regravado.
- **Não fazer / evitar regressão:** Não remover letras para tornar entrada inválida válida; não prefixar 55 em números internacionais novos; não usar produção para testes de escrita.
- **Tentativas que falharam:** Clone inicial bloqueado pela rede e depois pelo Schannel; resolvido com permissão de rede e backend OpenSSL. Vitest/esbuild padrão bloqueado ao ler diretório ancestral no sandbox; executado com configuração temporária equivalente e configLoader runner.
- **Pendências:** Integrar a alteração e verificar publicação na Vercel.
- **Referências:** src/lib/phone.ts, src/lib/booking-zod.ts, src/app/actions/reservations.ts, src/app/page.tsx.

### 2026-08-10 — Keep-alive do Supabase duas vezes ao dia

- **Status:** Concluído
- **Área:** Supabase, GitHub Actions e disponibilidade
- **Pedido:** Implementar duas consultas diárias ao Supabase com intervalo de 12 horas para gerar atividade de banco no projeto do plano Free.
- **Por que foi pedido:** Reduzir o risco de pausa automática por baixa atividade durante períodos sem reservas ou acessos reais.
- **Problema observado:** Não existia automação externa de keep-alive; o único `pg_cron` remoto cuida da anonimização LGPD e não representa atividade da aplicação.
- **Causa:** Ausência de workflow agendado, monitor externo ou Vercel Cron no projeto.
- **Decisão:** Usar GitHub Actions para executar uma consulta REST mínima e somente de leitura em `reservations`, às 00:17 e 12:17 UTC. O minuto 17 evita o pico de execuções no início da hora. Manter URL e chave de serviço exclusivamente em GitHub Actions Secrets.
- **O que foi feito:** Criado `.github/workflows/supabase-keepalive.yml` com agendamento, execução manual, permissões mínimas, validação de configuração, timeout e `SELECT id LIMIT 1`. Acrescentadas ao README as instruções de configuração e teste.
- **Resultado:** O repositório possui automação preparada para gerar duas consultas reais ao banco por dia, sem criar ou modificar dados.
- **Validação:** Workflow revisado quanto a cron, leitura somente, falha HTTP, ausência de segredos e saída sem conteúdo da consulta. Ativação remota ainda depende de publicar o arquivo na branch padrão e cadastrar os Secrets.
- **Impactos e riscos:** GitHub pode atrasar execuções agendadas e desativa workflows agendados em repositórios públicos sem atividade por 60 dias. O Supabase não garante que keep-alive impeça pausa no plano Free; disponibilidade garantida exige plano pago.
- **Não fazer / evitar regressão:** Não gravar as credenciais no YAML; não imprimir cabeçalhos ou resposta; não substituir a leitura por inserções fictícias; não renomear os Secrets sem atualizar workflow e documentação.
- **Pendências:** Cadastrar `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` nos Actions Secrets, publicar na branch padrão e executar manualmente uma vez para verificar o resultado remoto.
- **Referências:** `.github/workflows/supabase-keepalive.yml`, `README.md`, documentação de Project Pausing do Supabase e de eventos agendados do GitHub Actions.

### 2026-08-10 — Verificação de bot para impedir pausa do Supabase

- **Status:** Concluído
- **Área:** Supabase, disponibilidade e automação
- **Pedido:** Verificar se existe um bot que simula interação com o sistema para evitar que o projeto Supabase seja pausado por inatividade.
- **Por que foi pedido:** O projeto usa o plano gratuito do Supabase, sujeito a pausa quando apresenta pouca atividade durante sete dias.
- **Problema observado:** Uma pausa automática deixaria consultas e reservas indisponíveis até o projeto ser restaurado.
- **Causa:** Não existe no repositório GitHub Action, Vercel Cron, script de keep-alive, endpoint de monitoramento ou Edge Function com essa finalidade. No projeto Supabase conectado existe apenas o job interno de anonimização LGPD.
- **Decisão:** Nenhum bot de keep-alive está configurado atualmente. Para gerar atividade reconhecível, a interação deve provocar uma consulta real de usuário ao banco por meio da API ou aplicação, como um `SELECT` mínimo; carregar somente uma página estática não é suficiente. A documentação informa que algumas requisições ao banco por dia ao longo da semana normalmente evitam a pausa, sem publicar quantidade garantida. Não considerar o cron interno de LGPD como garantia contra pausa; o único meio garantido de eliminar a pausa automática é usar um plano pago.
- **O que foi feito:** Pesquisados arquivos e configurações locais; consultados o projeto e a organização no Supabase; listados os jobs de `cron.job`; verificados os logs recentes da API; consultada a política oficial de pausa.
- **Resultado:** Projeto `valle-dincanto-piscina` encontrado como `ACTIVE_HEALTHY`, na organização de plano `free`. Único job ativo: `lgpd_anonymize_reservations`, diariamente às `03:00` UTC. Nenhuma atividade apareceu nos logs de API das últimas 24 horas no momento da consulta.
- **Validação:** Confirmada ausência de `.github/`, `vercel.json`, funções Supabase e scripts de keep-alive no repositório. Confirmado o estado remoto por consultas somente leitura ao Supabase.
- **Impactos e riscos:** O Supabase informa que poucas consultas de usuário por dia normalmente evitam a pausa, mas não publica um limite exato e não oferece garantia no plano Free. Um ping automatizado reduz o risco, porém não equivale à garantia de disponibilidade de um plano de produção.
- **Não fazer / evitar regressão:** Não expor `SUPABASE_SERVICE_ROLE_KEY` em workflow, URL pública, código cliente ou logs; não realizar escrita fictícia nem criar dados falsos para manter o projeto ativo; não depender apenas do cron interno do banco como mecanismo de disponibilidade.
- **Pendências:** Decidir entre configurar um monitor externo com consulta segura e mínima ou migrar para o plano Pro para impedir pausa por inatividade de forma garantida.
- **Referências:** `supabase/migrations/20260416120000_lgpd_reservations_anonymize_cron.sql`, documentação oficial “Project Pausing” do Supabase.

### 2026-08-10 — Comportamento atual durante queda da internet do hotel

- **Status:** Decisão
- **Área:** Operação, conectividade e continuidade
- **Pedido:** Explicar o que acontece atualmente se a conexão de internet do hotel cair.
- **Por que foi pedido:** Avaliar o risco operacional da arquitetura web antes de decidir entre aplicação web, PWA ou programa instalado.
- **Problema observado:** A recepção depende da internet para acessar a aplicação hospedada e executar todas as operações de reserva.
- **Causa:** O sistema não possui service worker, manifesto PWA, armazenamento offline nem fila de sincronização. As consultas e alterações dependem das Server Actions do Next.js hospedado e do Supabase na nuvem.
- **Decisão:** Considerar o sistema atual como exclusivamente online. Uma reserva só é válida quando confirmada pelo servidor e gravada no banco central; nenhuma operação offline deve ser tratada como concluída.
- **O que foi feito:** Inspecionados o painel da recepção, o fluxo de reserva do hóspede, as Server Actions e os arquivos públicos. Confirmado que existem mensagens de falha de rede, mas não existe funcionamento offline.
- **Resultado:** Se apenas a internet do hotel cair, o computador da recepção deixa de carregar, atualizar, criar, editar ou cancelar reservas e não consegue gerar novos links. Hóspedes conectados à mesma rede Wi-Fi também perdem o acesso; hóspedes usando 4G/5G ou outra conexão continuam usando o sistema hospedado normalmente. Dados já gravados permanecem seguros no Supabase.
- **Validação:** Revisados `src/app/recepcao/reception-dashboard.tsx`, `src/components/guest-booking.tsx`, `src/app/actions/reservations.ts`, `src/middleware.ts`, `public/`, `next.config.ts` e `package.json`.
- **Impactos e riscos:** Uma tela já aberta pode continuar mostrando a última grade carregada, mas ela fica desatualizada e não deve orientar novas reservas. Tentativas sem conexão exibem erro e não são enfileiradas para envio posterior. Recarregar ou abrir uma página nova pode mostrar o erro offline do navegador.
- **Não fazer / evitar regressão:** Não anotar uma tentativa offline como reserva confirmada; não confiar na última grade visível durante a queda; não criar uma fila automática de reservas offline sem tratamento explícito de conflitos no servidor.
- **Pendências:** Definir procedimento manual de contingência e avaliar indicação visual de estado offline, modo somente leitura com data da última atualização e reconciliação controlada após o retorno da conexão.
- **Referências:** `src/app/recepcao/reception-dashboard.tsx`, `src/components/guest-booking.tsx`, `src/app/actions/reservations.ts`, `src/middleware.ts`.

### 2026-08-10 — Avaliação de aplicativo executável para a recepção

- **Status:** Pedido
- **Área:** Arquitetura, implantação, banco de dados e acesso
- **Pedido:** Avaliar a transformação do sistema de reservas em programa executável instalado no computador do hotel e explicar como funcionariam a integração com o banco de dados e o acesso dos hóspedes.
- **Por que foi pedido:** Entender se um programa instalado seria mais adequado para a operação da recepção do que o site atual.
- **Problema observado:** A aplicação web pode ser percebida como menos integrada ao computador do hotel, mas os hóspedes ainda precisam acessar o serviço remotamente por celular.
- **Causa:** Necessidade de conciliar uma experiência semelhante à de um programa na recepção com acesso público, atualização centralizada e banco de dados compartilhado.
- **Decisão:** Recomendação pendente de confirmação: manter Next.js e Supabase hospedados e adicionar suporte a PWA para instalação no Windows. Não converter todo o sistema em aplicativo desktop nem hospedar o servidor exclusivamente no PC do hotel. Um empacotador desktop só deve ser considerado futuramente se houver necessidade comprovada de integração nativa com hardware ou sistema operacional.
- **O que foi feito:** Arquitetura atual inspecionada. Confirmado que Server Actions e middleware acessam o Supabase com `SUPABASE_SERVICE_ROLE_KEY` no servidor; essa chave não pode ser incluída em um executável ou cliente público. Identificado também que a autenticação da recepção usa atualmente um cookie de valor fixo e deve ser fortalecida antes de ampliar o uso.
- **Resultado:** Definido um caminho recomendado em que recepção e hóspedes usam a mesma aplicação hospedada e o mesmo banco central, enquanto a recepção pode instalar a PWA com ícone e janela própria.
- **Validação:** Revisados `package.json`, `next.config.ts`, `src/lib/supabase/admin.ts`, `src/lib/reception-auth.ts`, `src/middleware.ts` e as Server Actions de reservas. Consultadas as documentações atuais do Next.js, Supabase e PWA.
- **Impactos e riscos:** Hospedar o sistema somente no PC do hotel criaria dependência de energia, internet, firewall, IP/domínio, certificados, backups e manutenção local. Distribuir a chave de serviço no executável permitiria extração do segredo e acesso privilegiado ao banco. A PWA ainda depende da hospedagem e da internet para operações que não tiverem modo offline implementado.
- **Não fazer / evitar regressão:** Não colocar `SUPABASE_SERVICE_ROLE_KEY` em código cliente, PWA ou executável distribuído; não expor diretamente à internet um servidor Next.js executado no PC da recepção; não manter duas bases independentes sem estratégia explícita de sincronização; não tratar cache offline como confirmação de reserva sem validação central de concorrência.
- **Pendências:** Responsável confirmar a arquitetura PWA; corrigir a autenticação da recepção; definir comportamento durante indisponibilidade da internet; implementar manifesto, ícones, service worker e fluxo de instalação; testar no Windows/Edge do hotel.
- **Referências:** `src/lib/supabase/admin.ts`, `src/lib/reception-auth.ts`, `src/middleware.ts`, `src/app/actions/reservations.ts`, `next.config.ts`.

### 2026-08-06 — Criação da memória histórica do produto

- **Status:** Concluído
- **Área:** Documentação e processo de desenvolvimento
- **Pedido:** Criar um arquivo chamado `productlog` que registre tudo o que for feito, incluindo erros, pedidos, motivações, problemas causados ou resolvidos e as alterações realizadas.
- **Por que foi pedido:** Permitir que qualquer IA ou pessoa desenvolvedora compreenda o histórico do produto, preserve decisões anteriores e evite regressões ou repetição de erros em solicitações futuras.
- **Problema observado:** O projeto não possuía uma memória central e padronizada das mudanças e das razões por trás delas. Um novo pedido poderia contradizer uma decisão anterior sem que o conflito fosse percebido.
- **Causa:** Informações históricas estavam ausentes ou distribuídas entre código, documentos e conversas, sem um protocolo único de consulta e atualização.
- **Decisão:** Adotar `productlog.md` como registro cronológico central. Pedidos novos podem substituir decisões antigas, mas o conflito, a justificativa e o impacto devem ser explicitamente registrados.
- **O que foi feito:** Criado este arquivo com regras de uso, estados padronizados, um modelo completo de entrada e o histórico ordenado do mais recente para o mais antigo.
- **Resultado:** O repositório passa a ter um local único para preservar contexto técnico e de produto.
- **Validação:** Estrutura revisada para contemplar pedido, motivação, problema, causa, decisão, execução, resultado, testes, riscos, prevenção de regressão, pendências e referências.
- **Impactos e riscos:** O registro só será confiável se for atualizado junto com cada alteração relevante. Entradas vagas, desatualizadas ou com dados sensíveis reduzem seu valor e podem causar decisões incorretas.
- **Não fazer / evitar regressão:** Não apagar decisões antigas para esconder conflitos; não registrar apenas "o que" mudou sem explicar "por quê"; não inserir segredos ou dados pessoais; não tratar uma decisão histórica como imutável quando uma nova decisão explícita a substituir.
- **Pendências:** Manter este arquivo atualizado em toda mudança futura relevante.
- **Referências:** `productlog.md`.
