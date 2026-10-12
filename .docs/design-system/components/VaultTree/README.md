# VaultTree — Biblo Design System

O componente **VaultTree** representa a árvore hierárquica de arquivos e diretórios do Biblo. Ele reflete de forma 1:1 o conteúdo real do disco em `./vault/`, permitindo navegar entre notas em Markdown (`.md`), diagramas do Excalidraw (`.excalidraw`) e mídias em `assets/`.

---

## 📂 Anatomia e Estados Visuais

1. **Pastas Estruturais (`.tree-folder`)**:
   - Ícone de pasta com estado recolhido/expandido.
   - Pastas fundamentais do Biblo: `notas/`, `diagramas/`, `assets/`.
2. **Arquivos Markdown (`.tree-icon-md`)**:
   - Identificados por ícone azul celeste (`#38bdf8`).
   - Suporte a contagem de backlinks calculados automaticamente pelo indexador.
3. **Diagramas Excalidraw (`.tree-icon-canvas`)**:
   - Identificados por ícone ciano (`#06b6d4`).
   - Indicador visual de desenho semântico preparado para o parser `diagram_to_text`.
4. **Estado Ativo (`.tree-item.active`)**:
   - Destaque sutil com fundo `--tree-active` e texto em `--accent-primary` para o documento aberto no momento.

---

## ♿ Acessibilidade
- Implementado utilizando estrutura semântica `aria-multiselectable="false"` e `role="tree"` / `role="treeitem"`.
- Navegação completa por teclado com setas Cima/Baixo para focar arquivos e Direita/Esquerda para expandir/recolher diretórios.

