# 🏨 Valle D'incanto — Sistema de Reservas

> **Projeto de aprendizado em produção** | Resolvendo problema real | Adquirindo conhecimento em ANÁLISE DE DESENVOLVIMENTO DE SISTEMAS | 📊 Gerando dados para análise

## 🎯 Sobre

Sistema de reservas de piscina e academia para hotel real em Gramado-RS. Desenvolvido como **projeto de aprendizado prático** enquanto curso ADS, aplicando conhecimentos de desenvolvimento, análise de sistemas e **preparação de dados**.

**Cliente Real:** Hotel Valle D'incanto (Gramado-RS)  
**Status:** ✅ Em produção | 🔄 Em desenvolvimento ativo  
**Aprendizado:** Full-stack, produção, testes, banco de dados, **extração de dados para análise**

---

## 💡 Por que existe?

Problema real: Hotel utilizava planilha googlesheets, o que fazia com que ocorrece erros, intercorrências e obrigava os hóspedes a comparecer a recepção para agendamentos.
Precisava de sistema de agendamento online, onde os próprios clientes pudessem agendar seu horário.

Solução: Sistema web moderno que permite hóspedes agendarem sem ligar para recepção, acessando no celular, através de um link gerado pela recepção. 

Resultado: Processo automatizado + dados estruturados + aprendizado prático.

---

## 🛠️ Tech Stack

| Camada | Tecnologia | Por quê |
|--------|-----------|---------|
| **Frontend** | Next.js 15, React, TypeScript | Modern, produção-ready |
| **Styling** | Tailwind CSS | Rápido, escalável |
| **Backend** | Next.js Server Actions, TypeScript | Type-safe, sem extra |
| **Banco Dados** | Supabase (PostgreSQL) | SQL + real-time |
| **Validação** | Zod | Type inference |
| **Deploy** | Vercel | Zero config Next.js |
| **Testes** | Vitest, Playwright | Confiança no código |
| **Telefones** | libphonenumber-js | Valida BR (DDD) e internacionais (E.164) |
| **CI** | GitHub Actions | Keep-alive do Supabase (plano Free) |

---

## 📁 Estrutura

```
Reservas-Piscina-Academia/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── hospede/            # Páginas hóspede
│   │   ├── recepcao/           # Páginas recepção
│   │   └── actions/            # Server actions (API)
│   ├── components/             # React components
│   ├── lib/                    # Utilities, validação, testes
│   └── middleware.ts           # Auth middleware
├── tests/
│   ├── e2e/                    # Testes Playwright
│   └── integration/            # Testes integração
├── supabase/
│   └── migrations/             # SQL migrations
├── docs/                       # Documentação
└── [config files]
```

---

## 🚀 Funcionalidades

### Hóspede
- ✅ Visualizar disponibilidade
- ✅ Agendar piscina/academia
- ✅ Ver agendamentos
- ✅ Cancelar reserva

### Recepção
- ✅ Visualizar todas as reservas
- ✅ Agendar em nome do hóspede
- ✅ Gerenciar capacidades
- ✅ Relatórios básicos

### Sistema
- ✅ Validação de conflitos (horário/lotação)
- ✅ Acesso do hóspede por link com token de estadia; recepção com senha
- ✅ Mensagens de WhatsApp via links `wa.me` (envio manual pela recepção, sem API)
- ✅ Conformidade LGPD

---

## 📚 Aprendizado Contínuo

### O que estou aprendendo fazendo:

**Frontend:**
- React hooks + Next.js 15
- Formulários complexos
- Estado e sincronização
- UX para entrada de dados

**Backend:**
- Database design (relacional, normalized)
- Validação de dados (Zod)
- Autenticação e autorização
- Edge cases (concorrência de agendamentos)
- APIs estruturadas para dados

**Produção:**
- Deploy contínuo (Vercel)
- Monitoring e logs
- Performance
- Escalabilidade

**Testes:**
- Testes unitários (Vitest)
- Testes E2E (Playwright)
- Cobertura
- Edge cases reais

