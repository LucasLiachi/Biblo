# CommandPalette — Biblo Design System

O componente **CommandPalette** é o mecanismo de busca rápida global e execução de comandos do Biblo Studio. Acionado universalmente pelo atalho `Cmd+K` (Mac) ou `Ctrl+K` (Windows/Linux), ele permite localizar qualquer nota ou diagrama no vault em milissegundos ou disparar ações do estúdio.

---

## 🔍 Funcionalidades

1. **Busca Instantânea no Vault**:
   - Varredura em tempo real por títulos e conteúdo via PostgreSQL FTS e vetores.
   - Ícones distintivos para cada tipo de resultado (`📄 Nota`, `🎨 Diagrama`, `⚙️ Ação do Sistema`).
2. **Navegação por Teclado**:
   - Setas Cima e Baixo para percorrer a lista de itens.
   - `Enter` para abrir o item focado.
   - `Esc` para fechar a paleta.
3. **Indicador de Atalhos**:
   - Cada ação exibe seu respectivo atalho `<kbd>` à direita.

---

## ♿ Acessibilidade
- Implementado com padrão ARIA `role="combobox"` com `aria-expanded="true"` e `aria-controls`.
- Foco automático no campo de busca ao abrir a janela modal.

