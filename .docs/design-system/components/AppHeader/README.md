# AppHeader — Biblo Design System

O componente **AppHeader** é a barra de controle superior global do Biblo Studio. Ocupa a faixa de `44px` no topo da tela e fornece orientação imediata sobre a fonte da verdade local, a integridade da sincronização e os alternadores de painéis.

---

## 📐 Anatomia do Componente

1. **Brand & Local-First Indicator (Esquerda)**:
   - Identidade visual do Biblo com ícone de estúdio de conhecimento.
   - Badge com o caminho real do vault em disco (`./vault`), reforçando o modelo local-first.
2. **Status de Sincronização & Watchdog (Centro)**:
   - Indicador dinâmico do serviço Watchdog em Python (`● Sincronizado` ou `⚡ Indexando`).
3. **Controles e Ações Globais (Direita)**:
   - Atalho para a Paleta de Comandos (`Cmd+K`).
   - Botão para alternar Painel do Vault (`Cmd+B`).
   - Botão para alternar Painel de Chat com IA (`Cmd+J`).
   - Alternador de tema Claro / Escuro.

---

## ♿ Acessibilidade
- Implementado como landmark `<header>` com `role="banner"`.
- Todos os botões de alternância possuem `aria-expanded` e `aria-label` associados.
- Atalhos universais expostos em tags visuais para memorização sem sobrecarga cognitiva.

