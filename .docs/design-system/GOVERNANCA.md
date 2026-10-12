# Proteção do design system

## Fonte e cópias

| Fonte (`.docs/design-system/`) | Cópia gerada (`web/`) |
| :--- | :--- |
| `tokens.css` | `src/styles/tokens.css` |
| `components/bundle.css` | `src/styles/bundle.css` |
| `brand/*.svg`, `brand/png/*.png` | `public/brand/*`, `public/favicon.svg` |

As cópias começam com o cabeçalho `GERADO ... NÃO EDITE`. O mapa fica em `scripts/design-system/shared.mjs`.

```bash
cd web
npm run ds:sync    # copia fonte -> web
npm run ds:check   # verifica as regras abaixo
```

## Regras verificadas por `ds:check` (`scripts/design-system/check.mjs`)

| # | Falha quando |
| :--- | :--- |
| 1 | Uma cópia em `web/` difere da fonte |
| 2 | Uma cor difere entre `tokens.json` e `tokens.css` |
| 3 | Um par de `color.contrastPairs` fica abaixo do mínimo declarado, em qualquer tema |
| 4 | Há cor literal (`#hex`, `rgb()`) em `web/src` (exceto testes e cópias geradas) ou em `components/*.css` |
| 5 | `web/index.html` ou um CSS/HTML do design system carrega recurso de rede externo |
| 6 | `web/index.html` não aponta o favicon para `/favicon.svg` |

Exceção pontual: comentário `ds-allow-hex` ou `ds-allow-url` na mesma linha. A única em uso é
`web/src/lib/excalidraw.ts` (cor de post-it, conteúdo de diagrama).

## Uso de tokens

- **Texto**: `--foreground`, `--muted-foreground` ou `*-fg`. Sobre preenchimento de acento, use `--on-accent`.
- **Bordas translúcidas**: `color-mix(in srgb, var(--token) N%, transparent)`.
- **`--brand-*`**: só na marca.
- **Token novo**: entra nos dois temas de `tokens.css` e em `tokens.json`. Se for texto, ganha um par em
  `contrastPairs`.

## Onde a verificação roda

| Local | Como |
| :--- | :--- |
| Local | `npm run verify` em `web/` (ds:check + typecheck + testes + build) |
| Commit | `scripts/design-system/pre-commit.sh` roda o `ds:check` quando o stage toca `web/`, `.docs/design-system/` ou `scripts/design-system/`. O repositório usa os hooks da raiz do AILab (`core.hooksPath`), que não chamam este script; rode-o manualmente ou pelo `verify` |
| CI | `.github/workflows/verify.yml` (jobs `web` e `api`) em push e pull request |
| Revisão | `.github/CODEOWNERS` atribui `.docs/design-system/`, `scripts/design-system/`, `web/src/styles/` e `.github/` a `@LucasLiachi` |
