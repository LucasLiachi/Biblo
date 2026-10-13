# Layout e UX

## Layout

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│ AppHeader: coruja Biblo │ Buscar nas bibliotecas (Ctrl K) │ status ⟳ ◧ ◨ ☀          │
├────────────────┬──────────────────────────────────────────────┬───────────────────┤
│ LibraryTree    │ DocumentTabs                                 │ Pergunte p/ Biblo │
│ 260 px         │ barra: biblioteca / caminho · ferramentas    │ 360 px            │
│ BIBLIOTECAS  + │ Estrutura / Backlinks │ Editor Markdown       │ ⚙ ⌫ ✕  escopo     │
│ filtro         │  ou                                          │ modelo · mensagens│
│ ▾ acervo       │ Canvas Excalidraw                            │ citações          │
│   ▸ notas      │ rodapé: estado da gravação · linha · palavras│ entrada           │
│ ▸ pesquisa     │                                              │                   │
└────────────────┴──────────────────────────────────────────────┴───────────────────┘
```

- As laterais têm largura fixa (`--sidebar-library-default`, `--sidebar-chat-default`) e podem ser ocultadas pelos
  botões do cabeçalho, por `Ctrl/Cmd+Shift+B` e `+L`, ou juntas por `Ctrl/Cmd+Shift+F` (modo foco).
- O primeiro nível da árvore só contém bibliotecas, e a única ação nele é "Nova biblioteca". Todo o resto (pastas,
  notas, diagramas, imagens) é criado dentro de uma biblioteca.
- Biblioteca de trabalho: a do documento ativo ou, sem documento, a primeira da lista. "Nova nota" e "Novo diagrama"
  sem pasta indicada criam nela, e o chat Pergunte para o Biblo usa essa biblioteca como escopo padrão.
- Sem documento aberto, a área central mostra a coruja e os botões "Nova nota", "Novo diagrama", "Nova biblioteca" e
  "Buscar". Sem nenhuma biblioteca, mostra só "Nova biblioteca".
- Nota: editor com modos **Editar**, **Dividido** (editor + preview) e **Visualizar**, e, à esquerda do texto, um painel com
  estrutura, backlinks e links de saída que o botão no início da barra mostra ou oculta.
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

**Bibliotecas e pastas**
Criar biblioteca, criar, renomear e excluir itens usam diálogos do próprio app (sem `prompt`/`confirm` do navegador).
Arrastar um item para uma pasta ou para uma biblioteca move o item, inclusive entre bibliotecas. As abas abertas
acompanham a mudança de caminho. Bibliotecas não são arrastadas, renomeadas nem excluídas pela interface.

**Wikilinks**
`[[alvo]]` é resolvido dentro da biblioteca do documento: pelo índice ou, sem índice, pelo nome dos arquivos. Se o
alvo não existe, o app oferece criar a nota na pasta do documento atual.

**Pergunte para o Biblo**
A busca de contexto fica restrita à biblioteca escolhida no seletor do painel (ou a todas). A pergunta, o histórico e
os trechos encontrados vão ao modelo. A resposta chega em streaming, com as fontes como badges.
Sem servidor de LLM ou sem índice, o painel mostra o erro e o botão "Configurar". A engrenagem abre a configuração
da LLM (endereço, token, modelo padrão) e o prompt guia.

**Falhas de interface**
Cada área (bibliotecas, trabalho, chat) fica dentro de um `ErrorBoundary`: um erro mostra a mensagem e "Recarregar
painel" no lugar daquela área, e o resto do app continua funcionando.

## Acessibilidade (WCAG 2.1 AA)

- **Contraste**: os pares de `tokens.json` (`color.contrastPairs`) são medidos nos dois temas por `npm run ds:check`.
  O mínimo é 4,5:1 para texto e 3:1 para foco, contornos e marca.
- **Foco**: `:focus-visible` com anel de 2 px em `--focus-ring`. Diálogos movem o foco para o primeiro campo, fecham com
  `Esc` e devolvem o foco ao sair.
- **Semântica**: árvore (`tree`/`treeitem`/`group`), abas (`tablist`/`tab`), modos do editor (`radiogroup`), paleta
  (`dialog` + `listbox`), estado (`status`, `aria-live`), chat (`aria-live`).
- **Ícones**: todo botão só com ícone tem `aria-label`.
- **Movimento**: `prefers-reduced-motion` reduz transições e animações a 0,01 ms.
