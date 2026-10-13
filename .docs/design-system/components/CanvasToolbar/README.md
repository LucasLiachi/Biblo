# Canvas (Excalidraw)

`web/src/components/DiagramCanvas.tsx` · classes `.canvas-autosave-badge`, `.canvas-notice`, `.canvas-host` (`web/src/styles/app.css`)

O canvas é o `@excalidraw/excalidraw` 0.18, com a barra de ferramentas e os atalhos dele, carregado sob demanda.

| Recurso | Comportamento |
| :--- | :--- |
| Gravação | `serializeAsJSON(..., "local")` 250 ms depois da mudança de cena e autosave 1,5 s depois. Cursor, zoom e seleção não gravam |
| Badge | "Gravado em disco", "Gravando…", "Conflito com o disco", "Falha ao gravar" |
| Tema e idioma | Segue o tema do Biblo; `langCode="pt-BR"` |
| Menu principal | Salvar como imagem, Exportar, Buscar, Limpar canvas, Fundo do canvas, Ajuda |
| Fontes | Servidas de `/excalidraw-assets/` |
| Mermaid → diagrama | Menu de ferramentas extras do Excalidraw |
| Arquivo fora do formato nativo | Convertido na abertura (`web/src/lib/excalidraw.ts`) com aviso; só é regravado ao editar |

Setas ligadas a formas viram relações no índice (`Origem --[rótulo]--> Destino`).