**🔥 Aprendizado com Dados (Foco Atual):**
- **SQL Avançado:** Queries complexas, CTEs, window functions
- **Extração de Dados:** APIs, exports, data dumps
- **Preparação:** Limpeza, normalização, transformação
- **Análise:** Padrões de uso, horários picos, taxa ocupação
- **Visualização:** Preparando dados para Power BI
- **Performance:** Indexação para analytics queries
- **Segurança:** RLS para dados sensíveis

---

## 🔧 Setup Local

### Pré-requisitos
```bash
Node.js 18+
npm ou pnpm
```

### Instalação
```bash
# 1. Clonar
git clone https://github.com/luisdienstmanntd/Reservas-Piscina-Academia.git
cd Reservas-Piscina-Academia

# 2. Instalar dependências
npm install

# 3. Configurar env
cp .env.template .env.local
# Editar .env.local com suas credenciais Supabase, RECEPTION_PASSWORD e SESSION_SECRET (32+ caracteres)

# 4. Rodar localmente
npm run dev

# 5. Acessar
open http://localhost:3000
```

### Testes
```bash
# Unitários
npm run test

# E2E
npm run test:e2e

# Integração
npm run test:integration
```

### Keep-alive do Supabase (plano Free)

O workflow `.github/workflows/supabase-keepalive.yml` executa uma consulta de
leitura mínima no banco duas vezes por dia, com 12 horas de intervalo. Para
ativá-lo, cadastre em **GitHub → Settings → Secrets and variables → Actions**:

- `SUPABASE_URL`: URL do projeto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: chave secreta usada somente pelo workflow.

Depois que o workflow estiver na branch padrão, abra **Actions → Supabase
keep-alive → Run workflow** para validar a configuração. O agendamento roda às
00:17 e 12:17 UTC (21:17 e 09:17 no horário de Brasília). O workflow não cria
nem altera reservas.

---

## 📊 Dados & Análise

### Estado atual
- **Tabelas:** 4 (`reservations`, `active_stays`, `reservation_events`, `login_attempts`), em 12 migrations (`supabase/migrations/`).
- **Testes:** 97 testes unitários (Vitest) + integração de concorrência e cancelamento + E2E (Playwright).
- **Histórico preservado:** cancelar uma reserva só a marca como `cancelled` (com data e autor); a linha permanece no banco.
- **Auditoria:** `updated_at` em toda reserva e a tabela `reservation_events` (criada, editada, cancelada, anonimizada), sem dados pessoais.
- **Camada analítica:** pronta na Fase 3 (schema `analytics` com views sem dados pessoais e role de leitura para o Power BI), e as migrations já estão aplicadas em produção; falta definir a senha da role e montar o relatório. Guia em [`docs/POWERBI.md`](./docs/POWERBI.md).

### Limitações conhecidas
- Sem vínculo reserva ↔ estadia (`stay_id`) para medir a conversão do link.
- Reservas de balcão não têm data de check-out (`NULL`), por não ser informada.
- As observações livres (`notes`) podem conter dados pessoais e não entram na anonimização LGPD.

Detalhes e plano em [`REVISAO_TECNICA.md`](./REVISAO_TECNICA.md).

### Exemplo de consulta (já possível hoje)
```sql
SELECT facility, reservation_date, COUNT(*) AS total
FROM reservations
WHERE status = 'active'
  AND reservation_date > CURRENT_DATE - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY 2 DESC;
```

### SQL Migrations
Veja `supabase/migrations/` para o histórico completo de schema.

---

## 🤖 Como foi desenvolvido (Desenvolvimento + Dados)

**Workflow com IA:**
1. **Entendo requisitos** (sistema + dados necessários)
2. **Uso Claude Code para:**
   - Arquitetar estrutura (app + dados)
   - Gerar componentes React
   - Validações Zod
   - Queries SQL (CRUD + analytics)
   - Scripts de análise (Python)
