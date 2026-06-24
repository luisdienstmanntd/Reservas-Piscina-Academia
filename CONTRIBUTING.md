# 🤝 Contribuindo para este projeto

Obrigado por se interessar em contribuir ao Valle D'incanto!

## Fluxo de contribuição

1. **Fork** o repositório
2. Crie uma branch para sua feature:
```bash
   git checkout -b feature/nome-da-feature
```
3. Faça seus commits seguindo o padrão (ver abaixo)
4. Push para sua branch:
```bash
   git push origin feature/nome-da-feature
```
5. Abra um **Pull Request**

## Padrão de commits (Conventional Commits)

Use este padrão para manter histórico limpo:

| Tipo | Uso | Exemplo |
|------|-----|---------|
| `feat` | Nova feature | `feat(dashboard): adicionar gráfico de ocupação` |
| `fix` | Bugfix | `fix(auth): resolver validação de token` |
| `docs` | Documentação | `docs: atualizar guia de setup` |
| `test` | Testes | `test: adicionar E2E para booking` |
| `chore` | Dependências, build | `chore: atualizar Next.js para 15.5` |

### Exemplos bons:
```bash
git commit -m "feat(reservations): add guest WhatsApp notifications"
git commit -m "fix(middleware): resolve token expiration on /hospede"
git commit -m "docs: update README with deployment instructions"
```

### Evitar:
```bash
git commit -m "fix stuff"
git commit -m "asdf"
git commit -m "update"
```

## Padrão de código

- ✅ TypeScript com tipos explícitos
- ✅ Zod para validação
- ✅ Componentes funcionais com hooks
- ✅ Commits descritivos (1 feature por commit)
- ❌ `console.log` em produção
- ❌ `any` em TypeScript

## Dúvidas ou bugs?

- Abra uma **Issue** para discussão
- Se encontrar bug, crie issue com título `[BUG]`

Obrigado por contribuir! 🎉