# CanvasToolbar — Biblo Design System

O componente **CanvasToolbar** é a barra flutuante de ferramentas de desenho do `@excalidraw/excalidraw` integrada ao Biblo. Ela fica suspensa sobre a tela infinita, garantindo acesso instantâneo a formas geométricas, conexões lógicas e feedback de autosave local.

---

## 🎨 Ferramentas e Funcionalidades

1. **Ferramentas de Desenho**:
   - **Seleção (`V`)**: Manipular e agrupar elementos.
   - **Retângulo (`R`)**: Caixas de módulos e serviços.
   - **Losango (`D`)**: Pontos de decisão lógica em fluxos.
   - **Elipse (`O`)**: Eventos de início e término.
   - **Seta Magnética (`A`)**: Conectores relacionais entre caixas (essenciais para o parser `diagram_to_text`).
   - **Texto Livre (`T`)**: Anotações e legendas técnicas.
   - **Pan / Mão (`H`)**: Deslocamento livre pela tela infinita.
2. **Controle de Zoom e Centralização**:
   - Zoom in, Zoom out e Reset (100%).
3. **Indicador de Autosave Silencioso**:
   - Badge com status de gravação direta no arquivo JSON `.excalidraw` dentro de `./vault/diagramas/`.

---

## ♿ Acessibilidade
- Cada botão de ferramenta possui tecla de atalho de letra única equivalente ao padrão Excalidraw.
- `aria-pressed="true"` no botão da ferramenta atualmente ativa.

