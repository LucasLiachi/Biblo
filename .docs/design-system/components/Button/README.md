# Button — Biblo Design System

O componente **Button** padroniza todas as ações interativas do Biblo Studio. Projetado para suportar densidade profissional e comandos combinados com teclas de atalho de teclado (`kbd`).

---

## 🎨 Variantes do Biblo

| Classe | Finalidade no Estúdio | Exemplo de Uso |
| :--- | :--- | :--- |
| `.btn-primary` | Ação de maior hierarquia na visão atual | "Salvar nota agora", "Indexar vault" |
| `.btn-secondary` | Ações de apoio estrutural | "Novo arquivo", "Exportar PNG" |
| `.btn-ghost` | Ações de baixa ênfase e barras de ferramentas | "Ocultar painel", "Limpar filtros" |
| `.btn-ai` | Ações conduzidas pelo copiloto de IA | "Sugerir conexões", "Resumir diagrama" |
| `.btn-danger` | Ações destrutivas com impacto em disco | "Excluir nota", "Remover do vault" |
| `.btn-icon` | Botões compactos de cabeçalho e utilitários | Alternar tema, fechar abas |

---

## ⌨️ Integração com Atalhos de Teclado
Botões críticos para o fluxo de trabalho de notas e diagramas incluem o componente visual `<kbd class="kbd">`:
```html
<button class="btn btn-primary" type="button">
  <span>Salvar</span>
  <kbd class="kbd">⌘S</kbd>
</button>
```

---

## ♿ Acessibilidade (WCAG 2.1 AA)
- Todos os botões possuem `:focus-visible` com anel de foco em `--focus-ring`.
- Botões que contêm apenas ícones (`.btn-icon`) **obrigatoriamente** recebem `aria-label` descritivo.
- Alvos de toque respeitam a área mínima recomendada de 32 × 32 px em desktop com padding estendido para mobile.
