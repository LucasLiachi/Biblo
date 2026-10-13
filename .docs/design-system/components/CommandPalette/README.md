# CommandPalette

`web/src/components/CommandPalette.tsx` · classes `.command-palette`, `.command-input-wrapper`, `.command-input`, `.command-results`, `.command-item`

Abre com `Ctrl/Cmd+K` ou pelo botão do cabeçalho.

| Grupo | Conteúdo |
| :--- | :--- |
| Arquivos | Até 8 notas e diagramas cujo caminho contém o texto digitado |
| No conteúdo | `GET /api/search` a partir de 3 caracteres (250 ms de espera); abre na linha do trecho |
| Comandos | Nova nota, Novo diagrama (na biblioteca atual), Nova biblioteca, Alternar tema |

Teclado: setas navegam, `Enter` executa, `Esc` fecha. Acessibilidade: `role="dialog"`, lista `role="listbox"`, campo
com `aria-activedescendant`.
