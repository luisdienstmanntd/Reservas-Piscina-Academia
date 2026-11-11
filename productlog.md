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

### 2026-11-11 — Piscina: planilha da recepção só com 09h no período compartilhado

- **Status:** Concluído (PR em rascunho; sem deploy ainda)
- **Área:** Reservas (recepção)
- **Pedido:** As linhas 10h, 11h e 12h não precisam aparecer na planilha da piscina; a recepção pode reservar manualmente às 09h. Ficará: 09h, 13h, 14h … 00h.
- **Decisão:** Isto substitui a decisão anterior (09h–12h como quatro horários de início): `POOL_SHARED_SLOT_STARTS` passa a ser só `09:00:00` (o período compartilhado 09h–13h vira um único horário). 10h/11h/12h passam a ser recusados também para a recepção. O CHECK do banco (`reservations_slot_valid`, piscina ≥ 09:00) não foi alterado: é mais largo que o app e inofensivo; nenhuma migration.
- **O que foi feito:** `src/lib/reservations.ts` (lista e comentários), comentários em `reservations.ts` (actions), `reservation-slot-validation.ts` e `reception-dashboard.tsx`; testes ajustados (planilha com 13 linhas; 10h–12h inválidos para a recepção); `ia.navegation.md` e `docs/POWERBI.md`.
- **Validação:** tsc, ESLint, 176 testes; consulta somente leitura em produção: nenhuma reserva em 10h–12h (nada some da planilha).
- **Não fazer / evitar regressão:** Não reintroduzir 10h–12h na planilha; o texto da home do hóspede ("09h–13h Uso compartilhado") continua correto.
- **Pendências:** nenhuma.
- **Referências:** `src/lib/reservations.ts`, `src/lib/reservation-slot-validation.ts`.

### 2026-11-11 — Recepção: ícone de origem da reserva no lugar do selo "Hóspede"

- **Status:** Concluído (PR em rascunho; verificado em navegador, desktop e celular)
- **Área:** Recepção (coluna Apto da planilha)
- **Pedido:** Em vez do selo "Hóspede", mostrar um ícone minimalista de celular antes do número do apartamento quando a reserva for do hóspede; quando for da recepção, um ícone de recepção.
- **O que foi feito:** `src/app/recepcao/reception-dashboard.tsx`: selo (`Badge`) removido; `Smartphone` (hóspede) e `ConciergeBell` (recepção), do lucide, antes do número, com `aria-label` ("Reserva feita pelo hóspede" / "Reserva feita pela recepção") para leitores de tela.
- **Validação:** tsc, ESLint e 175 testes; em navegador, reserva do hóspede mostra o celular e a da recepção o sino de recepção, sem o texto do selo.
- **Não fazer / evitar regressão:** Não voltar a mostrar texto de origem nessa coluna; manter o `aria-label`.

### 2026-11-11 — Recepção: "Som ligado" na mesma linha de Piscina/Academia

- **Status:** Concluído (PR em rascunho; verificado em navegador, desktop e celular)
- **Área:** Recepção (cabeçalho)
- **Pedido:** O botão "Som ligado" deve ficar na mesma linha dos botões Piscina/Academia.
- **O que foi feito:** `SoundToggleButton` (novo, em `new-reservation-alerts.tsx`) colocado à direita da linha das abas em `reception-dashboard.tsx`; o cabeçalho passou a ter uma linha com logo/título/Sair e outra com abas + som. O banner de alertas deixou de ter a linha do botão (o aviso "navegador bloqueou o som" continua nele).
- **Validação:** tsc, ESLint e testes; em navegador, centros verticais de Piscina e Som iguais (desktop 1400px e celular 390px), alinhado à direita com o Sair no desktop.
- **Não fazer / evitar regressão:** Não recolocar o botão de som dentro do banner de alertas.
- **Pendências:** nenhuma.
- **Referências:** `src/app/recepcao/reception-dashboard.tsx`, `src/app/recepcao/new-reservation-alerts.tsx`.

### 2026-11-11 — Recepção: removido o texto do cartão "Gerar acesso hóspede"

- **Status:** Concluído (PR em rascunho)
- **Área:** Recepção
- **Pedido:** Na tela inicial, em "Gerar acesso hóspede", não mostrar o texto "Link com token de estadia para agendar piscina ou academia no telemóvel do hóspede."
- **O que foi feito:** removido o `CardDescription` desse cartão em `src/app/recepcao/reception-dashboard.tsx`; título, formulário e geração do link não mudaram.
- **Validação:** tsc e ESLint sem erros; o texto não existe em mais nenhum lugar do código.
- **Pendências:** nenhuma.
- **Referências:** `src/app/recepcao/reception-dashboard.tsx`.

