# Biblo — Adaptador Claude Code

O Biblo é governado pelo SSOT do AILab (`../.ai/`). O `CLAUDE.md` da raiz do AILab é carregado como ancestral e importa
CONSTITUTION, CONTEXT, RULES e HANDOFF. Aqui fica só o que é específico do Biblo.

## Específico do Biblo
- **Estado**: em concepção. O repositório só tem `README.md` (visão, stack e arquitetura planejadas) e `LICENSE`. Não há código.
- **Repositório Git próprio**: commits vão para `Biblo/`. Specs ficam em `../docs/Plan/` com módulo `BIBLO`
  (ex.: `FEAT_BIBLO_<DESCRICAO>.md`). O primeiro código do Biblo nasce de uma spec aprovada (Gate Humano).
- **Worktree de ticket**: `git -C Biblo worktree add ../Biblo@<ticket> -b agent/claude-code/<ticket>` (`../.ai/RULES.md` § 3).
- **Stack planejada** (`README.md`, não verificada em código): React 19 + Vite, FastAPI (Python 3.11+),
  PostgreSQL 17 + pgvector, watchdog. Portas citadas (`3000`, `8000`, `5432`) **colidem** com a máquina: ver `../.ai/CONTEXT.md` § 2.
- **Regras de camada**: ainda não há regras específicas de Python/FastAPI. A primeira spec do Biblo deve propor
  `../.ai/rules/backend.md` § Biblo, a partir do código que criar.

## Ponte de IA (gerada por `../scripts/sync-ai.sh`, não edite)
`.claude/skills`, `.claude/agents`, `.agents/skills`, `.agents/rules`, `.agent/workflows` → SSOT na raiz.
