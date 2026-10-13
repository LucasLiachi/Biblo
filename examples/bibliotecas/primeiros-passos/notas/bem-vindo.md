---
title: Bem-vindo ao Biblo
tags: [inicio]
---
# Bem-vindo ao Biblo

Esta nota está na biblioteca **primeiros-passos**. Cada biblioteca é uma pasta mestra em `bibliotecas/` com materiais
dedicados a um assunto, guardados como **arquivos comuns**: dá para abrir no VS Code, versionar com Git ou copiar para
backup. O banco de dados é só um índice: se ele sumir, o Biblo reconstrói tudo a partir do disco.

## O que dá para fazer

- [ ] Escrever notas em Markdown, com `[[wikilinks]]` entre notas da mesma biblioteca
- [ ] Desenhar diagramas e fluxos no canvas Excalidraw (`.excalidraw`)
- [ ] Perguntar ao copiloto sobre os materiais da biblioteca, com citações clicáveis
- [ ] Organizar pastas dentro da biblioteca: criar, renomear, arrastar para mover e excluir
- [ ] Criar outras bibliotecas para outros assuntos

## Fluxos dentro da nota

```mermaid
flowchart LR
  N[Nota .md] -->|indexa| I[(Índice)]
  D[Diagrama .excalidraw] -->|diagram_to_text| I
  I -->|busca híbrida| C[Copiloto]
  C -->|cita| N
```

## Atalhos

| Ação | Atalho |
| --- | --- |
| Buscar arquivos e conteúdo | `Ctrl K` |
| Negrito / itálico | `Ctrl B` / `Ctrl I` |
| Abrir link sob o cursor | `Ctrl` + clique |
| Salvar agora | `Ctrl S` |
| Fechar aba | `Alt W` |
| Painel de bibliotecas / copiloto | `Ctrl Shift B` / `Ctrl Shift L` |
| Modo foco (oculta as laterais) | `Ctrl Shift F` |
