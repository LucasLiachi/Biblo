# Biblo — Adaptador Claude Code

O Biblo é governado pelo SSOT do AILab (`../.ai/`). O `CLAUDE.md` da raiz do AILab é carregado como ancestral e importa
CONSTITUTION, CONTEXT, RULES e HANDOFF. Aqui fica só o que é específico do Biblo.

## Específico do Biblo
- **Repositório Git próprio**: commits vão para `Biblo/`.
- **Worktree de ticket**: `git -C Biblo worktree add ../Biblo@<ticket> -b agent/claude-code/<ticket>` (`../.ai/RULES.md` § 3).
- **Stack**: React 19 + Vite 8 + CodeMirror 6 + Excalidraw 0.18 (`web/`); FastAPI + asyncpg + watchdog (`api/`);
  PostgreSQL 17 + pgvector na rede interna. Web em `127.0.0.1:2010`, API em `127.0.0.1:2011`.
- **Documentação**: `.docs/arquitetura.md` (serviços, API, índice, frontend, configuração), `.docs/backend.md` (regras
  do backend), `.docs/design-system/` (tokens, componentes, marca, proteção).
- **Verificação**: `docker compose --profile test run --rm biblo_api_test` (backend) e `cd web && npm run verify`
  (design system + typecheck + testes + build).
- **Design system**: edite só `.docs/design-system/` e rode `npm run ds:sync`. `web/src/styles/tokens.css`,
  `web/src/styles/bundle.css` e `web/public/brand/*` são cópias geradas.
- **Vault**: `./vault` é dado do usuário e fica fora do Git. Testes nunca escrevem nele.

## Ponte de IA (gerada por `../scripts/sync-ai.sh`, não edite)
`.claude/skills`, `.claude/agents`, `.agents/skills`, `.agents/rules`, `.agent/workflows` → SSOT na raiz.
