import { useLayoutEffect, useMemo, useRef } from "react";

import { renderMarkdown } from "../lib/markdown";
import { renderMermaid } from "../lib/mermaid";

interface MarkdownPreviewProps {
  source: string;
  theme: "dark" | "light";
  onOpenLink: (target: string) => void;
  onToggleTask?: (line: number) => void;
}

export function MarkdownPreview({ source, theme, onOpenLink, onToggleTask }: MarkdownPreviewProps) {
  const ref = useRef<HTMLElement>(null);
  const html = useMemo(() => renderMarkdown(source), [source]);

  // O HTML é aplicado aqui, e não via dangerouslySetInnerHTML: o React reaplicaria o markup a cada
  // re-render do pai e apagaria os SVGs que o Mermaid injeta depois.
  useLayoutEffect(() => {
    const article = ref.current;
    if (!article) return;
    article.innerHTML = html; // markdown-it sem HTML bruto + DOMPurify (lib/markdown.ts)
    let cancelled = false;
    article.querySelectorAll<HTMLElement>(".mermaid-block").forEach(async (block) => {
      const code = block.querySelector(".mermaid-source")?.textContent ?? "";
      try {
        const svg = await renderMermaid(code);
        if (!cancelled) block.innerHTML = svg; // saída do Mermaid em securityLevel "strict"
      } catch (err) {
        if (cancelled) return;
        const pre = document.createElement("pre");
        pre.className = "mermaid-error";
        pre.textContent = `Diagrama Mermaid inválido: ${err instanceof Error ? err.message : String(err)}`;
        block.replaceChildren(pre);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [html, theme]);

  return (
    <article
      ref={ref}
      className="md-preview"
      onClick={(e) => {
        const target = e.target as HTMLElement;
        const link = target.closest<HTMLElement>("[data-wikilink]");
        const task = target.closest<HTMLElement>("[data-task-line]");
        if (link) {
          e.preventDefault();
          onOpenLink(link.dataset.wikilink ?? "");
        } else if (task && onToggleTask) {
          onToggleTask(Number(task.dataset.taskLine));
        }
      }}
      onKeyDown={(e) => {
        const task = (e.target as HTMLElement).closest<HTMLElement>("[data-task-line]");
        if (task && onToggleTask && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          onToggleTask(Number(task.dataset.taskLine));
        }
      }}
    />
  );
}
