# Breadcrumb — Biblo Design System

O componente **Breadcrumb** mapeia a localização exata do documento aberto no painel central em relação à raiz do repositório de conhecimento local (`./vault/`).

---

## 🧭 Formato e Convenção

- **Raiz do Vault**: Sempre inicia com `vault` em monoespaçado.
- **Diretórios Intermediários**: Pastas clicáveis (`notas`, `diagramas`, subdiretórios) que abrem ou filtram o `VaultTree`.
- **Documento Ativo**: Nome do arquivo com extensão (`.md` ou `.excalidraw`), em negrito e `aria-current="page"`.
- **Separador**: Barra discreta `/` em cor `--muted`.

---

## ♿ Acessibilidade
- Implementado utilizando `<nav aria-label="Caminho do documento">` e lista semântica `<ol>`.
- O item final é marcado com `aria-current="page"` para informar leitores de tela sobre a localização atual.
