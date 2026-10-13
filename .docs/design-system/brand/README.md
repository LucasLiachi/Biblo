# Marca do Biblo: a coruja

A marca é a **coruja sólida** (estilo 02 de `../Corujas minimalistas.pdf`): silhueta preenchida com olhos vazados,
legível de 16 a 64 px.

Tinta azul-noite e um único acento âmbar: o brilho dos olhos e o bico.

## Cores

| Token | Valor | Uso |
| :--- | :--- | :--- |
| `--brand-ink` | `#16213b` | Corpo da coruja e fundo do ícone principal |
| `--brand-amber` | `#f2a33a` | Olhos e bico; corpo da coruja sobre fundo escuro |
| `--brand-paper` | `#f3f4f8` | Fundo claro do ícone |

Os tokens da marca são iguais nos dois temas e **não servem para texto de interface**: texto usa sempre os tokens
`*-fg` (ver `../GOVERNANCA.md`). Âmbar sobre azul-noite mede 7,66:1 (verificado por `ds:check`).

## Arquivos

| Arquivo | Quando usar |
| :--- | :--- |
| `favicon.svg` | Favicon e aba do navegador (é o `app-icon-ink.svg`) |
| `app-icon-ink.svg` | Ícone principal: coruja âmbar em fundo azul-noite. Cabeçalho do app |
| `app-icon-amber.svg` | Variante sobre fundo âmbar (materiais de divulgação) |
| `app-icon-paper.svg` | Variante duotone sobre papel, com sorriso âmbar (fundos claros) |
| `app-icon-outline.svg` | Variante em linha com moldura, para impressão monocromática |
| `owl-solid.svg` | Coruja sem moldura (estados vazios, avatar do Biblo no chat) |
| `owl-duotone.svg` | Coruja sem moldura com olhos e sorriso âmbar |
| `owl-line.svg` | Coruja em traço de 2,5 px (menus e ilustrações leves) |
| `png/favicon-16.png`, `favicon-32.png`, `favicon-48.png` | Navegadores sem suporte a favicon SVG |
| `png/apple-touch-icon.png` (180 px), `icon-192.png`, `icon-512.png` | Atalho na tela inicial e `manifest.webmanifest` |

No React, o componente `BrandMark` (`web/src/components/BrandMark.tsx`) desenha a mesma geometria com os
tokens `--brand-*` (variantes `tile` e `solid`).

## Geometria (viewBox 64 × 64)

- Corpo: `M13 9 L25.5 17.5 C29.5 16.2 34.5 16.2 38.5 17.5 L51 9 L51 37 C51 49 42.5 57.5 32 58 C21.5 57.5 13 49 13 37 Z`
- Olhos: círculos em (24,5; 31) e (39,5; 31), raio 7; pupilas com raio 3,2
- Bico: triângulo (29; 40), (35; 40), (32; 45,5)
- Ícone de app: moldura com `rx = 14`, coruja a 72% e centralizada (`translate(8.96 7.88) scale(0.72)`)

## Regras

- Não distorcer, girar nem trocar as cores fora das quatro variantes acima.
- Área de respiro mínima: 1/8 do lado do ícone.
- Abaixo de 24 px, use só `favicon.svg`/`app-icon-ink.svg`. As variantes em linha perdem legibilidade.
- Os arquivos desta pasta são a fonte. `web/public/brand/` e `web/public/favicon.svg` são cópias geradas por
  `npm run ds:sync` e verificadas por `npm run ds:check`.
- Os PNGs são renderizações de `app-icon-ink.svg` nos tamanhos indicados.
