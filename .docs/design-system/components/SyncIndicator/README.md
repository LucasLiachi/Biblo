# SyncIndicator

`web/src/components/SyncIndicator.tsx` · classes `.sync-indicator`, `.syncing`, `.error`, `.offline` (as duas últimas em `app.css`)

O estado vem de `GET /api/index/status` (consultado a cada 4 s) e da gravação do documento ativo, nesta ordem de
prioridade:

| Texto | Classe | Quando |
| :--- | :--- | :--- |
| Conflito com o disco | `.error` | O arquivo mudou fora do Biblo durante a edição |
| Falha ao gravar | `.error` | A última gravação falhou |
| Salvando… | `.syncing` | Alteração pendente ou gravando |
| Índice offline | `.offline` | Banco desconectado |
| Indexando… | `.syncing` | Indexador ocupado ou com fila |
| Sincronizado · N docs · só texto | `.syncing` | Há trechos sem embedding (provedor indisponível) |
| Sincronizado · N docs | — | Disco e índice em dia |

O `title` traz o detalhe (erro, fila, modo do watcher). Acessibilidade: `role="status"`, `aria-live="polite"`.
