# Biblo — Instruções para Agentes (Codex e Antigravity)

O Biblo é governado pela fonte única de verdade do AILab, em `../.ai/`. Isso vale também em worktrees `../Biblo@<ticket>/`,
que ficam no mesmo nível.

Antes de agir, leia `../AGENTS.md` (raiz do AILab) e siga a ordem de leitura dele
(CONSTITUTION → HANDOFF → RULES → CONTEXT → `rules/<camada>.md`). Antigravity: veja também `../GEMINI.md`.

## Específico do Biblo
- Em concepção: só há `README.md` e `LICENSE`. **Sem spec `BIBLO` aprovada em `../docs/Plan/`, não crie código.**
- Repositório Git próprio. Branch de ticket: `agent/<codex|antigravity>/<ticket-id>`.
- Skills, regras e workflows chegam por symlinks gerados por `../scripts/sync-ai.sh` (`.agents/skills`, `.agents/rules`, `.agent/workflows`).
- Verificação: ainda não há comandos de build/test. A primeira spec do Biblo define os comandos e os registra em `../.ai/CONTEXT.md` § 4.
