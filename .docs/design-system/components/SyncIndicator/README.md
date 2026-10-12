# SyncIndicator — Biblo Design System

O componente **SyncIndicator** expressa o estado em tempo real da filosofia **Local-First** do Biblo. Ele informa de maneira transparente o status da sincronização com o disco (`./vault/`), a atividade do serviço de monitoramento `watchdog` e a integridade da base vetorial PostgreSQL + pgvector.

---

## 🟢 Estados do Indicador

| Estado | Classe | Visual | Significado |
| :--- | :--- | :--- | :--- |
| **Sincronizado** | `.sync-indicator` | Verde esmeralda com ponto fixo | Todos os arquivos em disco foram indexados no PostgreSQL. |
| **Indexando / Salvando** | `.sync-indicator.syncing` | Âmbar com ponto pulsante animado | O Watchdog detectou alterações ou o debounce de 1.5s está gravando em disco. |
| **Erro de Disco** | `.sync-indicator.error` | Vermelho | Conflito de hash externo ou falha de escrita no filesystem. |

---

## ♿ Acessibilidade
- Elemento com `role="status"` e `aria-live="polite"`.
- O estado não depende apenas de cor: texto descritivo explicita o evento atual.