3. **Reviso, testo, itero** (funcionalidade + qualidade de dados)
4. **Documento decisões** (código + schema)
5. **Deploy** (produção + monitoro dados)
6. **Analiso dados** (insights → próximas melhorias)

**Diferenciais:**
- ✅ Não é "IA gerou tudo". É "IA acelera, eu valido"
- ✅ Sistema estruturado **para gerar dados bons**
- ✅ Queries pensadas **para análise**
- ✅ Logs estruturados **para investigação**
- ✅ Ciclo: dev → produção → dados → análise → melhoria

---

## 📖 Documentação

- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — Como contribuir
- [`docs/SUPABASE_SETUP.md`](./docs/SUPABASE_SETUP.md) — Database
- [`ia.navegation.md`](./ia.navegation.md) — Navegação do código
- [`ROADMAP_TESTES.md`](./ROADMAP_TESTES.md) — Testes
- [`ROADMAP_CORRECOES.md`](./ROADMAP_CORRECOES.md) — Falhas conhecidas e plano de correção
- [`docs/POWERBI.md`](./docs/POWERBI.md) — Conexão, modelo e relatório do Power BI
- [`REVISAO_TECNICA.md`](./REVISAO_TECNICA.md) — Revisão técnica completa
- [`productlog.md`](./productlog.md) — Histórico de decisões do produto

---

## 🔐 Segurança & Conformidade

- ✅ **Banco:** RLS ativo; acesso apenas via Server Actions com service role
- ✅ **Dados:** LGPD (anonimização automática diária via `pg_cron`, grava `NULL` e marca `anonymized`)
- ✅ **Validação:** Zod (server-side) + constraints no banco
- ✅ **HTTPS:** Vercel (automático)
- ✅ **Recepção:** senha + cookie assinado (HMAC, validade de 12h) e limite de 5 tentativas erradas a cada 15 min por IP (exige `SESSION_SECRET`)

---

## 📈 Próximos Passos (Dev + Dados)

### Desenvolvimento (ver [`ROADMAP_CORRECOES.md`](./ROADMAP_CORRECOES.md))
- [x] Fase 1 — Segurança: cookie assinado, rate limit no login, timeout no middleware
- [x] Fase 2 — Cancelamento sem apagar, checkout honesto no balcão, `updated_at`/auditoria, LGPD com `NULL`
- [ ] Fase 4 — Bloquear horário já passado, datas por string, restringir consulta do hóspede
- [ ] Aprofundar testes E2E ([`ROADMAP_TESTES.md`](./ROADMAP_TESTES.md))
- [x] Keep-alive do Supabase via GitHub Actions

### Dados & Análise 🔥 (Fase 3 do roadmap)
- [ ] Schema `analytics` + views sem dados pessoais (preparado, falta aplicar em produção)
- [ ] Role somente-leitura para Power BI (preparada, falta definir a senha)
- [ ] Dashboard Power BI (ocupação, cancelamentos, origem, antecedência)
- [ ] Scripts Python para análise exploratória

### Resultados
- Sistema funcionando + **dados reais analisáveis**
- Aprendo dev + **análise com dados verdadeiros**

---

## 🤝 Contribuições

Feedback e melhorias são bem-vindas! Veja [`CONTRIBUTING.md`](./CONTRIBUTING.md).

---

## 📄 Licença

MIT — Use livremente

---

## 🔗 Links

- **Endereço oficial:** https://agendamentosvallledincanto.vercel.app
- **Recepção:** https://agendamentosvallledincanto.vercel.app/recepcao (os links dos hóspedes são gerados a partir do endereço em que a recepção está logada; use sempre este)
- **Repositório:** https://github.com/luisdienstmanntd/Reservas-Piscina-Academia
- **Autor:** [Luis Dienstmann](https://github.com/luisdienstmanntd)

---

**Status:** ✅ Produção | 📚 Aprendizado contínuo | 🎓 ADS/DevClub

*Último update: Novembro 2026 (Fases 1 e 2 do roadmap concluídas)*
