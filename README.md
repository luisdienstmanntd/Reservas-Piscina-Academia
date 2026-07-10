# 🏨 Valle D'incanto — Sistema de Reservas

> **Projeto de aprendizado em produção** | Resolvendo problema real | Adquirindo conhecimento em ADS | 📊 Gerando dados para análise

## 🎯 Sobre

Sistema de reservas de piscina e academia para hotel real em Canela-RS. Desenvolvido como **projeto de aprendizado prático** enquanto curso ADS, aplicando conhecimentos de desenvolvimento, análise de sistemas e **preparação de dados**.

**Cliente Real:** Hotel Valle D'incanto (Canela-RS)  
**Status:** ✅ Em produção | 🔄 Em desenvolvimento ativo  
**Aprendizado:** Full-stack, produção, testes, banco de dados, **extração de dados para análise**

---

## 💡 Por que existe?

Problema real: Hotel precisava de sistema de agendamento online para piscina e academia.

Solução: Sistema web moderno que permite hóspedes agendarem sem ligar para recepção.

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
- ✅ Autenticação (Firebase/Supabase)
- ✅ Notificações (WhatsApp)
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
# Editar .env.local com suas credenciais Supabase

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

---

## 📊 Dados & Análise

### Estrutura para Análise
- **Tabelas:** 6+ (reservations, stays, users, facilities, logs)
- **Queries:** 15+ operações CRUD + **queries analytics**
- **Validações:** 20+ Zod schemas
- **Testes:** 40+ casos
- **Logs estruturados:** Todas ações registradas

### Recursos para Dados
```sql
-- Exemplo: Análise de ocupação por horário
SELECT 
  date_trunc('hour', reservation_date) as hour,
  facility,
  COUNT(*) as total_reservations,
  COUNT(DISTINCT user_id) as unique_guests
FROM reservations
WHERE reservation_date > NOW() - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY 1 DESC;

-- Views criadas para analytics
- v_daily_occupancy
- v_guest_behavior
- v_facility_performance
- v_time_series_bookings
```

### Dados Disponíveis para Análise
- ✅ Horários mais procurados (ocupação)
- ✅ Padrões de hóspede (quem/quando)
- ✅ Taxa ocupação por facility
- ✅ Cancelamentos (pattern analysis)
- ✅ Previsão de demanda
- ✅ Relatório de capacidade

### SQL Migrations
Veja `supabase/migrations/` para histórico completo de schema (7+ migrations com evolução de dados).

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
- [`ia.navegacao.md`](./ia.navegacao.md) — Navegação do código
- [`ROADMAP_TESTES.md`](./ROADMAP_TESTES.md) — Testes

---

## 🔐 Segurança & Conformidade

- ✅ **Auth:** Supabase + Row Level Security
- ✅ **Dados:** LGPD (anonimização automática)
- ✅ **Validação:** Zod (server-side)
- ✅ **HTTPS:** Vercel (automático)
- ✅ **Variáveis:** Env protegidas

---

## 📈 Próximos Passos (Dev + Dados)

### Desenvolvimento
- [ ] Aprofundar testes E2E (Fase 4)
- [ ] CI/CD (GitHub Actions)
- [ ] Migração PostgreSQL (Neon/Supabase)

### Dados & Análise 🔥
- [ ] Dashboard Power BI (ocupação, padrões)
- [ ] Scripts Python para análise exploratória
- [ ] Previsão de demanda (ML basics)
- [ ] API de dados (export estruturado)
- [ ] Análise de comportamento de hóspede
- [ ] Relatório semanal automatizado
- [ ] Integração com ferramentas BI

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

- **Live:** https://valle-piscina-academia.vercel.app
- **Repositório:** https://github.com/luisdienstmanntd/Reservas-Piscina-Academia
- **Autor:** [Luis Dienstmann](https://github.com/luisdienstmanntd)

---

**Status:** ✅ Produção | 📚 Aprendizado contínuo | 🎓 ADS/DevClub

*Último update: Junho 2026*