### 2026-11-11 — Documentação: `ia.navegation.md` atualizado após a revisão geral

- **Status:** Concluído (PR #27 mergeado)
- **Área:** Documentação
- **Pedido:** Revisar as tarefas feitas e verificar conflitos/regressões.
- **Problema observado:** Na revisão (tsc, ESLint, 175 testes, build, migrations repo = produção, e2e, concorrência, logs) não houve regressão de código; só o `ia.navegation.md` estava desatualizado.
- **O que foi feito:** `ia.navegation.md` §3.2 (horários compartilhados 09h–12h só pela recepção, `receptionSlotStartsFor`, ordem da academia), §3.4 (indisponível em cinza sem texto para o hóspede), §3.6 (botões só ícone, planilha de uma linha por hora, "Suas reservas", contato lembrado, troca de horário) e §3.7 (exclusivo 13h–01h só para hóspede).
- **Validação:** só documentação; nomes conferidos contra o código.
- **Pendências:** PR #21 (`asGuest`) aguarda decisão (o #26, sino sem borda, foi mergeado); limpeza dos dados de teste e rotação da chave exposta dependem do usuário.
- **Referências:** `ia.navegation.md`.

### 2026-11-11 — Recepção: sino do aviso sem borda (ajuste)

- **Status:** Concluído (PR em rascunho; verificado em navegador com os quatro estados)
- **Área:** Recepção
- **Pedido:** O sino deve aparecer sem borda, como os outros ícones (o "certo" da confirmação e a lixeira).
- **Decisão:** O botão do aviso passa a ser sem borda e sem fundo. Estados: normal = sino preto; hora de avisar (10 min antes do fim) = sino laranja piscando (antes era um botão laranja cheio com borda); enviado = sino cinza desabilitado com o selo verde pequeno; sem WhatsApp = sino cinza desabilitado.
- **O que foi feito:** `src/components/reception-wa-actions.tsx` (variante sem borda e sem fundo no botão do aviso).
- **Validação:** tsc e ESLint; em navegador, nos quatro estados, nenhum botão tem borda.
- **Não fazer / evitar regressão:** Não voltar a pôr borda ou fundo nos ícones da coluna de mensagens; manter o laranja piscando do aviso pendente.
- **Pendências:** nenhuma.
- **Referências:** `src/components/reception-wa-actions.tsx`, PR #25.

### 2026-11-11 — Recepção: botões de confirmação e aviso só com ícone

- **Status:** Concluído (PR em rascunho; verificado em navegador com os quatro estados; falta conferir no site publicado)
- **Área:** Recepção (coluna de mensagens da planilha)
- **Pedido:** O aviso deve mostrar só o ícone do sino, sem texto. A confirmação deve mostrar somente os ícones enviados no pedido (círculo verde com o "certo": contorno e cheio), sem texto.
- **Decisão:** Confirmação ainda não enviada = círculo verde só com o contorno e o "certo"; enviada = círculo verde cheio com o "certo" branco; sem WhatsApp = a versão de contorno em cinza, desabilitada. Aviso = só o sino; no horário de avisar (10 min antes do fim) o sino fica laranja piscando, como o botão já ficava; depois de enviado, o sino fica cinza desabilitado com um pequeno "certo" verde no canto (esse selo é um acréscimo meu para o estado "enviado" não ficar igual ao "não enviado" sem texto). Sem texto visível; o texto continua só como `aria-label` e dica ao passar o mouse, por acessibilidade.
- **O que foi feito:** `src/components/reception-wa-actions.tsx`: ícones SVG próprios (`ConfirmPendingIcon`, `ConfirmDoneIcon`), botões quadrados só com ícone; o comportamento de enviar não mudou.
- **Validação:** tsc e ESLint; em navegador com quatro reservas (nenhuma enviada, só confirmação enviada, as duas enviadas, sem WhatsApp): nenhum dos textos "Confirmação", "OK conf.", "Aviso", "OK aviso" ou "Aviso pendente" aparece e os rótulos de acessibilidade mudam por estado.
- **Não fazer / evitar regressão:** Não voltar a mostrar texto nesses botões; manter o laranja piscando do aviso pendente (é o alerta para a recepção).
- **Pendências:** nenhuma.
- **Referências:** `src/components/reception-wa-actions.tsx`.

### 2026-11-11 — Piscina: recepção pode reservar o uso compartilhado (09h às 12h)

- **Status:** Concluído (PR #24 mergeado; migration `20261111100000_pool_shared_slots.sql` aplicada em produção em 11/11/2026 antes do merge)
- **Área:** Reservas (recepção), banco de dados
- **Pedido:** Na piscina, 09h às 12h é de uso compartilhado e não precisa de reserva, mas a recepção pode registrar reserva manualmente nesses horários.
- **Decisão:** "09h às 12h" foi lido como a lista de horas de início 09h, 10h, 11h e 12h (o mesmo texto da página inicial: "09h–13h uso compartilhado"). O HÓSPEDE continua sem poder reservar esses horários (a regra fica no servidor: `validateStayAndSlot` só aceita `receptionSlotStartsFor` quando chamado pela recepção). A planilha e o formulário "Nova reserva" da recepção passam a incluir 09h–12h: piscina com 16 linhas (09h00 a 00h00). O padrão do formulário continua sendo o primeiro horário normal (13h00). O limite de 1 reserva por apartamento por dia continua valendo para todos os horários. Reserva manual nesses horários aparece ao hóspede em "Suas reservas" e ele pode trocá-la por um horário normal.
- **O que foi feito:** `POOL_SHARED_SLOT_STARTS` e `receptionSlotStartsFor` em `src/lib/reservations.ts`; parâmetro `forReception` em `validateStayAndSlot`; `createReceptionReservation` o usa; `reception-dashboard.tsx` usa a lista da recepção na planilha e no formulário; migration `20261111100000_pool_shared_slots.sql` amplia a regra do banco (`reservations_slot_valid`) para aceitar piscina a partir de 09h (só amplia: nenhuma reserva existente fica inválida); nota no `docs/POWERBI.md` (essas reservas não entram na capacidade de 12 horários).
- **Validação:** 175 testes, tsc e ESLint. Em navegador com PostgreSQL real (18 migrations): a planilha da piscina tem 16 linhas; a recepção registra uma reserva às 10h pelo formulário e ela aparece na linha 10h00 e no banco (`10:00:00`, criada pela recepção); o hóspede continua vendo só 13h00 a 00h00.
- **Impactos e riscos:** A migration já está aplicada em produção (conferido: a regra do banco aceita piscina a partir das 09h; as 20 reservas existentes seguem intactas; histórico de migrations alinhado com a versão do arquivo). A rotina de anonimização, as views do Power BI e os avisos de novas reservas não precisam de mudança.
- **Não fazer / evitar regressão:** Não liberar 09h–12h para o hóspede; não remover o limite de 1 reserva por dia; não aceitar horário quebrado (minutos) nem antes das 09h.
- **Pendências:** Conferir no site publicado: a recepção reserva um horário de 09h a 12h na piscina e o hóspede não vê esses horários.
- **Referências:** `supabase/migrations/20261111100000_pool_shared_slots.sql`, `src/lib/reservations.ts`, `src/lib/reservation-slot-validation.ts`.

### 2026-11-11 — Tela da recepção mais limpa e planilha completa, uma linha por hora

- **Status:** Concluído (PR em rascunho; verificado em navegador contra PostgreSQL local; falta conferir no site publicado)
- **Área:** Recepção
- **Pedido:** (A) Não mostrar: (1) "Novas reservas verificadas às … (a cada 10 s)"; (2) o botão "Atualizar"; (3) "Horários em cinza estão indisponíveis (ocupados ou já passaram)."; (4) "Preencha para ativar os botões de confirmação e aviso (10 min) na coluna whatsapp da grade."; (5) "Brasil: (54) 99999-9999. Exterior: + código do país e número." (campo WhatsApp da Nova reserva); (6) "Já passou · N horários"; (7) "Livre · N horários". (B) A recepção precisa ver a tabela completa de horários, do primeiro ao último, para controle: uma linha por hora, uma abaixo da outra, no formato "21h00" (e não "21h00 – 22h00"). Piscina de hora em hora; academia 24 h, de 01h até 00h.
- **Decisão:** Os grupos "Já passou · N" e "Livre · N" saem, mas a planilha passa a mostrar TODOS os horários do dia, cada um na sua linha: com reserva, a linha completa de sempre (apto, hóspede, observações, WhatsApp, mensagens, cancelar); sem reserva, só a hora, numa linha compacta (as que já passaram ficam em cinza claro, sem texto). O rótulo é só o início da hora ("21h00"). Piscina: 13h00 a 00h00 (12 linhas, os horários reserváveis). Academia: 24 linhas, de 01h00 a 00h00 (a meia-noite passa a ser a última). Sem o botão "Atualizar", a grade continua atualizando sozinha (carrega ao abrir, ao trocar a data ou a instalação, depois de cada ação e a cada 30 s). Foi removido só o TEXTO do status das novas reservas: o aviso de conexão ("Sem conexão com o sistema"), o banner de novas reservas, o som e o botão "Som ligado" continuam. A dica de telefone da tela do HÓSPEDE não mudou (o pedido era da recepção); o tooltip do campo WhatsApp na grade também ficou.
- **O que foi feito:** `src/app/recepcao/reception-dashboard.tsx` (botão e textos de ajuda removidos; linha por hora com `EmptySlotRow`; rótulo só com o início), `src/app/recepcao/new-reservation-alerts.tsx` (texto de status removido), `src/lib/reservation-grid.ts` (`receptionSlotOrder`, `slotStartLabel`; os agrupamentos antigos foram removidos).
- **Validação:** testes, tsc e ESLint; em navegador: os oito textos não aparecem; piscina com 12 linhas (13h00 a 00h00); academia com 24 linhas (primeira 01h00, última 00h00, sem repetir nem faltar hora); nenhum rótulo com faixa "–"; editar o nome numa linha reservada continua salvando; no celular não há rolagem lateral; a grade atualiza ao trocar a data.
- **Impactos e riscos:** A academia, com 24 linhas, deixa a página mais comprida (as linhas vazias são compactas). O formulário "Nova reserva" e a tela do hóspede mantêm os rótulos em faixa ("21h00 – 22h00") e a ordem de antes. A piscina só tem horários reserváveis de 13h a 00h (regra do banco); as 10h–13h, de uso compartilhado, não aparecem como linhas. Se o hotel quiser reservar a partir das 10h, é uma mudança de regra (e de banco) à parte.
- **Não fazer / evitar regressão:** Não remover o aviso de queda de conexão nem o banner de novas reservas.
- **Pendências:** nenhuma.
- **Referências:** `src/app/recepcao/reception-dashboard.tsx`, PR #10.

### 2026-11-10 — Troca de horário: o botão "Alterar" não fazia nada (correção)

- **Status:** Concluído (PR em rascunho; verificado em navegador com toque, contra PostgreSQL local; falta conferir no site publicado)
- **Área:** Reservas (hóspede)
- **Pedido:** Depois do PR #19, o diálogo "Deseja alterar a reserva para …?" passou a aparecer, mas ao clicar em "Alterar" nada acontecia.
- **Problema observado:** Pelos logs do Supabase de produção (18:06–18:07 UTC, apto 208): o diálogo veio do caminho novo do servidor (3 tentativas de criar reserva, cada uma seguida da busca da reserva própria) e depois do "Alterar" nenhuma troca chegou ao banco (nenhum PATCH, nenhuma busca de troca).
- **Causa:** `confirmChange` exigia o horário atual guardado na tela (`ownSlot`) e desistia em silêncio sem ele. Logo depois de o diálogo abrir, a tela refaz a consulta do dia e essa consulta zerou `ownSlot` (a consulta de produção não trouxe o horário próprio). Por que a consulta do dia não trazia o horário próprio em produção continua sem explicação confirmada.
- **Decisão:** A troca não depende do estado da tela: o diálogo guarda o horário novo e o atual (para o texto) em `pendingChange`, e "Alterar" chama o servidor só com o horário novo. O servidor localiza e confere a reserva atual (mesmo apartamento, instalação e dia; deste link ou da recepção; que não tenha passado) e faz o UPDATE.
- **O que foi feito:** `src/components/guest-booking.tsx` (`pendingChange` com `slot` e `from`; `confirmChange` sem exigir `ownSlot`).
- **Validação:** tsc e ESLint; em navegador com toque (iPhone emulado): reservar, voltar, tocar em outro horário, aguardar, "Alterar" → horário trocado e "Reserva alterada!"; e o cenário de tela desatualizada. Logs de produção usados para o diagnóstico.
- **Não fazer / evitar regressão:** Nunca fazer um botão de confirmação desistir em silêncio: ou chama o servidor, ou mostra um aviso. Não exigir da tela dados que o servidor já valida.
- **Pendências:** Conferir em produção; investigar por que a consulta do dia (`getReservationDaySummary`) não devolveu `ownSlot` ao hóspede em produção (a tela continua sem o aviso "Você já tem reserva neste dia" nesse caso, embora a troca funcione).
- **Referências:** PR #18, PR #19, `src/components/guest-booking.tsx`.

### 2026-11-10 — Troca de horário: o servidor passa a oferecer a troca (correção)

- **Status:** Concluído (PR em rascunho; verificado em navegador real contra PostgreSQL local; falta conferir no site publicado)
- **Área:** Reservas (hóspede)
- **Pedido:** Depois do PR #18, o responsável testou em produção: com reserva às 14h, ao tocar em outro horário livre apareceu o aviso "Limite diário atingido… consulte a recepção" em vez de "Deseja alterar…?". O comportamento esperado é: tocar num horário livre → "Deseja alterar o horário para …?" → "sim" troca; nunca mais de 1 hora por dia.
- **Problema observado:** A tela decidia entre "reservar" e "trocar" só pelo estado carregado na página (`ownSlot`). Quando esse estado não indicava a reserva própria, a tela tentava criar uma segunda reserva e o servidor recusava com o aviso de limite.
- **Causa:** Não foi possível reproduzir o estado exato de produção localmente (o acesso ao site publicado é bloqueado neste ambiente). O fluxo completo funcionou no teste local, então a correção elimina a dependência: a decisão passa a ser também do servidor.
- **Decisão:** `createGuestReservation`, ao recusar porque o apartamento já tem reserva no dia (e ela é deste hóspede: feita pelo link ou pela recepção), devolve `existingSlot` com o horário atual. A tela então abre o diálogo "Deseja alterar a reserva para …?" em vez do aviso de limite. Reserva de outra estadia do mesmo apartamento continua só recusada. O limite de 1 reserva por dia não muda.
- **O que foi feito:** `src/app/actions/reservations.ts` (`findOwnSlot`, `existingSlot` em `ActionResult`, tipo de conflito em `assertSlotAndApartmentFree`), `src/components/guest-booking.tsx`.
- **Validação:** 170 testes, tsc e ESLint. Em navegador: fluxo normal (reservar 14h, voltar, tocar em livre → diálogo) e tela desatualizada (reserva própria criada depois de a tela carregar; tocar em 21h → diálogo, confirmar → 1 reserva ativa às 21h, sem aviso de limite).
- **Não fazer / evitar regressão:** Não voltar a mostrar "limite diário" ao hóspede que apenas quer trocar o próprio horário; não criar segunda reserva no dia.
- **Pendências:** Conferir em produção com o link real; se ainda falhar, enviar o link/horário e o que aparece na tela (a causa do estado desatualizado segue sem confirmação).
- **Referências:** PR #18, `src/app/actions/reservations.ts`.

### 2026-11-10 — Hóspede troca o horário de uma reserva já feita

- **Status:** Concluído (PR #18 mergeado; migration `20261110200000_guest_reschedule.sql` aplicada em produção em 10/11/2026 antes do merge)
- **Área:** Reservas (hóspede), recepção, banco de dados
- **Pedido:** Se o hóspede quiser trocar o horário de uma reserva, ele entra em "Agendar piscina/academia", escolhe a data, vê os horários e, ao tocar num horário livre (ex.: 22h), aparece "Deseja alterar a reserva para 22h às 23h?".
- **Decisão:** O limite de 1 reserva por apartamento, instalação e dia continua. Com reserva no dia, os outros horários livres ficam tocáveis e servem para TROCAR (antes ficavam cinza com "limite diário"); o horário atual segue cinza. Só vale para reserva do próprio apartamento, feita por este link ou pela recepção; reserva de outra estadia do mesmo apartamento não pode ser trocada; reserva cujo horário já passou também não. A troca é um único UPDATE (o índice único garante que dois hóspedes não ficam no mesmo horário); os avisos de WhatsApp (confirmação/lembrete) voltam a "não enviados", porque falavam do horário antigo. A recepção é avisada ("Horário alterado: ...") pelo mesmo mecanismo de 10 s das reservas novas.
- **O que foi feito:** `changeGuestReservation` e `ownSlot` no resumo do dia (`src/app/actions/reservations.ts`); troca na tela do hóspede com diálogo de confirmação (`src/components/guest-booking.tsx`); `kind: "changed"` nos avisos da recepção (`src/lib/new-reservations.ts`); migration que cria `reservations.guest_rescheduled_at` e faz a auditoria registrar mudança de `slot_start`/`reservation_date` com ator `guest`.
- **Validação:** 166 testes, tsc e ESLint. Em navegador com PostgreSQL real (17 migrations): horário próprio e de outro apartamento em cinza; "Manter" não altera; "Alterar" troca para 22h, mantém 1 reserva ativa, zera os avisos, grava o evento `updated` com ator `guest` e `{slot_start}`, e a recepção foi avisada em 2 s.
- **Impactos e riscos:** A migration é aditiva (coluna anulável + troca do corpo de uma função). O código tolera a migration ainda não aplicada: o aviso de trocas só falha em silêncio e a troca devolve "não foi possível alterar", sem afetar reservas novas. A migration já está aplicada em produção (conferido: coluna `guest_rescheduled_at`, índice, função de auditoria nova com `search_path` vazio, 2 gatilhos ativos, 14 reservas intactas, histórico alinhado com a versão do arquivo).
- **Não fazer / evitar regressão:** Não permitir mais de 1 reserva por dia para o hóspede; não trocar reserva de outra estadia; não apagar o aviso da recepção.
- **Pendências:** Conferir no site publicado, com um link real, a troca de horário e o aviso na recepção.
- **Referências:** `supabase/migrations/20261110200000_guest_reschedule.sql`, `src/app/actions/reservations.ts`, `src/components/guest-booking.tsx`.

### 2026-11-10 — Hóspede não precisa informar nome e WhatsApp de novo

- **Status:** Concluído (PR #16 mergeado; verificado em navegador real contra PostgreSQL local)
- **Área:** Reservas (tela do hóspede)
- **Pedido:** Depois de cadastrar nome e WhatsApp pelo link da recepção, ao clicar em "Agendar piscina/academia" o hóspede deve cair direto na escolha de horários, sem refazer o cadastro.
- **Problema observado:** Os dados ficavam só na memória da página; ao voltar ao início e abrir outra instalação, a identificação aparecia de novo.
- **Decisão:** Guardar nome e WhatsApp no navegador do hóspede (`localStorage`), por apartamento e data de check-out, assim que ele continua na identificação. Na volta, o WhatsApp é revalidado com o mesmo schema do servidor e o hóspede vai direto ao calendário; "Voltar" reabre a identificação preenchida. Só neste aparelho: outro aparelho pede os dados uma vez. Dados de estadias encerradas são apagados.
- **O que foi feito:** `src/lib/guest-contact-storage.ts` (+ teste), `src/components/guest-booking.tsx`.
- **Validação:** 152 testes, tsc e ESLint; em navegador, piscina, academia e F5 vão direto ao calendário e outro aparelho pede os dados.
- **Impactos e riscos:** O WhatsApp fica no aparelho do hóspede até o check-out; aparelho compartilhado por hóspedes do mesmo apartamento usa os mesmos dados (aceito). A validação do servidor não mudou.
- **Não fazer / evitar regressão:** Não gravar o token da estadia no armazenamento; manter a expiração por check-out; não pular a validação do WhatsApp.
- **Pendências:** Opcional: lembrar os dados entre aparelhos (exigiria gravar o contato no servidor).
- **Referências:** `src/lib/guest-contact-storage.ts`, PR #16.

### 2026-11-10 — Hóspede vê as próprias reservas na página inicial

- **Status:** Concluído (PR #15 mergeado; verificado em app real contra PostgreSQL local)
- **Área:** Reservas (página inicial do hóspede)
- **Pedido:** Ao abrir o link da recepção, mostrar acima dos botões os horários já reservados. Ex.: "terça-feira 10/11 - 19h às 20h - piscina".
- **Decisão:** Bloco "Sua reserva / Suas reservas" só com reservas ativas que ainda não terminaram, ordenadas por data e horário, só do apartamento da estadia do link (sem nome, WhatsApp ou observações). Inclui as feitas pelo link e pela recepção; exclui as de outra estadia do mesmo apartamento (filtro em código, sem depender do operador `or` do PostgREST). Sem link válido ou com o banco fora do ar, a página abre normal sem o bloco.
- **O que foi feito:** `src/lib/my-reservations.ts` (+ teste), `listMyReservations()` em `src/app/actions/reservations.ts`, `src/app/page.tsx` (agora assíncrona).
- **Validação:** 148 testes, tsc e ESLint; em app real o bloco mostra as reservas certas, não mostra a de outra estadia e não aparece sem cookie.
- **Impactos e riscos:** A página inicial passa a ser dinâmica (lê o cookie e faz uma consulta leve). O bloco 00h–01h da piscina nunca é tratado como "já terminou" (regra pendente).
- **Não fazer / evitar regressão:** Não exibir dados pessoais nem reservas de outros apartamentos ou estadias.
- **Pendências:** nenhuma.
- **Referências:** `src/lib/my-reservations.ts`, `src/app/page.tsx`, PR #15.

### 2026-11-10 — Hóspede: horários que já passaram somem; indisponíveis só em cinza

- **Status:** Concluído (PR #14 mergeado)
- **Área:** Reservas (tela do hóspede)
- **Pedido:** Na escolha de horário (piscina e academia), não mostrar horários que já passaram. Nos indisponíveis, sem texto e sem riscado: só o horário em cinza.
- **Decisão:** Ajusta a regra do PR #9 (que mostrava tudo em cinza com o motivo escrito): para o hóspede, passado some; ocupado e limite do apartamento continuam visíveis em cinza, sem rótulo (o motivo segue no `aria-label`). A recepção NÃO mudou (reserva retroativa é decisão pendente). Se todos os horários do dia já passaram, aparece "Não há mais horários disponíveis hoje. Escolha outro dia."
- **O que foi feito:** `src/components/guest-booking.tsx`: lista filtrada (`visibleSlots`), removidos rótulo, riscado e `title`.
- **Não fazer / evitar regressão:** A regra de bloqueio no servidor (`slotBlockReason`) continua valendo: esconder na tela não substitui a validação.
- **Pendências:** nenhuma.
- **Referências:** `src/components/guest-booking.tsx`, `src/lib/slot-availability.ts`, PR #9, PR #14.

### 2026-11-10 — QA completo antes da entrega (testes, correções e carga)

- **Status:** Concluído (PR #12 mergeado; aprovado com condições)
- **Área:** Reservas, recepção, autenticação, segurança, infraestrutura
- **Pedido:** Testar o site com agentes para colocá-lo em uso por hóspedes e recepção: etapas funcionais e sem erros, sem conflito de reservas, suporte a vários usuários simultâneos e recepção sempre avisada de novas reservas. Testar e aprovar.
- **Problema observado:** Os agentes encontraram falhas de validação (datas impossíveis, texto com caracteres de controle, observações sem limite, estadia sem limite de dias), duplo clique criando requisição repetida, ausência de cabeçalhos de segurança, IP do login lido do cabeçalho errado e, na segunda rodada, o cookie do hóspede apagado por um erro momentâneo do banco (o hóspede via "estadia expirada" mesmo com o link válido).
- **Causa:** O middleware tratava qualquer falha na consulta da estadia (queda, lentidão, erro 5xx) como "estadia inexistente" e apagava a sessão. As demais falhas eram validações ausentes.
- **Decisão:** A sessão do hóspede só é apagada quando o servidor responde com clareza que a estadia não existe ou venceu (`classifyStayLookup`: ok / invalid / error). Em erro, o hóspede vai para `/indisponivel` e o link continua válido. `getValidatedGuestStay()` lança erro quando o banco falha (retorna `null` só quando não há estadia).
- **O que foi feito:** `src/lib/booking-zod.ts` (datas reais, texto sem caracteres de controle, observações até 2000), limite de estadia de 90 dias em `stays.ts`, `x-real-ip` primeiro no rate limit, cabeçalhos de segurança em `next.config.ts` (X-Frame-Options, CSP frame-ancestors, nosniff, Referrer-Policy, Permissions-Policy), proteção contra duplo clique, `src/lib/guest-stay.ts` + `src/middleware.ts` + `src/app/indisponivel/page.tsx`. Na recepção, o contador no título da aba é reaplicado e os avisos não vistos sobrevivem a F5 (24 h).
- **Resultado:** Ambiente de QA local com PostgreSQL 16 real e uma camada REST própria no lugar do PostgREST (download do PostgREST foi negado). Quatro agentes: funcional, concorrência, segurança e carga. Concorrência: 60 hóspedes no mesmo horário dão exatamente 1 vencedor e 59 recusas, em todas as rajadas. Carga (55 hóspedes + 3 recepcionistas por 5 min): 0 erros 5xx, 0 timeouts, 0 horários ou apartamentos duplicados, todas as 178 reservas vistas pela recepção em até 9,8 s.
- **Validação:** 145 testes unitários, tsc, ESLint e `next build` aprovados na versão final. Em navegador: aviso em 6,9 s, contador sobrevive ao F5, "marcar como vistas" zera. Derrubar e subir o backend: hóspede vai para `/indisponivel`, mantém o cookie e volta a funcionar; token falso vai para `/acesso-negado`. Em produção, o fluxo foi confirmado pelo responsável após o deploy.
- **Impactos e riscos:** Não foram medidos: desempenho real do Supabase/Vercel, redes e navegadores reais, duração acima de 5 min. A latência do aviso é limitada pelo intervalo de 10 s. Se o Vercel não repassar `x-real-ip`/`X-Forwarded-For` como esperado, o bloqueio por tentativas de login pode agrupar pessoas diferentes (não verificado).
- **Não fazer / evitar regressão:** Não apagar o cookie `guest_token` em erro transitório; não exportar constantes (`export const`) de arquivos `"use server"`; não tratar erro de banco como "estadia não encontrada".
- **Pendências:** Decisões do responsável: reserva retroativa pela recepção; semântica do horário 00h–01h da piscina; confirmar o cabeçalho de IP no Vercel.
- **Referências:** PR #12, PR #10, PR #11; `src/middleware.ts`, `src/lib/guest-stay.ts`, `src/lib/booking-zod.ts`, `next.config.ts`.

### 2026-11-10 — LGPD: anonimização também apaga as observações

- **Status:** Concluído (migration aplicada em produção em 10/11/2026 por pedido do responsável)
- **Área:** Banco de dados, LGPD
- **Pedido:** Apagar também as observações (`notes`) das reservas na anonimização.
- **Problema observado:** O job diário de anonimização limpava nome e WhatsApp, mas as observações, texto livre da recepção, podem conter dados pessoais (telefone de familiar, alergias, pedidos) e ficavam guardadas.
- **Causa:** `notes` nunca entrou na rotina original.
- **Decisão:** Depois do fim da estadia as observações não são mais necessárias, então são apagadas junto com nome e WhatsApp.
- **O que foi feito:** `supabase/migrations/20261110100000_lgpd_anonymize_notes.sql`: (1) apaga as `notes` das reservas já anonimizadas, desligando os gatilhos de usuário durante a limpeza para não gerar eventos de auditoria falsos; (2) reagenda o job `lgpd_anonymize_reservations` (03:00 UTC) incluindo `notes = NULL`.
- **Resultado:** Vigente em produção. Conferido depois de aplicar: job `lgpd_anonymize_reservations` ativo (`0 3 * * *`) com `notes = NULL`; os 2 gatilhos da tabela `reservations` ativos (nenhum desligado); 0 reservas anonimizadas com observação restante (já eram 0 antes: o banco estava com 14 reservas, nenhuma anonimizada com observação). Histórico de migrations alinhado com a versão `20261110100000` do arquivo.
- **Validação:** Testada no PostgreSQL 16 local durante o QA (a primeira versão falhou por um gatilho de auditoria; corrigida) e aplicada em produção com as verificações acima.
- **Impactos e riscos:** Apagar observações é irreversível. Exige `pg_cron` (já usado pelo job existente).
- **Não fazer / evitar regressão:** Não remover `notes = NULL` do job; ao mexer em migrations que desligam gatilhos, sempre religar com `ENABLE TRIGGER USER` e conferir `tgenabled`.
- **Pendências:** Conferir, depois da primeira execução às 03:00 UTC com reservas de estadias encerradas, que as observações foram apagadas.
- **Referências:** `supabase/migrations/20261110100000_lgpd_anonymize_notes.sql`, PR #12.

### 2026-11-10 — Aviso de novas reservas para a recepção

- **Status:** Concluído (PR #10 mergeado em 10/11/2026; revalidado na rodada final de QA)
- **Área:** Recepção
- **Pedido:** A recepção precisa SEMPRE saber quando entram novas reservas.
- **Problema observado:** A grade atualizava a cada 30 s, em silêncio e só para o dia e a instalação que estavam na tela. Uma reserva de outro dia ou da outra instalação não aparecia, e nada avisava (sem som, contador ou destaque). Se a internet caísse, ninguém saberia que a tela estava parada.
- **Decisão:** Verificação a cada 10 s, para qualquer dia e instalação (nova ação `listNewReservations`, só para a recepção, sem nome nem WhatsApp). Só reserva feita pelo hóspede gera aviso. Aviso = faixa verde "N novas reservas" com "Ver na grade" e "Marcar como vistas", toast, som de 3 tons (desligável; lembrado no navegador), contador no título da aba e indicador "Novas reservas verificadas às HH:MM:SS". Se a verificação falhar 2 vezes seguidas, aparece o alerta vermelho "Sem conexão com o sistema: novas reservas podem não ser avisadas". O marcador da última verificação fica no navegador (até 24 h), então quem abre a tela depois de um tempo vê o que entrou nesse intervalo. A busca tem sobreposição de 10 s e a tela descarta repetidas pelo id.
- **O que foi feito:** `src/lib/new-reservations.ts`, `listNewReservations` em `src/app/actions/reservations.ts`, `src/app/recepcao/new-reservation-alerts.tsx` e ligação em `reception-dashboard.tsx`; testes unitários.
- **Validação:** 131 testes unitários, ESLint, tsc. Em navegador real, contra PostgreSQL real, 17 verificações passam: aviso em 9,9 s para outra instalação e outro dia, texto correto, sem dados pessoais, título da aba, som, toast, reserva da própria recepção não avisa, "Ver na grade" troca instalação/dia, som desligado não toca mas avisa, alerta de queda de conexão, recuperação sem perder a reserva criada durante a queda, sessão expirada volta ao login, sem erros de console.
- **Impactos e riscos:** Uma consulta leve a cada 10 s por aba da recepção aberta. Abas em segundo plano têm os temporizadores reduzidos pelo navegador (a verificação pode cair para cerca de 1 minuto depois de alguns minutos escondida); o aviso aparece ao voltar para a aba. O navegador só libera o som depois de um clique na página (a tela avisa quando o som está bloqueado). Se a recepção fechar o navegador, não há aviso (não é um aplicativo instalado nem notificação do sistema).
- **Não fazer / evitar regressão:** Não colocar dados pessoais no aviso; não avisar a recepção das reservas que ela mesma cria; manter o alerta de "sem conexão".
- **Pendências:** Opcional: notificação do sistema operacional e aviso por WhatsApp/e-mail para quando ninguém estiver com a tela aberta.
- **Referências:** `src/app/recepcao/new-reservation-alerts.tsx`, `src/lib/new-reservations.ts`.

### 2026-11-10 — Atualização do Next.js por falhas de segurança

- **Status:** Concluído (PR #11 mergeado em 10/11/2026; revalidado no teste integrado da versão final)
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
