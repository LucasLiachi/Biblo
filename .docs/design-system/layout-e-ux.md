# 📐 Arquitetura de Layout e Experiência do Usuário (UX) — Biblo

Este documento detalha a arquitetura de layout, os fluxos de interação, os modos de visualização e as heurísticas de UX projetadas para o **Biblo — Knowledge Studio Local-First**.

---

## 1. Visão Arquitetural do Layout Tripartite

O Biblo organiza o espaço mental do usuário em três painéis funcionais contínuos, articulados sob uma barra de controle superior unificada:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  APP HEADER: 📚 Biblo  |  📁 ./vault  |  ● Watchdog Sincronizado  |  [⌘B] [⌘J] [☀️/🌙]  │
├──────────────────────┬──────────────────────────────────────────┬──────────────────────┤
│      PAINEL 1        │                 PAINEL 2                 │       PAINEL 3       │
│   VAULT EXPLORER     │            WORKSPACE VIEWPORT            │    AI RAG ASSISTANT  │
│                      │                                          │                      │
│ 🔍 Buscar no vault   │ [📄 arch.md] [🎨 fluxo.excalidraw] [+]   │ [ Modelo: Gemini 2.0 ]│
│                      │ ──────────────────────────────────────── │ ──────────────────── │
│ 📁 notas/            │  Modo: [Editor] [Canvas] [Split]         │                      │
│   📄 arch.md         │                                          │ 👤 Como funciona a   │
│   📄 regras.md       │  Área Ativa:                             │    indexação?        │
│ 📁 diagramas/        │  - Editor CodeMirror 6 (Markdown)        │                      │
│   🎨 fluxo.excal     │  - Canvas Excalidraw (Infinito)          │ 🤖 O indexador usa   │
│ 📁 assets/           │                                          │    o watchdog em     │
│                      │                                          │    disco [notas/     │
│ 🔗 Backlinks (3)     │                                          │    arch.md] gerando  │
│                      │                                          │    embeddings... █   │
│                      │                                          │                      │
│  [⌘B para fechar]    │  ● Salvo em disco (debounce 1.5s)        │  [Pergunte à base...]│
└──────────────────────┴──────────────────────────────────────────┴──────────────────────┘
```

### Anatomia dos Painéis:

1. **App Header (Barra Global do Estúdio)**
   - Altura fixa de `44px`.
   - Identidade visual do Biblo com indicação do diretório montado (`./vault`).
   - Indicador de status do Watchdog e banco vetorial (`● Sincronizado` / `⚡ Indexando`).
   - Botões de alternância de painéis laterais com atalhos declarados (`Cmd/Ctrl+B` para Vault, `Cmd/Ctrl+J` para Chat).
   - Seletor de tema e botão de paleta de comandos (`Cmd/Ctrl+K`).

2. **Painel 1: Vault Explorer & Navegação de Conhecimento**
   - Largura padrão: `260px` (redimensionável de `200px` a `420px`; colapsável).
   - Árvore hierárquica fiel aos arquivos em disco (`./vault/notas/`, `./vault/diagramas/`, `./vault/assets/`).
   - Ações rápidas: criar nova nota `.md`, criar novo diagrama `.excalidraw`, criar pasta.
   - Painel inferior recolhível de **Backlinks e Links Bidirecionais** calculados a partir dos `[[wikilinks]]`.

3. **Painel 2: Workspace Viewport (Área de Trabalho Central)**
   - Ocupa todo o espaço flexível central (mínimo `480px`).
   - **Barra de Abas de Documentos (`DocumentTabs`)**: permite alternar rapidamente entre notas e diagramas abertos, com indicação de estado dirty/salvando.
   - **Alternador de Modo de Exibição**:
     - *Modo Editor*: Foco no texto Markdown com CodeMirror 6, suporte a YAML Frontmatter, syntax highlighting e live preview.
     - *Modo Canvas*: Tela infinita com Excalidraw, barra flutuante de ferramentas geométricas e setas inteligentes.
     - *Modo Split (Lado a Lado)*: Exibe nota e diagrama simultaneamente, ideal para documentar e desenhar em paralelo.
   - Barra de status inferior: contagem de palavras, coordenadas do cursor e status de autosave em disco.

4. **Painel 3: Copiloto de IA & Chat com RAG Híbrido**
   - Largura padrão: `360px` (redimensionável de `300px` a `560px`; colapsável).
   - Seletor de Provedor e Modelo de IA (Anthropic Claude, Google Gemini, Ollama Local).
   - Área de conversa com renderização de Markdown e respostas em tempo real via **Server-Sent Events (SSE)** com cursor pulsante.
   - **Citações Clicáveis Interativas**: cada referência retornada pela busca RAG (`[notas/arch.md]`, `[diagramas/fluxo.excalidraw]`) é um elemento clicável que abre o arquivo correspondente no painel central com destaque para o trecho consultado.
   - Barra de input com auto-resize, badge de contexto anexado e atalho `Enter` para envio / `Shift+Enter` para quebra de linha.

---

## 2. Modos de Exibição e Espaço de Trabalho

O Biblo adapta seu layout conforme a tarefa cognitiva do usuário:

| Modo de Layout | Vault Tree | Central Viewport | Chat IA | Caso de Uso Recomendado |
| :--- | :--- | :--- | :--- | :--- |
| **Estúdio Completo (Padrão)** | Visível (260px) | Flexível | Visível (360px) | Pesquisa ativa, consulta à IA enquanto escreve e organiza notas. |
| **Modo Foco / Zen (`Cmd+Shift+F`)** | Oculto | 100% da largura | Oculto | Escrita profunda em Markdown ou sessões imersivas de desenho em Canvas. |
| **Modo Conversa com IA** | Oculto | Flexível | Expandido (480px) | Análise aprofundada de dados da base, cruzamento de raciocínio. |
| **Modo Split Screen** | Visível ou Oculto | 50% Editor / 50% Canvas | Oculto ou Visível | Criação simultânea de especificação técnica e diagrama de arquitetura. |

---

## 3. Fluxos de UX e Ciclos de Vida Local-First

### A. Ciclo de Autosave Silencioso (Local-First)
1. O usuário digita no editor ou move elementos no Canvas.
2. A aplicação ativa um temporizador com **debounce de 1.5s**.
3. Durante o debounce, a aba exibe um ponto sutil de alteração pendente.
4. Ao término do debounce, a aplicação despacha requisição `PUT /api/files/{path}` gravando o arquivo diretamente em disco.
5. O indicador de status muda discretamente para `● Salvo em disco` por 3 segundos e retorna ao estado repouso.
6. Não há janelas modais de bloqueio nem interrupções de fluxo.

### B. Ciclo do Watchdog e Reindexação RAG
1. Um arquivo é criado, editado ou excluído (seja pela interface do Biblo, seja externamente pelo VS Code ou Git).
2. O serviço `watchdog` em Python detecta a alteração no diretório `./vault/`.
3. O parser processa o arquivo:
   - Se for `.excalidraw`, o parser `diagram_to_text` traduz elementos geométricos e conexões para texto semântico estruturado.
   - Se for `.md`, gera chunks com cabeçalhos preservados.
4. Gera embeddings e atualiza o índice no PostgreSQL (`vector(768)` e `tsvector`).
5. A interface exibe no `AppHeader` o indicador pulsante `⚡ Reindexando base` que conclui com `● Sincronizado`.

### C. Ciclo de Consulta com Citação Rastreável
1. O usuário envia uma dúvida no chat: *"Qual o SLA de aprovação de pedidos?"*.
2. A API executa a busca híbrida RRF combinando similaridade de cosseno (HNSW) e busca textual FTS.
3. O prompt do sistema injeta os chunks retornados com metadados de origem identificados.
4. A IA gera a resposta com streaming SSE.
5. Quando o modelo cita um trecho, o frontend reconhece os marcadores e renderiza um `CitationBadge` clicável.
6. Ao clicar no badge, o Biblo abre o arquivo `.md` ou `.excalidraw` no painel central e destaca o bloco referenciado.

---

## 4. Heurísticas de Usabilidade Aplicadas

| Heurística de Nielsen | Implementação no Biblo |
| :--- | :--- |
| **1. Visibilidade do estado do sistema** | Status contínuo do Watchdog no topo, indicador de debounce de autosave ("Salvo há 2s"), cursor pulsante durante streaming SSE da IA. |
| **2. Correspondência com o mundo real** | Pastas e arquivos refletem 1:1 o filesystem do computador. Extensões padrão `.md` e `.excalidraw`. |
| **3. Controle e liberdade do usuário** | Capacidade de fechar ou redimensionar qualquer painel lateral, cancelar resposta de IA em streaming a qualquer momento via botão "Parar". |
| **4. Consistência e padrões** | Cores funcionais padronizadas (violeta para IA, ciano para canvas, esmeralda para disco), atalhos de teclado universais (`Cmd+B`, `Cmd+K`, `Cmd+J`). |
| **5. Prevenção de erros** | Validação `safe_path` impedindo vazamento fora do vault, verificação de `content_hash` antes de sobrescrever arquivos modificados externamente. |
| **6. Reconhecimento em vez de memorização** | Citações clicáveis mostram o nome do arquivo e prévia ao passar o mouse; Paleta de comandos (`Cmd+K`) lista atalhos disponíveis. |
| **7. Flexibilidade e eficiência** | Atendimento tanto a usuários visuais (drag-and-drop, canvas livre) quanto a usuários focados em teclado (Markdown puro e atalhos rápidos). |
| **8. Design estético e minimalista** | Dark Mode com baixo contraste periférico para focar a atenção no conteúdo criativo, sem banners ou elementos de distração. |

---

## 5. Diretrizes de Acessibilidade (WCAG 2.1 AA)

- **Contraste de Cor**:
  - Texto principal (`--foreground`) contra fundos possui razão mínima de **11:1** no Dark Mode e **12:1** no Light Mode (supera com folga o mínimo legal de 4.5:1).
  - Texto secundário (`--muted-foreground`) possui razão mínima de **6:1**.
  - Acentos de IA e ações primárias possuem contraste superior a **4.5:1** em relação aos fundos de superfície.
- **Navegação por Teclado e Foco Visível**:
  - Todos os elementos interativos possuem `:focus-visible` com anel de foco de `2px` em `--focus-ring` e offset de `2px`.
  - Ordem de tabulação lógica: App Header → Vault Tree → Abas do Editor → Conteúdo Ativo → Chat de IA.
- **Áreas de Toque e Clique**:
  - Controles primários e botões possuem área mínima de clique de **36 × 36 px** (desktop) e **44 × 44 px** (dispositivos móveis/tablets).
- **Redução de Movimento**:
  - Diretiva `@media (prefers-reduced-motion: reduce)` zera ou reduz transições para menos de 50ms e desativa pulsações animadas.
