# Biblo — Instruções para Agentes (Codex e Antigravity)

O Biblo é governado pela fonte única de verdade do AILab, em `../.ai/`. Isso vale também em worktrees `../Biblo@<ticket>/`,
que ficam no mesmo nível.

Antes de agir, leia `../AGENTS.md` (raiz do AILab) e siga a ordem de leitura dele
(CONSTITUTION → HANDOFF → RULES → CONTEXT → `rules/<camada>.md`). Antigravity: veja também `../GEMINI.md`.

## Específico do Biblo
- Repositório Git próprio. Branch de ticket: `agent/<codex|antigravity>/<ticket-id>`.
- Skills, regras e workflows chegam por symlinks gerados por `../scripts/sync-ai.sh` (`.agents/skills`, `.agents/rules`, `.agent/workflows`).
- Documentação: `.docs/arquitetura.md`, `.docs/backend.md`, `.docs/design-system/`.
- Verificação: `docker compose --profile test run --rm biblo_api_test` e `cd web && npm run verify`.
- Design system: edite só `.docs/design-system/` e rode `npm run ds:sync`; as cópias em `web/` são geradas.
- `./vault` é dado do usuário: testes nunca escrevem nele.
