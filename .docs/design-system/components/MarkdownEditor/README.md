# MarkdownEditor — Biblo Design System

O componente **MarkdownEditor** define o visual e os padrões de tipografia para o editor de notas baseado em **CodeMirror 6** do Biblo. Ele sustenta a escrita livre de documentação técnica, pesquisas e notas estilo Obsidian com links bidirecionais.

---

## 📝 Recursos Estruturais

1. **Frontmatter YAML (`.editor-frontmatter`)**:
   - Caixa recolhível no topo com borda de acento à esquerda, guardando metadados (`tags`, `status`, `data`, `autores`).
2. **Tipografia de Leitura & Edição**:
   - Cabeçalhos hierárquicos H1, H2, H3 com peso balanceado.
   - Parágrafos confortáveis com line-height de `1.65`.
3. **Links Bidirecionais (`.wikilink`)**:
   - Formato `[[nome-da-nota]]` ou `[[diagrama#seção]]`.
   - Renderizados como links de cor azul-celeste (`--accent-wikilink`) com preview ao passar o mouse e navegação com um clique.
4. **Blocos de Código (`.code-block`)**:
   - Fonte monoespaçada (`JetBrains Mono`), fundo discreto e numeração de linhas.

---

## ♿ Acessibilidade
- Contraste superior a 11:1 entre texto e fundo no Dark Mode.
- Links `[[wikilinks]]` visualmente distinguíveis por cor e sublinhado no hover.

