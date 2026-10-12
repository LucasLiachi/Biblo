# Breadcrumb

`web/src/components/Breadcrumb.tsx` · classes `.breadcrumb`, `.breadcrumb-crumb`, `.breadcrumb-crumb.current`, `.breadcrumb-separator`

Mostra o caminho do documento aberto: `vault / pasta / arquivo.ext`, em monoespaçada, na barra do documento. Os
segmentos não são clicáveis. O último usa `.current` e `aria-current="page"`.

Acessibilidade: `<nav aria-label="Caminho no vault">`; separadores com `aria-hidden`.
