// Mermaid é pesado (~1 MB): só carrega quando uma nota tem bloco ```mermaid.
type MermaidApi = typeof import("mermaid").default;

let loader: Promise<MermaidApi> | null = null;
let counter = 0;

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();

function themeVariables() {
  return {
    fontFamily: token("font-sans"),
    background: token("card-bg"),
    primaryColor: token("panel-bg"),
    primaryBorderColor: token("accent-primary"),
    primaryTextColor: token("foreground"),
    secondaryColor: token("accent-canvas-bg"),
    tertiaryColor: token("input-bg"),
    lineColor: token("muted-foreground"),
    textColor: token("foreground"),
    noteBkgColor: token("status-warning-bg"),
    noteTextColor: token("foreground"),
  };
}

async function load(): Promise<MermaidApi> {
  loader ??= import("mermaid").then((m) => m.default);
  const mermaid = await loader;
  // Reinicializa a cada render para acompanhar o tema claro/escuro.
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "base", themeVariables: themeVariables() });
  return mermaid;
}

export async function renderMermaid(source: string): Promise<string> {
  const mermaid = await load();
  const { svg } = await mermaid.render(`mermaid-${++counter}`, source);
  return svg;
}
