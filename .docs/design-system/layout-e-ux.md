# Layout e UX

## Layout

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│ AppHeader: coruja Biblo · ./vault │ Buscar no vault (Ctrl K) │ status ⟳ ◧ ◨ ☀       │
├────────────────┬──────────────────────────────────────────────┬───────────────────┤
│ VaultTree      │ DocumentTabs                                 │ ChatPanel         │
│ 260 px         │ barra do documento: caminho · ferramentas    │ 360 px            │
│                │ Editor Markdown │ Estrutura / Backlinks       │                   │
│ filtro         │  ou                                          │ modelo · mensagens│
│ árvore         │ Canvas Excalidraw                            │ citações          │
│                │ rodapé: estado da gravação · linha · palavras│ entrada           │
└────────────────┴──────────────────────────────────────────────┴───────────────────┘
```

- As laterais têm largura fixa (`--sidebar-vault-default`, `--sidebar-chat-default`) e podem ser ocultadas pelos
  botões do cabeçalho, por `Ctrl/Cmd+Shift+B` e `+L`, ou juntas por `Ctrl/Cmd+Shift+F` (modo foco).
- Sem documento aberto, a área central mostra a coruja e os botões "Nova nota", "Novo diagrama" e "Buscar".
- Nota: editor com modos **Editar**, **Dividido** (editor + preview) e **Visualizar**, e um painel lateral com estrutura,
  backlinks e links de saída que pode ser ocultado.
- Diagrama: o canvas ocupa toda a área central.

## Fluxos

**Gravação**
1. Cada alteração marca o documento como pendente (ponto na aba, "Alterado…" no rodapé).
2. 1,5 s depois da última alteração, o app grava com `If-Match`. `Ctrl/Cmd+S` grava na hora.
3. Resposta 409 (o arquivo mudou fora do Biblo): o autosave do documento para e abre o modal com três opções:
   "Salvar a minha como cópia", "Usar a do disco" e "Manter a minha". O modal não fecha sem escolha.
4. Fechar uma aba ou renomear/mover grava antes o que estiver pendente.

**Mudanças externas**
A cada 4 s e ao voltar o foco para a janela, o app relê a árvore, o estado do índice e o documento ativo. Se o
documento estiver gravado e o disco mudou, o conteúdo é trocado pelo do disco. Se o arquivo sumiu, o documento entra em
erro e mantém o texto na tela.

**Pastas**
Criar, renomear e excluir usam diálogos do próprio app (sem `prompt`/`confirm` do navegador). Arrastar um item para uma
pasta, ou para a área vazia da árvore, move o item. As abas abertas acompanham a mudança de caminho.

**Wikilinks**
`[[alvo]]` é resolvido pelo índice. Sem índice, pelo nome dos arquivos. Se o alvo não existe, o app oferece criar a
nota na pasta do documento atual.

**Copiloto**
A pergunta, o histórico e os trechos encontrados vão ao modelo. A resposta chega em streaming, com as fontes como badges.
Sem gateway ou sem índice, o painel mostra o erro.

## Acessibilidade (WCAG 2.1 AA)

- **Contraste**: os pares de `tokens.json` (`color.contrastPairs`) são medidos nos dois temas por `npm run ds:check`.
  O mínimo é 4,5:1 para texto e 3:1 para foco, contornos e marca.
- **Foco**: `:focus-visible` com anel de 2 px em `--focus-ring`. Diálogos movem o foco para o primeiro campo, fecham com
  `Esc` e devolvem o foco ao sair.
- **Semântica**: árvore (`tree`/`treeitem`/`group`), abas (`tablist`/`tab`), modos do editor (`radiogroup`), paleta
  (`dialog` + `listbox`), estado (`status`, `aria-live`), chat (`aria-live`).
- **Ícones**: todo botão só com ícone tem `aria-label`.
- **Movimento**: `prefers-reduced-motion` reduz transições e animações a 0,01 ms.
