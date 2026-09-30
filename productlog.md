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
