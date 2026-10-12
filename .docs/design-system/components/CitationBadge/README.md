# CitationBadge

`web/src/components/CitationBadge.tsx` · classes `.citation-badge`, `.citation-badge-canvas`

Botão para uma fonte usada pelo copiloto.

| Tipo | Rótulo | Clique |
| :--- | :--- | :--- |
| Nota (`.citation-badge`) | `caminho.md:linha` | Abre a nota e posiciona o cursor na linha |
| Diagrama (`.citation-badge-canvas`) | `caminho.excalidraw` | Abre o diagrama |

O `title` mostra a seção e o trecho. Texto em `--accent-ai-fg` / `--accent-canvas-fg`; no hover, preenchimento cheio
com `--on-accent`.
