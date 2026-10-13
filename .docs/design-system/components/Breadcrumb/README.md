# Breadcrumb

`web/src/components/Breadcrumb.tsx` · classes `.breadcrumb`, `.breadcrumb-crumb`, `.breadcrumb-crumb.current`, `.breadcrumb-separator`

Mostra o caminho do documento aberto a partir da biblioteca (`biblioteca / pasta / arquivo.ext`), em monoespaçada,
com o ícone de biblioteca no primeiro segmento. Os segmentos não são clicáveis. O último usa `.current` e `aria-current="page"`.

Acessibilidade: `<nav aria-label="Caminho na biblioteca">`; separadores com `aria-hidden`.
