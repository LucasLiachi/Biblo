# DocumentTabs

`web/src/components/DocumentTabs.tsx` · classes `.document-tabs`, `.tabs-group`, `.doc-tab`, `.doc-tab.active`, `.doc-dirty-dot`, `.doc-close-btn`

Uma aba por documento aberto (nota ou diagrama), com ícone do tipo e nome.

- Ponto `.doc-dirty-dot` enquanto há alteração ainda não gravada.
- Fechar: botão ×, clique do meio ou `Alt+W` (`Option+W` no Mac). Antes de fechar, a aba grava o que estiver pendente.
  Em erro ou conflito, ela não fecha.

Acessibilidade: `role="tablist"` / `role="tab"` com `aria-selected`.
